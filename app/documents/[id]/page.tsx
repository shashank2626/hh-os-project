"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  FileCheck,
  TrendingUp,
  ShieldCheck,
  Layers,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";

interface DocumentDetail {
  id: string;
  title: string;
  originalName: string;
  docType: string;
  status: string;
  confidenceScore: number;
  extractedJson: string;
  impactAnalysis?: string;
  rawText: string;
  createdAt: string;
}

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJsonDetails, setShowJsonDetails] = useState(false);

  useEffect(() => {
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data) => {
        const found = data.documents?.find((d: DocumentDetail) => d.id === resolvedParams.id);
        setDoc(found || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <AppShell>
        <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
          <span>Retrieving household document intelligence...</span>
        </div>
      </AppShell>
    );
  }

  if (!doc) {
    return (
      <AppShell>
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-slate-600 text-sm">Document not found.</p>
          <Link href="/documents" className="mt-3 inline-block text-xs text-teal-600 font-semibold">
            &larr; Back to Documents Archive
          </Link>
        </div>
      </AppShell>
    );
  }

  const parsed = doc.extractedJson ? JSON.parse(doc.extractedJson) : {};
  let impactAnalysis = null;
  if (doc.impactAnalysis) {
    try {
      impactAnalysis = JSON.parse(doc.impactAnalysis);
    } catch {
      impactAnalysis = null;
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Documents Archive</span>
        </Link>

        {/* Document Header */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>{doc.docType.replace(/_/g, " ")} • Document Memory</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{doc.title}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Original: <span className="font-mono text-slate-600">{doc.originalName}</span> • Ingested {formatIndianDate(doc.createdAt)} • Accuracy: {(doc.confidenceScore * 100).toFixed(0)}%
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                doc.status === "CONFIRMED"
                  ? "bg-emerald-100 text-emerald-800"
                  : doc.status === "REJECTED"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              Status: {doc.status}
            </span>
          </div>
        </div>

        {/* Understood Document Overview Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-600" />
              <span>Document Intelligence Summary</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-semibold">Entity / Provider</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                {String(parsed.provider || parsed.vendor || parsed.brand || parsed.issuerOrVendor || "N/A")}
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-semibold">Amount Recorded</span>
              <span className="font-bold text-teal-700 text-sm mt-0.5 block">
                {formatINR(Number(parsed.totalAmount || parsed.total || parsed.purchasePrice || 0))}
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-semibold">
                {parsed.dueDate ? "Due Date" : "Date"}
              </span>
              <span className="font-medium text-slate-800 text-sm mt-0.5 block">
                {String(parsed.dueDate || parsed.date || parsed.purchaseDate || "N/A")}
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-semibold">Reference / Number</span>
              <span className="font-mono text-slate-800 text-xs mt-0.5 block">
                {String(parsed.unitsOrUsage || parsed.billNumber || parsed.serialNumber || "N/A")}
              </span>
            </div>
          </div>
        </div>

        {/* What I Found: Findings, Historical Comparisons & Anomalies */}
        {impactAnalysis && impactAnalysis.findings && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                <span>What I Found (Memory &amp; Historical Context)</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {impactAnalysis.findings.map((f: { id: string; type: string; title: string; description: string; metric?: string; sentiment?: string }) => (
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
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/80 border border-current shadow-2xs">
                          {f.metric}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Historical comparison stats */}
            {impactAnalysis.historicalComparison && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">3-Month Average</div>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">
                    {formatINR(impactAnalysis.historicalComparison.threeMonthAverageAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Deviation vs Avg</div>
                  <div className={`font-bold text-sm mt-0.5 ${
                    impactAnalysis.historicalComparison.currentVsAveragePercent > 0
                      ? "text-rose-600"
                      : "text-emerald-600"
                  }`}>
                    {impactAnalysis.historicalComparison.currentVsAveragePercent > 0 ? "+" : ""}
                    {impactAnalysis.historicalComparison.currentVsAveragePercent}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Usage Change</div>
                  <div className="font-bold text-slate-800 text-sm mt-0.5">
                    {impactAnalysis.historicalComparison.currentUnits || "N/A"}
                    {impactAnalysis.historicalComparison.consumptionChangePercent
                      ? ` (+${impactAnalysis.historicalComparison.consumptionChangePercent}%)`
                      : ""}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Downstream Proposed Actions & Applied State */}
        {impactAnalysis && impactAnalysis.proposedActions && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Downstream Actions &amp; Household State Changes</span>
            </h2>

            <div className="space-y-2">
              {impactAnalysis.proposedActions.map((action: { id: string; actionType: string; title: string; description: string; impact: string }) => {
                const wasExecuted = doc.status === "CONFIRMED";
                return (
                  <div
                    key={action.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-start gap-3"
                  >
                    <div className="mt-0.5 shrink-0">
                      {wasExecuted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{action.title}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                          {action.actionType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">{action.description}</p>
                      <div className="mt-1 text-[10px] text-teal-700 font-medium">
                        💡 {action.impact}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Collapsible Raw JSON Data Section (Secondary Inspect Mode) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
          <button
            type="button"
            onClick={() => setShowJsonDetails(!showJsonDetails)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <span>Inspect Raw Extraction Payload (Developer / Audit View)</span>
            {showJsonDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showJsonDetails && (
            <pre className="mt-3 p-4 bg-slate-900 text-slate-100 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed max-h-80">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </AppShell>
  );
}
