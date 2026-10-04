import assert from "assert";
import {
  calculateDepletion,
  generateProcurementRecommendation,
} from "../lib/services/inventory-calculator";
import { calculateAssetMaintenance } from "../lib/services/maintenance-calculator";
import { detectExpenseAnomaly } from "../lib/services/finance-calculator";
import {
  GroceryReceiptExtractionSchema,
  ApplianceInvoiceExtractionSchema,
  UtilityBillExtractionSchema,
} from "../lib/validation/schemas";
import { executeTool } from "../lib/tools/registry";
import { prisma } from "../lib/db/prisma";
import { parseShoppingIntent } from "../lib/services/shopping-agent-service";
import { generatePkcePair, getSwiggyAuthorizationUrl } from "../lib/integrations/commerce/swiggy-instamart/auth";

async function runTestSuite() {
  console.log("==================================================");
  console.log("🧪 RUNNING HOUSEHOLD OS AUTOMATED TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`✓ PASS: ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`✗ FAIL: ${name}`, err);
            failed++;
          });
      } else {
        console.log(`✓ PASS: ${name}`);
        passed++;
      }
    } catch (err) {
      console.error(`✗ FAIL: ${name}`, err);
      failed++;
    }
  }

  // 1. Inventory Depletion & Procurement Tests
  console.log("--- 1. Inventory & Depletion Logic Tests ---");

  test("calculates accurate days remaining and low stock flag", () => {
    const res = calculateDepletion(1.2, 5.0, 0.5); // 1.2kg at 0.5kg/day = 2 days
    assert.strictEqual(res.estimatedDaysRemaining, 2);
    assert.strictEqual(res.isLowStock, true);
    assert.strictEqual(res.urgency, "HIGH");
  });

  test("handles zero stock safely without negative days", () => {
    const res = calculateDepletion(0, 2.0, 1.0);
    assert.strictEqual(res.estimatedDaysRemaining, 0);
    assert.strictEqual(res.isLowStock, true);
    assert.strictEqual(res.urgency, "CRITICAL");
  });

  test("generates optimal pack procurement recommendation for Indian groceries", () => {
    const rec = generateProcurementRecommendation({
      id: "test-atta",
      name: "Aashirvaad Chakki Atta",
      category: "Groceries",
      brand: "Aashirvaad",
      quantity: 1.0,
      unit: "kg",
      minimumStock: 5.0,
      consumptionRate: 0.5,
      price: 380,
      vendor: "Blinkit",
    });
    assert.strictEqual(rec.isLowStock, true);
    assert(rec.recommendedPack && (rec.recommendedPack.includes("Bag") || rec.recommendedPack.includes("Value")));
    assert(rec.deepLinkUrl.includes("blinkit.com"));
  });

  // 2. Predictive Maintenance Calculations
  console.log("\n--- 2. Predictive Maintenance Calculation Tests ---");

  test("calculates upcoming maintenance due dates accurately", () => {
    const now = new Date();
    const lastService = new Date(now.getTime() - 150 * 24 * 3600 * 1000); // 150 days ago
    const res = calculateAssetMaintenance({
      id: "asset-ac",
      name: "Daikin AC",
      category: "AC",
      brand: "Daikin",
      lastServiceDate: lastService,
      serviceIntervalDays: 180,
      usageLevel: "Medium",
    });
    assert.strictEqual(res.isOverdue, false);
    assert(res.daysUntilNextService >= 29 && res.daysUntilNextService <= 31);
    assert(res.healthScore > 50);
  });

  test("penalizes health score and marks critical when maintenance is overdue", () => {
    const now = new Date();
    const lastService = new Date(now.getTime() - 200 * 24 * 3600 * 1000); // 200 days ago (interval 90)
    const res = calculateAssetMaintenance({
      id: "asset-ro",
      name: "Kent RO",
      category: "RO Water Purifier",
      brand: "Kent",
      lastServiceDate: lastService,
      serviceIntervalDays: 90,
      usageLevel: "Heavy",
    });
    assert.strictEqual(res.isOverdue, true);
    assert.strictEqual(res.riskLevel, "Critical");
    assert(res.explanation.includes("OVERDUE"));
  });

  // 3. Finance & Anomaly Detection Tests
  console.log("\n--- 3. Finance & Anomaly Detection Tests ---");

  test("flags spending anomaly when expense exceeds baseline by > 20%", () => {
    const historical = [
      { category: "Utilities", amount: 1800, date: new Date() },
      { category: "Utilities", amount: 1900, date: new Date() },
      { category: "Utilities", amount: 1850, date: new Date() },
    ];
    const check = detectExpenseAnomaly("Tata Power", "Utilities", 2400, historical);
    assert.strictEqual(check.isAnomaly, true);
    assert(check.percentageChange >= 25);
    assert(check.explanation.includes("higher than your recent average"));
  });

  test("accepts normal expenses within expected baseline without false alarms", () => {
    const historical = [
      { category: "Groceries", amount: 1200, date: new Date() },
      { category: "Groceries", amount: 1300, date: new Date() },
    ];
    const check = detectExpenseAnomaly("Blinkit", "Groceries", 1250, historical);
    assert.strictEqual(check.isAnomaly, false);
  });

  // 4. Document Schema Validation
  console.log("\n--- 4. Document Schema Zod Validation Tests ---");

  test("validates well-formed Indian appliance invoice schema", () => {
    const valid = {
      docType: "APPLIANCE_INVOICE",
      brand: "Voltas",
      model: "V-185V",
      applianceType: "AC",
      purchaseDate: "2026-10-04",
      purchasePrice: 38990,
      warrantyPeriodMonths: 12,
      recommendedServiceIntervalDays: 180,
    };
    const parsed = ApplianceInvoiceExtractionSchema.parse(valid);
    assert.strictEqual(parsed.brand, "Voltas");
    assert.strictEqual(parsed.purchasePrice, 38990);
  });

  test("rejects invalid invoice data missing purchasePrice", () => {
    const invalid = {
      docType: "APPLIANCE_INVOICE",
      brand: "LG",
      applianceType: "Refrigerator",
      purchaseDate: "2026-10-04",
      // missing purchasePrice
    };
    assert.throws(() => ApplianceInvoiceExtractionSchema.parse(invalid));
  });

  test("validates quick-commerce receipt with itemized lines", () => {
    const valid = {
      docType: "RECEIPT",
      vendor: "Blinkit",
      date: "2026-10-04",
      items: [{ name: "Amul Milk", quantity: 2, price: 112 }],
      total: 112,
    };
    const parsed = GroceryReceiptExtractionSchema.parse(valid);
    assert.strictEqual(parsed.vendor, "Blinkit");
    assert.strictEqual(parsed.items.length, 1);
  });

  // 5. Database Tools & Execution against real database
  console.log("\n--- 5. Database Real-Time Tool Execution Tests ---");

  await test("executeTool('get_household_summary') returns live DB overview", async () => {
    const summary = (await executeTool("get_household_summary")) as {
      householdName: string;
      membersCount: number;
      pendingBillsCount: number;
    };
    assert(summary.householdName.includes("Sharma"));
    assert(summary.membersCount >= 4);
    assert(summary.pendingBillsCount >= 1);
  });

  await test("executeTool('get_low_stock_items') queries database low stock correctly", async () => {
    const items = (await executeTool("get_low_stock_items")) as unknown[];
    assert(Array.isArray(items));
    assert(items.length >= 1);
  });

  await test("executeTool('create_task') mutates database and persists new record", async () => {
    const res = (await executeTool("create_task", {
      title: "Test Automated Verification Task",
      priority: "HIGH",
      category: "Maintenance",
    })) as { success: boolean; task: { id: string } };
    assert.strictEqual(res.success, true);
    assert(res.task.id);

    // Clean up test task
    await prisma.task.delete({ where: { id: res.task.id } });
  });

  // 6. General AI Shopping Agent & Swiggy Instamart MCP Integration Tests
  console.log("\n--- 6. General AI Shopping Agent & Swiggy Instamart MCP Integration Tests ---");

  test("parseShoppingIntent handles 'Refill inventory' (inventory replenishment only)", () => {
    const parsed = parseShoppingIntent("Refill inventory");
    assert.strictEqual(parsed.refillLowStock, true);
    assert.strictEqual(parsed.adHocItems.length, 0);
  });

  test("parseShoppingIntent handles 'Refill the inventory and also add deodorant.' (combined)", () => {
    const parsed = parseShoppingIntent("Refill the inventory and also add deodorant.");
    assert.strictEqual(parsed.refillLowStock, true);
    assert.strictEqual(parsed.adHocItems.length, 1);
    assert.strictEqual(parsed.adHocItems[0].query, "deodorant");
  });

  test("parseShoppingIntent handles ad-hoc request with budget 'Get me a deodorant under ₹500'", () => {
    const parsed = parseShoppingIntent("Get me a deodorant under ₹500");
    assert.strictEqual(parsed.adHocItems.length, 1);
    assert.strictEqual(parsed.adHocItems[0].query, "deodorant");
    assert.strictEqual(parsed.adHocItems[0].maxBudget, 500);
  });

  test("parseShoppingIntent handles brand constraint 'Add toothpaste, preferably Sensodyne'", () => {
    const parsed = parseShoppingIntent("Add toothpaste, preferably Sensodyne");
    assert.strictEqual(parsed.adHocItems.length, 1);
    assert.strictEqual(parsed.adHocItems[0].brand, "Sensodyne");
  });

  test("parseShoppingIntent handles multi-item ad-hoc request 'Add two bottles of milk and a pack of biscuits'", () => {
    const parsed = parseShoppingIntent("Add two bottles of milk and a pack of biscuits");
    assert(parsed.adHocItems.length >= 2);
    const milkItem = parsed.adHocItems.find((it) => it.query.includes("milk"));
    const biscuitItem = parsed.adHocItems.find((it) => it.query.includes("biscuit"));
    assert(milkItem !== undefined);
    assert(biscuitItem !== undefined);
    assert.strictEqual(milkItem?.quantity, 2);
  });

  test("generatePkcePair generates secure RFC 7636 S256 verifier and challenge", () => {
    const pair = generatePkcePair();
    assert(pair.codeVerifier.length >= 43);
    assert(pair.codeChallenge.length >= 43);
    assert(pair.state.length >= 16);
  });

  await test("getSwiggyAuthorizationUrl creates compliant OAuth 2.1 URL targeting Swiggy MCP server", async () => {
    const auth = await getSwiggyAuthorizationUrl("http://localhost:3000/api/auth/swiggy/callback");
    assert(auth.url.startsWith("https://mcp.swiggy.com/auth/authorize"));
    assert(auth.url.includes("code_challenge="));
    assert(auth.url.includes("code_challenge_method=S256"));
    assert(auth.url.includes("scope=mcp%3Atools") || auth.url.includes("scope=mcp:tools"));
  });

  await test("executeTool('shop_for_items') truthfully executes with live Swiggy provider or reports auth status", async () => {
    const result = (await executeTool("shop_for_items", {
      request: "Get me a deodorant under ₹500",
    })) as {
      success: boolean;
      authenticated: boolean;
      message: string;
      authUrl?: string;
      merchantCart?: unknown;
    };
    if (result.authenticated) {
      assert.strictEqual(result.authenticated, true);
      assert(typeof result.message === "string");
    } else {
      assert.strictEqual(result.authenticated, false);
      assert(result.message.includes("Instamart isn't connected yet"));
      assert.strictEqual(result.authUrl, "/api/auth/swiggy/connect");
    }
  });

  await test("executeTool('refill_inventory') truthfully executes with live Swiggy provider or reports auth status", async () => {
    const result = (await executeTool("refill_inventory")) as {
      success: boolean;
      authenticated: boolean;
      message: string;
    };
    if (result.authenticated) {
      assert.strictEqual(result.authenticated, true);
      assert(typeof result.message === "string");
    } else {
      assert.strictEqual(result.authenticated, false);
      assert(result.message.includes("Instamart isn't connected yet") || result.message.includes("Swiggy"));
    }
  });

  console.log("\n==================================================");
  console.log(`🏁 TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((e) => {
    console.error("Test execution fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
