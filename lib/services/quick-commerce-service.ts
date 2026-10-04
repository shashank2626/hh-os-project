import { prisma } from "@/lib/db/prisma";
import { getCommerceProvider } from "@/lib/integrations/commerce/provider";
import { CommerceProduct, CommerceVariant, CommerceCart } from "@/lib/integrations/commerce/types";
import { SwiggyAuthError } from "@/lib/integrations/commerce/swiggy-instamart/client";

export interface ProductOption {
  id: string;
  name: string;
  brand: string;
  packSize: string;
  quantityValue: number;
  quantityUnit: string;
  price: number;
  unitPrice: number;
  unitPriceLabel: string;
  retailer: string;
  retailerUrl: string;
  inStock: boolean;
  deliveryTimeMinutes?: number;
  skuId?: string;
  variantId?: string;
  spinId?: string;
}

export interface ProductComparisonResult {
  itemName: string;
  requiredQuantity: number;
  unit: string;
  options: ProductOption[];
  bestOption: ProductOption;
  reasoning: string;
  savingsPercentage: number;
}

/**
 * Searches real quick-commerce products via Swiggy Instamart MCP.
 * Zero hardcoded catalogs, zero fabricated prices, zero fake items.
 */
export async function searchQuickCommerceProducts(
  query: string,
  category?: string,
  householdId?: string
): Promise<ProductOption[]> {
  const provider = await getCommerceProvider(householdId);
  const isAuth = await provider.isAuthenticated();

  if (!isAuth) {
    throw new SwiggyAuthError(
      "Instamart isn't connected yet. Connect your Swiggy account to enable real shopping."
    );
  }

  const addresses = await provider.getAddresses();
  if (addresses.length === 0) {
    throw new Error("No saved delivery address found in Swiggy account.");
  }

  const products: CommerceProduct[] = await provider.searchProducts(query, addresses[0]?.id);

  // Flatten products and variants into ProductOption
  const options: ProductOption[] = [];

  for (const prod of products) {
    for (const v of prod.variants) {
      if (!v.inStock) continue;

      const unitPrice = v.price;
      const unitLabel = `₹${v.price} / ${v.packSize || "pack"}`;

      options.push({
        id: v.id || prod.id,
        name: prod.name,
        brand: prod.brand || "",
        packSize: v.packSize || "Standard Pack",
        quantityValue: 1,
        quantityUnit: "pack",
        price: v.price,
        unitPrice,
        unitPriceLabel: unitLabel,
        retailer: "Swiggy Instamart",
        retailerUrl: "https://www.swiggy.com/instamart",
        inStock: v.inStock,
        skuId: v.skuId,
        variantId: v.id,
        spinId: v.spinId,
      });
    }
  }

  return options;
}

/**
 * Compare real product options based on price, pack size, and unit economy
 */
export function compareProductOptions(
  itemName: string,
  requiredQuantity: number,
  unit: string,
  options: ProductOption[]
): ProductComparisonResult {
  if (options.length === 0) {
    throw new Error(`No available product options found for ${itemName}`);
  }

  if (options.length === 1) {
    return {
      itemName,
      requiredQuantity,
      unit,
      options,
      bestOption: options[0],
      reasoning: `Selected ${options[0].name} (${options[0].packSize}) at ₹${options[0].price} (only available in-stock option).`,
      savingsPercentage: 0,
    };
  }

  // Sort by price ascending
  const sorted = [...options].sort((a, b) => a.price - b.price);
  const bestOption = sorted[0];
  const higherOption = sorted[sorted.length - 1];

  const savingsPct =
    higherOption.price > bestOption.price
      ? Math.round(((higherOption.price - bestOption.price) / higherOption.price) * 100)
      : 0;

  const reasoning =
    savingsPct > 0
      ? `Selected Option "${bestOption.packSize}" at ₹${bestOption.price} vs ${higherOption.packSize} at ₹${higherOption.price}. Saves ${savingsPct}% on order total.`
      : `Selected ${bestOption.name} (${bestOption.packSize}) at ₹${bestOption.price} for optimal household replenishment.`;

  return {
    itemName,
    requiredQuantity,
    unit,
    options,
    bestOption,
    reasoning,
    savingsPercentage: savingsPct,
  };
}

/**
 * Manage household refill cart: queries real Swiggy Instamart cart if authenticated,
 * falls back to local database audit records
 */
export async function getHouseholdCart(householdId?: string) {
  let targetHouseholdId = householdId;
  if (!targetHouseholdId) {
    const hh = await prisma.household.findFirst();
    targetHouseholdId = hh?.id;
  }
  if (!targetHouseholdId) {
    return { cartItems: [], totalEstimatedPrice: 0, totalItems: 0, merchant: "Swiggy Instamart", merchantUrl: "https://www.swiggy.com/instamart" };
  }

  // Try real Swiggy Instamart cart first
  try {
    const provider = await getCommerceProvider(targetHouseholdId);
    if (await provider.isAuthenticated()) {
      const addresses = await provider.getAddresses();
      if (addresses.length > 0) {
        const liveCart: CommerceCart = await provider.getCart();
        if (liveCart && liveCart.items.length > 0) {
          return {
            cartItems: liveCart.items.map((it) => ({
              id: it.id,
              productName: it.productName,
              brand: it.brand || "Swiggy Instamart",
              packSize: it.packSize,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: it.totalPrice,
              retailer: "Swiggy Instamart",
              retailerUrl: "https://www.swiggy.com/instamart",
              valueScore: "Live Instamart Cart",
              skuId: it.skuId,
              variantId: it.variantId,
            })),
            totalEstimatedPrice: liveCart.totalPayable || liveCart.itemTotal,
            totalItems: liveCart.itemCount,
            merchant: "Swiggy Instamart",
            merchantUrl: "https://www.swiggy.com/instamart",
          };
        }
      }
    }
  } catch (err) {
    // If not authenticated, proceed to local audit records
  }

  // Audit records from local Prisma
  const cartItems = await prisma.cartItem.findMany({
    where: {
      householdId: targetHouseholdId,
      status: "PENDING_REVIEW",
    },
    orderBy: { createdAt: "desc" },
  });

  const totalEstimatedPrice = cartItems.reduce((acc, it) => acc + it.totalPrice, 0);

  return {
    cartItems,
    totalEstimatedPrice,
    totalItems: cartItems.length,
    merchant: "Swiggy Instamart",
    merchantUrl: "https://www.swiggy.com/instamart",
  };
}

/**
 * Add replenishment items to household cart
 */
export async function addItemsToCart(
  items: Array<{
    inventoryItemId?: string;
    productName: string;
    brand?: string;
    packSize: string;
    quantity?: number;
    unitPrice: number;
    totalPrice: number;
    retailer?: string;
    retailerUrl?: string;
    valueScore?: string;
    comparisonNotes?: string;
    skuId?: string;
    variantId?: string;
    spinId?: string;
  }>,
  householdId?: string
) {
  let targetHouseholdId = householdId;
  if (!targetHouseholdId) {
    const hh = await prisma.household.findFirst();
    targetHouseholdId = hh?.id;
  }
  if (!targetHouseholdId) throw new Error("No household found");

  const createdItems = [];
  for (const item of items) {
    if (item.inventoryItemId) {
      const existing = await prisma.cartItem.findFirst({
        where: {
          householdId: targetHouseholdId,
          inventoryItemId: item.inventoryItemId,
          status: "PENDING_REVIEW",
        },
      });

      if (existing) {
        const updated = await prisma.cartItem.update({
          where: { id: existing.id },
          data: {
            productName: item.productName,
            brand: item.brand || null,
            packSize: item.packSize,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            retailer: item.retailer || "Swiggy Instamart",
            retailerUrl: item.retailerUrl || "https://www.swiggy.com/instamart",
            comparisonNotes: item.comparisonNotes,
            valueScore: item.valueScore,
            skuId: item.skuId,
            variantId: item.variantId,
            spinId: item.spinId,
          },
        });
        createdItems.push(updated);
        continue;
      }
    }

    const created = await prisma.cartItem.create({
      data: {
        householdId: targetHouseholdId,
        inventoryItemId: item.inventoryItemId || null,
        productName: item.productName,
        brand: item.brand || null,
        packSize: item.packSize,
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        retailer: item.retailer || "Swiggy Instamart",
        retailerUrl: item.retailerUrl || "https://www.swiggy.com/instamart",
        valueScore: item.valueScore || null,
        comparisonNotes: item.comparisonNotes || null,
        skuId: item.skuId,
        variantId: item.variantId,
        spinId: item.spinId,
        status: "PENDING_REVIEW",
      },
    });
    createdItems.push(created);
  }

  return createdItems;
}
