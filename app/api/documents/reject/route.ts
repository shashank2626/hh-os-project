import { NextRequest, NextResponse } from "next/server";
import { rejectHouseholdDocument } from "@/lib/services/document-intelligence-service";

export async function POST(req: NextRequest) {
  try {
    const { documentId, reason } = await req.json();

    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    const result = await rejectHouseholdDocument({
      documentId,
      reason,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Document rejection error:", error);
    const message = error instanceof Error ? error.message : "Failed to reject document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
