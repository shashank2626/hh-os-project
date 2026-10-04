import { NextRequest, NextResponse } from "next/server";
import { getCommerceProvider } from "@/lib/integrations/commerce/provider";
import { CommerceProduct } from "@/lib/integrations/commerce/types";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim() || "";
    const brand = searchParams.get("brand")?.trim() || "";

    if (!query) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    const household = await prisma.household.findFirst();
    const provider = await getCommerceProvider(household?.id);
    const isAuth = await provider.isAuthenticated();

    if (!isAuth) {
      return NextResponse.json({
        success: false,
        error: "Swiggy Instamart is not connected",
        alternatives: [],
      });
    }

    const addresses = await provider.getAddresses();
    if (addresses.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No delivery address found",
        alternatives: [],
      });
    }

    const addressId = addresses[0].id;

    // Search Swiggy Instamart live catalog
    console.log(`[Alternatives API] Searching products for "${query}" (Brand: ${brand || "none"})...`);
    let products: CommerceProduct[] = await provider.searchProducts(query, addressId).catch(() => []);

    // If few results and brand is known, search brand as well
    if (products.length < 3 && brand && !query.toLowerCase().includes(brand.toLowerCase())) {
      const brandProducts = await provider.searchProducts(`${brand} ${query}`, addressId).catch(() => []);
      const existingIds = new Set(products.map((p) => p.id));
      for (const bp of brandProducts) {
        if (!existingIds.has(bp.id)) {
          products.push(bp);
          existingIds.add(bp.id);
        }
      }
    }

    // Flatten products and variants into selectable options
    const alternatives: Array<{
      productId: string;
      name: string;
      brand?: string;
      packSize: string;
      price: number;
      mrp?: number;
      discountPercentage?: number;
      imageUrl?: string;
      skuId?: string;
      spinId?: string;
      variantId?: string;
      inStock: boolean;
    }> = [];

    for (const prod of products) {
      const variants = prod.variants && prod.variants.length > 0 ? prod.variants : [
        {
          id: prod.id,
          name: prod.name,
          packSize: "Standard",
          price: 0,
          inStock: true,
        },
      ];

      for (const v of variants) {
        if (!v.inStock) continue;

        alternatives.push({
          productId: prod.id,
          name: prod.name,
          brand: prod.brand || brand || undefined,
          packSize: v.packSize || "Standard Pack",
          price: v.price,
          mrp: v.mrp,
          discountPercentage: v.discountPercentage,
          imageUrl: prod.imageUrl,
          skuId: v.skuId || v.id,
          spinId: v.spinId || v.id,
          variantId: v.id,
          inStock: v.inStock,
        });
      }
    }

    return NextResponse.json({
      success: true,
      query,
      count: alternatives.length,
      alternatives: alternatives.slice(0, 15), // Top 15 in-stock variants
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to fetch alternative products";
    console.error("[Alternatives API] Error:", msg);
    return NextResponse.json({ error: msg, alternatives: [] }, { status: 500 });
  }
}
