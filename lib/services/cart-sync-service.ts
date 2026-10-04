import { prisma } from "@/lib/db/prisma";
import {
  CommerceProvider,
  CommerceCart,
  CommerceCartItem,
} from "@/lib/integrations/commerce/types";
import { normalizeText } from "./product-matcher";

export interface DesiredCartAddition {
  productName: string;
  brand?: string;
  packSize: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  variantId?: string;
  skuId?: string;
  spinId?: string;
  inventoryItemId?: string;
  comparisonNotes?: string;
  valueScore?: string;
}

export type MergeItemSource =
  | "EXISTING_PRESERVED"
  | "QUANTITY_TOPPED_UP"
  | "NEWLY_ADDED"
  | "ALREADY_SATISFIED";

export interface MergedCartItemDetail {
  id: string;
  spinId?: string;
  skuId?: string;
  variantId?: string;
  productName: string;
  brand?: string;
  packSize: string;
  unitPrice: number;
  totalPrice: number;
  quantity: number;
  existingQuantity: number;
  addedQuantity: number;
  source: MergeItemSource;
  inventoryItemId?: string;
  comparisonNotes?: string;
  valueScore?: string;
}

export interface CartMergePlan {
  existingCart: CommerceCart;
  itemsToUpdate: Array<{
    spinId?: string;
    skuId?: string;
    variantId?: string;
    quantity: number;
  }>;
  mergedDetails: MergedCartItemDetail[];
  unrelatedPreservedCount: number;
  toppedUpCount: number;
  newlyAddedCount: number;
  alreadySatisfiedCount: number;
}

/**
 * Determines whether an existing cart item represents the same product as the desired addition
 */
export function isSameCartItem(
  existing: CommerceCartItem,
  desired: DesiredCartAddition
): boolean {
  // 1. Direct ID matches (spinId, skuId, variantId)
  if (desired.spinId && existing.spinId && desired.spinId.toLowerCase() === existing.spinId.toLowerCase()) {
    return true;
  }
  if (desired.skuId && existing.skuId && desired.skuId.toLowerCase() === existing.skuId.toLowerCase()) {
    return true;
  }
  if (desired.variantId && existing.variantId && desired.variantId.toLowerCase() === existing.variantId.toLowerCase()) {
    return true;
  }
  if (desired.variantId && existing.id && desired.variantId.toLowerCase() === existing.id.toLowerCase()) {
    return true;
  }
  if (desired.skuId && existing.id && desired.skuId.toLowerCase() === existing.id.toLowerCase()) {
    return true;
  }
  if (desired.spinId && existing.id && desired.spinId.toLowerCase() === existing.id.toLowerCase()) {
    return true;
  }

  // 2. Normalized Name + Pack Size Match
  const normExName = normalizeText(existing.productName || "");
  const normDesName = normalizeText(desired.productName || "");

  if (normExName === normDesName) {
    const normExPack = normalizeText(existing.packSize || "");
    const normDesPack = normalizeText(desired.packSize || "");
    if (!normExPack || !normDesPack || normExPack === normDesPack) {
      return true;
    }
  }

  // 3. Brand + Overlapping Name Match
  if (desired.brand && existing.brand) {
    const normExBrand = normalizeText(existing.brand);
    const normDesBrand = normalizeText(desired.brand);
    if (normExBrand === normDesBrand && (normExName.includes(normDesName) || normDesName.includes(normExName))) {
      const normExPack = normalizeText(existing.packSize || "");
      const normDesPack = normalizeText(desired.packSize || "");
      if (!normExPack || !normDesPack || normExPack === normDesPack) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Pure algorithm to merge requested HH-OS additions into an existing Swiggy Instamart cart
 * without clearing or deleting unrelated existing items.
 */
export function planCartMerge(
  existingCart: CommerceCart,
  desiredAdditions: DesiredCartAddition[]
): CartMergePlan {
  const existingItems = existingCart.items || [];
  const matchedExistingIndices = new Set<number>();
  const matchedDesiredIndices = new Set<number>();

  const mergedDetails: MergedCartItemDetail[] = [];

  let unrelatedPreservedCount = 0;
  let toppedUpCount = 0;
  let newlyAddedCount = 0;
  let alreadySatisfiedCount = 0;

  // 1. Check desired additions against existing cart items
  for (let dIdx = 0; dIdx < desiredAdditions.length; dIdx++) {
    const desired = desiredAdditions[dIdx];

    // Find first unmatched existing item that matches this desired addition
    let matchIdx = -1;
    for (let eIdx = 0; eIdx < existingItems.length; eIdx++) {
      if (!matchedExistingIndices.has(eIdx) && isSameCartItem(existingItems[eIdx], desired)) {
        matchIdx = eIdx;
        break;
      }
    }

    if (matchIdx !== -1) {
      // Item exists in current Swiggy basket!
      matchedExistingIndices.add(matchIdx);
      matchedDesiredIndices.add(dIdx);
      const existing = existingItems[matchIdx];

      const existingQty = existing.quantity || 1;
      const targetQty = desired.quantity || 1;
      const missingQty = Math.max(0, targetQty - existingQty);
      const finalQty = Math.max(existingQty, targetQty);

      const isAlreadySatisfied = missingQty === 0;
      const source: MergeItemSource = isAlreadySatisfied
        ? "ALREADY_SATISFIED"
        : "QUANTITY_TOPPED_UP";

      if (isAlreadySatisfied) {
        alreadySatisfiedCount++;
      } else {
        toppedUpCount++;
      }

      const note = isAlreadySatisfied
        ? `Already in basket with ${existingQty} units (requested ${targetQty})`
        : `Topped up by +${missingQty} units to reach target of ${finalQty} units`;

      mergedDetails.push({
        id: existing.id || desired.variantId || desired.skuId || desired.spinId || `merged_${dIdx}`,
        spinId: existing.spinId || desired.spinId,
        skuId: existing.skuId || desired.skuId || desired.variantId,
        variantId: existing.variantId || desired.variantId,
        productName: existing.productName || desired.productName,
        brand: existing.brand || desired.brand,
        packSize: existing.packSize || desired.packSize,
        unitPrice: existing.unitPrice || desired.unitPrice,
        totalPrice: (existing.unitPrice || desired.unitPrice) * finalQty,
        quantity: finalQty,
        existingQuantity: existingQty,
        addedQuantity: missingQty,
        source,
        inventoryItemId: desired.inventoryItemId,
        comparisonNotes: desired.comparisonNotes
          ? `${desired.comparisonNotes} • ${note}`
          : note,
        valueScore: desired.valueScore,
      });
    }
  }

  // 2. Add remaining desired items that do NOT yet exist in the basket
  for (let dIdx = 0; dIdx < desiredAdditions.length; dIdx++) {
    if (!matchedDesiredIndices.has(dIdx)) {
      const desired = desiredAdditions[dIdx];
      newlyAddedCount++;

      mergedDetails.push({
        id: desired.variantId || desired.skuId || desired.spinId || `new_${dIdx}`,
        spinId: desired.spinId,
        skuId: desired.skuId || desired.variantId,
        variantId: desired.variantId,
        productName: desired.productName,
        brand: desired.brand,
        packSize: desired.packSize,
        unitPrice: desired.unitPrice,
        totalPrice: desired.totalPrice || desired.unitPrice * (desired.quantity || 1),
        quantity: desired.quantity || 1,
        existingQuantity: 0,
        addedQuantity: desired.quantity || 1,
        source: "NEWLY_ADDED",
        inventoryItemId: desired.inventoryItemId,
        comparisonNotes: desired.comparisonNotes,
        valueScore: desired.valueScore,
      });
    }
  }

  // 3. Preserve ALL existing cart items that were unrelated to the desired additions
  for (let eIdx = 0; eIdx < existingItems.length; eIdx++) {
    if (!matchedExistingIndices.has(eIdx)) {
      const existing = existingItems[eIdx];
      unrelatedPreservedCount++;

      mergedDetails.push({
        id: existing.id,
        spinId: existing.spinId,
        skuId: existing.skuId || existing.variantId,
        variantId: existing.variantId,
        productName: existing.productName,
        brand: existing.brand,
        packSize: existing.packSize,
        unitPrice: existing.unitPrice,
        totalPrice: existing.totalPrice,
        quantity: existing.quantity,
        existingQuantity: existing.quantity,
        addedQuantity: 0,
        source: "EXISTING_PRESERVED",
        comparisonNotes: "Preserved existing item from your Swiggy basket",
        valueScore: "In-cart before refill request",
      });
    }
  }

  // 4. Build exact items array for Swiggy update_cart payload
  const itemsToUpdate = mergedDetails.map((it) => ({
    spinId: it.spinId,
    skuId: it.skuId || it.variantId || it.id,
    variantId: it.variantId || it.skuId || it.id,
    quantity: it.quantity,
  }));

  return {
    existingCart,
    itemsToUpdate,
    mergedDetails,
    unrelatedPreservedCount,
    toppedUpCount,
    newlyAddedCount,
    alreadySatisfiedCount,
  };
}

/**
 * Executes a full, non-destructive cart merge against Swiggy Instamart MCP:
 * 1. Fetches current real cart via getCart()
 * 2. Compares requested additions against current cart
 * 3. Preserves unrelated existing items
 * 4. Adds missing quantities or new items via updateCart()
 * 5. Re-fetches getCart() to verify actual live cart state
 * 6. Mirrors live cart to Prisma CartItem table
 */
export async function syncAndMergeCartWithInstamart(
  provider: CommerceProvider,
  addressId: string,
  desiredAdditions: DesiredCartAddition[],
  householdId?: string
): Promise<{
  liveCart: CommerceCart;
  mergePlan: CartMergePlan;
}> {
  let targetHouseholdId = householdId;
  if (!targetHouseholdId) {
    const hh = await prisma.household.findFirst();
    targetHouseholdId = hh?.id;
  }

  // 1. Fetch current REAL cart from Swiggy Instamart MCP
  console.log(`[Cart Sync] 🛒 Fetching current real Swiggy Instamart basket...`);
  let existingCart: CommerceCart;
  try {
    existingCart = await provider.getCart();
    console.log(
      `[Cart Sync] Found ${existingCart.itemCount} existing item(s) in Swiggy basket. Total: ₹${existingCart.totalPayable}`
    );
  } catch (err: unknown) {
    console.warn(`[Cart Sync] Warning fetching current cart, treating as empty:`, err);
    existingCart = {
      items: [],
      itemCount: 0,
      itemTotal: 0,
      deliveryFee: 0,
      discount: 0,
      totalPayable: 0,
      selectedAddressId: addressId,
      merchantName: "Swiggy Instamart",
      merchantUrl: "https://www.swiggy.com/instamart",
      isRealMerchantCart: true,
    };
  }

  // 2. Plan the non-destructive merge
  const mergePlan = planCartMerge(existingCart, desiredAdditions);
  console.log(
    `[Cart Sync] Merge Plan: ${mergePlan.unrelatedPreservedCount} preserved, ${mergePlan.toppedUpCount} topped-up, ${mergePlan.newlyAddedCount} newly added, ${mergePlan.alreadySatisfiedCount} already satisfied`
  );

  // If there are no items to update at all, return existing cart
  if (mergePlan.itemsToUpdate.length === 0) {
    return {
      liveCart: existingCart,
      mergePlan,
    };
  }

  // 3. Call real update_cart on Swiggy MCP with the full merged payload
  // DO NOT call clearCart() — we preserve existing items!
  let liveCart: CommerceCart;
  try {
    liveCart = await provider.updateCart(mergePlan.itemsToUpdate, addressId);
  } catch (updateErr: unknown) {
    const msg = updateErr instanceof Error ? updateErr.message : "Cart update failed";
    console.warn(`[Cart Sync] updateCart failed, attempting safe payload with capped quantities:`, msg);

    // If a store limit was reached, cap quantities at safe limits
    const safePayload = mergePlan.itemsToUpdate.map((it) => ({
      ...it,
      quantity: Math.min(it.quantity, 2),
    }));

    liveCart = await provider.updateCart(safePayload, addressId);
  }

  // 4. Verify resulting cart via getCart() to confirm real merchant state
  try {
    const verifiedCart = await provider.getCart();
    if (verifiedCart) {
      liveCart = verifiedCart;
    }
  } catch (vErr) {
    console.warn(`[Cart Sync] getCart verification warning:`, vErr);
  }

  // 5. Mirror the verified cart into local Prisma CartItem records
  if (targetHouseholdId) {
    try {
      await prisma.cartItem.deleteMany({
        where: { householdId: targetHouseholdId },
      });

      for (const item of liveCart.items) {
        // Find matching details from mergePlan
        const matchDetail = mergePlan.mergedDetails.find((d) => isSameCartItem(item, d));

        await prisma.cartItem.create({
          data: {
            householdId: targetHouseholdId,
            inventoryItemId: matchDetail?.inventoryItemId || null,
            productName: item.productName,
            brand: item.brand || matchDetail?.brand || null,
            packSize: item.packSize || matchDetail?.packSize || "Standard",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            retailer: "Swiggy Instamart",
            retailerUrl: "https://www.swiggy.com/instamart",
            variantId: item.variantId || matchDetail?.variantId || null,
            skuId: item.skuId || matchDetail?.skuId || null,
            spinId: item.spinId || matchDetail?.spinId || null,
            comparisonNotes: matchDetail?.comparisonNotes || null,
            valueScore: matchDetail?.valueScore || "Live verified in Swiggy basket",
            status: "PENDING_REVIEW",
          },
        });
      }
    } catch (dbErr) {
      console.error(`[Cart Sync] Failed to mirror cart items to Prisma:`, dbErr);
    }
  }

  return {
    liveCart,
    mergePlan,
  };
}
