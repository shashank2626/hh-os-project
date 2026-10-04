import { NextRequest, NextResponse } from "next/server";
import { createServiceRequest, matchVendorForIssue } from "@/lib/services/vendor-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendorId, assetId, issue, category, preferredDate, preferredTime, notes, estimatedCost } = body;

    if (!issue || !category) {
      return NextResponse.json({ error: "issue and category are required" }, { status: 400 });
    }

    let targetVendorId = vendorId;

    // If no vendorId provided, attempt automatic match
    if (!targetVendorId) {
      const match = await matchVendorForIssue(`${category} ${issue}`);
      if (match.primaryVendor) {
        targetVendorId = match.primaryVendor.id;
      } else {
        return NextResponse.json({ error: "No matching vendor found for this category" }, { status: 404 });
      }
    }

    const result = await createServiceRequest({
      vendorId: targetVendorId,
      assetId,
      issue,
      category,
      preferredDate,
      preferredTime,
      notes,
      estimatedCost,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Create service request error:", error);
    return NextResponse.json({ error: error.message || "Failed to create service request" }, { status: 500 });
  }
}
