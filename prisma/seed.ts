import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Indian Household OS seed...");

  // Clean existing data for clean demo state
  await prisma.vendorContactLog.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.aIMessage.deleteMany();
  await prisma.aIConversation.deleteMany();
  await prisma.documentExtraction.deleteMany();
  await prisma.document.deleteMany();
  await prisma.task.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.maintenanceRecord.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.inventoryEvent.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.householdMember.deleteMany();
  await prisma.household.deleteMany();

  // 1. Create Sharma Household
  const household = await prisma.household.create({
    data: {
      name: "Sharma Household",
      address: "Flat 402, Palm Heights, Hiranandani Gardens, Nashik",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400076",
      currency: "INR",
    },
  });

  console.log(`✓ Created Household: ${household.name} (${household.id})`);

  // 2. Household Members
  const ayush = await prisma.householdMember.create({
    data: {
      householdId: household.id,
      name: "Ayush Sharma",
      role: "Admin",
      phone: "+91 98201 12345",
      email: "ayush@householdos.in",
      availability: "Available",
      responsibilities: "Finance, Utility Bills, Major Asset Maintenance, Tech Operations",
      preferences: "Prefers instant UPI payments, SMS alerts, evening maintenance slots",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
  });

  const priya = await prisma.householdMember.create({
    data: {
      householdId: household.id,
      name: "Priya Sharma",
      role: "Member",
      phone: "+91 98201 54321",
      email: "priya@householdos.in",
      availability: "Available",
      responsibilities: "Kitchen Inventory, Groceries, Daily Supplies, Domestic Help Coordination",
      preferences: "Prefers morning deliveries, Blinkit & Swiggy Instamart, organic brands",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    },
  });

  const ramesh = await prisma.householdMember.create({
    data: {
      householdId: household.id,
      name: "Ramesh Sharma",
      role: "Parent",
      phone: "+91 98201 99887",
      email: "ramesh.sharma@householdos.in",
      availability: "Available",
      responsibilities: "Daily Medicine Stock, Balcony Garden, Morning Milk & Newspaper Delivery",
      preferences: "Prefers Amul Cow Milk, Local Kirana store over apps",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    },
  });

  const sunita = await prisma.householdMember.create({
    data: {
      householdId: household.id,
      name: "Sunita Devi",
      role: "Helper",
      phone: "+91 98201 77665",
      availability: "Available",
      responsibilities: "Cooking Prep, Utensil Cleaning, Deep Cleaning, Kitchen Stock Checks",
      preferences: "Works daily 08:30 AM - 12:30 PM",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    },
  });

  console.log("✓ Created 4 Household Members");

  // 3. Inventory Items with realistic Indian consumption rates & depletion
  const inventoryData = [
    {
      name: "Aashirvaad Shudh Chakki Atta",
      category: "Groceries",
      brand: "Aashirvaad",
      quantity: 1.2,
      unit: "kg",
      minimumStock: 5.0,
      consumptionRate: 0.5, // 0.5 kg/day
      estimatedDaysRemaining: 2,
      preferredBrand: "Aashirvaad",
      preferredPackSize: "10kg Value Pack",
      price: 380,
      vendor: "Blinkit",
      isLowStock: true,
      lastPurchasedAt: new Date(Date.now() - 18 * 24 * 3600 * 1000),
    },
    {
      name: "Amul Taaza Homogenised Milk",
      category: "Dairy",
      brand: "Amul",
      quantity: 0.5,
      unit: "L",
      minimumStock: 2.0,
      consumptionRate: 1.5, // 1.5 L/day
      estimatedDaysRemaining: 0,
      preferredBrand: "Amul",
      preferredPackSize: "1L Pouch x 2",
      price: 56,
      vendor: "Blinkit",
      isLowStock: true,
      lastPurchasedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
    },
    {
      name: "Fortune Sunlite Refined Sunflower Oil",
      category: "Groceries",
      brand: "Fortune",
      quantity: 0.8,
      unit: "L",
      minimumStock: 3.0,
      consumptionRate: 0.15,
      estimatedDaysRemaining: 5,
      preferredBrand: "Fortune",
      preferredPackSize: "5L Canister",
      price: 690,
      vendor: "Zepto",
      isLowStock: true,
      lastPurchasedAt: new Date(Date.now() - 25 * 24 * 3600 * 1000),
    },
    {
      name: "Tata Salt Vacuum Evaporated Iodized",
      category: "Spices",
      brand: "Tata",
      quantity: 0.3,
      unit: "kg",
      minimumStock: 1.0,
      consumptionRate: 0.05,
      estimatedDaysRemaining: 6,
      preferredBrand: "Tata",
      preferredPackSize: "1kg Packet",
      price: 28,
      vendor: "Blinkit",
      isLowStock: true,
      lastPurchasedAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
    },
    {
      name: "Surf Excel Matic Top Load Detergent Liquid",
      category: "Cleaning",
      brand: "Surf Excel",
      quantity: 0.4,
      unit: "L",
      minimumStock: 2.0,
      consumptionRate: 0.1,
      estimatedDaysRemaining: 4,
      preferredBrand: "Surf Excel",
      preferredPackSize: "2L Refill Pouch",
      price: 399,
      vendor: "Swiggy Instamart",
      isLowStock: true,
      lastPurchasedAt: new Date(Date.now() - 16 * 24 * 3600 * 1000),
    },
    {
      name: "Daawat Rozana Super Basmati Rice",
      category: "Groceries",
      brand: "Daawat",
      quantity: 8.5,
      unit: "kg",
      minimumStock: 4.0,
      consumptionRate: 0.3,
      estimatedDaysRemaining: 28,
      preferredBrand: "Daawat",
      preferredPackSize: "5kg Bag",
      price: 450,
      vendor: "Amazon",
      isLowStock: false,
      lastPurchasedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    },
    {
      name: "Vim Dishwash Gel Lemon",
      category: "Cleaning",
      brand: "Vim",
      quantity: 120,
      unit: "ml",
      minimumStock: 500,
      consumptionRate: 25,
      estimatedDaysRemaining: 4,
      preferredBrand: "Vim",
      preferredPackSize: "750ml Bottle",
      price: 145,
      vendor: "Blinkit",
      isLowStock: true,
      lastPurchasedAt: new Date(Date.now() - 21 * 24 * 3600 * 1000),
    },
    {
      name: "Tata Tea Gold Leaf Tea",
      category: "Beverages",
      brand: "Tata Tea",
      quantity: 450,
      unit: "g",
      minimumStock: 250,
      consumptionRate: 20,
      estimatedDaysRemaining: 22,
      preferredBrand: "Tata Tea",
      preferredPackSize: "500g Pack",
      price: 320,
      vendor: "Local Kirana",
      isLowStock: false,
      lastPurchasedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
    },
    {
      name: "Dettol Antiseptic Liquid",
      category: "Personal Care",
      brand: "Dettol",
      quantity: 220,
      unit: "ml",
      minimumStock: 250,
      consumptionRate: 10,
      estimatedDaysRemaining: 22,
      preferredBrand: "Dettol",
      preferredPackSize: "500ml Bottle",
      price: 180,
      vendor: "Apollo Pharmacy",
      isLowStock: false,
      lastPurchasedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    },
    {
      name: "Crocin 650mg Fast Relief Paracetamol",
      category: "Medicines",
      brand: "GSK Crocin",
      quantity: 4,
      unit: "tablets",
      minimumStock: 15,
      consumptionRate: 1,
      estimatedDaysRemaining: 4,
      preferredBrand: "Crocin",
      preferredPackSize: "Strip of 15 tablets",
      price: 35,
      vendor: "Blinkit",
      isLowStock: true,
      lastPurchasedAt: new Date(Date.now() - 15 * 24 * 3600 * 1000),
    },
  ];

  for (const item of inventoryData) {
    const created = await prisma.inventoryItem.create({
      data: {
        ...item,
        householdId: household.id,
      },
    });

    // Record initial restock event
    await prisma.inventoryEvent.create({
      data: {
        itemId: created.id,
        type: "RESTOCK",
        quantityChanged: created.quantity,
        newQuantity: created.quantity,
        notes: `Initial tracked inventory level from ${created.vendor}`,
      },
    });
  }

  console.log(`✓ Seeded ${inventoryData.length} Inventory Items`);

  // 4. Assets & Appliances
  const now = new Date();

  // Daikin AC: service interval 180 days, last service 172 days ago -> due in 8 days
  const daikinAC = await prisma.asset.create({
    data: {
      householdId: household.id,
      name: "Daikin 1.5 Ton 5-Star Inverter Split AC",
      category: "AC",
      brand: "Daikin",
      model: "FTKG50TV16U",
      serialNumber: "DKN-2023-89104",
      purchaseDate: new Date("2023-04-15"),
      purchasePrice: 44500,
      warrantyPeriodMonths: 12,
      warrantyExpiresAt: new Date("2024-04-15"),
      lastServiceDate: new Date(Date.now() - 172 * 24 * 3600 * 1000),
      nextServiceDueDate: new Date(Date.now() + 8 * 24 * 3600 * 1000),
      serviceIntervalDays: 180,
      usageLevel: "Heavy",
      healthScore: 74,
      riskLevel: "Warning",
      location: "Master Bedroom",
      technicianContact: "Urban Company / Daikin Care (+91 91671 22334)",
      notes: "Last deep foam jet wash done in October. Outdoor unit needs coil spray before summer peak.",
    },
  });

  await prisma.maintenanceRecord.create({
    data: {
      assetId: daikinAC.id,
      serviceDate: new Date(Date.now() - 172 * 24 * 3600 * 1000),
      serviceType: "Deep Clean",
      provider: "Urban Company",
      cost: 799,
      notes: "Indoor wet wash & outdoor pressure clean completed. Refrigerant pressure optimal at 135 PSI.",
      technicianName: "Santosh Verma",
      technicianPhone: "+91 98205 44321",
    },
  });

  // Kent RO: CRITICAL OVERDUE (interval 90 days, last service 178 days ago -> overdue by 88 days!)
  const kentRO = await prisma.asset.create({
    data: {
      householdId: household.id,
      name: "Kent Grand Star Alkaline RO Water Purifier",
      category: "RO Water Purifier",
      brand: "Kent",
      model: "Grand Star-B",
      serialNumber: "KNT-2022-RO-4421",
      purchaseDate: new Date("2022-08-20"),
      purchasePrice: 19500,
      warrantyPeriodMonths: 12,
      warrantyExpiresAt: new Date("2023-08-20"),
      lastServiceDate: new Date(Date.now() - 178 * 24 * 3600 * 1000),
      nextServiceDueDate: new Date(Date.now() - 88 * 24 * 3600 * 1000), // Overdue!
      serviceIntervalDays: 90,
      usageLevel: "Heavy",
      healthScore: 48,
      riskLevel: "Critical",
      location: "Kitchen",
      technicianContact: "Kent Authorized Service (+91 92781 01010)",
      notes: "Sediment filter and carbon block overdue for change. TDS alarm beeped yesterday.",
    },
  });

  await prisma.maintenanceRecord.create({
    data: {
      assetId: kentRO.id,
      serviceDate: new Date(Date.now() - 178 * 24 * 3600 * 1000),
      serviceType: "Filter Replacement",
      provider: "Kent Brand Service",
      cost: 2200,
      notes: "Installed original sediment filter, activated carbon, and post-carbon filter. Input TDS was 310, output TDS was 42.",
      technicianName: "Vikram Jadhav",
      technicianPhone: "+91 98199 87654",
    },
  });

  // LG Refrigerator: Healthy
  const lgFridge = await prisma.asset.create({
    data: {
      householdId: household.id,
      name: "LG 360L 3-Star Double Door Smart Inverter Refrigerator",
      category: "Refrigerator",
      brand: "LG",
      model: "GL-T402JDS3",
      serialNumber: "LG-REF-99201",
      purchaseDate: new Date("2024-01-10"),
      purchasePrice: 38900,
      warrantyPeriodMonths: 24,
      warrantyExpiresAt: new Date("2026-01-10"),
      lastServiceDate: new Date(Date.now() - 80 * 24 * 3600 * 1000),
      nextServiceDueDate: new Date(Date.now() + 285 * 24 * 3600 * 1000),
      serviceIntervalDays: 365,
      usageLevel: "Medium",
      healthScore: 92,
      riskLevel: "Good",
      location: "Kitchen",
      technicianContact: "LG Customer Service (1800 315 9999)",
      notes: "Smart Inverter compressor has 10-year warranty. Defrost cycle working normally.",
    },
  });

  // IFB Washing Machine
  const ifbWashingMachine = await prisma.asset.create({
    data: {
      householdId: household.id,
      name: "IFB 8kg Front Load Senator WSS Washing Machine",
      category: "Washing Machine",
      brand: "IFB",
      model: "Senator WSS Steam",
      serialNumber: "IFB-WM-2023-551",
      purchaseDate: new Date("2023-09-05"),
      purchasePrice: 36500,
      warrantyPeriodMonths: 48,
      warrantyExpiresAt: new Date("2027-09-05"),
      lastServiceDate: new Date(Date.now() - 155 * 24 * 3600 * 1000),
      nextServiceDueDate: new Date(Date.now() + 25 * 24 * 3600 * 1000),
      serviceIntervalDays: 180,
      usageLevel: "Heavy",
      healthScore: 82,
      riskLevel: "Good",
      location: "Utility Area",
      technicianContact: "IFB Home Service (+91 93240 11223)",
      notes: "Descaling run once every 2 months. Tub clean recommended in next 25 days.",
    },
  });

  // Bajaj Geyser
  const bajajGeyser = await prisma.asset.create({
    data: {
      householdId: household.id,
      name: "Bajaj New Shakti 25L Storage Geyser",
      category: "Geyser",
      brand: "Bajaj",
      model: "New Shakti Neo 25L",
      serialNumber: "BJJ-GYS-2023-11",
      purchaseDate: new Date("2023-11-15"),
      purchasePrice: 7800,
      warrantyPeriodMonths: 24,
      warrantyExpiresAt: new Date("2025-11-15"),
      lastServiceDate: new Date(Date.now() - 320 * 24 * 3600 * 1000),
      nextServiceDueDate: new Date(Date.now() + 45 * 24 * 3600 * 1000),
      serviceIntervalDays: 365,
      usageLevel: "Medium",
      healthScore: 80,
      riskLevel: "Good",
      location: "Master Bathroom",
      technicianContact: "Urban Company / Local Plumber (+91 98200 44112)",
      notes: "Anode rod inspection due in 45 days before winter peak.",
    },
  });

  console.log("✓ Seeded 5 Indian Household Assets & Maintenance Records");

  // 5. Utility Bills
  const billsData = [
    {
      title: "Tata Power Mumbai Electricity Bill",
      provider: "Tata Power",
      category: "Electricity",
      amount: 2340,
      dueDate: new Date(Date.now() + 1 * 24 * 3600 * 1000), // Due tomorrow!
      paymentStatus: "PENDING",
      paymentMethod: "UPI",
      autoPay: false,
      billNumber: "TP-MUM-2026-09-91823",
      referenceNumber: "CA-900018241",
      billingPeriodStart: new Date(Date.now() - 32 * 24 * 3600 * 1000),
      billingPeriodEnd: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      notes: "Peak summer daytime AC load reflected. Units consumed: 284 kWh (normal average: 230 kWh). Late fee ₹100 if paid after tomorrow.",
    },
    {
      title: "Mahanagar Gas Piped Cooking Gas (PNG)",
      provider: "Mahanagar Gas Limited",
      category: "Gas/LPG",
      amount: 890,
      dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000), // Due in 7 days
      paymentStatus: "PENDING",
      paymentMethod: "Net Banking",
      autoPay: false,
      billNumber: "MGL-PNG-849201",
      referenceNumber: "BP-50019284",
      billingPeriodStart: new Date(Date.now() - 60 * 24 * 3600 * 1000),
      billingPeriodEnd: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      notes: "Bi-monthly billing. Meter reading entered via MGL mobile app.",
    },
    {
      title: "JioFiber Ultra HD Postpaid Broadband",
      provider: "Jio Fiber",
      category: "Internet",
      amount: 1179,
      dueDate: new Date(Date.now() + 11 * 24 * 3600 * 1000),
      paymentStatus: "PENDING",
      paymentMethod: "UPI",
      autoPay: true,
      billNumber: "JIO-MUM-9948271",
      referenceNumber: "022-35619284",
      notes: "100 Mbps Unlimited + 14 OTT Apps pack. Includes 18% GST (₹180).",
    },
    {
      title: "Palm Heights Society Quarterly Maintenance",
      provider: "Palm Heights CHS Ltd",
      category: "Society Maintenance",
      amount: 14500,
      dueDate: new Date(Date.now() + 6 * 24 * 3600 * 1000),
      paymentStatus: "PENDING",
      paymentMethod: "Net Banking",
      autoPay: false,
      billNumber: "PH-CHS-Q3-2026",
      referenceNumber: "FLAT-402",
      notes: "Includes building security, lift maintenance, generator fuel backup, gym and clubhouse charges.",
    },
    {
      title: "Airtel Postpaid Family Plan (3 SIMs)",
      provider: "Airtel",
      category: "Mobile",
      amount: 1415,
      dueDate: new Date(Date.now() - 6 * 24 * 3600 * 1000),
      paidAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      paymentStatus: "PAID",
      paymentMethod: "UPI",
      autoPay: true,
      billNumber: "AIR-POS-882910",
      referenceNumber: "9820112345",
      notes: "Paid successfully via Google Pay UPI on 27th Sep.",
    },
  ];

  for (const bill of billsData) {
    await prisma.bill.create({
      data: {
        ...bill,
        householdId: household.id,
      },
    });
  }

  console.log(`✓ Seeded ${billsData.length} Household Bills`);

  // 6. Expenses & Anomaly Detection Seed
  const expensesData = [
    {
      title: "Tata Power Electricity Bill (Sep)",
      category: "Utilities",
      amount: 2340,
      date: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      paymentMethod: "UPI",
      paidBy: ayush.name,
      vendor: "Tata Power",
      isAnomaly: true,
      anomalyReason: "Electricity bill is ₹2,340, which is 23.8% higher than your 3-month trailing average of ₹1,890. Higher consumption driven by afternoon AC usage.",
    },
    {
      title: "Tata Power Electricity Bill (Aug)",
      category: "Utilities",
      amount: 1890,
      date: new Date(Date.now() - 32 * 24 * 3600 * 1000),
      paymentMethod: "UPI",
      paidBy: ayush.name,
      vendor: "Tata Power",
      isAnomaly: false,
    },
    {
      title: "Tata Power Electricity Bill (Jul)",
      category: "Utilities",
      amount: 1850,
      date: new Date(Date.now() - 63 * 24 * 3600 * 1000),
      paymentMethod: "UPI",
      paidBy: ayush.name,
      vendor: "Tata Power",
      isAnomaly: false,
    },
    {
      title: "Blinkit Quick Grocery Delivery",
      category: "Groceries",
      amount: 1240,
      date: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      paymentMethod: "UPI",
      paidBy: priya.name,
      vendor: "Blinkit",
      isAnomaly: false,
    },
    {
      title: "Swiggy Instamart Fresh Vegetables & Fruits",
      category: "Groceries",
      amount: 870,
      date: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      paymentMethod: "UPI",
      paidBy: priya.name,
      vendor: "Swiggy Instamart",
      isAnomaly: false,
    },
    {
      title: "Domestic Cook Salary - Sunita Devi",
      category: "Domestic Help",
      amount: 6500,
      date: new Date(Date.now() - 4 * 24 * 3600 * 1000),
      paymentMethod: "UPI",
      paidBy: ayush.name,
      vendor: "Sunita Devi",
      isAnomaly: false,
    },
    {
      title: "Housekeeping Maid Monthly Salary",
      category: "Domestic Help",
      amount: 4000,
      date: new Date(Date.now() - 4 * 24 * 3600 * 1000),
      paymentMethod: "UPI",
      paidBy: ayush.name,
      vendor: "Lata Bai",
      isAnomaly: false,
    },
    {
      title: "HP Petrol Pump Car Fuel Refill",
      category: "Transport",
      amount: 3500,
      date: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      paymentMethod: "Card",
      paidBy: ayush.name,
      vendor: "Hindustan Petroleum Powai",
      isAnomaly: false,
    },
    {
      title: "Urban Company Deep Home Cleaning Service",
      category: "Maintenance",
      amount: 2499,
      date: new Date(Date.now() - 12 * 24 * 3600 * 1000),
      paymentMethod: "UPI",
      paidBy: priya.name,
      vendor: "Urban Company",
      isAnomaly: false,
    },
  ];

  for (const exp of expensesData) {
    await prisma.expense.create({
      data: {
        ...exp,
        householdId: household.id,
      },
    });
  }

  console.log(`✓ Seeded ${expensesData.length} Indian Household Expenses`);

  // 7. Household Tasks
  const tasksData = [
    {
      title: "Pay Tata Power electricity bill before due date",
      description: "Bill amount ₹2,340 is due tomorrow. Pay via UPI to avoid late surcharge of ₹100.",
      priority: "URGENT",
      dueDate: new Date(Date.now() + 1 * 24 * 3600 * 1000),
      assignedMemberId: ayush.id,
      status: "PENDING",
      category: "Bill Payment",
      aiRecommendedMemberId: ayush.id,
      aiReason: "Ayush manages household utilities and net banking/UPI operations.",
    },
    {
      title: "Schedule Kent RO filter replacement & TDS inspection",
      description: "Service interval overdue by 88 days. Health score dropped to 48%. Schedule brand technician via Kent Care app or call.",
      priority: "HIGH",
      dueDate: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      assignedMemberId: ayush.id,
      status: "PENDING",
      category: "Maintenance",
      aiRecommendedMemberId: ayush.id,
      aiReason: "Ayush is listed as technician contact and coordinator for water purification maintenance.",
    },
    {
      title: "Order grocery essentials: Atta, Milk, Salt, Detergent",
      description: "Aashirvaad Atta (1.2kg left, 2 days), Amul Milk (0.5L left, 0 days), Surf Excel (0.4L left). Add value packs to Blinkit basket.",
      priority: "HIGH",
      dueDate: new Date(Date.now() + 0 * 24 * 3600 * 1000), // Today
      assignedMemberId: priya.id,
      status: "PENDING",
      category: "Procurement",
      aiRecommendedMemberId: priya.id,
      aiReason: "Priya handles weekly groceries and preferred delivery slots on Blinkit.",
    },
    {
      title: "Daikin AC outdoor unit pre-summer foam cleaning",
      description: "Daikin AC service due in 8 days. Urban Company slot recommended for Saturday morning.",
      priority: "MEDIUM",
      dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      assignedMemberId: null, // Unassigned for AI demo
      status: "PENDING",
      category: "Maintenance",
      aiRecommendedMemberId: ayush.id,
      aiReason: "Ayush manages appliance maintenance scheduling.",
    },
    {
      title: "Collect society maintenance receipt from office",
      description: "Collect printed Q2 payment receipt from Palm Heights society manager.",
      priority: "LOW",
      dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      assignedMemberId: ramesh.id,
      status: "PENDING",
      category: "Chore",
      aiRecommendedMemberId: ramesh.id,
      aiReason: "Ramesh is available in the society clubhouse area during morning walks.",
    },
  ];

  for (const t of tasksData) {
    await prisma.task.create({
      data: {
        ...t,
        householdId: household.id,
      },
    });
  }

  console.log(`✓ Seeded ${tasksData.length} Household Tasks`);

  // 8. AI Recommendations
  const recommendationsData = [
    {
      type: "PROCUREMENT",
      title: "Restock Aashirvaad Shudh Chakki Atta (10kg Value Pack)",
      description: "Current stock has only 1.2 kg remaining (~2 days based on 0.5 kg/day family consumption).",
      reason: "Buying the 10kg value pack on Blinkit at ₹380 saves ₹45 compared to 2 x 5kg packets.",
      urgency: "HIGH",
      status: "PENDING",
      estimatedCost: 380,
      metadata: JSON.stringify({
        product: "Aashirvaad Shudh Chakki Atta",
        recommendedQuantity: "10 kg",
        estimatedPrice: 380,
        retailer: "Blinkit",
        retailerUrl: "https://blinkit.com/s/?q=aashirvaad+atta+10kg",
        alternatives: [
          { name: "Fortune Chakki Fresh Atta 10kg", price: 365, savings: "₹15 cheaper" },
          { name: "Pillsbury Chakki Fresh 10kg", price: 395, savings: "Premium quality" },
        ],
      }),
    },
    {
      type: "MAINTENANCE",
      title: "Urgent: Book Filter Replacement for Kent Grand Star RO",
      description: "Water purifier service is 88 days overdue. Device health score is 48% (Critical).",
      reason: "Post-monsoon TDS and dissolved impurities can degrade membrane performance and affect drinking water safety.",
      urgency: "HIGH",
      status: "PENDING",
      estimatedCost: 2200,
      metadata: JSON.stringify({
        assetId: kentRO.id,
        assetName: kentRO.name,
        recommendedAction: "Book Urban Company or Kent Authorized Service for full filter & sediment cartridge replacement",
        estimatedCost: 2200,
      }),
    },
    {
      type: "BILL_PAYMENT",
      title: "Pay Tata Power Bill (₹2,340) due tomorrow",
      description: "DueDate: 5th Oct 2026. Payment status is PENDING.",
      reason: "AutoPay is disabled for this bill. Avoid ₹100 late payment surcharge and potential disconnection notice.",
      urgency: "HIGH",
      status: "PENDING",
      estimatedCost: 2340,
      metadata: JSON.stringify({
        provider: "Tata Power",
        amount: 2340,
        dueDate: "2026-10-05",
        paymentMode: "UPI / Net Banking",
      }),
    },
    {
      type: "ENERGY_SAVING",
      title: "Optimize Master Bedroom AC Temperature Setting",
      description: "September electricity bill increased by 23.8% (₹2,340 vs ₹1,890 avg).",
      reason: "Setting Daikin AC to 24°C instead of 19°C saves approximately ₹350 - ₹450 per month in electricity consumption.",
      urgency: "MEDIUM",
      status: "PENDING",
      estimatedCost: 0,
      metadata: JSON.stringify({
        currentIncrease: "23.8%",
        potentialMonthlySavings: "₹420",
      }),
    },
  ];

  for (const r of recommendationsData) {
    await prisma.recommendation.create({
      data: {
        ...r,
        householdId: household.id,
      },
    });
  }

  console.log(`✓ Seeded ${recommendationsData.length} Actionable Recommendations`);

  // 9. Activity Logs
  const activityData = [
    {
      actionType: "INVENTORY_UPDATED",
      title: "Low stock alert: Atta & Milk running low",
      description: "Chakki Atta (1.2 kg) and Amul Milk (0.5 L) crossed safety threshold of 2-day buffer.",
      entityType: "Inventory",
      actor: "AI Assistant",
      metadata: JSON.stringify({ lowCount: 2 }),
      createdAt: new Date(Date.now() - 2 * 3600 * 1000),
    },
    {
      actionType: "BILL_PAID",
      title: "Airtel Postpaid Family Plan bill paid",
      description: "Bill of ₹1,415 paid successfully via Google Pay UPI.",
      entityType: "Bill",
      actor: "Ayush Sharma",
      metadata: JSON.stringify({ amount: 1415, provider: "Airtel" }),
      createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    },
    {
      actionType: "MAINTENANCE_SCHEDULED",
      title: "Kent RO maintenance warning triggered",
      description: "Predictive health score dropped to 48% due to elapsed service interval (178 days).",
      entityType: "Asset",
      actor: "Predictive Engine",
      metadata: JSON.stringify({ assetName: "Kent Grand Star RO", healthScore: 48 }),
      createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000),
    },
    {
      actionType: "DOCUMENT_EXTRACTED",
      title: "Tata Power bill parsed successfully",
      description: "Extracted ₹2,340 due on 05/10/2026 for Consumer CA-900018241.",
      entityType: "Document",
      actor: "Document Intelligence",
      metadata: JSON.stringify({ provider: "Tata Power", amount: 2340 }),
      createdAt: new Date(Date.now() - 30 * 3600 * 1000),
    },
  ];

  for (const a of activityData) {
    await prisma.activityLog.create({
      data: {
        ...a,
        householdId: household.id,
      },
    });
  }

  console.log("✓ Seeded Activity Logs");

  // 10. Sample Document for Instant Verification
  const sampleDoc = await prisma.document.create({
    data: {
      householdId: household.id,
      title: "Tata Power Electricity Bill - September 2026",
      originalName: "tata_power_september_2026.pdf",
      fileType: "application/pdf",
      fileSize: 245000,
      status: "CONFIRMED",
      docType: "UTILITY_BILL",
      confidenceScore: 0.98,
      rawText: "TATA POWER CO. LTD. Consumer No: CA-900018241. Due Date: 05/10/2026. Total Amount: ₹2,340.00.",
      extractedJson: JSON.stringify({
        docType: "UTILITY_BILL",
        provider: "Tata Power",
        accountNumber: "CA-900018241",
        billingPeriod: "25 Aug 2026 - 24 Sep 2026",
        dueDate: "2026-10-05",
        totalAmount: 2340,
        usage: "284 kWh",
        lateFee: "₹100",
      }),
    },
  });

  await prisma.documentExtraction.create({
    data: {
      documentId: sampleDoc.id,
      extractedType: "UTILITY_BILL",
      vendorOrBrand: "Tata Power",
      invoiceNumber: "TP-MUM-2026-09-91823",
      date: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      totalAmount: 2340,
      downstreamApplied: true,
    },
  });

  console.log("✓ Seeded Sample Verified Document");

  // 11. Local Vendors (Human Commerce & Services Layer)
  const defaultVendors = [
    {
      name: "Ramesh Gupta",
      businessName: "Gupta Kirana & General Store",
      category: "Kirana / Grocery",
      phone: "+91 98200 11223",
      whatsappNumber: "919820011223",
      address: "Shop 4, Palm Heights Commercial Wing",
      area: "Palm Heights Market, Sector 4",
      city: "Mumbai",
      services: "Aashirvaad Atta, Daal, Basmati Rice, Fortune Sunflower Oil, Spices, Cleaning Supplies, Toiletries, Daily Provisions",
      notes: "Offers 30-min free home delivery above ₹300. Accepts UPI and monthly household ledger.",
      rating: 4.8,
      reviewCount: 38,
      isFavourite: true,
      isTrusted: true,
      isDemo: true,
      availability: "Open • Closes 10 PM",
    },
    {
      name: "Mukesh Yadav",
      businessName: "Yadav Fresh Milk & Dairy Farm",
      category: "Dairy & Milk",
      phone: "+91 98200 44556",
      whatsappNumber: "919820044556",
      address: "Kiosk 2, Near Main Gate, Hiranandani Gardens",
      area: "Hiranandani Gardens",
      city: "Mumbai",
      services: "Amul Taaza / Gold Milk, Buffalo Full Cream Milk, Fresh Malai Paneer, Cow Ghee, Curd (Dahi), Country Eggs",
      notes: "Daily morning 6:30 AM doorstep delivery. Fresh evening malai paneer batch ready by 5 PM.",
      rating: 4.9,
      reviewCount: 54,
      isFavourite: true,
      isTrusted: true,
      isDemo: true,
      availability: "Open • 6 AM - 12 PM, 4 PM - 9 PM",
    },
    {
      name: "Sanjay Maurya",
      businessName: "Sanjay Farm Fresh Vegetables & Fruits",
      category: "Fresh Fruits & Vegetables",
      phone: "+91 98200 77889",
      whatsappNumber: "919820077889",
      address: "Stall 12, Subzi Mandi",
      area: "Opposite Palm Heights Tower 2",
      city: "Mumbai",
      services: "Nashik Onions, Potatoes, Vine Tomatoes, Fresh Palak, Coriander, Ginger-Garlic, Seasonal Apples, Bananas",
      notes: "Direct farm produce arrives daily at 6:30 AM. Sends daily fresh arrival prices on WhatsApp.",
      rating: 4.7,
      reviewCount: 29,
      isFavourite: true,
      isTrusted: true,
      isDemo: true,
      availability: "Open • 7 AM - 9 PM",
    },
    {
      name: "Imran Khan",
      businessName: "CoolCare HVAC & AC Solutions",
      category: "AC Repair & Service",
      phone: "+91 98200 33441",
      whatsappNumber: "919820033441",
      address: "B-14, Powai Commercial Complex",
      area: "Sector 7, Powai",
      city: "Mumbai",
      services: "AC Deep Foam Jet Cleaning, Gas Refill (R32/R410), PCB Diagnostics, Cooling Coil Replacement, Split AC Installation",
      notes: "Urban Company certified senior technician. Gives 60-day cooling warranty on gas charges.",
      rating: 4.9,
      reviewCount: 67,
      isFavourite: true,
      isTrusted: true,
      isDemo: true,
      availability: "On Call • 9 AM - 8 PM",
    },
    {
      name: "Santosh Verma",
      businessName: "Apex Plumbing & RO Purifier Care",
      category: "Plumber",
      phone: "+91 98200 88993",
      whatsappNumber: "919820088993",
      address: "Shop 18, Galleria Market",
      area: "Galleria Market, Powai",
      city: "Mumbai",
      services: "Kent/Aquaguard Filter Replacement, Membrane Change, Tap Leakage, Pipe Blockage, Flush Tank Repair, RO Water Testing",
      notes: "Carries genuine Kent and Eureka Forbes filters with TDS testing kit. Society approved plumber.",
      rating: 4.8,
      reviewCount: 31,
      isFavourite: true,
      isTrusted: true,
      isDemo: true,
      availability: "Open • 8:30 AM - 8:30 PM",
    },
    {
      name: "Dinesh Patel",
      businessName: "Patel Electricals & Home Services",
      category: "Electrician",
      phone: "+91 98200 55662",
      whatsappNumber: "919820055662",
      address: "Shop 9, Hiranandani Market",
      area: "Hiranandani Market Complex",
      city: "Mumbai",
      services: "MCB & Short Circuit Repair, Inverter Wiring, Geyser Element Replacement, Ceiling Fan Repair, Switchboard Rewiring",
      notes: "Arrives within 45 mins for emergency residential calls. Equipped with heavy load testing meters.",
      rating: 4.8,
      reviewCount: 42,
      isFavourite: false,
      isTrusted: true,
      isDemo: true,
      availability: "Open • 8 AM - 9 PM",
    },
    {
      name: "Arun Nair",
      businessName: "SmartTech Multi-Brand Appliance Repair",
      category: "Appliance Technician",
      phone: "+91 98200 22338",
      whatsappNumber: "919820022338",
      address: "Shop 21, Central Avenue",
      area: "Central Avenue, Powai",
      city: "Mumbai",
      services: "Washing Machine Drum & Motor Repair, Refrigerator Compressor Service, Microwave Magnetron, Chimney Motor Servicing",
      notes: "Specializes in Samsung, LG, IFB, Whirlpool appliances. Fixed ₹250 visit charge adjusted against repair invoice.",
      rating: 4.7,
      reviewCount: 26,
      isFavourite: false,
      isTrusted: true,
      isDemo: true,
      availability: "On Call • 9:30 AM - 7:30 PM",
    },
    {
      name: "Mahesh Singh",
      businessName: "PureFlow Water Supplies",
      category: "Water Can Delivery",
      phone: "+91 98200 66774",
      whatsappNumber: "919820066774",
      address: "Gate 1 Logistics Depot",
      area: "Palm Heights Society",
      city: "Mumbai",
      services: "20L Sealed Bisleri Water Cans, Aquafina Cans, Dispenser Service",
      notes: "Guaranteed 15-minute doorstep drop to Flat 402.",
      rating: 4.9,
      reviewCount: 45,
      isFavourite: true,
      isTrusted: true,
      isDemo: true,
      availability: "Open • 7 AM - 9 PM",
    },
  ];

  for (const v of defaultVendors) {
    await prisma.vendor.create({
      data: {
        ...v,
        householdId: household.id,
      },
    });
  }

  console.log(`✓ Seeded ${defaultVendors.length} Local Vendors`);
  console.log("🎉 Household OS database successfully seeded with realistic Indian data!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
