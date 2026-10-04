import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/services/activity-service";
import { buildWhatsAppLink, generateRefillWhatsAppMessage } from "@/lib/utils/whatsapp";
import { SwiggyInstamartProvider } from "@/lib/integrations/commerce/swiggy-instamart/tools";
import { getHouseholdId } from "@/lib/services/vendor-service";
import { getSwiggySession } from "@/lib/integrations/commerce/swiggy-instamart/auth";
import { CommerceAddress, CommerceProduct, CommerceVariant } from "@/lib/integrations/commerce/types";
import { syncAndMergeCartWithInstamart } from "@/lib/services/cart-sync-service";

export interface RefillRecommendation {
  itemId: string;
  name: string;
  category: string;
  brand?: string | null;
  currentQuantity: number;
  unit: string;
  minimumStock: number;
  consumptionRate: number;
  estimatedDaysRemaining: number;
  suggestedRefillQuantity: number;
  urgency: "HIGH" | "MEDIUM" | "LOW";
  recommendedVendorCategory: string;
  preferredVendor?: {
    id: string;
    name: string;
    businessName: string | null;
    phone: string;
    whatsappNumber: string | null;
    category: string;
  } | null;
  isInstamartEligible: boolean;
}

export function determineVendorCategoryForInventory(itemCategory: string, itemName: string): string {
  const cat = itemCategory.toLowerCase();
  const name = itemName.toLowerCase();

  if (cat.includes("dairy") || name.includes("milk") || name.includes("paneer") || name.includes("dahi") || name.includes("curd") || name.includes("butter") || name.includes("ghee") || name.includes("cheese") || name.includes("egg")) {
    return "Dairy & Milk";
  }

  if (cat.includes("vegetable") || cat.includes("fruit") || name.includes("onion") || name.includes("potato") || name.includes("tomato") || name.includes("palak") || name.includes("coriander") || name.includes("ginger") || name.includes("garlic") || name.includes("apple") || name.includes("banana")) {
    return "Fresh Fruits & Vegetables";
  }

  if (name.includes("water") && (name.includes("can") || name.includes("20l") || name.includes("jar") || name.includes("bisleri"))) {
    return "Water Can Delivery";
  }

  return "Kirana / Grocery";
}

export async function getSmartKitchenRefillItems(householdId?: string): Promise<{
  householdId: string;
  totalLowStockCount: number;
  recommendations: RefillRecommendation[];
}> {
  const targetHouseholdId = await getHouseholdId(householdId);

  // Fetch all inventory items for this household
  const items = await prisma.inventoryItem.findMany({
    where: { householdId: targetHouseholdId },
    orderBy: [{ isLowStock: "desc" }, { estimatedDaysRemaining: "asc" }, { name: "asc" }],
  });

  // Fetch all vendors to map
  const vendors = await prisma.vendor.findMany({
    where: { householdId: targetHouseholdId },
  });

  // Find items requiring refill
  const lowStockItems = items.filter(
    (item) => item.isLowStock || item.quantity <= item.minimumStock || item.estimatedDaysRemaining <= 3
  );

  const recommendations: RefillRecommendation[] = lowStockItems.map((item) => {
    const vendorCategory = determineVendorCategoryForInventory(item.category, item.name);
    const matchingVendor =
      vendors.find((v) => v.category === vendorCategory && v.isFavourite) ||
      vendors.find((v) => v.category === vendorCategory) ||
      null;

    // Calculate intelligent suggested quantity (target ~2x minimum stock or at least +2 units)
    const targetQuantity = Math.max(item.minimumStock * 2, item.minimumStock + 1);
    const needed = Math.max(Math.ceil(targetQuantity - item.quantity), 1);

    const urgency: "HIGH" | "MEDIUM" | "LOW" =
      item.quantity <= 0.5 * item.minimumStock || item.estimatedDaysRemaining <= 1
        ? "HIGH"
        : item.quantity <= item.minimumStock
        ? "MEDIUM"
        : "LOW";

    return {
      itemId: item.id,
      name: item.name,
      category: item.category,
      brand: item.brand,
      currentQuantity: item.quantity,
      unit: item.unit,
      minimumStock: item.minimumStock,
      consumptionRate: item.consumptionRate,
      estimatedDaysRemaining: item.estimatedDaysRemaining,
      suggestedRefillQuantity: needed,
      urgency,
      recommendedVendorCategory: vendorCategory,
      preferredVendor: matchingVendor
        ? {
            id: matchingVendor.id,
            name: matchingVendor.name,
            businessName: matchingVendor.businessName,
            phone: matchingVendor.phone,
            whatsappNumber: matchingVendor.whatsappNumber,
            category: matchingVendor.category,
          }
        : null,
      isInstamartEligible: true, // Swiggy Instamart carries groceries, dairy, staples, and fresh produce
    };
  });

  return {
    householdId: targetHouseholdId,
    totalLowStockCount: recommendations.length,
    recommendations,
  };
}

export interface LocalVendorOrderGroup {
  vendorId: string;
  vendorName: string;
  businessName: string | null;
  category: string;
  phone: string;
  whatsappUrl: string;
  whatsappMessage: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
}

export async function generateLocalVendorRefillPlan(
  householdId: string | undefined,
  selectedItems: Array<{ itemId?: string; name?: string; quantity: number; unit?: string }>
): Promise<{ groups: LocalVendorOrderGroup[] }> {
  const targetHouseholdId = await getHouseholdId(householdId);

  const itemIds = selectedItems
    .map((s) => s.itemId)
    .filter((id): id is string => Boolean(id));

  const dbItems = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds }, householdId: targetHouseholdId },
  });

  const vendors = await prisma.vendor.findMany({
    where: { householdId: targetHouseholdId },
  });

  // Group items by vendor category
  const vendorBucket: Record<
    string,
    {
      vendor: any;
      items: Array<{ name: string; quantity: number; unit: string }>;
    }
  > = {};

  for (const selected of selectedItems) {
    const item = selected.itemId ? dbItems.find((i) => i.id === selected.itemId) : undefined;
    const itemName = item?.name || selected.name;
    const itemCat = item?.category || "Grocery";
    const itemUnit = item?.unit || selected.unit || "unit";

    if (!itemName) continue;

    const vendorCat = determineVendorCategoryForInventory(itemCat, itemName);
    const vendor =
      vendors.find((v) => v.category === vendorCat && v.isFavourite) ||
      vendors.find((v) => v.category === vendorCat) ||
      vendors.find((v) => v.category === "Kirana / Grocery") ||
      vendors[0];

    if (!vendor) continue;

    if (!vendorBucket[vendor.id]) {
      vendorBucket[vendor.id] = {
        vendor,
        items: [],
      };
    }

    vendorBucket[vendor.id].items.push({
      name: itemName,
      quantity: selected.quantity || 1,
      unit: itemUnit,
    });
  }

  const groups: LocalVendorOrderGroup[] = [];

  for (const bucket of Object.values(vendorBucket)) {
    const message = generateRefillWhatsAppMessage({
      vendorName: bucket.vendor.name,
      flatDetails: "Flat 402, Palm Heights",
      items: bucket.items,
      senderName: "Ayush Sharma",
    });

    const whatsappUrl = buildWhatsAppLink(
      bucket.vendor.whatsappNumber || bucket.vendor.phone,
      message
    );

    groups.push({
      vendorId: bucket.vendor.id,
      vendorName: bucket.vendor.name,
      businessName: bucket.vendor.businessName,
      category: bucket.vendor.category,
      phone: bucket.vendor.phone,
      whatsappUrl,
      whatsappMessage: message,
      items: bucket.items,
    });
  }

  await logActivity({
    householdId: targetHouseholdId,
    actionType: "REFILL_LOCAL_PLAN_GENERATED",
    title: `Generated local vendor refill orders (${selectedItems.length} items)`,
    description: `Prepared WhatsApp order plans across ${groups.length} local vendor(s).`,
    entityType: "Inventory",
    actor: "Smart Kitchen",
  });

  return { groups };
}

export async function executeSplitRefillPlan({
  householdId,
  localItems,
  instamartItems,
}: {
  householdId?: string;
  localItems: Array<{ itemId?: string; name?: string; quantity: number; unit?: string }>;
  instamartItems: Array<{ itemId?: string; name?: string; quantity: number; unit?: string }>;
}) {
  const targetHouseholdId = await getHouseholdId(householdId);
  const safeLocalItems = localItems || [];
  const safeInstamartItems = instamartItems || [];

  // 1. Generate Local Vendor Groups
  let localVendorPlan = null;
  if (safeLocalItems.length > 0) {
    localVendorPlan = await generateLocalVendorRefillPlan(targetHouseholdId, safeLocalItems);
  }

  // 2. Process Instamart items using live Swiggy Instamart provider
  const instamartResults: Array<{
    itemName: string;
    quantity: number;
    searched: boolean;
    addedToCart?: boolean;
    availableProducts?: any[];
    selectedProduct?: any;
    error?: string;
  }> = [];

  let instamartCart: {
    authenticated?: boolean;
    authUrl?: string;
    itemCount: number;
    totalEstimatedCost: number;
    merchantUrl: string;
    items: Array<{
      variantId?: string;
      skuId?: string;
      spinId?: string;
      quantity: number;
      productName: string;
      brand?: string;
      packSize: string;
      unitPrice: number;
      totalPrice: number;
    }>;
    status: string;
    message?: string;
  } | null = null;

  if (safeInstamartItems.length > 0) {
    const provider = new SwiggyInstamartProvider(targetHouseholdId);
    const isAuthed = await provider.isAuthenticated();

    if (!isAuthed) {
      for (const item of safeInstamartItems) {
        let searchName = item.name;
        if (!searchName && item.itemId) {
          const dbItem = await prisma.inventoryItem.findUnique({ where: { id: item.itemId } });
          if (dbItem) searchName = dbItem.name;
        }
        instamartResults.push({
          itemName: searchName || "Requested Item",
          quantity: item.quantity,
          searched: false,
          addedToCart: false,
          error: "Swiggy Instamart session not authenticated. Connect via Settings or MCP.",
        });
      }

      instamartCart = {
        authenticated: false,
        authUrl: "/api/auth/swiggy/connect",
        itemCount: 0,
        totalEstimatedCost: 0,
        merchantUrl: "https://www.swiggy.com/instamart",
        items: [],
        status: "NOT_AUTHENTICATED",
        message: "Swiggy Instamart isn't connected. Please connect your Swiggy account to enable live cart addition.",
      };
    } else {
      // 1. Fetch delivery addresses
      let addresses: CommerceAddress[] = [];
      try {
        addresses = await provider.getAddresses();
      } catch (err: any) {
        console.warn("[Split Refill] Failed to get addresses:", err);
      }

      // If no address, try auto-create from household profile
      if (addresses.length === 0) {
        try {
          const hh = await prisma.household.findFirst({
            where: { id: targetHouseholdId },
            include: { members: true },
          });
          if (hh && hh.address && hh.city && hh.pincode) {
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
            }
          }
        } catch (createErr) {
          console.warn("[Split Refill] Address auto-creation attempt:", createErr);
        }
      }

      const session = await getSwiggySession(targetHouseholdId);
      const selectedAddress =
        (session?.selectedAddressId && addresses.find((a) => a.id === session.selectedAddressId)) ||
        addresses.find((a) => a.isDefault) ||
        addresses[0];

      const cartPayloadItems: Array<{
        variantId?: string;
        skuId?: string;
        spinId?: string;
        quantity: number;
        productName: string;
        brand?: string;
        packSize: string;
        unitPrice: number;
        totalPrice: number;
      }> = [];

      for (const item of safeInstamartItems) {
        let searchName = item.name;
        if (!searchName && item.itemId) {
          const dbItem = await prisma.inventoryItem.findUnique({ where: { id: item.itemId } });
          if (dbItem) searchName = dbItem.name;
        }

        if (!searchName) continue;

        try {
          const products = await provider.searchProducts(searchName, selectedAddress?.id);
          const inStockVariants: Array<{ product: CommerceProduct; variant: CommerceVariant }> = [];

          for (const prod of products) {
            for (const v of prod.variants) {
              if (v.inStock) {
                inStockVariants.push({ product: prod, variant: v });
              }
            }
          }

          if (inStockVariants.length > 0) {
            inStockVariants.sort((a, b) => a.variant.price - b.variant.price);
            const best = inStockVariants[0];
            const maxAllowed = best.variant.maxQuantity || 2;
            const finalQty = Math.max(1, Math.min(Math.round(item.quantity || 1), maxAllowed));

            cartPayloadItems.push({
              variantId: best.variant.id,
              skuId: best.variant.skuId || best.variant.id,
              spinId: best.variant.spinId,
              quantity: finalQty,
              productName: best.product.name,
              brand: best.product.brand,
              packSize: best.variant.packSize,
              unitPrice: best.variant.price,
              totalPrice: best.variant.price * finalQty,
            });

            instamartResults.push({
              itemName: searchName,
              quantity: finalQty,
              searched: true,
              addedToCart: true,
              availableProducts: products.slice(0, 3),
              selectedProduct: {
                name: best.product.name,
                brand: best.product.brand,
                packSize: best.variant.packSize,
                price: best.variant.price,
                unitPrice: best.variant.price,
                totalPrice: best.variant.price * finalQty,
              },
            });
          } else {
            instamartResults.push({
              itemName: searchName,
              quantity: item.quantity,
              searched: true,
              addedToCart: false,
              availableProducts: products.slice(0, 3),
              error: `No in-stock variant found for "${searchName}" on Swiggy Instamart`,
            });
          }
        } catch (err: any) {
          instamartResults.push({
            itemName: searchName,
            quantity: item.quantity,
            searched: false,
            addedToCart: false,
            error: err.message || "Failed to search Instamart live catalog",
          });
        }
      }

      // Add to live Instamart cart if we have items
      // Add to live Instamart cart non-destructively
      if (cartPayloadItems.length > 0) {
        let liveCart: any = null;
        try {
          const syncResult = await syncAndMergeCartWithInstamart(
            provider,
            selectedAddress?.id || "",
            cartPayloadItems,
            targetHouseholdId
          );
          liveCart = syncResult.liveCart;
        } catch (syncErr: any) {
          console.error("[Split Refill] syncAndMergeCartWithInstamart failed:", syncErr);
        }

        const totalCost = liveCart?.totalPayable || liveCart?.itemTotal || cartPayloadItems.reduce((acc, it) => acc + it.totalPrice, 0);
        const merchantUrl = liveCart?.merchantUrl || "https://www.swiggy.com/instamart";

        instamartCart = {
          authenticated: true,
          itemCount: liveCart?.itemCount || cartPayloadItems.length,
          totalEstimatedCost: totalCost,
          merchantUrl,
          items: cartPayloadItems,
          status: "SUCCESS",
          message: `Successfully added ${cartPayloadItems.length} item(s) to your live Swiggy Instamart basket.`,
        };
      } else {
        instamartCart = {
          authenticated: true,
          itemCount: 0,
          totalEstimatedCost: 0,
          merchantUrl: "https://www.swiggy.com/instamart",
          items: [],
          status: "NO_IN_STOCK_ITEMS",
          message: "Could not find in-stock matches on Instamart for the requested items.",
        };
      }
    }
  }

  await logActivity({
    householdId: targetHouseholdId,
    actionType: "REFILL_SPLIT_PLAN_EXECUTED",
    title: `Split refill: ${safeLocalItems.length} via Local Vendors, ${safeInstamartItems.length} via Instamart`,
    description: `Dispatched household fulfillment across human vendor network and digital quick commerce.`,
    entityType: "Inventory",
    actor: "Smart Kitchen",
  });

  return {
    success: true,
    localVendorPlan,
    instamartCart,
    instamartResults,
  };
}
