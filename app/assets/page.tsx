"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  Tv,
  Plus,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";

interface Asset {
  id: string;
  name: string;
  category: string;
  brand: string;
  model?: string;
  serialNumber?: string;
  location: string;
  purchasePrice?: number;
  healthScore: number;
  riskLevel: string;
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
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState("AC");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [location, setLocation] = useState("Living Room");
  const [purchasePrice, setPurchasePrice] = useState("35000");
  const [warrantyMonths, setWarrantyMonths] = useState("12");
  const [serviceIntervalDays, setServiceIntervalDays] = useState("180");
  const [technicianContact, setTechnicianContact] = useState("");

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/assets");
      const data = await res.json();
      setAssets(data.assets || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          brand,
          model,
          serialNumber,
          location,
          purchasePrice: Number(purchasePrice),
          warrantyPeriodMonths: Number(warrantyMonths),
          serviceIntervalDays: Number(serviceIntervalDays),
          technicianContact,
        }),
      });

      if (res.ok) {
        setModalOpen(false);
        setName("");
        setBrand("");
        fetchAssets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase">
              <Tv className="w-3.5 h-3.5" />
              <span>Asset &amp; Appliance Registry</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Household Appliances &amp; Assets
            </h1>
            <p className="text-sm text-slate-500">
              Track warranties, predictive equipment health scores, and service schedules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/maintenance"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 text-xs font-semibold transition-colors"
            >
              <Wrench className="w-4 h-4" />
              <span>Maintenance Calendar</span>
            </Link>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register Appliance</span>
            </button>
          </div>
        </div>

        {/* Assets Cards Grid */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
            <span>Calculating asset health scores...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {assets.map((asset) => {
              const { maintenanceStatus } = asset;
              const isOverdue = maintenanceStatus.isOverdue;

              return (
                <div
                  key={asset.id}
                  className={`bg-white rounded-xl border p-5 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 ${
                    isOverdue ? "border-rose-300 bg-rose-50/10" : "border-slate-200"
                  }`}
                >
                  <div>
                    {/* Top Row: Category & Health Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {asset.category} • {asset.brand}
                        </div>
                        <h2 className="text-base font-bold text-slate-900 mt-1">
                          {asset.name}
                        </h2>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{asset.location}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold inline-block ${
                            maintenanceStatus.riskLevel === "Critical"
                              ? "bg-rose-100 text-rose-800"
                              : maintenanceStatus.riskLevel === "Warning"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          Health: {maintenanceStatus.healthScore}%
                        </span>
                      </div>
                    </div>

                    {/* Deterministic Explanation */}
                    <p className="mt-3 text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {maintenanceStatus.explanation}
                    </p>

                    {/* Specs / Warranty */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div className="p-2 bg-slate-50 rounded-md">
                        <span className="text-slate-40 text-[12px] block">Next Due</span>
                        <span
                          className={`font-semibold ${
                            isOverdue ? "text-rose-600 font-bold" : "text-slate-900"
                          }`}
                        >
                          {isOverdue
                            ? `${Math.abs(maintenanceStatus.daysUntilNextService)}d Overdue!`
                            : `In ${maintenanceStatus.daysUntilNextService} days`}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-md">
                        <span className="text-slate-40 text-[12px] block">Warranty</span>
                        <span className="font-semibold text-slate-900">
                          {maintenanceStatus.warrantyStatus.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">
                      {asset.purchasePrice ? formatINR(asset.purchasePrice) : "Price not set"}
                    </span>
                    <Link
                      href={`/assets/${asset.id}`}
                      className="text-teal-600 font-semibold hover:underline flex items-center gap-1"
                    >
                      <span>Manage &amp; History</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Register Appliance */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
              <h2 className="text-base font-bold text-slate-900">Register Household Appliance</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Register an appliance to activate predictive maintenance algorithms.
              </p>

              <form onSubmit={handleCreateAsset} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Appliance Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Daikin 1.5T AC, Kent RO, LG Refrigerator"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="AC">AC</option>
                      <option value="Refrigerator">Refrigerator</option>
                      <option value="Washing Machine">Washing Machine</option>
                      <option value="RO Water Purifier">RO Water Purifier</option>
                      <option value="Geyser">Geyser</option>
                      <option value="Microwave">Microwave</option>
                      <option value="Inverter">Inverter / UPS</option>
                      <option value="Vehicle">Vehicle</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Brand *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Daikin, LG, IFB, Kent"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Location</label>
                    <input
                      type="text"
                      placeholder="Living Room, Kitchen, Utility"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Purchase Price (₹)
                    </label>
                    <input
                      type="number"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Warranty (months)
                    </label>
                    <input
                      type="number"
                      value={warrantyMonths}
                      onChange={(e) => setWarrantyMonths(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Service Interval (days)
                    </label>
                    <input
                      type="number"
                      value={serviceIntervalDays}
                      onChange={(e) => setServiceIntervalDays(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
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
                    Save Appliance
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
