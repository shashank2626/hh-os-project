"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Package,
  Receipt,
  RotateCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Tv,
  Wrench,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";

interface DashboardData {
  household: {
    id: string;
    name: string;
    city: string;
    address: string;
  };
  healthScore: number;
  urgentAlerts: Array<{
    id: string;
    type: "BILL" | "MAINTENANCE" | "INVENTORY" | "TASK";
    title: string;
    description: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM";
    actionLabel: string;
    actionUrl: string;
  }>;
  counts: {
    lowStock: number;
    pendingBills: number;
    totalPendingBillsAmount: number;
    pendingTasks: number;
    overdueMaintenance: number;
    warningMaintenance: number;
    totalAppliances: number;
  };
  lowStockItems: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    estimatedDaysRemaining: number;
    vendor: string;
    price: number;
  }>;
  upcomingBills: Array<{
    id: string;
    title: string;
    provider: string;
    amount: number;
    dueDate: string;
    paymentStatus: string;
  }>;
  upcomingMaintenance: Array<{
    id: string;
    name: string;
    category: string;
    brand: string;
    healthScore: number;
    maintenanceStatus: {
      daysUntilNextService: number;
      isOverdue: boolean;
      riskLevel: string;
      explanation: string;
    };
  }>;
  pendingTasks: Array<{
    id: string;
    title: string;
    priority: string;
    dueDate: string;
    assignedMember?: { name: string };
  }>;
  recentExpenses: Array<{
    id: string;
    title: string;
    category: string;
    amount: number;
    date: string;
    isAnomaly: boolean;
    anomalyReason?: string;
  }>;
  monthlySpending: number;
  recommendations: Array<{
    id: string;
    type: string;
    title: string;
    reason: string;
    estimatedCost: number;
    metadata: string;
  }>;
  activityLogs: Array<{
    id: string;
    actionType: string;
    title: string;
    description: string;
    createdAt: string;
    actor: string;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (res.ok && json.household && json.urgentAlerts) {
        setData(json);
        setFetchError(null);
      } else {
        setFetchError(json.error || "Failed to load household command center");
        setData(null);
      }
    } catch (err: unknown) {
      console.error(err);
      setFetchError(err instanceof Error ? err.message : "Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleResolveAlert = async (type: string, id: string) => {
    setActionInProgress(id);
    try {
      if (type === "BILL") {
        const billId = id.replace("bill-", "");
        await fetch("/api/bills", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: billId, paymentMethod: "UPI" }),
        });
        setSuccessMessage("Bill paid successfully via UPI!");
      } else if (type === "MAINTENANCE") {
        const assetId = id.replace("asset-", "");
        await fetch("/api/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetId,
            serviceType: "Filter Replacement & TDS Check",
            provider: "Urban Company",
            cost: 1800,
          }),
        });
        setSuccessMessage("Preventive service logged and health restored!");
      } else if (type === "INVENTORY") {
        const itemId = id.replace("inv-", "");
        await fetch("/api/procurement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "RESTOCK_BOUGHT", itemId, quantity: 5 }),
        });
        setSuccessMessage("Item restocked to safe buffer level!");
      }
      await fetchDashboard();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleBatchResolveAll4 = async () => {
    setActionInProgress("batch-all");
    try {
      const res = await fetch("/api/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType: "HANDLE_ALL_4" }),
      });
      const resData = await res.json();
      setSuccessMessage(resData.message || "All 4 critical actions executed!");
      await fetchDashboard();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      console.error(err);
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading && !data) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <RotateCw className="w-6 h-6 animate-spin text-teal-600" />
          <div className="text-sm font-medium text-slate-600">
            Syncing real-time household data...
          </div>
        </div>
      </AppShell>
    );
  }

  if (fetchError || !data) {
    return (
      <AppShell>
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 max-w-lg mx-auto my-12 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">
            Household Command Center Connection
          </h2>
          <p className="text-xs text-slate-600 mb-4">
            {fetchError || "Could not retrieve live household records."}
          </p>
          <button
            type="button"
            onClick={fetchDashboard}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Banner Notification if action succeeded */}
        {successMessage && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-medium">{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-xs text-emerald-600 underline font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Greeting & Command Center Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 text-xs font-semibold border border-teal-200">
                COMMAND CENTER
              </span>
              <span className="text-xs text-slate-400">• Real-Time DB State</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              Good morning, Ayush
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Here is what requires your attention today in {data.household.name}.
            </p>
          </div>

          {/* Household Health Score Gauge */}
          <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium">Household Health</div>
              <div className="text-lg font-bold text-slate-900 flex items-center gap-1.5 justify-end">
                <span>{data.healthScore}/100</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    data.healthScore >= 80
                      ? "bg-emerald-100 text-emerald-800"
                      : data.healthScore >= 60
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {data.healthScore >= 80
                    ? "Healthy"
                    : data.healthScore >= 60
                    ? "Attention Needed"
                    : "Critical Action"}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-teal-500 flex items-center justify-center font-bold text-xs text-teal-800 bg-white">
              {data.healthScore}%
            </div>
          </div>
        </div>

        {/* 1. Critical Urgent Alerts Banner */}
        {data.urgentAlerts.length > 0 && (
          <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border border-rose-200 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-rose-950">
                    Urgent Actions Required ({data.urgentAlerts.length})
                  </h2>
                  <p className="text-xs text-rose-800">
                    High-priority items identified by Household OS predictive engine.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBatchResolveAll4}
                disabled={actionInProgress === "batch-all"}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {actionInProgress === "batch-all"
                  ? "Resolving All Actions..."
                  : "Resolve All 4 Items Automatically"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.urgentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="bg-white/90 backdrop-blur-xs p-3.5 rounded-lg border border-rose-200/80 flex flex-col justify-between shadow-xs hover:border-rose-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-rose-600 mb-1">
                      <span>{alert.type}</span>
                      <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 uppercase text-[10px]">
                        {alert.severity}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">{alert.title}</div>
                    <div className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {alert.description}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      href={alert.actionUrl}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-medium"
                    >
                      Inspect Details
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleResolveAlert(alert.type, alert.id)}
                      disabled={actionInProgress === alert.id}
                      className="text-xs px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {actionInProgress === alert.id ? "Processing..." : alert.actionLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Key Metrics Summary Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/inventory"
            className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Low-Stock Items</span>
              <Package className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{data.counts.lowStock}</div>
            <div className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
              <span>Depleting in &le; 4 days</span>
            </div>
          </Link>

          <Link
            href="/bills"
            className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Pending Utility Bills</span>
              <Receipt className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {formatINR(data.counts.totalPendingBillsAmount)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {data.counts.pendingBills} pending (Tata Power due tomorrow)
            </div>
          </Link>

          <Link
            href="/maintenance"
            className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Maintenance Alerts</span>
              <Wrench className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {data.counts.overdueMaintenance + data.counts.warningMaintenance}
            </div>
            <div className="text-xs text-rose-600 font-medium mt-1">
              {data.counts.overdueMaintenance} Overdue • Kent RO filter
            </div>
          </Link>

          <Link
            href="/tasks"
            className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition-all group"
          >
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-medium">Active Tasks</span>
              <Calendar className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{data.counts.pendingTasks}</div>
            <div className="text-xs text-slate-500 mt-1">Delegated across family</div>
          </Link>
        </div>

        {/* 3. Main Split View: Left (Inventory & Bills) vs Right (AI Recommendations & Activity Feed) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 spans): Real DB Inventory & Bills */}
          <div className="lg:col-span-2 space-y-6">
            {/* Low-Stock Inventory Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-600" />
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Pantry & Grocery Depletion Monitor
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href="/inventory/smart-kitchen"
                    className="text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg hover:bg-teal-100 font-semibold flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Smart Refill Hub</span>
                  </Link>
                  <Link
                    href="/vendors"
                    className="text-xs text-slate-600 hover:text-slate-900 font-medium px-2 py-1"
                  >
                    Local Vendors
                  </Link>
                  <Link
                    href="/inventory"
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                  >
                    <span>All Inventory</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="p-3 font-medium">Item</th>
                      <th className="p-3 font-medium">Current Stock</th>
                      <th className="p-3 font-medium">Days Remaining</th>
                      <th className="p-3 font-medium">Quick Vendor</th>
                      <th className="p-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.lowStockItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-medium text-slate-900">
                          {item.name}
                          <div className="text-[10px] text-slate-400 font-normal">
                            {item.category}
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-slate-700">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              item.estimatedDaysRemaining <= 1
                                ? "bg-rose-100 text-rose-800"
                                : item.estimatedDaysRemaining <= 3
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {item.estimatedDaysRemaining <= 0
                              ? "Depleted"
                              : `${item.estimatedDaysRemaining} days left`}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 font-medium">{item.vendor}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleResolveAlert("INVENTORY", `inv-${item.id}`)}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-700 font-medium transition-colors cursor-pointer"
                          >
                            Restock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Upcoming Bills & Subscriptions */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-teal-600" />
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Upcoming Household Utility Bills
                  </h3>
                </div>
                <Link
                  href="/bills"
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                >
                  <span>Manage Bills</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {data.upcomingBills.map((bill) => (
                  <div
                    key={bill.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{bill.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Provider: {bill.provider}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <Clock className="w-3 h-3 text-slate-400" />
                          Due: {formatIndianDate(bill.dueDate)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">
                          {formatINR(bill.amount)}
                        </div>
                        <span className="text-[10px] uppercase font-semibold text-amber-600">
                          {bill.paymentStatus}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleResolveAlert("BILL", `bill-${bill.id}`)}
                        disabled={actionInProgress === `bill-${bill.id}`}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {actionInProgress === `bill-${bill.id}` ? "Paying..." : "Pay via UPI"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Appliance Health & Predictive Maintenance */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-teal-600" />
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Household Equipment &amp; Health Scores
                  </h3>
                </div>
                <Link
                  href="/assets"
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                >
                  <span>All Appliances</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.upcomingMaintenance.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">{item.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            item.maintenanceStatus.isOverdue
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          Health: {item.healthScore}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {item.maintenanceStatus.explanation}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <Link
                        href={`/assets/${item.id}`}
                        className="text-[11px] text-teal-600 font-medium hover:underline"
                      >
                        Service History
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleResolveAlert("MAINTENANCE", `asset-${item.id}`)}
                        className="text-xs px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-medium cursor-pointer"
                      >
                        Schedule Service
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (1 span): AI Recommendations & Activity Audit Feed */}
          <div className="space-y-6">
            {/* AI Recommendations Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-400" />
                  <h3 className="font-semibold text-sm">AI Household Insights</h3>
                </div>
                <Link
                  href="/assistant"
                  className="text-xs text-teal-300 hover:text-white font-medium flex items-center gap-1"
                >
                  <Bot className="w-3.5 h-3.5" />
                  Ask Assistant
                </Link>
              </div>

              <div className="p-4 space-y-3">
                {data.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3 rounded-lg border border-slate-200 hover:border-teal-300 transition-colors bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-teal-700 mb-1">
                      <span>{rec.type}</span>
                      {rec.estimatedCost > 0 && (
                        <span>Est: {formatINR(rec.estimatedCost)}</span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900">{rec.title}</div>
                    <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {rec.reason}
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center justify-between">
                      <Link
                        href={rec.type === "PROCUREMENT" ? "/procurement" : "/bills"}
                        className="text-[11px] text-teal-600 font-semibold hover:underline flex items-center gap-1"
                      >
                        <span>Review</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Anomaly Alert */}
            {data.recentExpenses.some((e) => e.isAnomaly) && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 shadow-xs">
                <div className="flex items-center gap-2 font-bold text-xs mb-1 text-amber-950">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                  <span>Spending Anomaly Detected</span>
                </div>
                {data.recentExpenses
                  .filter((e) => e.isAnomaly)
                  .map((anom) => (
                    <p key={anom.id} className="text-xs text-amber-800 leading-relaxed mt-1">
                      {anom.anomalyReason}
                    </p>
                  ))}
              </div>
            )}

            {/* Activity Timeline Audit Feed */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <h3 className="font-semibold text-slate-900 text-sm">
                  Household Activity Feed
                </h3>
                <Link
                  href="/activity"
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  View All
                </Link>
              </div>

              <div className="space-y-3">
                {data.activityLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="flex gap-2.5 text-xs">
                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="font-medium text-slate-800">{log.title}</div>
                      <div className="text-slate-500 text-[11px] leading-relaxed">
                        {log.description}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {log.actor} • {formatIndianDate(log.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
