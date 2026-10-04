import { NextRequest, NextResponse } from "next/server";
import {
  getSmartKitchenRefillItems,
  generateLocalVendorRefillPlan,
  executeSplitRefillPlan,
} from "@/lib/services/refill-service";

export async function GET() {
  try {
    const data = await getSmartKitchenRefillItems();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Smart refill fetch error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch refill recommendations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, items, localItems, instamartItems } = body;

    if (action === "LOCAL_VENDOR") {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "items array is required" }, { status: 400 });
      }
      const plan = await generateLocalVendorRefillPlan(undefined, items);
      return NextResponse.json(plan);
    }

    if (action === "SPLIT" || action === "MIXED") {
      const result = await executeSplitRefillPlan({
        localItems: localItems || [],
        instamartItems: instamartItems || [],
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unsupported refill action. Use LOCAL_VENDOR or SPLIT." }, { status: 400 });
  } catch (error: any) {
    console.error("Smart refill execute error:", error);
    return NextResponse.json({ error: error.message || "Failed to process refill plan" }, { status: 500 });
  }
}
