"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  ShoppingCart,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Package,
  RotateCw,
  Plus,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

interface ProcurementRec {
  itemId: string;
  productName: string;
  brand: string;
  category: string;
  recommendedPack: string;
  estimatedPrice: number;
  vendor: string;
  deepLinkUrl: string;
  urgency: string;
  reason: string;
  alternative: string;
  valueSavings: string;
}

export default function ProcurementPage() {
  const [recommendations, setRecommendations] = useState<ProcurementRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [shoppingList, setShoppingList] = useState<string[]>([]);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchProcurement = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/procurement");
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcurement();
  }, []);

  const handleToggleShoppingList = (itemId: string) => {
    if (shoppingList.includes(itemId)) {
      setShoppingList((prev) => prev.filter((id) => id !== itemId));
    } else {
      setShoppingList((prev) => [...prev, itemId]);
      setSuccessMessage("Added to active shopping list!");
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleBuyNow = async (rec: ProcurementRec) => {
    setActionInProgress(rec.itemId);
    try {
      const res = await fetch("/api/procurement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESTOCK_BOUGHT",
          itemId: rec.itemId,
          quantity: rec.recommendedPack.includes("10kg")
            ? 10
            : rec.recommendedPack.includes("5kg")
            ? 5
            : 2,
          price: rec.estimatedPrice,
          vendor: rec.vendor,
        }),
      });

      if (res.ok) {
        setSuccessMessage(`Restocked ${rec.productName}! Pantry inventory updated.`);
        setShoppingList((prev) => prev.filter((id) => id !== rec.itemId));
        await fetchProcurement();
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Procurement &amp; Quick-Commerce Bridge</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Smart Household Procurement
            </h1>
            <p className="text-sm text-slate-500">
              Autonomous pack size optimization, value comparison, and direct retailer handoff.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs text-xs">
            <span className="text-slate-500">In Shopping List:</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">
              {shoppingList.length} items
            </span>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
            <span>Analyzing household depletion rates &amp; market pack pricing...</span>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-600 text-xs">
            All household inventory items are currently well-stocked. No procurement recommendations needed!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recommendations.map((rec) => {
              const inList = shoppingList.includes(rec.itemId);

              return (
                <div
                  key={rec.itemId}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-teal-300 transition-all"
                >
                  <div>
                    {/* Top Row: Category & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                          Recommended Pack
                        </span>
                        <h2 className="text-base font-bold text-slate-900 mt-2">
                          {rec.productName}
                        </h2>
                        <div className="text-xs text-slate-500 font-medium">
                          {rec.brand} • {rec.category}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-bold text-slate-900">
                          {formatINR(rec.estimatedPrice)}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          via {rec.vendor}
                        </span>
                      </div>
                    </div>

                    {/* AI Recommendation Reasoning */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs leading-relaxed text-slate-700">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        <span>Why This Recommendation:</span>
                      </div>
                      <p>{rec.reason}</p>
                    </div>

                    {/* Value Comparison & Alternatives */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                        <span className="text-[10px] font-semibold text-emerald-800 uppercase block">
                          Optimal Pack Size
                        </span>
                        <span className="font-bold text-slate-900 block mt-0.5">
                          {rec.recommendedPack}
                        </span>
                        <span className="text-[11px] text-emerald-700 block mt-0.5">
                          {rec.valueSavings}
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                          Alternative Option
                        </span>
                        <span className="font-semibold text-slate-800 block mt-0.5">
                          {rec.alternative}
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          Standard Retail Pack
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleShoppingList(rec.itemId)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                        inList
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {inList ? "✓ In Shopping List" : "+ Add to Shopping List"}
                    </button>

                    <div className="flex items-center gap-2">
                      {/* Clean Retailer Integration Handoff Link */}
                      <a
                        href={rec.deepLinkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <span>Open {rec.vendor}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </a>

                      {/* Buy Now / Confirm Restock */}
                      <button
                        type="button"
                        onClick={() => handleBuyNow(rec)}
                        disabled={actionInProgress === rec.itemId}
                        className="text-xs px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {actionInProgress === rec.itemId ? "Restocking..." : "Mark Bought"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
