import { NextRequest, NextResponse } from "next/server";
import { logVendorContact } from "@/lib/services/vendor-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendorId, actionType, context, messageSent } = body;

    if (!vendorId || !actionType) {
      return NextResponse.json({ error: "vendorId and actionType are required" }, { status: 400 });
    }

    const log = await logVendorContact({
      vendorId,
      actionType,
      context,
      messageSent,
    });

    return NextResponse.json({ log });
  } catch (error: any) {
    console.error("Log vendor contact error:", error);
    return NextResponse.json({ error: error.message || "Failed to log vendor contact" }, { status: 500 });
  }
}
