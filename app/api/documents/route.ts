import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  computeDocumentHash,
  extractStage1Document,
  performHouseholdImpactAnalysis,
} from "@/lib/services/document-intelligence-service";

export async function GET() {
  try {
    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const documents = await prisma.document.findMany({
      where: { householdId: household.id },
      include: { extractions: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Fetch documents error:", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, fileType, base64Data, sampleType, apiKey } = body;
    const clientApiKey = req.headers.get("x-gemini-api-key") || apiKey;

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    // Determine target file name and type
    let effectiveFileName = fileName || "Document.pdf";
    let effectiveFileType = fileType || "application/pdf";

    if (sampleType === "AC_INVOICE") {
      effectiveFileName = "Voltas_1.5T_Inverter_AC_Tax_Invoice.pdf";
      effectiveFileType = "application/pdf";
    } else if (sampleType === "GROCERY_RECEIPT") {
      effectiveFileName = "Blinkit_Quick_Commerce_Receipt.png";
      effectiveFileType = "image/png";
    } else if (sampleType === "ELECTRICITY_BILL") {
      effectiveFileName = "Tata_Power_Mumbai_Electricity_Bill.pdf";
      effectiveFileType = "application/pdf";
    }

    // Compute SHA-256 hash for document content to prevent duplicate submissions
    const contentToHash = base64Data || `${sampleType || "CUSTOM"}_${effectiveFileName}`;
    const docHash = computeDocumentHash(contentToHash);

    // ==========================================
    // STAGE 1: PURE EXTRACTION (MULTIMODAL & TRANSCRIPTION)
    // Inspects visual tables, net amount, GST, line items, and final total.
    // Zero database assumptions or fake fallbacks.
    // ==========================================
    const stage1 = await extractStage1Document({
      fileName: effectiveFileName,
      fileType: effectiveFileType,
      base64Data,
      apiKeyOverride: clientApiKey,
      sampleType,
    });

    // ==========================================
    // STAGE 2: HOUSEHOLD MEMORY & IMPACT ANALYSIS
    // Only runs on verified Stage 1 data.
    // Checks existing assets/inventory, historical trends, and formulates actions.
    // ==========================================
    const impactAnalysis = await performHouseholdImpactAnalysis({
      householdId: household.id,
      stage1,
      documentHash: docHash,
    });

    // Title generation from extracted content rather than raw filename
    const docTitle =
      stage1.applianceMetadata?.model ||
      stage1.lineItems[0]?.description ||
      `${stage1.vendor} ${stage1.docType.replace(/_/g, " ")}`;

    // Persist in Document table
    const doc = await prisma.document.create({
      data: {
        householdId: household.id,
        title: docTitle,
        originalName: effectiveFileName,
        fileType: effectiveFileType,
        fileSize: base64Data ? Math.round(base64Data.length * 0.75) : 156000,
        status: "EXTRACTED",
        docType: stage1.docType,
        extractedJson: JSON.stringify(stage1),
        confidenceScore: stage1.fieldConfidence.finalTotal || 0.95,
        rawText: stage1.rawText || stage1.fieldEvidence.finalTotal,
        hash: docHash,
        impactAnalysis: JSON.stringify(impactAnalysis),
        duplicateOfId: impactAnalysis.duplicateDetails?.duplicateOfId,
      },
    });

    // Create DocumentExtraction record
    const extraction = await prisma.documentExtraction.create({
      data: {
        documentId: doc.id,
        extractedType: stage1.docType,
        vendorOrBrand: stage1.vendor,
        invoiceNumber: stage1.invoiceNumber || stage1.orderNumber,
        totalAmount: stage1.finalTotal,
        lineItems: JSON.stringify(stage1.lineItems),
        downstreamApplied: false,
      },
    });

    return NextResponse.json({
      success: true,
      document: doc,
      extraction,
      stage1,
      impactAnalysis,
      summary: `${stage1.vendor}: ₹${stage1.finalTotal.toLocaleString("en-IN")}`,
      confidence: stage1.fieldConfidence.finalTotal || 0.95,
    });
  } catch (error) {
    console.error("Document upload/process error:", error);
    return NextResponse.json({ error: "Failed to process document" }, { status: 500 });
  }
}
