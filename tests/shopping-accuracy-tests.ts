import assert from "assert";
import {
  buildInventoryRequirement,
  generateTieredSearchQueries,
  extractCandidateFeatures,
  scoreProductCandidate,
  calculatePacks,
  parseShoppingIntentRobust,
  ShoppingRequirement,
  CandidateFeatures,
} from "../lib/services/product-matcher";
import { parseShoppingIntent, executeShoppingWorkflow } from "../lib/services/shopping-agent-service";
import { CommerceProduct, CommerceVariant } from "../lib/integrations/commerce/types";
import { prisma } from "../lib/db/prisma";

async function runShoppingAccuracyTests() {
  console.log("==================================================");
  console.log("🎯 RUNNING HH-OS SHOPPING ACCURACY TEST SUITE");
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

  // ----------------------------------------------------
  // SECTION 1: INVENTORY REQUIREMENT OBJECTS
  // ----------------------------------------------------
  console.log("--- 1. Testing Inventory Requirement Transformation ---");

  test("transforms Aashirvaad Atta into structured requirement with 9kg purchase target", () => {
    const req = buildInventoryRequirement({
      id: "item-atta",
      name: "Aashirvaad Shudh Chakki Atta",
      brand: "Aashirvaad",
      category: "Groceries",
      quantity: 1.2,
      minimumStock: 5,
      unit: "kg",
      estimatedDaysRemaining: 2,
    });
    assert.strictEqual(req.brand, "Aashirvaad");
    assert.strictEqual(req.productType, "Atta");
    assert.strictEqual(req.variant, "Shudh Chakki");
    assert.strictEqual(req.suggestedPurchaseQuantity, 9);
    assert.strictEqual(req.criticality, "CRITICAL");
  });

  test("transforms Amul Milk into structured requirement with 4L purchase target", () => {
    const req = buildInventoryRequirement({
      id: "item-milk",
      name: "Amul Taaza Homogenised Milk",
      brand: "Amul",
      category: "Dairy",
      quantity: 0.5,
      minimumStock: 2,
      unit: "L",
      estimatedDaysRemaining: 0,
    });
    assert.strictEqual(req.brand, "Amul");
    assert.strictEqual(req.productType, "Milk");
    assert.strictEqual(req.variant, "Taaza");
    assert.strictEqual(req.suggestedPurchaseQuantity, 4);
    assert.strictEqual(req.criticality, "CRITICAL");
  });

  test("transforms Crocin into medicine requirement with strength and form", () => {
    const req = buildInventoryRequirement({
      id: "item-crocin",
      name: "Crocin 650mg Fast Relief Paracetamol",
      brand: "Crocin",
      category: "Medicines",
      quantity: 4,
      minimumStock: 15,
      unit: "tablets",
      estimatedDaysRemaining: 4,
    });
    assert.strictEqual(req.brand, "Crocin");
    assert.strictEqual(req.productType, "Paracetamol");
    assert.strictEqual(req.strength, "650mg");
    assert.strictEqual(req.form, "Tablet");
    assert.strictEqual(req.suggestedPurchaseQuantity, 26);
  });

  test("transforms Surf Excel into detergent requirement with Top Load variant", () => {
    const req = buildInventoryRequirement({
      id: "item-surf",
      name: "Surf Excel Matic Top Load Detergent Liquid",
      brand: "Surf Excel",
      category: "Cleaning",
      quantity: 0.4,
      minimumStock: 2,
      unit: "L",
      estimatedDaysRemaining: 4,
    });
    assert.strictEqual(req.brand, "Surf Excel");
    assert.strictEqual(req.productType, "Detergent");
    assert.strictEqual(req.variant, "Top Load");
    assert.strictEqual(req.form, "Liquid");
    assert.strictEqual(req.suggestedPurchaseQuantity, 4);
  });

  test("transforms Vim into dishwash requirement with Lemon variant", () => {
    const req = buildInventoryRequirement({
      id: "item-vim",
      name: "Vim Dishwash Gel Lemon",
      brand: "Vim",
      category: "Cleaning",
      quantity: 120,
      minimumStock: 500,
      unit: "ml",
      estimatedDaysRemaining: 4,
    });
    assert.strictEqual(req.brand, "Vim");
    assert.strictEqual(req.productType, "Dishwash");
    assert.strictEqual(req.variant, "Lemon");
    assert.strictEqual(req.form, "Gel");
    assert.strictEqual(req.suggestedPurchaseQuantity, 880);
  });

  // ----------------------------------------------------
  // SECTION 2: TIERED SEARCH QUERIES
  // ----------------------------------------------------
  console.log("\n--- 2. Testing Tiered Search Query Strategy ---");

  test("generates specific tiered queries for Surf Excel Top Load without jumping to generic detergent", () => {
    const req = buildInventoryRequirement({
      id: "item-surf",
      name: "Surf Excel Matic Top Load Detergent Liquid",
      brand: "Surf Excel",
      category: "Cleaning",
      quantity: 0.4,
      minimumStock: 2,
      unit: "L",
    });
    const queries = generateTieredSearchQueries(req);
    assert(queries.length >= 3);
    assert.strictEqual(queries[0], "Surf Excel Matic Top Load Detergent Liquid");
    assert(queries.some((q) => q.includes("Surf Excel") && q.includes("Top Load")));
    // Must NOT contain bare "detergent"
    assert(!queries.includes("detergent"));
  });

  test("generates specific tiered queries for Crocin without jumping to pain relief", () => {
    const req = buildInventoryRequirement({
      id: "item-crocin",
      name: "Crocin 650mg Fast Relief Paracetamol",
      brand: "Crocin",
      category: "Medicines",
      quantity: 4,
      minimumStock: 15,
      unit: "tablets",
    });
    const queries = generateTieredSearchQueries(req);
    assert(queries.length >= 2);
    assert(queries[0].includes("Crocin"));
    assert(!queries.includes("pain relief"));
    assert(!queries.includes("roll on"));
  });

  // ----------------------------------------------------
  // SECTION 3: DETERMINISTIC SCORING & CANDIDATE VALIDATION
  // ----------------------------------------------------
  console.log("\n--- 3. Testing Candidate Scoring Rules ---");

  test("RULE 4: Tata Salt rejects Sugar + Salt combo pack", () => {
    const req = buildInventoryRequirement({
      id: "item-salt",
      name: "Tata Salt Vacuum Evaporated Iodized",
      brand: "Tata",
      category: "Spices",
      quantity: 0.3,
      minimumStock: 1,
      unit: "kg",
    });

    const comboCandidate: CandidateFeatures = {
      product: { id: "p1", name: "Fortune Sugar 1 kg + Tata Sampann Iodized Salt 1 kg", variants: [] },
      variant: { id: "v1", name: "1 Combo", price: 99, inStock: true, packSize: "1 Combo" },
      title: "Fortune Sugar 1 kg + Tata Sampann Iodized Salt 1 kg",
      brand: "Fortune",
      productType: "Salt",
      variantName: "Iodized",
      packSizeStr: "1 Combo",
      numericPackAmount: 1,
      packUnit: "combo",
      price: 99,
      inStock: true,
      isCombo: true,
      comboContainsUnrelated: true,
    };

    const exactCandidate: CandidateFeatures = {
      product: { id: "p2", name: "Tata Salt Vacuum Evaporated Iodized Salt", variants: [] },
      variant: { id: "v2", name: "1 kg", price: 28, inStock: true, packSize: "1 kg" },
      title: "Tata Salt Vacuum Evaporated Iodized Salt",
      brand: "Tata",
      productType: "Salt",
      variantName: "Iodized",
      packSizeStr: "1 kg",
      numericPackAmount: 1,
      packUnit: "kg",
      price: 28,
      inStock: true,
      isCombo: false,
      comboContainsUnrelated: false,
    };

    const comboScore = scoreProductCandidate(req, comboCandidate);
    const exactScore = scoreProductCandidate(req, exactCandidate);

    assert.strictEqual(comboScore.passedThreshold, false);
    assert(comboScore.rejectionReasons.some((r) => r.includes("Combo pack")));
    assert.strictEqual(exactScore.passedThreshold, true);
    assert(exactScore.score > 80);
  });

  test("RULE 3: Crocin 650mg rejects Nua Cramp Relief Roll On", () => {
    const req = buildInventoryRequirement({
      id: "item-crocin",
      name: "Crocin 650mg Fast Relief Paracetamol",
      brand: "Crocin",
      category: "Medicines",
      quantity: 4,
      minimumStock: 15,
      unit: "tablets",
    });

    const rollOnCandidate: CandidateFeatures = {
      product: { id: "p1", name: "Nua Cramp Relief Roll On", variants: [] },
      variant: { id: "v1", name: "40 ml", price: 259, inStock: true, packSize: "40 ml" },
      title: "Nua Cramp Relief Roll On",
      brand: "Nua",
      productType: "Pain Relief Roll On",
      packSizeStr: "40 ml",
      numericPackAmount: 40,
      packUnit: "ml",
      price: 259,
      inStock: true,
      isCombo: false,
      comboContainsUnrelated: false,
      form: "Roll On",
    };

    const realCrocinCandidate: CandidateFeatures = {
      product: { id: "p2", name: "Crocin 650mg Fast Relief Tablet", variants: [] },
      variant: { id: "v2", name: "15 tablets", price: 34, inStock: true, packSize: "15 tablets" },
      title: "Crocin 650mg Fast Relief Tablet",
      brand: "Crocin",
      productType: "Paracetamol",
      strength: "650mg",
      form: "Tablet",
      packSizeStr: "15 tablets",
      numericPackAmount: 15,
      packUnit: "tablets",
      price: 34,
      inStock: true,
      isCombo: false,
      comboContainsUnrelated: false,
    };

    const rollOnScore = scoreProductCandidate(req, rollOnCandidate);
    const realCrocinScore = scoreProductCandidate(req, realCrocinCandidate);

    assert.strictEqual(rollOnScore.passedThreshold, false);
    assert.strictEqual(rollOnScore.isRejected, true);
    assert(rollOnScore.rejectionReasons.some((r) => r.includes("unrelated product")));

    assert.strictEqual(realCrocinScore.passedThreshold, true);
    assert(realCrocinScore.score >= 90);
  });

  test("RULE 2: Surf Excel Top Load rejects Front Load", () => {
    const req = buildInventoryRequirement({
      id: "item-surf",
      name: "Surf Excel Matic Top Load Detergent Liquid",
      brand: "Surf Excel",
      category: "Cleaning",
      quantity: 0.4,
      minimumStock: 2,
      unit: "L",
    });

    const frontLoadCandidate: CandidateFeatures = {
      product: { id: "p1", name: "Surf Excel Matic liquid Front Load New pouch", variants: [] },
      variant: { id: "v1", name: "2 L", price: 420, inStock: true, packSize: "2 L" },
      title: "Surf Excel Matic liquid Front Load New pouch",
      brand: "Surf Excel",
      productType: "Detergent",
      variantName: "Front Load",
      form: "Liquid",
      packSizeStr: "2 L",
      numericPackAmount: 2,
      packUnit: "l",
      price: 420,
      inStock: true,
      isCombo: false,
      comboContainsUnrelated: false,
    };

    const topLoadCandidate: CandidateFeatures = {
      product: { id: "p2", name: "Surf Excel Matic Top Load Detergent Liquid", variants: [] },
      variant: { id: "v2", name: "2 L", price: 430, inStock: true, packSize: "2 L" },
      title: "Surf Excel Matic Top Load Detergent Liquid",
      brand: "Surf Excel",
      productType: "Detergent",
      variantName: "Top Load",
      form: "Liquid",
      packSizeStr: "2 L",
      numericPackAmount: 2,
      packUnit: "l",
      price: 430,
      inStock: true,
      isCombo: false,
      comboContainsUnrelated: false,
    };

    const flScore = scoreProductCandidate(req, frontLoadCandidate);
    const tlScore = scoreProductCandidate(req, topLoadCandidate);

    assert(tlScore.score > flScore.score + 50);
    assert(flScore.rejectionReasons.some((r) => r.includes("Front Load")));
    assert.strictEqual(tlScore.passedThreshold, true);
  });

  test("RULE 1: Amul Taaza rejects Milky Milk flavored milk drink", () => {
    const req = buildInventoryRequirement({
      id: "item-milk",
      name: "Amul Taaza Homogenised Milk",
      brand: "Amul",
      category: "Dairy",
      quantity: 0.5,
      minimumStock: 2,
      unit: "L",
    });

    const milkyMilkCandidate: CandidateFeatures = {
      product: { id: "p1", name: "Amul Taaza Milky Milk", variants: [] },
      variant: { id: "v1", name: "4 Pieces", price: 112, inStock: true, packSize: "4 Pieces" },
      title: "Amul Taaza Milky Milk",
      brand: "Amul",
      productType: "Milk",
      variantName: "Milky Milk",
      packSizeStr: "4 Pieces",
      numericPackAmount: 4,
      packUnit: "pieces",
      price: 112,
      inStock: true,
      isCombo: false,
      comboContainsUnrelated: false,
    };

    const realTaazaCandidate: CandidateFeatures = {
      product: { id: "p2", name: "Amul Taaza Homogenised Toned Milk", variants: [] },
      variant: { id: "v2", name: "1 L", price: 54, inStock: true, packSize: "1 L" },
      title: "Amul Taaza Homogenised Toned Milk",
      brand: "Amul",
      productType: "Milk",
      variantName: "Taaza",
      packSizeStr: "1 L",
      numericPackAmount: 1,
      packUnit: "l",
      price: 54,
      inStock: true,
      isCombo: false,
      comboContainsUnrelated: false,
    };

    const mmScore = scoreProductCandidate(req, milkyMilkCandidate);
    const rtScore = scoreProductCandidate(req, realTaazaCandidate);

    assert(rtScore.score > mmScore.score + 50);
    assert(mmScore.rejectionReasons.some((r) => r.includes("Milky Milk")));
    assert.strictEqual(rtScore.passedThreshold, true);
  });

  test("RULE 5: Pack calculation handles 5kg pack x 2 for 9kg Atta deficit", () => {
    const req = buildInventoryRequirement({
      id: "item-atta",
      name: "Aashirvaad Shudh Chakki Atta",
      brand: "Aashirvaad",
      category: "Groceries",
      quantity: 1.2,
      minimumStock: 5,
      unit: "kg",
    });

    const cand: CandidateFeatures = {
      product: { id: "p-atta", name: "Aashirvaad Shudh Chakki Atta", variants: [] },
      variant: { id: "v-5kg", name: "5 kg", price: 248, inStock: true, packSize: "5 kg" },
      title: "Aashirvaad Shudh Chakki Atta",
      brand: "Aashirvaad",
      productType: "Atta",
      variantName: "Shudh Chakki",
      packSizeStr: "5 kg",
      numericPackAmount: 5,
      packUnit: "kg",
      price: 248,
      inStock: true,
      isCombo: false,
      comboContainsUnrelated: false,
    };

    const packInfo = calculatePacks(req, cand);
    assert.strictEqual(packInfo.quantity, 2);
    assert.strictEqual(packInfo.totalSupplied, 10);
    assert(packInfo.explanation.includes("5 kg × 2 = 10 kg to satisfy 9 kg refill requirement"));
  });

  // ----------------------------------------------------
  // SECTION 4: ARBITRARY REQUESTS & PARSING
  // ----------------------------------------------------
  console.log("\n--- 4. Testing Arbitrary Request Parsing ---");

  test("parses 'Add deodorant under ₹500'", () => {
    const res = parseShoppingIntent("Add deodorant under ₹500");
    assert.strictEqual(res.adHocItems.length, 1);
    assert.strictEqual(res.adHocItems[0].query, "deodorant");
    assert.strictEqual(res.adHocItems[0].maxBudget, 500);
  });

  test("parses 'Add toothpaste and shampoo' into two independent requirements", () => {
    const res = parseShoppingIntent("Add toothpaste and shampoo");
    assert(res.adHocItems.length >= 2);
    const tp = res.adHocItems.find((it) => it.query.includes("toothpaste"));
    const sp = res.adHocItems.find((it) => it.query.includes("shampoo"));
    assert(tp !== undefined);
    assert(sp !== undefined);
  });

  test("parses 'Buy Tata Salt' as explicit request", () => {
    const res = parseShoppingIntent("Buy Tata Salt");
    assert(res.adHocItems.length >= 1);
    assert(res.adHocItems[0].query.toLowerCase().includes("salt"));
    assert.strictEqual(res.adHocItems[0].brand, "Tata");
  });

  test("parses 'Refill inventory and add deodorant under ₹500'", () => {
    const res = parseShoppingIntent("Refill inventory and add deodorant under ₹500");
    assert.strictEqual(res.refillLowStock, true);
    assert.strictEqual(res.adHocItems.length, 1);
    assert.strictEqual(res.adHocItems[0].query, "deodorant");
    assert.strictEqual(res.adHocItems[0].maxBudget, 500);
  });

  // ----------------------------------------------------
  // SECTION 5: LIVE WORKFLOW END-TO-END EXECUTION
  // ----------------------------------------------------
  console.log("\n--- 5. Testing Live End-to-End Workflow Accuracy ---");

  await test("executeShoppingWorkflow selects accurate products and rejects unrelated items", async () => {
    const workflow = await executeShoppingWorkflow({
      request: "Refill inventory and add deodorant under ₹500",
    });

    if (workflow.authenticated) {
      assert.strictEqual(workflow.success, true);
      assert(workflow.merchantCart !== null);

      // Verify no combo pack was added for salt
      const saltCartItem = workflow.merchantCart?.items.find((it) => it.productName.toLowerCase().includes("salt"));
      if (saltCartItem) {
        assert(!saltCartItem.productName.toLowerCase().includes("sugar"));
        assert(!saltCartItem.productName.toLowerCase().includes("combo"));
      }

      // Verify no cramp relief was added for Crocin
      const crocinCartItem = workflow.merchantCart?.items.find(
        (it) => it.productName.toLowerCase().includes("crocin") || it.productName.toLowerCase().includes("cramp")
      );
      if (crocinCartItem) {
        assert(!crocinCartItem.productName.toLowerCase().includes("nua"));
        assert(!crocinCartItem.productName.toLowerCase().includes("roll on"));
      }

      // Verify deodorant budget constraint
      const deoCartItem = workflow.merchantCart?.items.find((it) => it.productName.toLowerCase().includes("deodorant"));
      if (deoCartItem) {
        assert(deoCartItem.unitPrice <= 500);
      }
    } else {
      assert.strictEqual(workflow.authenticated, false);
      assert.strictEqual(workflow.authUrl, "/api/auth/swiggy/connect");
    }
  });

  console.log("\n==================================================");
  console.log(`🏁 TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runShoppingAccuracyTests()
  .catch((e) => {
    console.error("Test execution fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
