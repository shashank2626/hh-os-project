"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  History,
  RotateCw,
  FileText,
  Package,
  CheckSquare,
  Receipt,
  Wrench,
  Bot,
  User,
  ShieldCheck,
} from "lucide-react";
import { formatIndianDate } from "@/lib/utils";

interface ActivityItem {
  id: string;
  actionType: string;
  title: string;
  description: string;
  actor: string;
  entityType?: string;
  createdAt: string;
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/activity");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "DOCUMENT_EXTRACTED":
        return <FileText className="w-4 h-4 text-blue-600" />;
      case "INVENTORY_UPDATED":
        return <Package className="w-4 h-4 text-emerald-600" />;
      case "TASK_ASSIGNED":
        return <CheckSquare className="w-4 h-4 text-purple-600" />;
      case "BILL_PAID":
        return <Receipt className="w-4 h-4 text-amber-600" />;
      case "MAINTENANCE_SCHEDULED":
      case "ASSET_ADDED":
        return <Wrench className="w-4 h-4 text-teal-600" />;
      default:
        return <History className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase">
              <History className="w-3.5 h-3.5" />
              <span>Audit Trail &amp; Event Stream</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Household Activity Timeline
            </h1>
            <p className="text-sm text-slate-500">
              Complete chronological audit trail of all AI extractions, inventory mutations, chore assignments, and payments.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchLogs}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh Feed</span>
          </button>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
              <span>Loading audit trail...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No activity logged yet.
            </div>
          ) : (
            <div className="relative border-l border-slate-200 pl-6 space-y-6 ml-3">
              {logs.map((log) => (
                <div key={log.id} className="relative group">
                  {/* Dot icon on timeline line */}
                  <div className="absolute -left-[35px] top-0.5 w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shadow-2xs group-hover:scale-110 transition-transform">
                    {getIcon(log.actionType)}
                  </div>

                  <div className="text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">{log.title}</h3>
                      <span className="text-[11px] text-slate-400">
                        {formatIndianDate(log.createdAt)}
                      </span>
                    </div>

                    <p className="text-slate-600 mt-1 leading-relaxed">{log.description}</p>

                    <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        {log.actionType}
                      </span>
                      <span>•</span>
                      <span>Initiated by {log.actor}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
