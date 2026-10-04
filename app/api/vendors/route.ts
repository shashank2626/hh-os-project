import { NextRequest, NextResponse } from "next/server";
import { listVendors, createVendor } from "@/lib/services/vendor-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const search = searchParams.get("search") || undefined;
    const favouritesOnly = searchParams.get("favourites") === "true";

    const vendors = await listVendors(undefined, {
      category,
      search,
      favouritesOnly,
    });

    return NextResponse.json({ vendors });
  } catch (error: any) {
    console.error("Fetch vendors error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch vendors" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vendor = await createVendor(body);
    return NextResponse.json({ vendor }, { status: 201 });
  } catch (error: any) {
    console.error("Create vendor error:", error);
    return NextResponse.json({ error: error.message || "Failed to create vendor" }, { status: 500 });
  }
}
