import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  executeApprovedDocumentActions,
  DocumentImpactAnalysis,
} from "@/lib/services/document-intelligence-service";

export async function POST(req: NextRequest) {
  try {
    const { documentId, selectedActionIds } = await req.json();

    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    let actionIdsToExecute = selectedActionIds;

    // If no action IDs were explicitly passed, default to all pre-selected actions from impact analysis
    if (!actionIdsToExecute || !Array.isArray(actionIdsToExecute)) {
      if (doc.impactAnalysis) {
        try {
          const impact = JSON.parse(doc.impactAnalysis) as DocumentImpactAnalysis;
          actionIdsToExecute = impact.proposedActions
            ?.filter((a) => a.isPreSelected)
            .map((a) => a.id) || [];
        } catch {
          actionIdsToExecute = [];
        }
      } else {
        actionIdsToExecute = [];
      }
    }

    // Apply approved downstream database mutations
    const result = await executeApprovedDocumentActions({
      documentId: doc.id,
      householdId: doc.householdId,
      selectedActionIds: actionIdsToExecute,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      executedCount: result.executedActionsCount,
      executedEntities: result.executedEntities,
    });
  } catch (error: unknown) {
    console.error("Document confirmation error:", error);
    const message = error instanceof Error ? error.message : "Failed to apply document changes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
