import { FunctionDeclaration, SchemaType } from "@google/generative-ai";

export const aiToolDeclarations: FunctionDeclaration[] = [
  {
    name: "get_household_summary",
    description: "Fetches an overview of the household: health score, pending bills count, overdue maintenance, low stock items, and open tasks.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_inventory",
    description: "Retrieves the current household pantry and grocery inventory with quantities, units, and categories.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category: {
          type: SchemaType.STRING,
          description: "Optional filter by category (Groceries, Dairy, Cleaning, Spices, Medicines, etc.)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_low_stock_items",
    description: "Fetches items that are running low, below safety threshold, or depleting within the next 4 days.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_upcoming_bills",
    description: "Retrieves utility bills (electricity, water, gas, internet, maintenance) due in the household, sorted by due date.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: {
          type: SchemaType.STRING,
          description: "Filter by status: PENDING, PAID, or ALL (default PENDING)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_household_expenses",
    description: "Retrieves recent Indian household expenses, category breakdowns, and flags anomalies (e.g. high electricity bills).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category: {
          type: SchemaType.STRING,
          description: "Optional expense category (Utilities, Groceries, Domestic Help, Maintenance, etc.)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_appliances",
    description: "Retrieves all household assets/appliances (AC, Refrigerator, RO, Washing Machine, Geyser, etc.) with health scores and risk status.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_maintenance_schedule",
    description: "Retrieves appliances that require servicing, filter replacement, or inspection (upcoming or overdue).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_family_members",
    description: "Retrieves family members, roles, availability, preferences, and delegated responsibilities.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_pending_tasks",
    description: "Retrieves pending household tasks, priorities, due dates, and assigned members.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        priority: {
          type: SchemaType.STRING,
          description: "Optional priority filter: URGENT, HIGH, MEDIUM, LOW",
        },
      },
      required: [],
    },
  },
  {
    name: "create_task",
    description: "Creates a new household task in the database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "Title of the task" },
        description: { type: SchemaType.STRING, description: "Detailed description" },
        priority: { type: SchemaType.STRING, description: "LOW, MEDIUM, HIGH, URGENT" },
        dueDate: { type: SchemaType.STRING, description: "Due date in YYYY-MM-DD" },
        category: { type: SchemaType.STRING, description: "Maintenance, Procurement, Chore, Bill Payment" },
        assignedMemberName: { type: SchemaType.STRING, description: "Optional name of family member to assign" },
      },
      required: ["title"],
    },
  },
  {
    name: "assign_task",
    description: "Assigns a specific household task to a family member.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        taskId: { type: SchemaType.STRING, description: "The ID of the task" },
        memberName: { type: SchemaType.STRING, description: "Name of the family member" },
      },
      required: ["taskId", "memberName"],
    },
  },
  {
    name: "update_inventory",
    description: "Updates the stock level or details of an existing inventory item in the database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        itemId: { type: SchemaType.STRING, description: "The ID or name of the item" },
        newQuantity: { type: SchemaType.NUMBER, description: "The updated quantity" },
        notes: { type: SchemaType.STRING, description: "Reason or notes for update" },
      },
      required: ["itemId", "newQuantity"],
    },
  },
  {
    name: "schedule_maintenance",
    description: "Logs a scheduled maintenance or service date for a specific household appliance.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        assetNameOrId: { type: SchemaType.STRING, description: "Appliance name or ID (e.g. Daikin AC, Kent RO)" },
        serviceType: { type: SchemaType.STRING, description: "Deep Clean, Filter Replacement, Preventive, Repair" },
        serviceDate: { type: SchemaType.STRING, description: "Date in YYYY-MM-DD" },
        provider: { type: SchemaType.STRING, description: "Urban Company, Brand Service, Local Technician" },
      },
      required: ["assetNameOrId", "serviceType"],
    },
  },
  {
    name: "mark_bill_paid",
    description: "Marks a specific bill as paid and records the payment transaction in expenses.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        billIdOrTitle: { type: SchemaType.STRING, description: "The ID or title of the bill" },
        paymentMethod: { type: SchemaType.STRING, description: "UPI, Net Banking, Card, Cash" },
      },
      required: ["billIdOrTitle"],
    },
  },
  {
    name: "create_purchase_recommendation",
    description: "Creates an actionable procurement recommendation card for the user to review and buy.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        product: { type: SchemaType.STRING, description: "Product name" },
        quantity: { type: SchemaType.STRING, description: "Recommended quantity / pack size" },
        estimatedPrice: { type: SchemaType.NUMBER, description: "Estimated price in INR" },
        reason: { type: SchemaType.STRING, description: "Why this recommendation is made" },
        retailer: { type: SchemaType.STRING, description: "Blinkit, Zepto, Swiggy Instamart, Amazon" },
      },
      required: ["product", "quantity", "reason"],
    },
  },
  {
    name: "search_products",
    description: "Searches available quick-commerce products across Blinkit, Zepto, and Instamart with real market pack sizes, prices, and unit values.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: "Product search query e.g. milk, atta, oil, detergent" },
        category: { type: SchemaType.STRING, description: "Optional category" },
      },
      required: ["query"],
    },
  },
  {
    name: "compare_products",
    description: "Analyzes product options using price, pack size, value for money, unit price (₹/L or ₹/kg), and availability to select the best option.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        itemName: { type: SchemaType.STRING, description: "Name of the inventory item being replenished" },
        requiredQuantity: { type: SchemaType.NUMBER, description: "Required quantity" },
        unit: { type: SchemaType.STRING, description: "Quantity unit (kg, L, etc.)" },
      },
      required: ["itemName"],
    },
  },
  {
    name: "add_to_cart",
    description: "Adds selected replenishment products to the household replenishment cart in the database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        items: {
          type: SchemaType.ARRAY,
          description: "List of items to add to cart",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              productName: { type: SchemaType.STRING },
              brand: { type: SchemaType.STRING },
              packSize: { type: SchemaType.STRING },
              quantity: { type: SchemaType.NUMBER },
              unitPrice: { type: SchemaType.NUMBER },
              totalPrice: { type: SchemaType.NUMBER },
              retailer: { type: SchemaType.STRING },
              retailerUrl: { type: SchemaType.STRING },
              valueScore: { type: SchemaType.STRING },
            },
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "refill_inventory",
    description: "Autonomous inventory replenishment workflow: reads real low-stock items from Prisma, determines required quantities, searches quick-commerce products, analyzes value options (Option A vs Option B), selects best value options, adds them to the household cart, and returns the complete cart for user manual review.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "shop_for_items",
    description: "General-purpose AI shopping agent powered by Swiggy Instamart MCP. Handles both inventory replenishment ('refill inventory') and ad-hoc shopping requests ('add deodorant under ₹500', 'add 2 bottles of milk and biscuits', 'something for cleaning bathroom'). Extracts product intent, budget, brand constraints, queries the real Instamart catalog, compares options, adds them to the real merchant cart, and returns the merchant cart for user review. Does not require items to exist in inventory.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        request: {
          type: SchemaType.STRING,
          description: "The full user shopping request in natural language (e.g. 'refill inventory and add deodorant under ₹500')",
        },
        refillLowStock: {
          type: SchemaType.BOOLEAN,
          description: "Whether to automatically include and replenish low-stock items from the Prisma inventory database",
        },
        items: {
          type: SchemaType.ARRAY,
          description: "Explicit items extracted from user request if already parsed",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              productName: { type: SchemaType.STRING, description: "Name/type of product (e.g. deodorant, shampoo, milk)" },
              brand: { type: SchemaType.STRING, description: "Preferred brand if specified" },
              quantity: { type: SchemaType.NUMBER, description: "Quantity requested" },
              maxBudget: { type: SchemaType.NUMBER, description: "Maximum budget in INR if specified" },
              preference: { type: SchemaType.STRING, description: "Preferences like 'cheap', 'best', 'value pack'" },
            },
            required: ["productName"],
          },
        },
      },
      required: ["request"],
    },
  },
  {
    name: "get_local_vendors",
    description: "Retrieves local neighborhood vendors (Kirana, Milk Dairy, Vegetable vendor, AC technician, Electrician, Plumber, Water can supplier) with contact numbers, ratings, and specialties.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category: {
          type: SchemaType.STRING,
          description: "Optional filter by vendor category (Kirana / Grocery, Dairy & Milk, Fresh Fruits & Vegetables, AC Repair & Service, Electrician, Plumber, Water Can Delivery)",
        },
      },
      required: [],
    },
  },
  {
    name: "order_from_local_vendor",
    description: "Generates a formatted WhatsApp order and direct link (wa.me) to send to a local neighborhood vendor for delivery.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        vendorName: { type: SchemaType.STRING, description: "Name of the local vendor or store" },
        items: {
          type: SchemaType.ARRAY,
          description: "List of items to order",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING, description: "Item name (e.g. Amul Taaza Milk, Aashirvaad Atta)" },
              quantity: { type: SchemaType.STRING, description: "Quantity with unit (e.g. 2L, 5kg)" },
            },
            required: ["name", "quantity"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "request_vendor_service",
    description: "Connects a maintenance issue or appliance breakdown with the best-matching local technician (AC, Plumber, Electrician) and prepares the WhatsApp service request dispatch.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category: { type: SchemaType.STRING, description: "Category (e.g. AC Repair, Plumbing, Electrical)" },
        issue: { type: SchemaType.STRING, description: "Description of the problem" },
        assetName: { type: SchemaType.STRING, description: "Name of the appliance if known (e.g. Daikin AC)" },
        preferredTime: { type: SchemaType.STRING, description: "Preferred time slot (e.g. Tomorrow 10 AM)" },
      },
      required: ["category", "issue"],
    },
  },
  {
    name: "assign_household_task",
    description: "Assigns or creates a household task to a family member (Ayush, Priya, Ramesh, Sunita) with AI role matching.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "Title of the task" },
        description: { type: SchemaType.STRING, description: "Details of the task" },
        category: { type: SchemaType.STRING, description: "Category (Kitchen, Groceries, Maintenance, Bills, Errands)" },
        priority: { type: SchemaType.STRING, description: "Priority: LOW, MEDIUM, HIGH, URGENT" },
        assigneeName: { type: SchemaType.STRING, description: "Specific member name, or leave blank for AI recommendation" },
      },
      required: ["title"],
    },
  },
  {
    name: "send_family_task_ping",
    description: "Generates a WhatsApp ping link to remind a family member about an urgent or pending household task.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        taskId: { type: SchemaType.STRING, description: "ID of the task to ping about" },
        memberName: { type: SchemaType.STRING, description: "Name of the family member" },
      },
      required: [],
    },
  },
  {
    name: "get_inventory_needing_refill",
    description: "Fetches actual inventory items needing replenishment from the database, transformed into explicit requirement objects with brand, productType, variant, strength, and calculated refill quantity.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_inventory_item",
    description: "Fetches a specific household inventory item by ID or name from the database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "Inventory item ID" },
        name: { type: SchemaType.STRING, description: "Item name (e.g. Tata Salt, Amul Milk)" },
      },
      required: [],
    },
  },
  {
    name: "get_household_inventory",
    description: "Retrieves complete household inventory stock and threshold levels from database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "build_refill_plan",
    description: "Builds a high-accuracy inventory refill plan by matching actual database deficit against live Instamart catalog with deterministic scoring and pack calculations.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        request: { type: SchemaType.STRING, description: "Optional user shopping context" },
      },
      required: [],
    },
  },
  {
    name: "parse_shopping_request",
    description: "Parses user shopping natural language into structured items, brand preferences, quantities, and budget constraints.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        request: { type: SchemaType.STRING, description: "User natural language request" },
      },
      required: ["request"],
    },
  },
  {
    name: "get_instamart_cart",
    description: "Fetches the current live Swiggy Instamart cart from MCP as single source of truth.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "remove_from_shopping_session",
    description: "Removes an item from the current shopping cart proposal without modifying inventory database.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        cartItemId: { type: SchemaType.STRING, description: "ID of cart item to remove" },
      },
      required: ["cartItemId"],
    },
  },
];
