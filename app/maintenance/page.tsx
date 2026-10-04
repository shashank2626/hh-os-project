"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  RotateCw,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { formatIndianDate, formatINR } from "@/lib/utils";

interface MaintenanceStatusItem {
  asset: {
    id: string;
    name: string;
    category: string;
    brand: string;
    location: string;
  };
  status: {
    daysSinceLastService: number;
    daysUntilNextService: number;
    isOverdue: boolean;
    healthScore: number;
    riskLevel: string;
    explanation: string;
  };
}

export default function MaintenanceSchedulePage() {
  const [data, setData] = useState<{
    summary: {
      totalAssets: number;
      overdueCount: number;
      upcomingCount: number;
      healthyCount: number;
    };
    overdue: MaintenanceStatusItem[];
    upcoming: MaintenanceStatusItem[];
    healthy: MaintenanceStatusItem[];
  } | null>(null);

  const [loading, setLoading] = useState(true);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/maintenance");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  if (loading || !data) {
    return (
      <AppShell>
        <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
          <span>Calculating maintenance intervals...</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase">
              <Wrench className="w-3.5 h-3.5" />
              <span>Predictive Equipment Management</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Maintenance Calendar &amp; Risk Health
            </h1>
            <p className="text-sm text-slate-500">
              Deterministic degradation models predict when appliances require preventive servicing before breakdown.
            </p>
          </div>
        </div>

        {/* Status Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <span className="text-xs text-slate-400 block font-medium">Tracked Appliances</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {data.summary.totalAssets}
            </span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-rose-200 bg-rose-50/20">
            <span className="text-xs text-rose-600 block font-semibold">Overdue for Service</span>
            <span className="text-2xl font-bold text-rose-700 mt-1 block">
              {data.summary.overdueCount}
            </span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-amber-200 bg-amber-50/20">
            <span className="text-xs text-amber-600 block font-semibold">Due within 30 Days</span>
            <span className="text-2xl font-bold text-amber-700 mt-1 block">
              {data.summary.upcomingCount}
            </span>
          </div>

          <div className="p-4 bg-white rounded-xl border border-emerald-200 bg-emerald-50/20">
            <span className="text-xs text-emerald-600 block font-semibold">Healthy Operating Band</span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">
              {data.summary.healthyCount}
            </span>
          </div>
        </div>

        {/* 1. Critical Overdue Section */}
        {data.overdue.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Overdue Equipment Requiring Prompt Action ({data.overdue.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.overdue.map(({ asset, status }) => (
                <div
                  key={asset.id}
                  className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{asset.name}</span>
                      <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full">
                        {Math.abs(status.daysUntilNextService)} Days Overdue
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      {status.explanation}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Location: {asset.location}</span>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/vendors?category=${encodeURIComponent(
                          asset.category.includes("AC")
                            ? "AC Repair & Service"
                            : asset.category.includes("RO")
                            ? "Plumber"
                            : "Appliance Technician"
                        )}`}
                        className="px-2.5 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-xs font-semibold"
                      >
                        Local Technician &rarr;
                      </Link>
                      <Link
                        href={`/assets/${asset.id}`}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Book / Record
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Upcoming Schedule List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">
              Upcoming Scheduled Maintenance ({data.upcoming.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {data.upcoming.map(({ asset, status }) => (
              <div
                key={asset.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50"
              >
                <div>
                  <div className="text-sm font-bold text-slate-900">{asset.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {asset.brand} • {asset.location} • Health: {status.healthScore}%
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{status.explanation}</p>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    Due in {status.daysUntilNextService} days
                  </span>

                  <Link
                    href={`/assets/${asset.id}`}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    View Asset
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Healthy Assets */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <h2 className="font-bold text-slate-900 text-sm mb-3">
            Optimal Operating Equipment ({data.healthy.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.healthy.map(({ asset, status }) => (
              <div
                key={asset.id}
                className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block">{asset.name}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Service in {status.daysUntilNextService} days
                  </span>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                    Health: {status.healthScore}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
