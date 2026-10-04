import { CommerceProduct, CommerceVariant } from "@/lib/integrations/commerce/types";

export interface InventoryRequirement {
  inventoryItemId: string;
  requestedName: string;
  brand: string;
  productType: string;
  variant?: string;
  strength?: string;
  form?: string;
  category: string;
  currentQuantity: number;
  minimumQuantity: number;
  suggestedPurchaseQuantity: number;
  unit: string;
  criticality: "CRITICAL" | "LOW" | "NORMAL";
  reason: string;
  source: "INVENTORY_REFILL";
}

export interface UserShoppingRequirement {
  query: string;
  rawRequest: string;
  brand?: string;
  productType: string;
  variant?: string;
  strength?: string;
  form?: string;
  category?: string;
  maxBudget?: number;
  quantity: number;
  unit?: string;
  preference?: "best_value" | "cheapest" | "premium" | "exact";
  source: "USER_REQUEST";
}

export type ShoppingRequirement = InventoryRequirement | UserShoppingRequirement;

export interface CandidateFeatures {
  product: CommerceProduct;
  variant: CommerceVariant;
  title: string;
  brand: string;
  productType: string;
  variantName?: string;
  strength?: string;
  form?: string;
  packSizeStr: string;
  numericPackAmount: number;
  packUnit: string;
  price: number;
  inStock: boolean;
  isCombo: boolean;
  comboContainsUnrelated: boolean;
}

export interface CandidateScore {
  score: number;
  confidence: number;
  passedThreshold: boolean;
  matchReasons: string[];
  rejectionReasons: string[];
  isRejected: boolean;
}

export interface ProductMatchEvaluation {
  requirement: ShoppingRequirement;
  selectedProduct?: {
    name: string;
    brand?: string;
    packSize: string;
    price: number;
    variantId?: string;
    skuId?: string;
    spinId?: string;
    quantity: number;
    totalPrice: number;
  };
  confidence: number;
  status: "found" | "not_found";
  comparisonReasoning: string;
  debugLog: {
    requestedName: string;
    searchQueries: string[];
    candidateCount: number;
    selectedProductName?: string;
    matchScore: number;
    matchReasons: string[];
    rejectedCandidates: Array<{ name: string; reasons: string[] }>;
  };
}

// Known Indian household brand catalog for deterministic extraction
const KNOWN_BRANDS = [
  "amul", "aashirvaad", "fortune", "tata", "surf excel", "ariel", "tide", "wheel",
  "vim", "pril", "exo", "dettol", "crocin", "dolo", "calpol", "daawat", "india gate",
  "nivea", "dove", "engage", "axe", "park avenue", "fogg", "rexona",
  "sensodyne", "colgate", "pepsodent", "dabur", "closeup", "oral-b",
  "harpic", "domex", "lizol", "colin", "comfort", "godrej",
  "britannia", "parle", "oreo", "sunfeast", "bourbon",
  "lays", "bingo", "doritos", "pringles", "kurkure",
  "nescafe", "bru", "davidoff", "continental", "taj mahal", "red label", "wagh bakri",
  "saffola", "gemini", "dhara", "mother dairy", "nandini", "nestle", "pillsbury"
];

/**
 * Normalizes string for safe matching
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Deterministically extract brand from product or item name
 */
export function extractBrand(name: string, explicitBrand?: string | null): string {
  if (explicitBrand && explicitBrand.trim().length > 0) {
    const bLower = explicitBrand.toLowerCase().trim();
    if (bLower.includes("crocin")) return "Crocin";
    if (bLower.includes("amul")) return "Amul";
    if (bLower.includes("aashirvaad")) return "Aashirvaad";
    if (bLower.includes("fortune")) return "Fortune";
    if (bLower.includes("surf excel")) return "Surf Excel";
    if (bLower.includes("tata")) return "Tata";
    if (bLower.includes("vim")) return "Vim";
    if (bLower.includes("dettol")) return "Dettol";
    return explicitBrand.trim();
  }

  const lower = name.toLowerCase();
  for (const b of KNOWN_BRANDS) {
    if (lower.startsWith(b) || lower.includes(` ${b} `) || lower.includes(`${b} `)) {
      return b.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
  }

  const firstWord = name.trim().split(" ")[0];
  return firstWord ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1) : "Generic";
}

/**
 * Extract active medical or chemical strength (e.g. "650mg", "500mg")
 */
export function extractStrength(name: string): string | undefined {
  const match = name.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|gm|g|ml))\b/i);
  return match ? match[1].toLowerCase().replace(/\s+/g, "") : undefined;
}

/**
 * Extract pharmaceutical or physical form
 */
export function extractForm(name: string, unitOrPack?: string): string | undefined {
  const combined = `${name} ${unitOrPack || ""}`.toLowerCase();
  if (/\b(?:tablets?|tab|tabs|capsules?|caplets?)\b/i.test(combined)) return "Tablet";
  if (/\b(?:liquid|syrup|drop|drops)\b/i.test(combined)) return "Liquid";
  if (/\b(?:gel|gel\s*lemon|gel\s*mint)\b/i.test(combined)) return "Gel";
  if (/\b(?:powder)\b/i.test(combined)) return "Powder";
  if (/\b(?:roll\s*on|balm|spray|inhaler)\b/i.test(combined)) return "Roll On";
  if (/\b(?:bar|soap)\b/i.test(combined)) return "Bar";
  if (/\b(?:oil)\b/i.test(combined)) return "Oil";
  return undefined;
}

/**
 * Extract specific product variant
 */
export function extractVariant(name: string): string | undefined {
  const lower = name.toLowerCase();
  if (lower.includes("top load")) return "Top Load";
  if (lower.includes("front load")) return "Front Load";
  if (lower.includes("lemon")) return "Lemon";
  if (lower.includes("mint")) return "Mint";
  if (lower.includes("neem")) return "Neem";
  if (lower.includes("iodized") || lower.includes("vacuum evaporated")) return "Iodized";
  if (lower.includes("rock salt") || lower.includes("sendha namak")) return "Rock Salt";
  if (lower.includes("black salt") || lower.includes("kala namak")) return "Black Salt";
  if (lower.includes("milky milk")) return "Milky Milk";
  if (lower.includes("taaza")) return "Taaza";
  if (lower.includes("gold")) return "Gold";
  if (lower.includes("cow milk")) return "Cow Milk";
  if (lower.includes("shudh chakki")) return "Shudh Chakki";
  if (lower.includes("chakki fresh")) return "Chakki Fresh";
  if (lower.includes("mp sehori")) return "MP Sehori";
  if (lower.includes("multigrain")) return "Multigrain";
  if (lower.includes("sugar release")) return "Sugar Release Control";
  if (lower.includes("sunlite") || lower.includes("refined sunflower")) return "Sunlite Refined";
  if (lower.includes("fast relief")) return "Fast Relief";
  return undefined;
}

/**
 * Extract canonical product type noun
 */
export function extractProductType(name: string, category?: string): string {
  const lower = name.toLowerCase();
  if (/\b(?:crocin|paracetamol|dolo|calpol)\b/i.test(lower)) return "Paracetamol";
  if (/\b(?:cramp relief|pain relief roll on|roll on)\b/i.test(lower)) return "Pain Relief Roll On";
  if (/\b(?:atta|wheat flour|chakki atta)\b/i.test(lower)) return "Atta";
  if (/\b(?:milk)\b/i.test(lower)) return "Milk";
  if (/\b(?:sunflower oil|mustard oil|cooking oil|refined oil|edible oil|oil)\b/i.test(lower)) return "Cooking Oil";
  if (/\b(?:salt|namak)\b/i.test(lower)) return "Salt";
  if (/\b(?:detergent|washing powder|matic liquid|detergent liquid)\b/i.test(lower)) return "Detergent";
  if (/\b(?:dishwash|dish wash|dishwash gel|dishwash bar)\b/i.test(lower)) return "Dishwash";
  if (/\b(?:deodorant|deo|body spray)\b/i.test(lower)) return "Deodorant";
  if (/\b(?:toothpaste)\b/i.test(lower)) return "Toothpaste";
  if (/\b(?:shampoo)\b/i.test(lower)) return "Shampoo";
  if (/\b(?:soap|body wash|shower gel)\b/i.test(lower)) return "Soap";
  if (/\b(?:tea|chai)\b/i.test(lower)) return "Tea";
  if (/\b(?:coffee)\b/i.test(lower)) return "Coffee";
  if (/\b(?:rice|basmati)\b/i.test(lower)) return "Rice";
  if (/\b(?:biscuit|biscuits|cookies|oreo)\b/i.test(lower)) return "Biscuits";
  if (/\b(?:antiseptic)\b/i.test(lower)) return "Antiseptic";
  if (/\b(?:cleaner|harpic|lizol)\b/i.test(lower)) return "Cleaner";
  if (/\b(?:charger|cable)\b/i.test(lower)) return "Phone Charger";

  return category || "General Grocery";
}

/**
 * Transforms an inventory item from DB into an explicit Inventory Requirement Object
 */
export function buildInventoryRequirement(item: {
  id: string;
  name: string;
  brand?: string | null;
  category: string;
  quantity: number;
  minimumStock: number;
  unit: string;
  estimatedDaysRemaining?: number | null;
  isLowStock?: boolean;
}): InventoryRequirement {
  const brand = extractBrand(item.name, item.brand);
  const strength = extractStrength(item.name);
  const form = extractForm(item.name, item.unit);
  const variant = extractVariant(item.name);
  const productType = extractProductType(item.name, item.category);

  // Exact quantity calculation:
  // If stock is below buffer, deficit = minimumStock * 2 - currentQuantity
  let suggestedPurchaseQuantity = 1;
  const current = item.quantity;
  const minStock = item.minimumStock;

  if (item.unit === "L" || item.unit === "kg") {
    suggestedPurchaseQuantity = Math.max(1, Math.round(minStock * 2 - current));
  } else if (item.unit === "ml" || item.unit === "g") {
    suggestedPurchaseQuantity = Math.max(1, Math.round(minStock * 2 - current));
  } else if (item.unit === "tablets" || item.unit === "capsules" || item.unit === "pieces") {
    suggestedPurchaseQuantity = Math.max(1, Math.round(minStock * 2 - current));
  } else {
    suggestedPurchaseQuantity = Math.max(1, Math.round(minStock * 2 - current));
  }

  const isCritical = current <= 1 || (item.estimatedDaysRemaining !== null && item.estimatedDaysRemaining !== undefined && item.estimatedDaysRemaining <= 2);
  const criticality = isCritical ? "CRITICAL" : "NORMAL";

  const reason = `${item.name} is at ${current} ${item.unit}, below the ${minStock} ${item.unit} minimum threshold.`;

  return {
    inventoryItemId: item.id,
    requestedName: item.name,
    brand,
    productType,
    variant,
    strength,
    form,
    category: item.category,
    currentQuantity: current,
    minimumQuantity: minStock,
    suggestedPurchaseQuantity,
    unit: item.unit,
    criticality,
    reason,
    source: "INVENTORY_REFILL",
  };
}

/**
 * Generates tiered, progressively relaxed search queries
 * Never jumps straight to generic "detergent" or "salt"!
 */
export function generateTieredSearchQueries(req: ShoppingRequirement): string[] {
  const queries: string[] = [];

  if (req.source === "INVENTORY_REFILL") {
    const rawName = req.requestedName;
    queries.push(rawName);

    // Tier 2: Brand + productType + variant + strength
    const partsTier2: string[] = [req.brand];
    if (req.variant) partsTier2.push(req.variant);
    if (req.strength) partsTier2.push(req.strength);
    if (req.productType && !req.variant?.toLowerCase().includes(req.productType.toLowerCase())) {
      partsTier2.push(req.productType);
    }
    const t2 = partsTier2.join(" ").trim();
    if (t2 && !queries.includes(t2)) queries.push(t2);

    // Tier 3: Brand + variant
    if (req.variant) {
      const t3 = `${req.brand} ${req.variant}`.trim();
      if (!queries.includes(t3)) queries.push(t3);
    }

    // Tier 4: Brand + productType
    const t4 = `${req.brand} ${req.productType}`.trim();
    if (!queries.includes(t4)) queries.push(t4);
  } else {
    queries.push(req.query);
    if (req.brand && !req.query.toLowerCase().includes(req.brand.toLowerCase())) {
      queries.push(`${req.brand} ${req.productType}`);
    }
  }

  return queries;
}

/**
 * Extract feature vector from Instamart candidate product
 */
export function extractCandidateFeatures(
  product: CommerceProduct,
  variant: CommerceVariant,
  req: ShoppingRequirement
): CandidateFeatures {
  const title = product.name;
  const brand = extractBrand(title, product.brand);
  const variantName = extractVariant(title);
  const strength = extractStrength(title);
  const form = extractForm(title, variant.packSize);
  const productType = extractProductType(title, product.category);

  // Detect Combo containing unrelated items (e.g. "Fortune Sugar 1 kg + Tata Sampann Iodized Salt 1 kg")
  const titleLower = title.toLowerCase();
  const isCombo = titleLower.includes("combo") || titleLower.includes(" + ") || titleLower.includes("with free") || titleLower.includes("bundle");

  let comboContainsUnrelated = false;
  if (isCombo) {
    const targetType = req.productType.toLowerCase();
    if (targetType === "salt" && (titleLower.includes("sugar") || titleLower.includes("oil") || titleLower.includes("atta"))) {
      comboContainsUnrelated = true;
    } else if (targetType !== "combo") {
      comboContainsUnrelated = true;
    }
  }

  // Parse pack size
  let numericPackAmount = 1;
  let packUnit = "unit";
  const packSizeStr = variant.packSize || "";
  const sizeMatch = packSizeStr.match(/(\d+(?:\.\d+)?)\s*(kg|g|gm|l|ltr|ml|tablets?|capsules?|pieces?|pcs)/i);
  if (sizeMatch) {
    numericPackAmount = parseFloat(sizeMatch[1]);
    packUnit = sizeMatch[2].toLowerCase();
  }

  return {
    product,
    variant,
    title,
    brand,
    productType,
    variantName,
    strength,
    form,
    packSizeStr,
    numericPackAmount,
    packUnit,
    price: variant.price,
    inStock: variant.inStock,
    isCombo,
    comboContainsUnrelated,
  };
}

/**
 * Deterministic scoring engine for ranking candidates against an explicit requirement
 */
export function scoreProductCandidate(
  req: ShoppingRequirement,
  cand: CandidateFeatures
): CandidateScore {
  let score = 0;
  const matchReasons: string[] = [];
  const rejectionReasons: string[] = [];
  let isRejected = false;

  const reqProductType = req.productType.toLowerCase();
  const candProductType = cand.productType.toLowerCase();

  // 1. PRODUCT TYPE MATCHING & UNRELATED PRODUCT ELIMINATION
  if (reqProductType === candProductType) {
    score += 30;
    matchReasons.push(`✓ Exact product type match: ${req.productType}`);
  } else {
    // Check fatal product type mismatches:
    // Medicine vs Pain Roll-on
    if (reqProductType === "paracetamol" && candProductType.includes("roll on")) {
      score -= 100;
      isRejected = true;
      rejectionReasons.push(`✗ Completely unrelated product: ${cand.productType} (expected ${req.productType})`);
    } else if (reqProductType === "salt" && (candProductType.includes("sugar") || candProductType.includes("spice"))) {
      score -= 100;
      isRejected = true;
      rejectionReasons.push(`✗ Unrelated product: ${cand.productType} (expected Salt)`);
    } else if (reqProductType === "atta" && candProductType.includes("rice")) {
      score -= 100;
      isRejected = true;
      rejectionReasons.push(`✗ Unrelated product: Rice (expected Atta)`);
    } else if (reqProductType === "milk" && (candProductType.includes("curd") || candProductType.includes("cheese"))) {
      score -= 60;
      rejectionReasons.push(`✗ Dairy sub-type mismatch: ${cand.productType} (expected Milk)`);
    } else {
      score -= 30;
      rejectionReasons.push(`✗ Product type mismatch (${cand.productType} vs ${req.productType})`);
    }
  }

  // 2. BRAND MATCHING
  if (req.brand) {
    const reqBrandLower = req.brand.toLowerCase();
    const candBrandLower = cand.brand.toLowerCase();
    const candTitleLower = cand.title.toLowerCase();

    if (candBrandLower.includes(reqBrandLower) || candTitleLower.includes(reqBrandLower)) {
      score += 30;
      matchReasons.push(`✓ Exact brand match: ${req.brand}`);
    } else {
      score -= 25;
      rejectionReasons.push(`✗ Different brand: ${cand.brand} (requested ${req.brand})`);
    }
  }

  // 3. VARIANT MATCHING
  if (req.variant) {
    const reqVarLower = req.variant.toLowerCase();
    const candTitleLower = cand.title.toLowerCase();

    // Detergent: Top Load vs Front Load
    if (reqVarLower.includes("top load")) {
      if (candTitleLower.includes("top load")) {
        score += 25;
        matchReasons.push(`✓ Exact Top Load variant match`);
      } else if (candTitleLower.includes("front load")) {
        score -= 45;
        rejectionReasons.push(`✗ Wrong variant: Front Load (required Top Load)`);
      }
    } else if (reqVarLower.includes("front load")) {
      if (candTitleLower.includes("front load")) {
        score += 25;
        matchReasons.push(`✓ Exact Front Load variant match`);
      } else if (candTitleLower.includes("top load")) {
        score -= 45;
        rejectionReasons.push(`✗ Wrong variant: Top Load (required Front Load)`);
      }
    }

    // Dishwash: Lemon vs Mint
    if (reqVarLower.includes("lemon")) {
      if (candTitleLower.includes("lemon")) {
        score += 20;
        matchReasons.push(`✓ Lemon variant match`);
      } else if (candTitleLower.includes("mint") || candTitleLower.includes("neem")) {
        score -= 35;
        rejectionReasons.push(`✗ Wrong variant: Mint/Neem (required Lemon)`);
      }
    }

    // Milk: Taaza vs Milky Milk
    if (reqVarLower.includes("taaza")) {
      if (candTitleLower.includes("milky milk")) {
        score -= 45;
        rejectionReasons.push(`✗ Wrong variant: Milky Milk (flavored milk drink, not standard Taaza milk)`);
      } else if (candTitleLower.includes("taaza")) {
        score += 25;
        matchReasons.push(`✓ Exact Amul Taaza variant`);
      }
    }

    // Atta: Shudh Chakki vs Sugar Release
    if (reqVarLower.includes("shudh chakki")) {
      if (candTitleLower.includes("shudh chakki") || candTitleLower.includes("chakki fresh") || candTitleLower.includes("chakki atta")) {
        score += 20;
        matchReasons.push(`✓ Chakki Atta variant`);
      } else if (candTitleLower.includes("sugar release") || candTitleLower.includes("multigrain")) {
        score -= 25;
        rejectionReasons.push(`✗ Different specialty flour: ${cand.title}`);
      }
    }

    // Salt: Iodized
    if (reqVarLower.includes("iodized")) {
      if (candTitleLower.includes("iodized") || candTitleLower.includes("vacuum evaporated")) {
        score += 15;
        matchReasons.push(`✓ Iodized salt match`);
      }
    }
  }

  // 4. MEDICINE STRENGTH & FORM STRICT MATCHING (RULE 3)
  if (req.strength) {
    if (cand.strength === req.strength || cand.title.toLowerCase().includes(req.strength.toLowerCase())) {
      score += 20;
      matchReasons.push(`✓ Exact strength: ${req.strength}`);
    } else {
      score -= 40;
      isRejected = true;
      rejectionReasons.push(`✗ Strength mismatch (required ${req.strength})`);
    }
  }

  if (req.form) {
    if (cand.form?.toLowerCase() === req.form.toLowerCase()) {
      score += 10;
      matchReasons.push(`✓ Exact form match: ${req.form}`);
    } else if (cand.form && cand.form !== req.form) {
      score -= 40;
      isRejected = true;
      rejectionReasons.push(`✗ Conflicting form: ${cand.form} (required ${req.form})`);
    }
  }

  // 5. COMBO PENALTY (RULE 4)
  if (cand.isCombo && cand.comboContainsUnrelated) {
    score -= 50;
    isRejected = true;
    rejectionReasons.push(`✗ Combo pack containing unrelated product: ${cand.title}`);
  }

  // 6. BUDGET CONSTRAINTS (For user requests)
  if (req.source === "USER_REQUEST" && req.maxBudget) {
    if (cand.price <= req.maxBudget) {
      score += 10;
      matchReasons.push(`✓ Price ₹${cand.price} within budget of ₹${req.maxBudget}`);
    } else {
      score -= 60;
      isRejected = true;
      rejectionReasons.push(`✗ Price ₹${cand.price} exceeds budget of ₹${req.maxBudget}`);
    }
  }

  // 7. STOCK AVAILABILITY
  if (cand.inStock) {
    score += 10;
    matchReasons.push(`✓ In stock at delivery darkstore`);
  } else {
    score -= 50;
    isRejected = true;
    rejectionReasons.push(`✗ Variant out of stock`);
  }

  const confidence = Math.max(0, Math.min(1, score / 100));
  const isMedicine = ("category" in req && req.category === "Medicines") || reqProductType === "paracetamol";
  const requiredConfidence = isMedicine ? 0.75 : 0.65;

  const passedThreshold = !isRejected && confidence >= requiredConfidence;

  return {
    score,
    confidence,
    passedThreshold,
    matchReasons,
    rejectionReasons,
    isRejected,
  };
}

/**
 * Calculates optimal pack count and total delivered amount based on deficit
 */
export function calculatePacks(
  req: ShoppingRequirement,
  cand: CandidateFeatures
): {
  quantity: number;
  packSize: string;
  totalSupplied: number;
  unit: string;
  explanation: string;
} {
  const isInventoryRefill = req.source === "INVENTORY_REFILL";
  const needed = isInventoryRefill ? req.suggestedPurchaseQuantity : req.quantity;
  const packSize = cand.packSizeStr || "Standard";

  let quantity = 1;
  let totalSupplied = cand.numericPackAmount;

  if (cand.numericPackAmount > 0 && isInventoryRefill) {
    // Normalization check: if deficit is in g/ml but pack is in kg/L
    let normalizedNeeded = needed;
    if ((req.unit === "ml" || req.unit === "g") && (cand.packUnit === "l" || cand.packUnit === "ltr" || cand.packUnit === "kg")) {
      normalizedNeeded = needed / 1000;
    }

    const calculatedPacks = Math.ceil(normalizedNeeded / cand.numericPackAmount);

    // Apply quick-commerce bike weight limit guards
    // If pack is 5kg, cap at 2 packs (= 10kg) to avoid canceling order due to bike overweight
    if (cand.numericPackAmount >= 4) {
      quantity = Math.max(1, Math.min(calculatedPacks, 2));
    } else {
      quantity = Math.max(1, Math.min(calculatedPacks, cand.variant.maxQuantity || 3));
    }

    totalSupplied = quantity * cand.numericPackAmount;
  } else {
    const reqQty = isInventoryRefill ? req.suggestedPurchaseQuantity : (req.quantity || 1);
    quantity = Math.max(1, Math.min(reqQty, cand.variant.maxQuantity || 2));
    totalSupplied = quantity * (cand.numericPackAmount || 1);
  }

  const defaultUnit = isInventoryRefill ? req.unit : "units";
  const unit = cand.packUnit || defaultUnit;
  const explanation = isInventoryRefill
    ? `Selected ${cand.title} (${packSize} × ${quantity} = ${totalSupplied} ${unit} to satisfy ${needed} ${req.unit} refill requirement)`
    : `Selected ${cand.title} (${packSize} × ${quantity}) per your request`;

  return {
    quantity,
    packSize,
    totalSupplied,
    unit,
    explanation,
  };
}

/**
 * Natural language intent parser for both refill and arbitrary multi-item requests
 */
export function parseShoppingIntentRobust(query: string): {
  refillLowStock: boolean;
  adHocItems: UserShoppingRequirement[];
} {
  const q = query.trim();
  const lower = q.toLowerCase();

  // 1. Check refill intent
  const refillKeywords = [
    "refill", "replenish", "restock", "running low", "run out",
    "low stock", "depleted", "refill everything", "refill the house", "refill inventory"
  ];
  const refillLowStock = refillKeywords.some((kw) => lower.includes(kw));

  // 2. Extract budget constraint
  let globalBudget: number | undefined;
  const budgetMatch = lower.match(/(?:under|below|less than)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
  if (budgetMatch) {
    globalBudget = parseInt(budgetMatch[1], 10);
  }

  // 3. Extract ad-hoc item requests
  const adHocItems: UserShoppingRequirement[] = [];

  // Remove standard "refill inventory" prefix to isolate explicit requests
  let cleanQuery = lower
    .replace(/^refill\s+(?:the\s+)?inventory\s*(?:and\s+also|and\s+add|and|also)?/i, "")
    .replace(/^refill\s+everything\s*(?:and\s+also|and\s+add|and|also)?/i, "")
    .trim();

  if (cleanQuery.length > 0) {
    // Split compound requests on " and ", " also ", ","
    const segments = cleanQuery.split(/,|\band\b|\balso\b/i).map((s) => s.trim()).filter(Boolean);

    for (const seg of segments) {
      // Clean leading verbs: "add", "order", "buy", "get me", "purchase"
      let cleanSeg = seg.replace(/^(?:add|order|buy|get\s*me|get|purchase)\s+/i, "").trim();
      if (!cleanSeg || cleanSeg === "inventory" || cleanSeg === "everything") continue;

      // Extract quantity from segment: e.g. "2 deodorants", "two bottles of milk", "3 packs of biscuits"
      let segQty = 1;
      const qtyMatch = cleanSeg.match(/^(?:(\d+|one|two|three|four|five)\s*(?:packs?|bottles?|units?|packets?|boxes?)?\s*(?:of)?\s*)/i);
      if (qtyMatch && qtyMatch[1]) {
        const val = qtyMatch[1].toLowerCase();
        if (val === "two" || val === "2") segQty = 2;
        else if (val === "three" || val === "3") segQty = 3;
        else if (val === "four" || val === "4") segQty = 4;
        else if (val === "five" || val === "5") segQty = 5;
        else {
          const num = parseInt(val, 10);
          if (!isNaN(num) && num > 0) segQty = num;
        }
        cleanSeg = cleanSeg.replace(qtyMatch[0], "").trim();
      }

      // Extract segment-specific budget if present
      let segBudget = globalBudget;
      const segBudgetMatch = cleanSeg.match(/(?:under|below|less than)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
      if (segBudgetMatch) {
        segBudget = parseInt(segBudgetMatch[1], 10);
        cleanSeg = cleanSeg.replace(segBudgetMatch[0], "").trim();
      }

      // Extract brand from segment if present
      let detectedBrand: string | undefined;
      for (const b of KNOWN_BRANDS) {
        if (cleanSeg.includes(b)) {
          detectedBrand = b.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
          break;
        }
      }

      const productType = extractProductType(cleanSeg);

      if (cleanSeg) {
        adHocItems.push({
          query: cleanSeg,
          rawRequest: seg,
          brand: detectedBrand,
          productType,
          quantity: segQty,
          maxBudget: segBudget,
          source: "USER_REQUEST",
        });
      }
    }
  }

  return {
    refillLowStock: refillLowStock || (adHocItems.length === 0),
    adHocItems,
  };
}
