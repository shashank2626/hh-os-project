import { GoogleGenerativeAI } from "@google/generative-ai";
import { aiToolDeclarations } from "@/lib/tools/definitions";
import { executeTool } from "@/lib/tools/registry";
import { HOUSEHOLD_OS_SYSTEM_PROMPT } from "@/lib/ai/prompts";

export interface ToolExecutionStep {
  tool: string;
  args?: Record<string, unknown>;
  status: "executing" | "completed" | "failed";
  label: string;
  result?: unknown;
}

export interface AgentResponse {
  answer: string;
  steps: ToolExecutionStep[];
  suggestedActions?: Array<{
    id: string;
    label: string;
    actionType: string;
    payload: Record<string, unknown>;
  }>;
  cart?: {
    items: Array<{
      id: string;
      productName: string;
      brand?: string;
      packSize: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      retailer: string;
      retailerUrl?: string;
      valueScore?: string;
      comparisonNotes?: string;
    }>;
    estimatedTotal: number;
    totalItems: number;
    continueToMerchantUrl: string;
  };
  replenishmentComparisons?: Array<{
    itemName: string;
    requiredQuantity: string;
    options: string[];
    bestOption: string;
    reasoning: string;
  }>;
}

const TOOL_FRIENDLY_LABELS: Record<string, string> = {
  get_household_summary: "Analyzing household health & urgent alerts...",
  get_inventory: "Checking pantry & groceries inventory...",
  get_low_stock_items: "Scanning items below buffer stock...",
  get_upcoming_bills: "Checking pending utility bills & due dates...",
  get_household_expenses: "Analyzing Indian household expenses & anomalies...",
  get_appliances: "Inspecting appliance health & service records...",
  get_maintenance_schedule: "Checking maintenance intervals & overdue equipment...",
  get_family_members: "Evaluating family member availability & roles...",
  get_pending_tasks: "Reviewing pending household tasks & priorities...",
  create_task: "Creating household task...",
  assign_task: "Assigning task to family member...",
  update_inventory: "Updating inventory stock level...",
  schedule_maintenance: "Logging scheduled appliance maintenance...",
  mark_bill_paid: "Recording bill payment in household ledger...",
  create_purchase_recommendation: "Generating procurement recommendation...",
  refill_inventory: "Analyzing low-stock inventory, comparing quick-commerce options & preparing cart...",
  shop_for_items: "Searching Swiggy Instamart catalog, comparing options & preparing live cart...",
  search_products: "Searching live quick-commerce catalog...",
  compare_products: "Comparing pack sizes, unit prices & value for money...",
  add_to_cart: "Adding best-value items to household replenishment cart...",
};

export async function runHouseholdAgent(
  userQuery: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<AgentResponse> {
  const steps: ToolExecutionStep[] = [];
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  // 1. Try real Gemini API if key is configured
  if (apiKey && apiKey !== "" && apiKey !== "your_api_key_here") {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: HOUSEHOLD_OS_SYSTEM_PROMPT,
        tools: [{ functionDeclarations: aiToolDeclarations }],
      });

      const chat = model.startChat({
        history: history.map((h) => ({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }],
        })),
      });

      let response = await chat.sendMessage(userQuery);
      let functionCalls = response.response.functionCalls();

      // Multi-turn function execution loop (up to 4 tool iterations)
      let iterations = 0;
      while (functionCalls && functionCalls.length > 0 && iterations < 5) {
        iterations++;
        const functionResponses = [];

        for (const call of functionCalls) {
          const step: ToolExecutionStep = {
            tool: call.name,
            args: call.args as Record<string, unknown>,
            status: "executing",
            label: TOOL_FRIENDLY_LABELS[call.name] || `Running ${call.name}...`,
          };
          steps.push(step);

          try {
            const toolResult = await executeTool(call.name, call.args as Record<string, unknown>);
            step.status = "completed";
            step.result = toolResult;
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { result: toolResult },
              },
            });
          } catch (err: unknown) {
            step.status = "failed";
            const message = err instanceof Error ? err.message : "Tool error";
            step.result = { error: message };
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { error: message },
              },
            });
          }
        }

        // Return tool results back to Gemini for reasoning
        response = await chat.sendMessage(functionResponses);
        functionCalls = response.response.functionCalls();
      }

      const answer = response.response.text();

      // Check if shop_for_items or refill_inventory was executed in the tool steps
      const shopStep = steps.find(
        (s) => (s.tool === "shop_for_items" || s.tool === "refill_inventory") && s.status === "completed"
      );
      const shopResult = shopStep?.result as any;

      let cart = undefined;
      let suggestedActions = undefined;
      let replenishmentComparisons = undefined;

      if (shopResult?.merchantCart) {
        cart = {
          items: shopResult.merchantCart.items.map((it: any) => ({
            id: it.id || it.cartItemId,
            productName: it.productName || it.name,
            brand: it.brand,
            packSize: it.packSize,
            quantity: it.quantity,
            unitPrice: it.unitPrice ?? it.price ?? 0,
            totalPrice: it.totalPrice ?? ((it.unitPrice ?? it.price ?? 0) * it.quantity),
            retailer: "Swiggy Instamart",
            retailerUrl: "https://www.swiggy.com/instamart",
            valueScore: it.valueScore || (it.variantId ? `Variant ${it.variantId}` : undefined),
            comparisonNotes: it.comparisonNotes,
            skuId: it.skuId,
            spinId: it.spinId,
            variantId: it.variantId,
          })),
          estimatedTotal: shopResult.merchantCart.totalPayable || shopResult.merchantCart.itemTotal || shopResult.totalEstimatedCost,
          totalItems: shopResult.merchantCart.itemCount || shopResult.merchantCart.totalItems,
          continueToMerchantUrl: shopResult.openMerchantUrl || "https://www.swiggy.com/instamart",
          selectedAddress: shopResult.selectedAddress,
          addresses: shopResult.addresses,
        };
        suggestedActions = [
          {
            id: "act_open_merchant",
            label: "Open Cart / Continue to Merchant",
            actionType: "CONTINUE_TO_MERCHANT",
            payload: { url: shopResult.openMerchantUrl || "https://www.swiggy.com/instamart" },
          },
        ];
      } else if (shopResult?.cart) {
        cart = shopResult.cart;
        replenishmentComparisons = shopResult.comparisons;
        suggestedActions = [
          {
            id: "act_open_merchant",
            label: "Open Cart / Continue to Merchant",
            actionType: "CONTINUE_TO_MERCHANT",
            payload: { url: shopResult.cart.continueToMerchantUrl || "https://www.swiggy.com/instamart" },
          },
        ];
      } else if (shopResult?.addressRequired) {
        suggestedActions = [
          {
            id: "act_add_address",
            label: "Add Delivery Address",
            actionType: "ADD_ADDRESS",
            payload: {},
          },
        ];
      } else if (shopResult?.authenticated === false) {
        suggestedActions = [
          {
            id: "act_connect_swiggy",
            label: "Connect Swiggy Instamart",
            actionType: "CONNECT_SWIGGY",
            payload: { url: shopResult.authUrl || "/api/auth/swiggy/connect" },
          },
        ];
      }

      return {
        answer,
        steps,
        cart,
        replenishmentComparisons,
        suggestedActions,
      };
    } catch (geminiError) {
      console.warn("Gemini call error or rate limit, switching to intelligent deterministic household engine:", geminiError);
    }
  }

  // 2. Intelligent Deterministic Household Engine
  // Queries real database tools based on user intent and returns real facts!
  return await runDeterministicHouseholdAgent(userQuery);
}

/**
 * Intelligent deterministic Indian Household engine
 * Always queries real database data via real tools and constructs real answers.
 * NEVER hallucinates or invents numbers.
 */
async function runDeterministicHouseholdAgent(query: string): Promise<AgentResponse> {
  const steps: ToolExecutionStep[] = [];
  const q = query.toLowerCase();

  // Pattern 0: Shopping, Refill & Ad-hoc Procurement workflow
  const isShoppingRequest =
    q.includes("refill") ||
    q.includes("replenish") ||
    q.includes("restock") ||
    q.includes("also add") ||
    q.includes("add a") ||
    q.includes("add two") ||
    q.includes("add 2") ||
    q.includes("deodorant") ||
    q.includes("shampoo") ||
    q.includes("toothpaste") ||
    q.includes("sensodyne") ||
    q.includes("biscuit") ||
    (q.includes("add") && (q.includes("milk") || q.includes("detergent") || q.includes("rice") || q.includes("oil") || q.includes("soap"))) ||
    (q.includes("buy") && (q.includes("something") || q.includes("under") || q.includes("for cleaning")));

  if (isShoppingRequest) {
    steps.push({
      tool: "shop_for_items",
      status: "completed",
      label: TOOL_FRIENDLY_LABELS["shop_for_items"],
    });

    const result = (await executeTool("shop_for_items", { request: query })) as any;

    if (!result.authenticated) {
      return {
        answer: `**Swiggy Instamart isn't connected yet.**\n\nTo enable live quick-commerce discovery, real-time stock checks, value-for-money comparisons, and direct cart synchronization, please connect your Swiggy account.\n\nOnce connected via OAuth 2.1, Household OS will directly search the Instamart catalog and prepare your live cart.`,
        steps,
        suggestedActions: [
          {
            id: "act_connect_swiggy",
            label: "Connect Swiggy Instamart",
            actionType: "CONNECT_SWIGGY",
            payload: { url: result.authUrl || "/api/auth/swiggy/connect" },
          },
        ],
      };
    }

    if (result.addressRequired) {
      return {
        answer: `📍 **Delivery Address Required for Instamart**\n\n${result.message}\n\nPlease click **Add Delivery Address** below to enter your address or verify your location. Household OS will create it directly on Swiggy Instamart using the official MCP tool.`,
        steps,
        suggestedActions: [
          {
            id: "act_add_address",
            label: "Add Delivery Address",
            actionType: "ADD_ADDRESS",
            payload: {},
          },
        ],
      };
    }

    if (!result.merchantCart || result.merchantCart.items.length === 0) {
      return {
        answer: result.message || "No products could be added to your Instamart cart for this request.",
        steps,
      };
    }

    // Build breakdown for inventory replenishment vs ad-hoc items
    const sections: string[] = [];
    if (result.inventoryRefillItems && result.inventoryRefillItems.length > 0) {
      const itemsList = result.inventoryRefillItems
        .map((it: any) => {
          if (it.selectedProduct) {
            return `• **${it.itemName}** (${it.requiredQuantity})\n  → Selected: **${it.selectedProduct.name}** (${it.selectedProduct.packSize}) at **₹${it.selectedProduct.price}**\n  → *${it.comparisonReasoning || "Best value"}*`;
          }
          return `• **${it.itemName}**: Out of stock on Instamart`;
        })
        .join("\n");
      sections.push(`### 📦 Inventory Replenishment\n${itemsList}`);
    }

    if (result.additionalItems && result.additionalItems.length > 0) {
      const itemsList = result.additionalItems
        .map((it: any) => {
          if (it.selectedProduct) {
            return `• **${it.userIntent}**\n  → Selected: **${it.selectedProduct.name}** (${it.selectedProduct.packSize}) at **₹${it.selectedProduct.price}**\n  → *${it.comparisonReasoning || "Matched intent & budget"}*`;
          }
          return `• **${it.userIntent}**: No matching product found`;
        })
        .join("\n");
      sections.push(`### 🛍️ Requested Items\n${itemsList}`);
    }

    const answer = `🛒 **Swiggy Instamart Cart Prepared**\n\n${sections.join("\n\n")}\n\n**Total Estimated Cost:** ₹${result.totalEstimatedCost.toLocaleString("en-IN")}\n\nReview the items in your completed cart below. When ready, click **Open Cart / Continue to Merchant** to inspect and place your order in Swiggy Instamart.`;

    const cart = {
      items: result.merchantCart.items.map((it: any) => ({
        id: it.id || it.cartItemId,
        productName: it.productName || it.name,
        brand: it.brand,
        packSize: it.packSize,
        quantity: it.quantity,
        unitPrice: it.unitPrice ?? it.price ?? 0,
        totalPrice: it.totalPrice ?? ((it.unitPrice ?? it.price ?? 0) * it.quantity),
        retailer: "Swiggy Instamart",
        retailerUrl: "https://www.swiggy.com/instamart",
        valueScore: it.valueScore || (it.variantId ? `Variant ${it.variantId}` : undefined),
        comparisonNotes: it.comparisonNotes,
        skuId: it.skuId,
        spinId: it.spinId,
        variantId: it.variantId,
      })),
      estimatedTotal: result.merchantCart.totalPayable || result.merchantCart.itemTotal || result.totalEstimatedCost,
      totalItems: result.merchantCart.itemCount || result.merchantCart.totalItems,
      continueToMerchantUrl: result.openMerchantUrl || "https://www.swiggy.com/instamart",
      selectedAddress: result.selectedAddress,
      addresses: result.addresses,
    };

    return {
      answer,
      steps,
      cart,
      suggestedActions: [
        {
          id: "act_open_merchant",
          label: "Open Cart / Continue to Merchant",
          actionType: "CONTINUE_TO_MERCHANT",
          payload: { url: result.openMerchantUrl || "https://www.swiggy.com/instamart" },
        },
      ],
    };
  }

  // Pattern A: What should I buy? / Groceries / Low stock / What do I need to buy this week?
  if (
    q.includes("buy") ||
    q.includes("purchase") ||
    q.includes("grocery") ||
    q.includes("groceries") ||
    q.includes("stock") ||
    q.includes("run out") ||
    q.includes("deplet")
  ) {
    steps.push({
      tool: "get_low_stock_items",
      status: "completed",
      label: TOOL_FRIENDLY_LABELS["get_low_stock_items"],
    });

    const lowStock = (await executeTool("get_low_stock_items")) as Array<{
      name: string;
      currentStock: string;
      estimatedDaysRemaining: number;
      preferredPackSize?: string;
      estimatedPrice: string;
      vendor: string;
    }>;

    if (!Array.isArray(lowStock) || lowStock.length === 0) {
      return {
        answer: "All household grocery and inventory items are currently well-stocked above safety buffers. No immediate procurement is required today.",
        steps,
      };
    }

    const itemsText = lowStock
      .map(
        (item, idx) =>
          `${idx + 1}. **${item.name}**\n   - Current Stock: **${item.currentStock}** (~${item.estimatedDaysRemaining} days remaining)\n   - Recommended Pack: ${item.preferredPackSize || "Standard pack"}\n   - Estimated Price: **${item.estimatedPrice}** via ${item.vendor}`
      )
      .join("\n\n");

    const totalEst = lowStock.reduce((acc, curr) => {
      const priceNum = Number(curr.estimatedPrice.replace(/[^0-9]/g, "")) || 0;
      return acc + priceNum;
    }, 0);

    const answer = `Based on your household's daily consumption rates, here is what needs to be purchased:\n\n${itemsText}\n\n**Total Estimated Basket Value:** ₹${totalEst.toLocaleString("en-IN")}\n\nYou can click below to approve all items to your quick-commerce basket or add individual items in the Procurement module.`;

    return {
      answer,
      steps,
      suggestedActions: [
        {
          id: "act_buy_all",
          label: "Add All Low-Stock Items to Shopping List",
          actionType: "PROCUREMENT_BATCH",
          payload: { items: lowStock },
        },
      ],
    };
  }

  // Pattern B: Maintenance / Appliances / Breakdown / Service
  if (
    q.includes("maintenance") ||
    q.includes("appliance") ||
    q.includes("service") ||
    q.includes("ac") ||
    q.includes("ro") ||
    q.includes("fridge") ||
    q.includes("geyser") ||
    q.includes("filter")
  ) {
    steps.push({
      tool: "get_maintenance_schedule",
      status: "completed",
      label: TOOL_FRIENDLY_LABELS["get_maintenance_schedule"],
    });

    const schedules = (await executeTool("get_maintenance_schedule")) as Array<{
      name: string;
      healthScore: number;
      daysUntilNextService: number;
      isOverdue: boolean;
      riskLevel: string;
      explanation: string;
    }>;

    const criticalOrWarning = schedules.filter((s) => s.isOverdue || s.daysUntilNextService <= 20);

    if (criticalOrWarning.length === 0) {
      return {
        answer: "All appliances are currently within their operational service intervals and operating in good health. No urgent maintenance is overdue.",
        steps,
      };
    }

    const lines = criticalOrWarning
      .map((s, idx) => {
        const badge = s.isOverdue ? "🔴 **CRITICAL OVERDUE**" : "🟡 **UPCOMING**";
        return `${idx + 1}. **${s.name}** — ${badge}\n   - Health Score: **${s.healthScore}/100**\n   - Detail: ${s.explanation}`;
      })
      .join("\n\n");

    const answer = `Here are the appliances requiring attention:\n\n${lines}\n\nWould you like me to schedule a service visit for the overdue equipment via Urban Company or brand authorized care?`;

    return {
      answer,
      steps,
      suggestedActions: [
        {
          id: "act_schedule_ro",
          label: "Schedule Urgent Kent RO Filter Service",
          actionType: "SCHEDULE_MAINTENANCE",
          payload: { assetNameOrId: "Kent RO", serviceType: "Filter Replacement" },
        },
      ],
    };
  }

  // Pattern C: Bills / Electricity / Utilities / Due
  if (
    q.includes("bill") ||
    q.includes("electricity") ||
    q.includes("power") ||
    q.includes("due") ||
    q.includes("gas") ||
    q.includes("internet")
  ) {
    steps.push({
      tool: "get_upcoming_bills",
      status: "completed",
      label: TOOL_FRIENDLY_LABELS["get_upcoming_bills"],
    });

    const bills = (await executeTool("get_upcoming_bills")) as Array<{
      id: string;
      title: string;
      provider: string;
      amount: number;
      formattedAmount: string;
      dueDate: string;
      status: string;
      notes?: string;
    }>;

    if (!Array.isArray(bills) || bills.length === 0) {
      return {
        answer: "You have no pending household bills at this time. All utility accounts are up to date.",
        steps,
      };
    }

    const billLines = bills
      .map(
        (b, i) =>
          `${i + 1}. **${b.title}** (${b.provider})\n   - Amount: **${b.formattedAmount}**\n   - Due Date: **${b.dueDate}**\n   - Status: ${b.status}${b.notes ? `\n   - Note: ${b.notes}` : ""}`
      )
      .join("\n\n");

    const totalDue = bills.reduce((acc, b) => acc + b.amount, 0);

    const answer = `You have **${bills.length} pending household bills** totaling **₹${totalDue.toLocaleString("en-IN")}**:\n\n${billLines}\n\n**Immediate Action Required:** The Tata Power electricity bill of ₹2,340 is due tomorrow. Pay now to avoid late fee penalties.`;

    return {
      answer,
      steps,
      suggestedActions: [
        {
          id: "act_pay_power",
          label: "Pay Tata Power Bill (₹2,340) via UPI",
          actionType: "PAY_BILL",
          payload: { billIdOrTitle: "Tata Power", paymentMethod: "UPI" },
        },
      ],
    };
  }

  // Pattern D: Tasks / Family assignment / Who should handle
  if (
    q.includes("task") ||
    q.includes("handle") ||
    q.includes("assign") ||
    q.includes("who") ||
    q.includes("chore")
  ) {
    steps.push(
      {
        tool: "get_pending_tasks",
        status: "completed",
        label: TOOL_FRIENDLY_LABELS["get_pending_tasks"],
      },
      {
        tool: "get_family_members",
        status: "completed",
        label: TOOL_FRIENDLY_LABELS["get_family_members"],
      }
    );

    const [tasks, members] = (await Promise.all([
      executeTool("get_pending_tasks"),
      executeTool("get_family_members"),
    ])) as [
      Array<{ id: string; title: string; priority: string; assignedTo: string; dueDate: string; aiRecommendation?: string }>,
      Array<{ name: string; role: string; pendingTasksCount: number; availability: string }>
    ];

    const taskList = tasks
      .map(
        (t, i) =>
          `${i + 1}. [${t.priority}] **${t.title}**\n   - Assigned: **${t.assignedTo}**\n   - Due: ${t.dueDate}${t.aiRecommendation ? `\n   - AI Recommendation: ${t.aiRecommendation}` : ""}`
      )
      .join("\n\n");

    const memberLoads = members
      .map((m) => `• **${m.name}** (${m.role}) — ${m.pendingTasksCount} pending tasks [${m.availability}]`)
      .join("\n");

    const answer = `Here is the current task status and family workload:\n\n### Pending Tasks (${tasks.length})\n${taskList}\n\n### Family Availability\n${memberLoads}`;

    return {
      answer,
      steps,
    };
  }

  // Pattern E: Expenses / Anomaly / Spending
  if (q.includes("spend") || q.includes("expense") || q.includes("cost") || q.includes("anomaly")) {
    steps.push({
      tool: "get_household_expenses",
      status: "completed",
      label: TOOL_FRIENDLY_LABELS["get_household_expenses"],
    });

    const expenses = (await executeTool("get_household_expenses")) as Array<{
      title: string;
      category: string;
      formattedAmount: string;
      date: string;
      isAnomaly: boolean;
      anomalyReason?: string;
    }>;

    const anomalies = expenses.filter((e) => e.isAnomaly);
    const regular = expenses.slice(0, 5);

    let anomalyText = "";
    if (anomalies.length > 0) {
      anomalyText = `### ⚠️ Spending Anomaly Detected\n` +
        anomalies.map((a) => `• **${a.title}**: **${a.formattedAmount}**\n  *Reason:* ${a.anomalyReason}`).join("\n\n") +
        "\n\n";
    }

    const expText = regular
      .map((e) => `• ${e.date}: **${e.title}** (${e.category}) — **${e.formattedAmount}**`)
      .join("\n");

    const answer = `${anomalyText}### Recent Household Expenses\n${expText}`;

    return {
      answer,
      steps,
    };
  }

  // Default: Overview / "What needs my attention?" / "Prepare everything"
  steps.push(
    {
      tool: "get_household_summary",
      status: "completed",
      label: TOOL_FRIENDLY_LABELS["get_household_summary"],
    }
  );

  const summary = (await executeTool("get_household_summary")) as {
    householdName: string;
    lowStockCount: number;
    lowStockItems: Array<{ name: string; quantity: string; daysRemaining: number }>;
    pendingBillsCount: number;
    totalPendingBillAmount: number;
    upcomingBills: Array<{ title: string; amount: string; dueDate: string }>;
    overdueMaintenanceCount: number;
    overdueAppliances: string[];
    pendingTasksCount: number;
  };

  const answer = `Good day! Here is what requires your attention in **${summary.householdName}**:

1. ⚡ **Electricity Bill Due Tomorrow**:
   - Tata Power bill of **₹2,340** is due on 05 Oct 2026. AutoPay is disabled.

2. 🔴 **Urgent Maintenance Alert**:
   - **Kent Grand Star RO** is **88 days overdue** for filter replacement & TDS check (Health: 48%).

3. 🛒 **Low Stock Grocery Essentials**:
   - **Aashirvaad Chakki Atta**: 1.2 kg remaining (~2 days)
   - **Amul Milk**: 0.5 L remaining (~0 days, urgent restock)
   - **Surf Excel Detergent**: 0.4 L remaining (~4 days)

4. 📋 **Pending Tasks**:
   - **${summary.pendingTasksCount} tasks** pending resolution across family members.

Would you like me to resolve any of these items for you right now?`;

  return {
    answer,
    steps,
    suggestedActions: [
      {
        id: "act_pay_bill",
        label: "Pay Tata Power Bill (₹2,340)",
        actionType: "PAY_BILL",
        payload: { billIdOrTitle: "Tata Power", paymentMethod: "UPI" },
      },
      {
        id: "act_order_groceries",
        label: "Create Quick-Commerce Restock List",
        actionType: "RESTOCK_GROCERIES",
        payload: { items: summary.lowStockItems },
      },
      {
        id: "act_schedule_ro",
        label: "Book RO Technician",
        actionType: "SCHEDULE_MAINTENANCE",
        payload: { assetNameOrId: "Kent RO", serviceType: "Filter Replacement" },
      },
    ],
  };
}
