"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { ArrowLeft, Package, Clock, TrendingDown, RotateCw, History } from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";

interface InventoryEvent {
  id: string;
  type: string;
  quantityChanged: number;
  newQuantity: number;
  notes: string;
  createdAt: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  brand?: string;
  quantity: number;
  unit: string;
  minimumStock: number;
  consumptionRate: number;
  estimatedDaysRemaining: number;
  preferredBrand?: string;
  preferredPackSize?: string;
  price: number;
  vendor: string;
  isLowStock: boolean;
  lastPurchasedAt?: string;
  events: InventoryEvent[];
}

export default function InventoryItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/inventory/${resolvedParams.id}`)
      .then((res) => res.json())
      .then((data) => setItem(data.item))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <AppShell>
        <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
          <span>Loading item history...</span>
        </div>
      </AppShell>
    );
  }

  if (!item) {
    return (
      <AppShell>
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-slate-600 text-sm">Inventory item not found.</p>
          <Link
            href="/inventory"
            className="mt-3 inline-block text-xs text-teal-600 font-semibold"
          >
            &larr; Back to Inventory
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Pantry Inventory</span>
        </Link>

        {/* Item Header */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
              {item.category} • {item.brand || "Standard"}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{item.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Preferred vendor: <span className="font-semibold">{item.vendor}</span> • Pack size:{" "}
              <span className="font-semibold">{item.preferredPackSize || "Standard"}</span>
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <div className="text-xs text-slate-500 font-medium">Current Stock</div>
              <div className="text-2xl font-bold text-slate-900">
                {item.quantity} {item.unit}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <div className="text-xs text-slate-500 font-medium">Estimated Days</div>
              <div
                className={`text-2xl font-bold ${
                  item.estimatedDaysRemaining <= 3 ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                ~{item.estimatedDaysRemaining} days
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">Daily Burn Rate</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">
              {item.consumptionRate} {item.unit} / day
            </span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">Minimum Buffer</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">
              {item.minimumStock} {item.unit}
            </span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">Unit Retail Price</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">
              {formatINR(item.price)}
            </span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">Last Purchased</span>
            <span className="text-lg font-bold text-slate-900 mt-1 block">
              {formatIndianDate(item.lastPurchasedAt)}
            </span>
          </div>
        </div>

        {/* Consumption & Restock History Log */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-sm">
              Consumption &amp; Restock Audit History
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {item.events.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No recorded consumption events yet.
              </div>
            ) : (
              item.events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 flex items-center justify-between hover:bg-slate-50/50 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        ev.type === "RESTOCK"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {ev.type}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {ev.type === "RESTOCK" ? "+" : ""}
                        {ev.quantityChanged} {item.unit} (New total: {ev.newQuantity} {item.unit})
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{ev.notes}</div>
                    </div>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {formatIndianDate(ev.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
