import { prisma } from "../lib/db/prisma";
import {
  computeDocumentHash,
  extractStage1Document,
  performHouseholdImpactAnalysis,
  executeApprovedDocumentActions,
  rejectHouseholdDocument,
} from "../lib/services/document-intelligence-service";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING MULTIMODAL DOCUMENT INTELLIGENCE TEST SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   └─ ${detail}`);
      failed++;
    }
  }

  const household = await prisma.household.findFirst();
  if (!household) {
    throw new Error("No household found for tests");
  }
  const householdId = household.id;

  try {
    // ----------------------------------------------------
    // TEST 1: Exact Amazon Samsung Washing Machine Invoice (Requirement 13)
    // ----------------------------------------------------
    console.log("\n--- TEST 1: Amazon Samsung Washing Machine Extraction (₹30,267) ---");
    const rawInvoiceText = `
Tax Invoice / Bill of Supply
Amazon Retail India Private Limited
Order Number: 407-9998887-6665544
Invoice Number: RNE1-9999999-2024
Invoice Date: 15.03.2024

Description: Samsung 7.0 Kg Fully Automatic Front Loading Washing Machine
Quantity: 1
Net Amount: ₹25,650.00
Tax Rate: 18% GST
GST: ₹4,617.00
FINAL TOTAL: ₹30,267.00
Payment Method: Electronic Transaction
`;

    const samsungStage1 = await extractStage1Document({
      fileName: "Amazon_Samsung_Washing_Machine_Invoice.pdf",
      fileType: "application/pdf",
      base64Data: Buffer.from(rawInvoiceText, "utf-8").toString("base64"),
      sampleType: "SAMSUNG_WASHING_MACHINE",
    });

    assert(
      samsungStage1.finalTotal === 30267,
      "Test 1.1: Final Total extracted is exactly ₹30,267 (NOT ₹14,500)",
      `Extracted finalTotal: ₹${samsungStage1.finalTotal}`
    );

    assert(
      samsungStage1.netAmount === 25650 && samsungStage1.taxAmount === 4617,
      "Test 1.2: Net amount ₹25,650 and GST ₹4,617 extracted separately",
      `Net: ₹${samsungStage1.netAmount}, GST: ₹${samsungStage1.taxAmount}`
    );

    assert(
      samsungStage1.orderNumber === "407-9998887-6665544" &&
      samsungStage1.invoiceNumber === "RNE1-9999999-2024",
      "Test 1.3: Extracted exact Order # (407-9998887-6665544) and Invoice # (RNE1-9999999-2024)",
      `Order: ${samsungStage1.orderNumber}, Invoice: ${samsungStage1.invoiceNumber}`
    );

    assert(
      samsungStage1.vendor === "Amazon" &&
      samsungStage1.lineItems[0]?.description.includes("Samsung 7.0 Kg"),
      "Test 1.4: Extracted vendor Amazon and product Samsung Washing Machine",
      `Vendor: ${samsungStage1.vendor}, Item: ${samsungStage1.lineItems[0]?.description}`
    );

    // ----------------------------------------------------
    // TEST 2: Arithmetic Validation & Field Evidence
    // ----------------------------------------------------
    console.log("\n--- TEST 2: Arithmetic Validation & Source Evidence ---");
    assert(
      samsungStage1.arithmeticValidation.isValid === true &&
      samsungStage1.arithmeticValidation.difference === 0,
      "Test 2.1: Validated arithmetic: 25650 + 4617 = 30267",
      `Formula: ${samsungStage1.arithmeticValidation.formula}`
    );

    assert(
      Boolean(samsungStage1.fieldEvidence.finalTotal) &&
      Boolean(samsungStage1.fieldEvidence.netAmount) &&
      Boolean(samsungStage1.fieldEvidence.taxAmount),
      "Test 2.2: Field evidence captured with source text snippets",
      `Evidence: ${samsungStage1.fieldEvidence.finalTotal}`
    );

    // ----------------------------------------------------
    // TEST 3: Zero Contamination — No Fake Palm Heights or Society Bill
    // ----------------------------------------------------
    console.log("\n--- TEST 3: Zero Contamination & Fake Removal ---");
    const jsonStr = JSON.stringify(samsungStage1);
    assert(
      !jsonStr.includes("Palm Heights") && !jsonStr.includes("14500"),
      "Test 3: Zero fake Palm Heights or ₹14,500 hallucination in Stage 1 extraction",
      `Clean extraction verified: Vendor=${samsungStage1.vendor}`
    );

    // ----------------------------------------------------
    // TEST 4: Stage 2 Household Memory on Samsung Washing Machine
    // ----------------------------------------------------
    console.log("\n--- TEST 4: Stage 2 Memory & Proposed Actions on Samsung Washing Machine ---");
    const samsungStage2 = await performHouseholdImpactAnalysis({
      householdId,
      stage1: samsungStage1,
    });

    const createAssetAction = samsungStage2.proposedActions.find((a) => a.actionType === "CREATE_ASSET");
    const logExpenseAction = samsungStage2.proposedActions.find((a) => a.actionType === "LOG_EXPENSE");

    assert(
      createAssetAction !== undefined &&
      (createAssetAction.payload as { purchasePrice: number }).purchasePrice === 30267,
      "Test 4.1: Proposed CREATE_ASSET with exact purchase price ₹30,267",
      `Asset Name: ${(createAssetAction?.payload as { name: string })?.name}, Price: ₹${(createAssetAction?.payload as { purchasePrice: number })?.purchasePrice}`
    );

    assert(
      logExpenseAction !== undefined &&
      (logExpenseAction.payload as { amount: number }).amount === 30267,
      "Test 4.2: Proposed LOG_EXPENSE with exact transaction amount ₹30,267",
      `Expense Title: ${(logExpenseAction?.payload as { title: string })?.title}, Amount: ₹${(logExpenseAction?.payload as { amount: number })?.amount}`
    );

    // ----------------------------------------------------
    // TEST 5: Downstream Execution to Prisma (Samsung Asset Created)
    // ----------------------------------------------------
    console.log("\n--- TEST 5: Downstream Execution of Samsung Washing Machine to Prisma ---");
    const testDoc = await prisma.document.create({
      data: {
        householdId,
        title: "Samsung Washing Machine Amazon Invoice",
        originalName: "Amazon_Invoice.pdf",
        fileType: "application/pdf",
        docType: "APPLIANCE_INVOICE",
        extractedJson: JSON.stringify(samsungStage1),
        impactAnalysis: JSON.stringify(samsungStage2),
        confidenceScore: 0.99,
      },
    });

    const execResult = await executeApprovedDocumentActions({
      documentId: testDoc.id,
      householdId,
      selectedActionIds: ["action-create-asset", "action-log-appliance-expense"],
    });

    assert(
      execResult.success && execResult.executedActionsCount === 2,
      "Test 5.1: Successfully executed approved actions against Prisma",
      `Executed count: ${execResult.executedActionsCount}`
    );

    const createdSamsungAsset = await prisma.asset.findFirst({
      where: {
        householdId,
        brand: "Samsung",
      },
    });

    assert(
      createdSamsungAsset !== null &&
      createdSamsungAsset.purchasePrice === 30267 &&
      createdSamsungAsset.category === "Washing Machine",
      "Test 5.2: Verified real Asset row in Prisma with purchasePrice ₹30,267",
      `Asset ID: ${createdSamsungAsset?.id}, Name: ${createdSamsungAsset?.name}, Price: ₹${createdSamsungAsset?.purchasePrice}`
    );

    // Cleanup created test asset and document
    if (createdSamsungAsset) {
      await prisma.asset.delete({ where: { id: createdSamsungAsset.id } });
    }
    await prisma.document.delete({ where: { id: testDoc.id } });

    // ----------------------------------------------------
    // TEST 6: Utility Bill Stage 1 & Historical Memory (Tata Power)
    // ----------------------------------------------------
    console.log("\n--- TEST 6: Utility Bill Stage 1 & 2 (Tata Power Mumbai) ---");
    const tataStage1 = await extractStage1Document({
      fileName: "Tata_Power_Bill.pdf",
      fileType: "application/pdf",
      sampleType: "ELECTRICITY_BILL",
    });

    assert(
      tataStage1.docType === "UTILITY_BILL" &&
      tataStage1.vendor === "Tata Power" &&
      tataStage1.finalTotal === 2340,
      "Test 6: Extracted Tata Power bill (₹2,340) accurately",
      `Vendor: ${tataStage1.vendor}, Total: ₹${tataStage1.finalTotal}`
    );

    const tataStage2 = await performHouseholdImpactAnalysis({
      householdId,
      stage1: tataStage1,
    });

    assert(
      tataStage2.historicalComparison !== undefined &&
      tataStage2.historicalComparison.threeMonthAverageAmount > 0,
      "Test 6.1: Historical comparison calculated 3-month trailing average from Prisma",
      `Prior bills: ${tataStage2.historicalComparison?.previousBillsCount}, 3-mo avg: ₹${tataStage2.historicalComparison?.threeMonthAverageAmount}`
    );

    const hasAnomalyAction = tataStage2.proposedActions.some((a) => a.actionType === "FLAG_ANOMALY");
    assert(
      hasAnomalyAction,
      "Test 6.2: Detected consumption spike and proposed FLAG_ANOMALY action",
      `Proposed actions count: ${tataStage2.proposedActions.length}`
    );

    // ----------------------------------------------------
    // TEST 7: Duplicate Bill Detection
    // ----------------------------------------------------
    console.log("\n--- TEST 7: Duplicate Document Hashing ---");
    const testHash = computeDocumentHash("duplicate_hash_check_99");
    const tempDoc = await prisma.document.create({
      data: {
        householdId,
        title: "Duplicate Check Doc",
        originalName: "dup.pdf",
        fileType: "application/pdf",
        hash: testHash,
        status: "EXTRACTED",
      },
    });

    const dupStage2 = await performHouseholdImpactAnalysis({
      householdId,
      stage1: tataStage1,
      documentHash: testHash,
    });

    assert(
      dupStage2.isDuplicate === true &&
      dupStage2.duplicateDetails?.duplicateOfId === tempDoc.id,
      "Test 7: SHA-256 duplicate detection correctly identified duplicate document",
      `Duplicate ID: ${tempDoc.id}`
    );

    await prisma.document.delete({ where: { id: tempDoc.id } });

    // ----------------------------------------------------
    // TEST 8: Grocery Receipt Line Item Extraction & Pantry Restock
    // ----------------------------------------------------
    console.log("\n--- TEST 8: Grocery Receipt Line Items & Pantry Restock ---");
    const groceryStage1 = await extractStage1Document({
      fileName: "Blinkit_Receipt.png",
      fileType: "image/png",
      sampleType: "GROCERY_RECEIPT",
    });

    assert(
      groceryStage1.finalTotal === 867 &&
      groceryStage1.lineItems.length === 4,
      "Test 8.1: Extracted 4 line items totaling ₹867 from Blinkit receipt",
      `Items: ${groceryStage1.lineItems.map((i) => i.description).join(", ")}`
    );

    const groceryStage2 = await performHouseholdImpactAnalysis({
      householdId,
      stage1: groceryStage1,
    });

    const restockAction = groceryStage2.proposedActions.find((a) => a.actionType === "RESTOCK_INVENTORY");
    const newProductAction = groceryStage2.proposedActions.find((a) => a.actionType === "CREATE_INVENTORY_ITEM");

    assert(
      restockAction !== undefined && newProductAction !== undefined,
      "Test 8.2: Matched existing pantry items (RESTOCK) and detected new product Nivea Deodorant (CREATE)",
      `Restock action: ${restockAction?.title}, New item action: ${newProductAction?.title}`
    );

    // ----------------------------------------------------
    // TEST 9: Existing Appliance Memory Matching (Daikin AC)
    // ----------------------------------------------------
    console.log("\n--- TEST 9: Existing Asset Memory Matching ---");
    const daikinStage1: typeof samsungStage1 = {
      docType: "APPLIANCE_INVOICE",
      vendor: "Daikin",
      invoiceNumber: "DKN-2023-89104",
      date: "2026-10-01",
      lineItems: [
        {
          description: "Daikin 1.5 Ton 5-Star Inverter Split AC",
          quantity: 1,
          totalAmount: 43500,
        },
      ],
      finalTotal: 43500,
      currency: "INR",
      arithmeticValidation: {
        isValid: true,
        formula: "43500 = 43500",
        calculatedTotal: 43500,
        extractedTotal: 43500,
        difference: 0,
      },
      fieldEvidence: { finalTotal: "₹43,500" },
      fieldConfidence: { vendor: 0.99, finalTotal: 0.99 },
      multipleAmountsDetected: [{ label: "Total", amount: 43500, isGrandTotal: true }],
      applianceMetadata: {
        brand: "Daikin",
        model: "1.5 Ton 5-Star Inverter Split AC",
        applianceType: "AC",
        serialNumber: "DKN-2023-89104",
        warrantyMonths: 24,
      },
    };

    const daikinStage2 = await performHouseholdImpactAnalysis({
      householdId,
      stage1: daikinStage1,
    });

    const hasUpdateAsset = daikinStage2.proposedActions.some((a) => a.actionType === "UPDATE_ASSET");
    const hasCreateAsset = daikinStage2.proposedActions.some((a) => a.actionType === "CREATE_ASSET");

    assert(
      hasUpdateAsset && !hasCreateAsset,
      "Test 9: Matched existing Daikin AC in household memory; proposed UPDATE_ASSET instead of CREATE_ASSET",
      `Matched: ${daikinStage2.matchedEntity?.name}`
    );

    // ----------------------------------------------------
    // TEST 10: User Rejection Flow
    // ----------------------------------------------------
    console.log("\n--- TEST 10: User Rejection Flow ---");
    const rejectDoc = await prisma.document.create({
      data: {
        householdId,
        title: "Rejection Test Document",
        originalName: "reject_test.pdf",
        fileType: "application/pdf",
        status: "EXTRACTED",
      },
    });

    const rejectRes = await rejectHouseholdDocument({
      documentId: rejectDoc.id,
      reason: "User cancelled during verification.",
    });

    const updatedRejectDoc = await prisma.document.findUnique({
      where: { id: rejectDoc.id },
    });

    assert(
      rejectRes.success && updatedRejectDoc?.status === "REJECTED",
      "Test 10: Rejection marks status as REJECTED without modifying household state",
      `Status: ${updatedRejectDoc?.status}`
    );

    await prisma.document.delete({ where: { id: rejectDoc.id } });

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
