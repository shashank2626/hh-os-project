import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCommerceProvider } from "@/lib/integrations/commerce/provider";
import { getHouseholdCart, addItemsToCart } from "@/lib/services/quick-commerce-service";

export async function GET() {
  try {
    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    // 1. Try to fetch live cart from Swiggy Instamart
    try {
      const provider = await getCommerceProvider(household.id);
      const isAuth = await provider.isAuthenticated();
      if (isAuth) {
        const liveCart = await provider.getCart();
        if (liveCart && liveCart.items) {
          return NextResponse.json({
            items: liveCart.items,
            itemCount: liveCart.itemCount,
            totalEstimatedPrice: liveCart.totalPayable || liveCart.itemTotal,
            totalPayable: liveCart.totalPayable,
            itemTotal: liveCart.itemTotal,
            merchant: "Swiggy Instamart",
            merchantUrl: "https://www.swiggy.com/instamart",
            selectedAddressId: liveCart.selectedAddressId,
            selectedAddressName: liveCart.selectedAddressName,
            isRealMerchantCart: true,
          });
        }
      }
    } catch (liveErr) {
      console.warn("[Cart API GET] Live cart fetch warning, falling back to database:", liveErr);
    }

    const cart = await getHouseholdCart(household.id);
    return NextResponse.json(cart);
  } catch (error) {
    console.error("Fetch cart error:", error);
    return NextResponse.json({ error: "Failed to fetch cart" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items } = body;

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const added = await addItemsToCart(items || [], household.id);
    const cart = await getHouseholdCart(household.id);

    return NextResponse.json({ success: true, added, cart });
  } catch (error) {
    console.error("Add to cart error:", error);
    return NextResponse.json({ error: "Failed to add items to cart" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, quantity, packSize, totalPrice, replacement } = body;

    if (!id) return NextResponse.json({ error: "Cart item ID required" }, { status: 400 });

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const provider = await getCommerceProvider(household.id);
    const isAuth = await provider.isAuthenticated();

    // CASE 1: Replace item with a new product variant / alternative
    if (replacement) {
      console.log(`[Cart API PATCH] Replacing item ${id} with:`, replacement.name);

      let updatedLiveCart = null;

      if (isAuth) {
        try {
          const currentCart = await provider.getCart();
          const targetAddressId = currentCart.selectedAddressId || (await provider.getAddresses())[0]?.id;

          // Remove the old item
          const remainingItems = currentCart.items.filter((it) => {
            return !(
              it.id === id ||
              it.skuId === id ||
              it.spinId === id ||
              it.variantId === id
            );
          });

          // Add replacement item
          const replacementQty = Number(replacement.quantity || 1);
          remainingItems.push({
            id: replacement.variantId || replacement.skuId || replacement.spinId || `rep_${Date.now()}`,
            productName: replacement.name,
            brand: replacement.brand,
            packSize: replacement.packSize || "Standard",
            quantity: replacementQty,
            unitPrice: Number(replacement.price || 0),
            totalPrice: Number(replacement.price || 0) * replacementQty,
            variantId: replacement.variantId,
            skuId: replacement.skuId || replacement.variantId,
            spinId: replacement.spinId,
            inStock: true,
          });

          const updatePayload = remainingItems.map((it) => ({
            spinId: it.spinId,
            skuId: it.skuId || it.variantId || it.id,
            variantId: it.variantId || it.skuId || it.id,
            quantity: it.quantity,
          }));

          if (targetAddressId) {
            await provider.updateCart(updatePayload, targetAddressId);
            updatedLiveCart = await provider.getCart();
          }
        } catch (liveUpdateErr) {
          console.warn("[Cart API PATCH] Live Swiggy replacement warning:", liveUpdateErr);
        }
      }

      // Mirror change in Prisma
      try {
        const existingPrismaItem = await prisma.cartItem.findFirst({
          where: {
            householdId: household.id,
            OR: [
              { id },
              { skuId: id },
              { spinId: id },
              { variantId: id },
            ],
          },
        });

        if (existingPrismaItem) {
          await prisma.cartItem.update({
            where: { id: existingPrismaItem.id },
            data: {
              productName: replacement.name,
              brand: replacement.brand || existingPrismaItem.brand,
              packSize: replacement.packSize || existingPrismaItem.packSize,
              unitPrice: Number(replacement.price || existingPrismaItem.unitPrice),
              totalPrice: Number(replacement.price || existingPrismaItem.unitPrice) * Number(replacement.quantity || existingPrismaItem.quantity),
              skuId: replacement.skuId || existingPrismaItem.skuId,
              spinId: replacement.spinId || existingPrismaItem.spinId,
              variantId: replacement.variantId || existingPrismaItem.variantId,
              valueScore: "Updated product via Change Product",
            },
          });
        }
      } catch (dbErr) {
        console.warn("[Cart API PATCH] Prisma update warning:", dbErr);
      }

      const finalCart = updatedLiveCart || (await getHouseholdCart(household.id));
      return NextResponse.json({
        success: true,
        message: `Replaced with ${replacement.name}`,
        cart: finalCart,
      });
    }

    // CASE 2: Update existing item quantity or packSize
    let updatedLiveCart = null;

    if (isAuth && quantity !== undefined) {
      try {
        const currentCart = await provider.getCart();
        const targetAddressId = currentCart.selectedAddressId || (await provider.getAddresses())[0]?.id;

        const updatedItems = currentCart.items.map((it) => {
          if (it.id === id || it.skuId === id || it.spinId === id || it.variantId === id) {
            return { ...it, quantity: Number(quantity) };
          }
          return it;
        });

        const updatePayload = updatedItems.map((it) => ({
          spinId: it.spinId,
          skuId: it.skuId || it.variantId || it.id,
          variantId: it.variantId || it.skuId || it.id,
          quantity: it.quantity,
        }));

        if (targetAddressId) {
          await provider.updateCart(updatePayload, targetAddressId);
          updatedLiveCart = await provider.getCart();
        }
      } catch (liveUpdateErr) {
        console.warn("[Cart API PATCH] Live Swiggy quantity update warning:", liveUpdateErr);
      }
    }

    // Update in Prisma
    const existingPrismaItem = await prisma.cartItem.findFirst({
      where: {
        householdId: household.id,
        OR: [
          { id },
          { skuId: id },
          { spinId: id },
          { variantId: id },
        ],
      },
    });

    let updatedPrismaItem = null;
    if (existingPrismaItem) {
      updatedPrismaItem = await prisma.cartItem.update({
        where: { id: existingPrismaItem.id },
        data: {
          quantity: quantity !== undefined ? Number(quantity) : undefined,
          packSize: packSize !== undefined ? packSize : undefined,
          totalPrice: totalPrice !== undefined ? Number(totalPrice) : undefined,
        },
      });
    }

    const finalCart = updatedLiveCart || (await getHouseholdCart(household.id));
    return NextResponse.json({ success: true, item: updatedPrismaItem, cart: finalCart });
  } catch (error) {
    console.error("Update cart error:", error);
    return NextResponse.json({ error: "Failed to update cart item" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("clear") === "true";

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const provider = await getCommerceProvider(household.id);
    const isAuth = await provider.isAuthenticated();

    let updatedLiveCart = null;

    if (clearAll) {
      if (isAuth) {
        try {
          await provider.clearCart();
        } catch (e) {
          console.warn("[Cart API DELETE] Swiggy clearCart warning:", e);
        }
      }
      await prisma.cartItem.deleteMany({ where: { householdId: household.id } });
      return NextResponse.json({ success: true, message: "Cart cleared" });
    }

    if (!id) return NextResponse.json({ error: "Cart item ID required" }, { status: 400 });

    console.log(`[Cart API DELETE] Removing item ${id}...`);

    // 1. Remove from live Swiggy Instamart basket if authenticated
    if (isAuth) {
      try {
        const currentCart = await provider.getCart();
        const targetAddressId = currentCart.selectedAddressId || (await provider.getAddresses())[0]?.id;

        // Filter out the item to remove
        const remainingItems = currentCart.items.filter((it) => {
          const matches =
            it.id === id ||
            it.skuId === id ||
            it.spinId === id ||
            it.variantId === id;
          return !matches;
        });

        console.log(`[Cart API DELETE] Remaining items after removal: ${remainingItems.length}`);

        if (targetAddressId) {
          if (remainingItems.length === 0) {
            await provider.clearCart();
            updatedLiveCart = {
              items: [],
              itemCount: 0,
              totalPayable: 0,
              itemTotal: 0,
              merchantName: "Swiggy Instamart",
              merchantUrl: "https://www.swiggy.com/instamart",
              isRealMerchantCart: true,
            };
          } else {
            const updatePayload = remainingItems.map((it) => ({
              spinId: it.spinId,
              skuId: it.skuId || it.variantId || it.id,
              variantId: it.variantId || it.skuId || it.id,
              quantity: it.quantity,
            }));
            await provider.updateCart(updatePayload, targetAddressId);
            updatedLiveCart = await provider.getCart();
          }
        }
      } catch (liveDelErr) {
        console.warn("[Cart API DELETE] Live Swiggy removal warning:", liveDelErr);
      }
    }

    // 2. Remove matching item from Prisma CartItem table
    try {
      const match = await prisma.cartItem.findFirst({
        where: {
          householdId: household.id,
          OR: [
            { id },
            { skuId: id },
            { spinId: id },
            { variantId: id },
          ],
        },
      });

      if (match) {
        await prisma.cartItem.delete({ where: { id: match.id } });
      }
    } catch (dbErr) {
      console.warn("[Cart API DELETE] Prisma delete warning:", dbErr);
    }

    const finalCart = updatedLiveCart || (await getHouseholdCart(household.id));
    return NextResponse.json({ success: true, cart: finalCart });
  } catch (error) {
    console.error("Delete cart item error:", error);
    return NextResponse.json({ error: "Failed to delete cart item" }, { status: 500 });
  }
}
