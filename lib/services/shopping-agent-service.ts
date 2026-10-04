import { prisma } from "@/lib/db/prisma";
import { getCommerceProvider } from "@/lib/integrations/commerce/provider";
import {
  CommerceProduct,
  CommerceVariant,
  CommerceCart,
  CommerceAddress,
} from "@/lib/integrations/commerce/types";
import { SwiggyAuthError } from "@/lib/integrations/commerce/swiggy-instamart/client";
import { getSwiggySession } from "@/lib/integrations/commerce/swiggy-instamart/auth";
import {
  InventoryRequirement,
  UserShoppingRequirement,
  ShoppingRequirement,
  CandidateFeatures,
  CandidateScore,
  buildInventoryRequirement,
  generateTieredSearchQueries,
  extractCandidateFeatures,
  scoreProductCandidate,
  calculatePacks,
  extractBrand,
  extractProductType,
} from "@/lib/services/product-matcher";
import { syncAndMergeCartWithInstamart } from "@/lib/services/cart-sync-service";

export interface ParsedShoppingIntent {
  refillLowStock: boolean;
  adHocItems: Array<{
    query: string;
    brand?: string;
    maxBudget?: number;
    preferredPackSize?: string;
    quantity?: number;
    preference?: "best_value" | "cheapest" | "premium" | "exact";
  }>;
}

export interface ShoppingWorkflowResult {
  success: boolean;
  authenticated: boolean;
  addressRequired?: boolean;
  addresses?: CommerceAddress[];
  selectedAddress?: CommerceAddress;
  message: string;
  authUrl?: string;
  error?: string;
  inventoryRefillItems: Array<{
    itemName: string;
    requiredQuantity: string;
    selectedProduct?: {
      name: string;
      brand?: string;
      packSize: string;
      price: number;
      variantId?: string;
      skuId?: string;
    };
    comparisonReasoning?: string;
    status: "found" | "not_found";
  }>;
  additionalItems: Array<{
    query: string;
    userIntent: string;
    selectedProduct?: {
      name: string;
      brand?: string;
      packSize: string;
      price: number;
      variantId?: string;
      skuId?: string;
    };
    comparisonReasoning?: string;
    status: "found" | "not_found";
  }>;
  merchantCart: CommerceCart | null;
  totalEstimatedCost: number;
  openMerchantUrl: string;
}

/**
 * Natural language intent parser for inventory refill and arbitrary shopping requests
 */
export function parseShoppingIntent(query: string): ParsedShoppingIntent {
  const q = query.trim();
  const lower = q.toLowerCase();

  // 1. Detect if inventory replenishment is requested
  const refillKeywords = [
    "refill",
    "replenish",
    "restock",
    "running low",
    "run out",
    "low stock",
    "depleted",
    "refill everything",
    "refill the house",
    "refill inventory",
  ];
  const refillLowStock = refillKeywords.some((kw) => lower.includes(kw));

  // 2. Extract budget constraints: e.g. "under 500", "below ₹500", "under rs 400"
  let globalBudget: number | undefined;
  const budgetMatch = lower.match(/(?:under|below|less than)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
  if (budgetMatch) {
    globalBudget = parseInt(budgetMatch[1], 10);
  }

  // 3. Extract ad-hoc item requests
  const adHocItems: ParsedShoppingIntent["adHocItems"] = [];

  // Strip standard refill command prefix to isolate explicit addition clauses
  let remainingQuery = lower
    .replace(/^refill\s+(?:the\s+)?inventory\s*(?:and\s+also|and\s+add|and|also)?/i, "")
    .replace(/^refill\s+everything\s*(?:and\s+also|and\s+add|and|also)?/i, "")
    .trim();

  // Check specific brand preferences like "preferably Sensodyne"
  let preferredBrandGlob: string | undefined;
  const prefBrandMatch = lower.match(/(?:preferably|brand:?|prefer)\s+([a-z0-9\s]+?)(?:$|\.|\band\b)/i);
  if (prefBrandMatch && prefBrandMatch[1]) {
    const rawB = prefBrandMatch[1].trim();
    preferredBrandGlob = rawB.charAt(0).toUpperCase() + rawB.slice(1);
  }

  // If query had explicit multi-item split or additions
  const segments = (remainingQuery || lower)
    .split(/,|\band\s+(?:also\s+)?|\balso\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const seg of segments) {
    if (!seg || seg === "refill" || seg === "refill inventory" || seg === "inventory") continue;

    // Check quantity
    let segQty = 1;
    const qtyMatch = seg.match(/(?:(\d+|one|two|three|four|five)\s*(?:bottles?|packs?|boxes?|packets?|units?|pouches?)?\s*(?:of)?\s*)/i);
    if (qtyMatch && qtyMatch[1]) {
      const val = qtyMatch[1].toLowerCase();
      if (val === "two" || val === "2") segQty = 2;
      else if (val === "three" || val === "3") segQty = 3;
      else if (val === "four" || val === "4") segQty = 4;
      else if (val === "five" || val === "5") segQty = 5;
      else {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0) segQty = parsed;
      }
    }

    // Check item-specific budget
    let segBudget = globalBudget;
    const segBudgetMatch = seg.match(/(?:under|below|less than)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
    if (segBudgetMatch) {
      segBudget = parseInt(segBudgetMatch[1], 10);
    }

    // Clean verbs: "add", "buy", "get me", "order"
    let cleanItem = seg
      .replace(/^(?:add\s+(?:a\s+|an\s+)?|get\s+(?:me\s+)?|order\s+|buy\s+)/i, "")
      .replace(/(?:under|below|less than)\s*(?:₹|rs\.?|inr)?\s*\d+/i, "")
      .replace(/(?:preferably|brand:?|prefer)\s+[a-z0-9\s]+/i, "")
      .replace(/(?:two|three|four|five|\d+)\s*(?:bottles?|packs?|boxes?|packets?|units?|pouches?)?\s*(?:of)?/i, "")
      .replace(/[.,;!?]/g, "")
      .trim();

    if (!cleanItem || cleanItem === "inventory" || cleanItem === "everything") continue;

    // Extract brand
    const detectedBrand = preferredBrandGlob || extractBrand(cleanItem);
    const finalBrand = detectedBrand !== "Generic" ? detectedBrand : undefined;

    // Canonical query simplification
    let normalizedQuery = cleanItem;
    if (cleanItem.includes("deodorant")) normalizedQuery = "deodorant";
    else if (cleanItem.includes("toothpaste")) normalizedQuery = "toothpaste";
    else if (cleanItem.includes("shampoo")) normalizedQuery = "shampoo";
    else if (cleanItem.includes("biscuit")) normalizedQuery = "biscuits";
    else if (cleanItem.includes("milk")) normalizedQuery = "milk";

    // Deduplicate within adHocItems
    if (!adHocItems.some((it) => it.query.toLowerCase() === normalizedQuery.toLowerCase())) {
      adHocItems.push({
        query: normalizedQuery,
        brand: finalBrand,
        maxBudget: segBudget,
        quantity: segQty,
        preference: "best_value",
      });
    }
  }

  // Fallback for direct "Get me a deodorant under ₹500" if no segment was parsed
  if (adHocItems.length === 0 && (lower.includes("deodorant") || lower.includes("toothpaste") || lower.includes("shampoo") || lower.includes("charger"))) {
    if (lower.includes("deodorant")) {
      adHocItems.push({ query: "deodorant", maxBudget: globalBudget, quantity: 1, preference: "best_value" });
    } else if (lower.includes("toothpaste")) {
      adHocItems.push({ query: "toothpaste", brand: preferredBrandGlob, maxBudget: globalBudget, quantity: 1, preference: "best_value" });
    } else if (lower.includes("shampoo")) {
      adHocItems.push({ query: "shampoo", maxBudget: globalBudget, quantity: 1, preference: "best_value" });
    }
  }

  return {
    refillLowStock: refillLowStock || adHocItems.length === 0,
    adHocItems,
  };
}

/**
 * Executes end-to-end shopping workflow on real Swiggy Instamart MCP with high-accuracy matching:
 * 1. Verifies OAuth authentication (truthful error if not connected).
 * 2. Fetches saved delivery addresses.
 * 3. Transforms inventory items needing replenishment into explicit InventoryRequirement objects.
 * 4. Transforms ad-hoc user requests into UserShoppingRequirement objects.
 * 5. Applies tiered live catalog search queries.
 * 6. Deterministically scores and validates product candidates against brand, productType, variant, strength, form, combos.
 * 7. Calculates optimal consumer pack quantities based on replenishment deficit.
 * 8. Rejects invalid / unrelated products without inventing fake items.
 * 9. Calls update_cart on Swiggy Instamart MCP and mirrors items to Prisma CartItem table.
 */
export async function executeShoppingWorkflow(options: {
  request?: string;
  refillLowStock?: boolean;
  explicitItems?: Array<{
    query: string;
    brand?: string;
    maxBudget?: number;
    preferredPackSize?: string;
    quantity?: number;
    preference?: "best_value" | "cheapest" | "premium" | "exact";
  }>;
  householdId?: string;
}): Promise<ShoppingWorkflowResult> {
  const { request = "Refill inventory", householdId } = options;
  const provider = await getCommerceProvider(householdId);

  // 1. Verify authentication
  const isAuth = await provider.isAuthenticated();
  if (!isAuth) {
    return {
      success: false,
      authenticated: false,
      message:
        "Swiggy Instamart isn't connected yet. Connect your Swiggy account with OAuth 2.1 to enable real grocery discovery and live cart management.",
      authUrl: "/api/auth/swiggy/connect",
      inventoryRefillItems: [],
      additionalItems: [],
      merchantCart: null,
      totalEstimatedCost: 0,
      openMerchantUrl: "https://www.swiggy.com/instamart",
    };
  }

  // 2. Fetch real delivery addresses
  let addresses: CommerceAddress[] = [];
  try {
    addresses = await provider.getAddresses();
    console.log(`[Shopping Agent] Fetched ${addresses.length} addresses from Swiggy Instamart.`);
  } catch (err: unknown) {
    if (err instanceof SwiggyAuthError) {
      return {
        success: false,
        authenticated: false,
        message: "Swiggy authorization token has expired or is invalid. Please reconnect your account.",
        authUrl: "/api/auth/swiggy/connect",
        inventoryRefillItems: [],
        additionalItems: [],
        merchantCart: null,
        totalEstimatedCost: 0,
        openMerchantUrl: "https://www.swiggy.com/instamart",
      };
    }
    console.error("[Shopping Agent] getAddresses failed:", err);
  }

  // If no addresses found, try to auto-create from household profile if available
  if (addresses.length === 0) {
    try {
      const hh = await prisma.household.findFirst({ include: { members: true } });
      if (hh && hh.address && hh.city && hh.pincode) {
        console.log("[Shopping Agent] Attempting to auto-create address from Household profile...");
        const member = hh.members[0];
        const newAddr = await provider.createAddress({
          fullAddress: `${hh.address}, ${hh.city}, ${hh.state} ${hh.pincode}`,
          addressLine: hh.address,
          city: hh.city,
          postalCode: hh.pincode,
          locality: hh.city,
          userName: member?.name || hh.name || "Resident",
          userPhone: member?.phone || "9876543210",
          addressCategory: "HOME",
          addressTag: "Home",
        });
        if (newAddr && newAddr.id) {
          addresses = [newAddr];
          console.log("[Shopping Agent] Successfully auto-created address from Household profile:", newAddr.id);
        }
      }
    } catch (createErr) {
      console.warn("[Shopping Agent] Address auto-creation attempt from household profile:", createErr);
    }
  }

  // If still no address found, do NOT block the user: prompt for delivery address
  if (addresses.length === 0) {
    return {
      success: false,
      authenticated: true,
      addressRequired: true,
      message:
        "No delivery address was found on your Swiggy account. Please enter your delivery address below so Household OS can create it on Instamart and prepare your live cart.",
      inventoryRefillItems: [],
      additionalItems: [],
      merchantCart: null,
      totalEstimatedCost: 0,
      openMerchantUrl: "https://www.swiggy.com/instamart",
    };
  }

  const session = await getSwiggySession(householdId);
  const selectedAddress =
    (session?.selectedAddressId && addresses.find((a) => a.id === session.selectedAddressId)) ||
    addresses.find((a) => a.isDefault) ||
    addresses[0];

  // 3. Parse intent into Inventory Requirements & User Shopping Requirements
  const parsed = parseShoppingIntent(request);
  const shouldRefill = options.refillLowStock !== undefined ? options.refillLowStock : parsed.refillLowStock;
  const adHocList = options.explicitItems || parsed.adHocItems;

  const requirementsQueue: ShoppingRequirement[] = [];

  let targetHouseholdId = householdId;
  if (!targetHouseholdId) {
    const hh = await prisma.household.findFirst();
    targetHouseholdId = hh?.id;
  }

  // A) Inventory replenishment requirements (dynamic DB query)
  if (shouldRefill && targetHouseholdId) {
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: {
        householdId: targetHouseholdId,
        OR: [
          { isLowStock: true },
          { estimatedDaysRemaining: { lte: 4 } },
          { quantity: { lte: 2 } },
        ],
      },
      orderBy: [
        { estimatedDaysRemaining: "asc" },
        { quantity: "asc" },
      ],
    });

    for (const item of lowStockItems) {
      const invReq = buildInventoryRequirement(item);

      // Deduplication check: did user also explicitly mention this item?
      const matchingAdHocIdx = adHocList.findIndex(
        (ad) =>
          invReq.requestedName.toLowerCase().includes(ad.query.toLowerCase()) ||
          ad.query.toLowerCase().includes(invReq.productType.toLowerCase())
      );

      if (matchingAdHocIdx >= 0) {
        // Merge request into existing inventory requirement rather than creating duplicate
        const adHoc = adHocList[matchingAdHocIdx];
        invReq.reason = `${invReq.reason} (Note: Extra quantity requested by user merged into household refill)`;
        invReq.suggestedPurchaseQuantity += adHoc.quantity || 1;
        adHocList.splice(matchingAdHocIdx, 1);
      }

      requirementsQueue.push(invReq);
    }
  }

  // B) Ad-hoc user requirements (independent of DB stock status)
  for (const adHoc of adHocList) {
    requirementsQueue.push({
      query: adHoc.query,
      rawRequest: adHoc.query,
      brand: adHoc.brand,
      productType: extractProductType(adHoc.query),
      maxBudget: adHoc.maxBudget,
      quantity: adHoc.quantity || 1,
      preference: adHoc.preference || "best_value",
      source: "USER_REQUEST",
    });
  }

  if (requirementsQueue.length === 0) {
    return {
      success: true,
      authenticated: true,
      message:
        "All household inventory items are currently well-stocked, and no additional items were requested.",
      inventoryRefillItems: [],
      additionalItems: [],
      merchantCart: null,
      totalEstimatedCost: 0,
      openMerchantUrl: "https://www.swiggy.com/instamart",
    };
  }

  // 4. Execute Tiered Search & Deterministic Matching for each requirement
  const inventoryRefillResults: ShoppingWorkflowResult["inventoryRefillItems"] = [];
  const additionalResults: ShoppingWorkflowResult["additionalItems"] = [];
  const cartPayloadItems: Array<{
    inventoryItemId?: string;
    variantId?: string;
    skuId?: string;
    spinId?: string;
    quantity: number;
    productName: string;
    brand?: string;
    packSize: string;
    unitPrice: number;
    totalPrice: number;
    source: "INVENTORY_REFILL" | "USER_REQUEST";
    comparisonNotes?: string;
    valueScore?: string;
  }> = [];

  for (const req of requirementsQueue) {
    const tieredQueries = generateTieredSearchQueries(req);
    const validCandidates: Array<{
      candidate: CandidateFeatures;
      score: CandidateScore;
    }> = [];
    const rejectedCandidates: Array<{ name: string; reasons: string[] }> = [];

    // Search live Instamart with tiered specificity
    for (const q of tieredQueries) {
      let products: CommerceProduct[] = [];
      try {
        products = await provider.searchProducts(q, selectedAddress.id);
      } catch (searchError) {
        console.warn(`Swiggy Instamart search failed for "${q}":`, searchError);
        products = [];
      }

      if (!products || products.length === 0) continue;

      for (const prod of products) {
        for (const variant of prod.variants) {
          const candFeatures = extractCandidateFeatures(prod, variant, req);
          const score = scoreProductCandidate(req, candFeatures);

          if (score.passedThreshold) {
            validCandidates.push({ candidate: candFeatures, score });
          } else {
            rejectedCandidates.push({
              name: prod.name,
              reasons: score.rejectionReasons,
            });
          }
        }
      }

      // If we found in-stock candidates matching specific tier, stop relaxing queries
      if (validCandidates.length > 0) {
        break;
      }
    }

    const reqDisplayName = req.source === "INVENTORY_REFILL" ? req.requestedName : req.query;

    if (validCandidates.length === 0) {
      // Truthful reporting: do NOT invent fake products or accept wrong candidates!
      const notFoundReason = rejectedCandidates.length > 0
        ? `Could not find an exact in-stock match for "${reqDisplayName}" on Swiggy Instamart. Rejected ${rejectedCandidates.length} options that did not match specifications (e.g. wrong variant, combos, or unrelated products).`
        : `Could not find "${reqDisplayName}" on Swiggy Instamart at your delivery location.`;

      // Log structured debug information
      console.log(`[Product Matcher] REJECTED ALL CANDIDATES for "${reqDisplayName}":`, {
        requestedName: reqDisplayName,
        tieredQueries,
        totalEvaluated: rejectedCandidates.length,
        rejectedSamples: rejectedCandidates.slice(0, 3),
      });

      if (req.source === "INVENTORY_REFILL") {
        inventoryRefillResults.push({
          itemName: req.requestedName,
          requiredQuantity: `${req.suggestedPurchaseQuantity} ${req.unit}`,
          status: "not_found",
          comparisonReasoning: notFoundReason,
        });
      } else {
        additionalResults.push({
          query: req.query,
          userIntent: req.rawRequest,
          status: "not_found",
          comparisonReasoning: notFoundReason,
        });
      }
      continue;
    }

    // Sort valid candidates by match score (highest quality match first)
    validCandidates.sort((a, b) => b.score.score - a.score.score);
    const best = validCandidates[0];

    // Calculate optimal consumer pack count based on deficit
    const packInfo = calculatePacks(req, best.candidate);

    // Build cart item payload
    const cartItemPayload = {
      inventoryItemId: req.source === "INVENTORY_REFILL" ? req.inventoryItemId : undefined,
      variantId: best.candidate.variant.id,
      skuId: best.candidate.variant.skuId || best.candidate.variant.id,
      spinId: best.candidate.variant.spinId,
      quantity: packInfo.quantity,
      productName: best.candidate.product.name,
      brand: best.candidate.brand,
      packSize: best.candidate.packSizeStr,
      unitPrice: best.candidate.price,
      totalPrice: best.candidate.price * packInfo.quantity,
      source: req.source,
      comparisonNotes: req.source === "INVENTORY_REFILL"
        ? `🏠 Inventory refill • ${req.reason}`
        : `🛒 Added by you • ${req.query}${req.maxBudget ? ` (Budget: ≤ ₹${req.maxBudget})` : ""}`,
      valueScore: `${Math.round(best.score.confidence * 100)}% Match • ${packInfo.explanation}`,
    };

    cartPayloadItems.push(cartItemPayload);

    // Log structured debug match information
    console.log(`[Product Matcher] MATCH SUCCESS for "${reqDisplayName}":`, {
      requestedName: reqDisplayName,
      source: req.source,
      selectedProduct: best.candidate.product.name,
      variant: best.candidate.variantName || "Standard",
      packSize: best.candidate.packSizeStr,
      quantity: packInfo.quantity,
      price: best.candidate.price,
      matchScore: best.score.score,
      matchReasons: best.score.matchReasons,
    });

    const formattedSelection = {
      name: best.candidate.product.name,
      brand: best.candidate.brand,
      packSize: best.candidate.packSizeStr,
      price: best.candidate.price,
      variantId: best.candidate.variant.id,
      skuId: best.candidate.variant.skuId,
    };

    if (req.source === "INVENTORY_REFILL") {
      inventoryRefillResults.push({
        itemName: req.requestedName,
        requiredQuantity: `${req.suggestedPurchaseQuantity} ${req.unit}`,
        selectedProduct: formattedSelection,
        comparisonReasoning: packInfo.explanation,
        status: "found",
      });
    } else {
      additionalResults.push({
        query: req.query,
        userIntent: req.rawRequest,
        selectedProduct: formattedSelection,
        comparisonReasoning: packInfo.explanation,
        status: "found",
      });
    }
  }

  if (cartPayloadItems.length === 0) {
    return {
      success: false,
      authenticated: true,
      message: "Could not find any available in-stock items matching your exact specifications on Swiggy Instamart.",
      inventoryRefillItems: inventoryRefillResults,
      additionalItems: additionalResults,
      merchantCart: null,
      totalEstimatedCost: 0,
      openMerchantUrl: "https://www.swiggy.com/instamart",
    };
  }

  // 5. Non-destructively merge with existing Swiggy Instamart basket
  // Calls get_cart first, preserves unrelated items, tops up quantities, adds new items, and verifies live cart
  let liveCart: CommerceCart;
  try {
    const syncResult = await syncAndMergeCartWithInstamart(
      provider,
      selectedAddress.id,
      cartPayloadItems,
      targetHouseholdId
    );
    liveCart = syncResult.liveCart;
  } catch (cartSyncErr: unknown) {
    const msg = cartSyncErr instanceof Error ? cartSyncErr.message : "Cart synchronization failed";
    console.error("Cart synchronization error on Swiggy Instamart:", msg);
    return {
      success: false,
      authenticated: true,
      message: `Swiggy Instamart notice: ${msg}. Please review item quantities or delivery address.`,
      inventoryRefillItems: inventoryRefillResults,
      additionalItems: additionalResults,
      merchantCart: null,
      totalEstimatedCost: 0,
      openMerchantUrl: "https://www.swiggy.com/instamart",
    };
  }

  const totalItemsCount = liveCart.itemCount || cartPayloadItems.length;
  const totalAmount = liveCart.totalPayable || liveCart.itemTotal;

  return {
    success: true,
    authenticated: true,
    addresses,
    selectedAddress,
    message: `Your Swiggy Instamart cart is ready with ${totalItemsCount} items.`,
    inventoryRefillItems: inventoryRefillResults,
    additionalItems: additionalResults,
    merchantCart: liveCart,
    totalEstimatedCost: totalAmount,
    openMerchantUrl: liveCart.merchantUrl || "https://www.swiggy.com/instamart",
  };
}
