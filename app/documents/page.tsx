"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Tv,
  RotateCw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  FileUp,
  Zap,
  TrendingUp,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  Check,
  Calculator,
  Search,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";
import { Stage1ExtractionResult } from "@/lib/services/document-stage1-extractor";

interface DocumentFinding {
  id: string;
  type: "TREND" | "ANOMALY" | "URGENCY" | "MATCH" | "INFO";
  title: string;
  description: string;
  metric?: string;
  sentiment?: "POSITIVE" | "WARNING" | "CRITICAL" | "NEUTRAL";
}

interface ProposedAction {
  id: string;
  actionType: string;
  title: string;
  description: string;
  impact: string;
  isPreSelected: boolean;
  payload: Record<string, unknown>;
}

interface HistoricalComparison {
  provider: string;
  previousBillsCount: number;
  threeMonthAverageAmount: number;
  sixMonthAverageAmount?: number;
  currentVsAveragePercent: number;
  previousUnits?: string;
  currentUnits?: string;
  consumptionChangePercent?: number;
  trendDescription: string;
  history?: Array<{
    date: string;
    amount: number;
    units?: string;
    notes?: string;
  }>;
}

interface DocumentImpactAnalysis {
  stage1: Stage1ExtractionResult;
  documentType: string;
  confidenceScore: number;
  summary: string;
  isDuplicate: boolean;
  duplicateDetails?: {
    duplicateOfId?: string;
    message: string;
  };
  findings: DocumentFinding[];
  householdImpact: {
    expenseImpact: string;
    budgetImpact?: string;
    inventoryImpact?: string;
    assetImpact?: string;
    financialHealthScoreDelta?: number;
  };
  historicalComparison?: HistoricalComparison;
  matchedEntity?: {
    entityType: string;
    id: string;
    name: string;
    details: string;
  };
  proposedActions: ProposedAction[];
}

interface DocumentItem {
  id: string;
  title: string;
  originalName: string;
  fileType: string;
  status: string;
  docType: string;
  confidenceScore: number;
  extractedJson: string;
  impactAnalysis?: string;
  createdAt: string;
  extractions: Array<{
    id: string;
    extractedType: string;
    vendorOrBrand: string;
    totalAmount: number;
    downstreamApplied: boolean;
  }>;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reviewStep, setReviewStep] = useState<"VERIFY_EXTRACTION" | "HOUSEHOLD_ACTIONS">("VERIFY_EXTRACTION");

  const [activeReviewDoc, setActiveReviewDoc] = useState<{
    documentId: string;
    docType: string;
    title: string;
    stage1: Stage1ExtractionResult;
    impactAnalysis: DocumentImpactAnalysis;
    confidence: number;
  } | null>(null);

  const [selectedActionIds, setSelectedActionIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showJsonDetails, setShowJsonDetails] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const openReviewModal = (
    docId: string,
    docType: string,
    title: string,
    stage1: Stage1ExtractionResult,
    impactAnalysis: DocumentImpactAnalysis,
    confidence: number
  ) => {
    setActiveReviewDoc({
      documentId: docId,
      docType,
      title,
      stage1,
      impactAnalysis,
      confidence,
    });
    setReviewStep("VERIFY_EXTRACTION");
    const initialSelected = impactAnalysis.proposedActions
      .filter((a) => a.isPreSelected)
      .map((a) => a.id);
    setSelectedActionIds(initialSelected);
    setShowJsonDetails(false);
  };

  // Upload sample or custom file
  const handleUploadSample = async (sampleType: string) => {
    setProcessing(true);
    try {
      const clientApiKey = typeof window !== "undefined" ? localStorage.getItem("gemini_api_key") : null;
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(clientApiKey ? { "x-gemini-api-key": clientApiKey } : {}),
        },
        body: JSON.stringify({ sampleType }),
      });

      const data = await res.json();
      if (res.ok) {
        openReviewModal(
          data.document.id,
          data.stage1.docType,
          data.document.title,
          data.stage1,
          data.impactAnalysis,
          data.confidence
        );
        await fetchDocuments();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    try {
      const clientApiKey = typeof window !== "undefined" ? localStorage.getItem("gemini_api_key") : null;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(clientApiKey ? { "x-gemini-api-key": clientApiKey } : {}),
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type || "application/pdf",
            base64Data,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          openReviewModal(
            data.document.id,
            data.stage1.docType,
            data.document.title,
            data.stage1,
            data.impactAnalysis,
            data.confidence
          );
          await fetchDocuments();
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const toggleActionSelection = (actionId: string) => {
    setSelectedActionIds((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId]
    );
  };

  const selectAllActions = () => {
    if (!activeReviewDoc) return;
    setSelectedActionIds(activeReviewDoc.impactAnalysis.proposedActions.map((a) => a.id));
  };

  const deselectAllActions = () => {
    setSelectedActionIds([]);
  };

  // User Confirms Extraction -> Applies Approved Actions Transactionally to Prisma!
  const handleConfirmExtraction = async () => {
    if (!activeReviewDoc) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/documents/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: activeReviewDoc.documentId,
          selectedActionIds,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessNotice(data.message || "Document approved and household state updated!");
        setActiveReviewDoc(null);
        await fetchDocuments();
        setTimeout(() => setSuccessNotice(null), 6000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConfirming(false);
    }
  };

  // User Rejects Document
  const handleRejectDocument = async () => {
    if (!activeReviewDoc) return;
    setRejecting(true);
    try {
      const res = await fetch("/api/documents/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: activeReviewDoc.documentId,
          reason: "User rejected proposed actions during document review.",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessNotice("Document rejected. No changes made to household state.");
        setActiveReviewDoc(null);
        await fetchDocuments();
        setTimeout(() => setSuccessNotice(null), 5000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRejecting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Two-Stage Multimodal AI Document Intelligence</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Household Document Intelligence
            </h1>
            <p className="text-sm text-slate-500">
              Stage 1 transcribes pixel-accurate invoices &amp; verifies arithmetic. Stage 2 matches household memory &amp; executes user-approved actions.
            </p>
          </div>
        </div>

        {/* Success Notice */}
        {successNotice && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium flex items-center gap-3 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-sm">Household State Updated</div>
              <div className="text-emerald-700">{successNotice}</div>
            </div>
          </div>
        )}

        {/* Upload & Verified Test Invoice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Custom File Upload Box */}
          <div className="p-5 bg-white rounded-xl border border-dashed border-slate-300 hover:border-teal-500 flex flex-col items-center justify-center text-center shadow-xs transition-colors group">
            <div className="w-10 h-10 rounded-full bg-teal-50 group-hover:bg-teal-100 text-teal-600 flex items-center justify-center mb-2 transition-colors">
              <FileUp className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-xs">Upload Real Invoice / Bill</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">JPG, PNG, PDF (Multimodal Vision)</p>
            <label className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Choose File</span>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={processing}
              />
            </label>
          </div>

          {/* Test 1: Amazon Samsung Washing Machine Invoice (User Requested Exact Document) */}
          <div className="p-4 bg-white rounded-xl border border-blue-200 shadow-xs flex flex-col justify-between hover:border-blue-400 transition-colors">
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-blue-700 mb-1">
                <span>Verified Appliance Test</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800">Net + GST Total</span>
              </div>
              <h3 className="font-bold text-slate-900 text-xs">
                Amazon Samsung 7.0 Kg Washing Machine
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Net: ₹25,650 • GST: ₹4,617 • <strong>Final Total: ₹30,267</strong>. Order: 407-9998887-6665544.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleUploadSample("SAMSUNG_WASHING_MACHINE")}
              disabled={processing}
              className="mt-3 w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>{processing ? "Analyzing..." : "Test Samsung Invoice (₹30,267)"}</span>
            </button>
          </div>

          {/* Test 2: Electricity Bill */}
          <div className="p-4 bg-white rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between hover:border-amber-400 transition-colors">
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-amber-700 mb-1">
                <span>Utility Intelligence</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">Historical Memory</span>
              </div>
              <h3 className="font-bold text-slate-900 text-xs">
                Tata Power Electricity Bill (₹2,340 / 284 kWh)
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Compares with prior bills, detects +25% consumption surge, flags due tomorrow urgency.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleUploadSample("ELECTRICITY_BILL")}
              disabled={processing}
              className="mt-3 w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{processing ? "Analyzing..." : "Analyze Tata Power Bill"}</span>
            </button>
          </div>

          {/* Test 3: Quick-Commerce Grocery Receipt */}
          <div className="p-4 bg-white rounded-xl border border-emerald-200 shadow-xs flex flex-col justify-between hover:border-emerald-400 transition-colors">
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700 mb-1">
                <span>Pantry Memory</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">Inventory Sync</span>
              </div>
              <h3 className="font-bold text-slate-900 text-xs">
                Blinkit Quick-Commerce Order (₹867)
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Restocks low-stock Atta and Milk, discovers new deodorant item and proposes registration.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleUploadSample("GROCERY_RECEIPT")}
              disabled={processing}
              className="mt-3 w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Package className="w-3.5 h-3.5" />
              <span>{processing ? "Analyzing..." : "Analyze Grocery Receipt"}</span>
            </button>
          </div>
        </div>

        {/* REVIEW MODAL: 2-STAGE VERIFICATION WORKFLOW */}
        {activeReviewDoc && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 animate-in zoom-in-95 flex flex-col max-h-[92vh] overflow-y-auto space-y-5">

              {/* Modal Top Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 uppercase">
                      {activeReviewDoc.stage1.docType.replace(/_/g, " ")}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      Confidence: {(activeReviewDoc.confidence * 100).toFixed(0)}%
                    </span>
                    {activeReviewDoc.impactAnalysis.isDuplicate && (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Duplicate Detected</span>
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mt-1.5">
                    {reviewStep === "VERIFY_EXTRACTION"
                      ? "Stage 1: Verify Extracted Data"
                      : "Stage 2: Household Memory & Proposed Actions"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {reviewStep === "VERIFY_EXTRACTION"
                      ? "Confirm exact extracted numbers, line items, and tax breakdown before analyzing household impact."
                      : "Review historical comparisons, memory matching, and approve downstream database mutations."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveReviewDoc(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <button
                  type="button"
                  onClick={() => setReviewStep("VERIFY_EXTRACTION")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    reviewStep === "VERIFY_EXTRACTION"
                      ? "bg-teal-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>1. Verify Extracted Data</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReviewStep("HOUSEHOLD_ACTIONS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    reviewStep === "HOUSEHOLD_ACTIONS"
                      ? "bg-teal-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>2. Household Memory &amp; Actions ({selectedActionIds.length})</span>
                </button>
              </div>

              {/* ========================================== */}
              {/* VIEW 1: STAGE 1 VERIFY EXTRACTED DATA      */}
              {/* ========================================== */}
              {reviewStep === "VERIFY_EXTRACTION" && (
                <div className="space-y-4">
                  {/* Visual Overview Card */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Detected Vendor</span>
                        <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                          {activeReviewDoc.stage1.vendor}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Final Total Payable</span>
                        <span className="font-bold text-teal-700 text-base mt-0.5 block">
                          {formatINR(activeReviewDoc.stage1.finalTotal)}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Invoice Date</span>
                        <span className="font-medium text-slate-800 text-xs mt-0.5 block">
                          {activeReviewDoc.stage1.date || "N/A"}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 text-[10px] block uppercase font-bold">Invoice / Order #</span>
                        <span className="font-mono text-slate-800 text-[11px] mt-0.5 block truncate">
                          {activeReviewDoc.stage1.invoiceNumber || activeReviewDoc.stage1.orderNumber || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  {activeReviewDoc.stage1.lineItems.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      <div className="bg-slate-100/70 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-200">
                        Extracted Line Items ({activeReviewDoc.stage1.lineItems.length})
                      </div>
                      <div className="divide-y divide-slate-100 text-xs">
                        {activeReviewDoc.stage1.lineItems.map((item, idx) => (
                          <div key={idx} className="p-3.5 flex items-center justify-between gap-3">
                            <div className="flex-1">
                              <span className="font-bold text-slate-900 block text-xs">{item.description}</span>
                              <span className="text-[11px] text-slate-500">
                                Qty: {item.quantity} • Unit Price: {formatINR(item.unitPrice || item.netAmount || 0)}
                                {item.taxRate && ` • Tax: ${item.taxRate}`}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-slate-900 text-sm block">
                                {formatINR(item.totalAmount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial Breakdown & Arithmetic Verification */}
                  <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-200 text-xs space-y-2.5">
                    <div className="flex items-center justify-between font-bold text-teal-950 border-b border-teal-200/60 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Calculator className="w-4 h-4 text-teal-600" />
                        <span>Financial Table &amp; Arithmetic Validation</span>
                      </div>
                      {activeReviewDoc.stage1.arithmeticValidation.isValid ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                          ✅ Arithmetic Validated
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">
                          ⚠️ Arithmetic Discrepancy
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Net Amount (Excl. Tax)</span>
                        <span className="font-semibold text-slate-900">
                          {formatINR(activeReviewDoc.stage1.netAmount || activeReviewDoc.stage1.finalTotal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Tax (GST)</span>
                        <span className="font-semibold text-slate-900">
                          + {formatINR(activeReviewDoc.stage1.taxAmount || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Discounts / Charges</span>
                        <span className="font-semibold text-slate-900">
                          - {formatINR(activeReviewDoc.stage1.discountAmount || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-teal-800 text-[10px] block font-bold">Final Total Payable</span>
                        <span className="font-bold text-teal-700 text-sm">
                          = {formatINR(activeReviewDoc.stage1.finalTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-teal-800 pt-1 font-mono">
                      Validation: {activeReviewDoc.stage1.arithmeticValidation.formula}
                    </div>
                  </div>

                  {/* Source Evidence Snippets */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                      Document Source Evidence
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                      {activeReviewDoc.stage1.fieldEvidence.finalTotal && (
                        <div>• Total: <span className="font-mono text-slate-800">{activeReviewDoc.stage1.fieldEvidence.finalTotal}</span></div>
                      )}
                      {activeReviewDoc.stage1.fieldEvidence.netAmount && (
                        <div>• Net Amount: <span className="font-mono text-slate-800">{activeReviewDoc.stage1.fieldEvidence.netAmount}</span></div>
                      )}
                      {activeReviewDoc.stage1.fieldEvidence.taxAmount && (
                        <div>• Tax (GST): <span className="font-mono text-slate-800">{activeReviewDoc.stage1.fieldEvidence.taxAmount}</span></div>
                      )}
                      {activeReviewDoc.stage1.fieldEvidence.orderNumber && (
                        <div>• Order #: <span className="font-mono text-slate-800">{activeReviewDoc.stage1.fieldEvidence.orderNumber}</span></div>
                      )}
                      {activeReviewDoc.stage1.fieldEvidence.invoiceNumber && (
                        <div>• Invoice #: <span className="font-mono text-slate-800">{activeReviewDoc.stage1.fieldEvidence.invoiceNumber}</span></div>
                      )}
                    </div>
                  </div>

                  {/* Stage 1 to Stage 2 Navigation Bar */}
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleRejectDocument}
                      className="px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-semibold transition-colors cursor-pointer"
                    >
                      Reject Document
                    </button>

                    <button
                      type="button"
                      onClick={() => setReviewStep("HOUSEHOLD_ACTIONS")}
                      className="px-5 py-2 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Proceed to Household Memory &amp; Actions</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================== */}
              {/* VIEW 2: STAGE 2 HOUSEHOLD MEMORY & ACTIONS */}
              {/* ========================================== */}
              {reviewStep === "HOUSEHOLD_ACTIONS" && (
                <div className="space-y-4">
                  {/* Memory & Findings */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-amber-600" />
                      <span>Household Memory &amp; Historical Context</span>
                    </h3>

                    <div className="grid grid-cols-1 gap-2">
                      {activeReviewDoc.impactAnalysis.findings.map((f) => (
                        <div
                          key={f.id}
                          className={`p-3 rounded-xl border text-xs flex items-start gap-3 ${
                            f.sentiment === "CRITICAL"
                              ? "bg-rose-50 border-rose-200 text-rose-900"
                              : f.sentiment === "WARNING"
                              ? "bg-amber-50 border-amber-200 text-amber-900"
                              : f.sentiment === "POSITIVE"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                              : "bg-blue-50 border-blue-200 text-blue-900"
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {f.sentiment === "CRITICAL" || f.sentiment === "WARNING" ? (
                              <AlertTriangle className="w-4 h-4 text-amber-600" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold">{f.title}</span>
                              {f.metric && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/70 border border-current shadow-2xs">
                                  {f.metric}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">{f.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Proposed Actions (Interactive Checkboxes) */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Proposed Downstream Actions ({selectedActionIds.length} of {activeReviewDoc.impactAnalysis.proposedActions.length} selected)
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Uncheck any action you do not wish to execute against the database.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={selectAllActions}
                          className="text-teal-600 hover:text-teal-700 font-semibold cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={deselectAllActions}
                          className="text-slate-500 hover:text-slate-700 font-semibold cursor-pointer"
                        >
                          Deselect
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {activeReviewDoc.impactAnalysis.proposedActions.map((action) => {
                        const isSelected = selectedActionIds.includes(action.id);
                        return (
                          <div
                            key={action.id}
                            onClick={() => toggleActionSelection(action.id)}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                              isSelected
                                ? "bg-white border-teal-500 shadow-xs ring-1 ring-teal-500/20"
                                : "bg-slate-50/70 border-slate-200 opacity-60 hover:opacity-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-900 text-xs">
                                  {action.title}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {action.actionType.replace(/_/g, " ")}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5">{action.description}</p>
                              <div className="mt-1 text-[10px] text-teal-700 font-medium">
                                💡 Impact: {action.impact}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Technical Data Drawer */}
                  <div className="border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowJsonDetails(!showJsonDetails)}
                      className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                    >
                      {showJsonDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>{showJsonDetails ? "Hide" : "Inspect"} Raw Extraction JSON (Developer View)</span>
                    </button>

                    {showJsonDetails && (
                      <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-[10px] overflow-x-auto font-mono max-h-48 leading-relaxed">
                        {JSON.stringify(activeReviewDoc.stage1, null, 2)}
                      </pre>
                    )}
                  </div>

                  {/* Stage 2 Action Bar */}
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setReviewStep("VERIFY_EXTRACTION")}
                      className="px-3.5 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Verify Data</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRejectDocument}
                        disabled={rejecting || confirming}
                        className="px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-semibold cursor-pointer"
                      >
                        Reject
                      </button>

                      <button
                        type="button"
                        onClick={handleConfirmExtraction}
                        disabled={confirming || rejecting || selectedActionIds.length === 0}
                        className="px-5 py-2 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        {confirming ? (
                          <>
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Applying {selectedActionIds.length} Actions...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve &amp; Apply ({selectedActionIds.length} Actions)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Processed Ingested Documents List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Household Document Memory &amp; Archive ({documents.length})
              </h2>
              <p className="text-[11px] text-slate-400">
                Persistent Indian household documents with structured extractions and linked downstream entities
              </p>
            </div>
            <span className="text-xs text-slate-500 font-medium">Multimodal Pipeline Active</span>
          </div>

          <div className="divide-y divide-slate-100">
            {documents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No documents uploaded yet. Click one of the test sample buttons above or upload your own file!
              </div>
            ) : (
              documents.map((doc) => {
                let parsedImpact: DocumentImpactAnalysis | null = null;
                if (doc.impactAnalysis) {
                  try {
                    parsedImpact = JSON.parse(doc.impactAnalysis);
                  } catch {
                    parsedImpact = null;
                  }
                }

                return (
                  <div
                    key={doc.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 font-bold">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                          <span>{doc.title}</span>
                          {parsedImpact?.isDuplicate && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 rounded">
                              Duplicate
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-2 mt-0.5">
                          <span className="font-medium text-teal-700">{doc.docType.replace(/_/g, " ")}</span>
                          <span>•</span>
                          <span>{formatIndianDate(doc.createdAt)}</span>
                          {parsedImpact?.findings?.[0] && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 italic">
                                {parsedImpact.findings[0].title}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          doc.status === "CONFIRMED"
                            ? "bg-emerald-100 text-emerald-800"
                            : doc.status === "REJECTED"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {doc.status}
                      </span>

                      <Link
                        href={`/documents/${doc.id}`}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>View Intelligence</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
