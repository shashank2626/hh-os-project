"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  ArrowLeft,
  Tv,
  Wrench,
  ShieldCheck,
  RotateCw,
  Plus,
  CheckCircle2,
  Calendar,
  Phone,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";

interface MaintenanceRecord {
  id: string;
  serviceDate: string;
  serviceType: string;
  provider: string;
  cost: number;
  notes: string;
  technicianName?: string;
  technicianPhone?: string;
}

interface AssetDetail {
  id: string;
  name: string;
  category: string;
  brand: string;
  model?: string;
  serialNumber?: string;
  location: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyPeriodMonths: number;
  serviceIntervalDays: number;
  technicianContact?: string;
  notes?: string;
  healthScore: number;
  maintenanceStatus: {
    daysSinceLastService: number;
    daysUntilNextService: number;
    isOverdue: boolean;
    healthScore: number;
    riskLevel: string;
    explanation: string;
    warrantyStatus: {
      isUnderWarranty: boolean;
      label: string;
    };
  };
  maintenance: MaintenanceRecord[];
}

export default function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Service log fields
  const [serviceType, setServiceType] = useState("Preventive");
  const [provider, setProvider] = useState("Urban Company");
  const [cost, setCost] = useState("799");
  const [notes, setNotes] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [technicianPhone, setTechnicianPhone] = useState("");

  const fetchAsset = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/assets/${resolvedParams.id}`);
      const data = await res.json();
      setAsset(data.asset);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAsset();
  }, [resolvedParams.id]);

  const handleLogService = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: resolvedParams.id,
          serviceType,
          provider,
          cost: Number(cost),
          notes,
          technicianName,
          technicianPhone,
        }),
      });

      if (res.ok) {
        setModalOpen(false);
        setSuccessNotice("Maintenance logged successfully! Health score restored.");
        fetchAsset();
        setTimeout(() => setSuccessNotice(null), 4000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
          <span>Loading asset telemetry &amp; maintenance logs...</span>
        </div>
      </AppShell>
    );
  }

  if (!asset) {
    return (
      <AppShell>
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <p className="text-slate-600 text-sm">Appliance not found.</p>
          <Link href="/assets" className="mt-3 inline-block text-xs text-teal-600 font-semibold">
            &larr; Back to Assets
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Link
          href="/assets"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Appliances</span>
        </Link>

        {successNotice && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Appliance Overview Header */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
              {asset.category} • {asset.brand}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{asset.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Serial No: <span className="font-mono">{asset.serialNumber || "N/A"}</span> • Location:{" "}
              {asset.location}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Health Score</span>
              <span className="text-2xl font-bold text-teal-700">
                {asset.maintenanceStatus.healthScore}%
              </span>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Wrench className="w-4 h-4" />
              <span>Log Completed Service</span>
            </button>
          </div>
        </div>

        {/* Diagnostic Explanation Banner */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
          <span className="font-bold text-slate-900 block mb-1">
            Predictive Health Assessment:
          </span>
          <p>{asset.maintenanceStatus.explanation}</p>
        </div>

        {/* Specifications & Warranty Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <span className="text-slate-400 block mb-1">Purchase Date</span>
            <span className="font-bold text-slate-900">
              {formatIndianDate(asset.purchaseDate)}
            </span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <span className="text-slate-400 block mb-1">Warranty Status</span>
            <span className="font-bold text-slate-900">
              {asset.maintenanceStatus.warrantyStatus.label}
            </span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <span className="text-slate-400 block mb-1">Service Interval</span>
            <span className="font-bold text-slate-900">
              Every {asset.serviceIntervalDays} days
            </span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <span className="text-slate-400 block mb-1">Technician / Helpline</span>
            <span className="font-bold text-slate-900">
              {asset.technicianContact || "Urban Company"}
            </span>
          </div>
        </div>

        {/* Maintenance History */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">
              Service &amp; Repair History ({asset.maintenance.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {asset.maintenance.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                No past service logs recorded yet.
              </div>
            ) : (
              asset.maintenance.map((m) => (
                <div key={m.id} className="p-4 hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-900">{m.serviceType}</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Provider: <span className="font-medium text-slate-700">{m.provider}</span> • Date:{" "}
                      {formatIndianDate(m.serviceDate)}
                    </div>
                    {m.notes && <p className="text-slate-600 mt-1">{m.notes}</p>}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-bold text-slate-900">{formatINR(m.cost)}</div>
                    {m.technicianName && (
                      <div className="text-[10px] text-slate-400">Tech: {m.technicianName}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal: Log Completed Service */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
              <h2 className="text-base font-bold text-slate-900">Record Maintenance Service</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Log completed servicing to update appliance health score and reset interval timers.
              </p>

              <form onSubmit={handleLogService} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Service Type *</label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  >
                    <option value="Preventive">Preventive Inspection</option>
                    <option value="Deep Clean">Deep Foam Jet Clean</option>
                    <option value="Filter Replacement">Filter / Cartridge Replacement</option>
                    <option value="Repair">Part Replacement / Repair</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Provider</label>
                    <input
                      type="text"
                      required
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Cost (₹)</label>
                    <input
                      type="number"
                      required
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Technician Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Vikram Sharma"
                      value={technicianName}
                      onChange={(e) => setTechnicianName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Technician Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+91 98200..."
                      value={technicianPhone}
                      onChange={(e) => setTechnicianPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Notes &amp; Observations
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Filters changed, input TDS 310, output TDS 40..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer"
                  >
                    Record Service &amp; Reset Health
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
