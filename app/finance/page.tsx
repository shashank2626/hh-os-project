"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  CreditCard,
  Plus,
  TrendingUp,
  AlertTriangle,
  RotateCw,
  Receipt,
  PieChart,
} from "lucide-react";
import { formatINR, formatIndianDate } from "@/lib/utils";

interface ExpenseItem {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: string;
  paidBy: string;
  vendor?: string;
  isAnomaly: boolean;
  anomalyReason?: string;
}

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export default function FinancePage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [anomalies, setAnomalies] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Groceries");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [paidBy, setPaidBy] = useState("Ayush Sharma");
  const [vendor, setVendor] = useState("");

  const fetchFinance = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/finance");
      const data = await res.json();
      setExpenses(data.recentExpenses || []);
      setCategoryBreakdown(data.categoryBreakdown || []);
      setTotalSpent(data.totalSpent || 0);
      setAnomalies(data.anomalies || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinance();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          amount: Number(amount),
          paymentMethod,
          paidBy,
          vendor,
        }),
      });

      if (res.ok) {
        setModalOpen(false);
        setTitle("");
        setAmount("");
        fetchFinance();
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
              <CreditCard className="w-3.5 h-3.5" />
              <span>Indian Household Finance &amp; Ledger</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Expenses &amp; Anomaly Detection
            </h1>
            <p className="text-sm text-slate-500">
              Track domestic staff salaries, groceries, utilities, and automatic AI-flagged spending anomalies.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs text-xs text-right">
              <span className="text-slate-400 block text-[10px]">Total Tracked Spending</span>
              <span className="font-bold text-slate-900 text-sm">{formatINR(totalSpent)}</span>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Expense</span>
            </button>
          </div>
        </div>

        {/* Anomaly Alerts Banner */}
        {anomalies.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
              <TrendingUp className="w-5 h-5 text-amber-600" />
              <span>Spending Anomaly Detected ({anomalies.length})</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {anomalies.map((anom) => (
                <div
                  key={anom.id}
                  className="bg-white/90 backdrop-blur-xs p-3.5 rounded-lg border border-amber-200 text-xs shadow-xs"
                >
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{anom.title}</span>
                    <span className="text-amber-700">{formatINR(anom.amount)}</span>
                  </div>
                  <p className="text-slate-600 mt-1.5 leading-relaxed">{anom.anomalyReason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Breakdown Cards */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-sm">Category Spending Allocation</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {categoryBreakdown.map((cat) => (
              <div
                key={cat.category}
                className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs flex flex-col justify-between"
              >
                <div>
                  <span className="font-semibold text-slate-700 block">{cat.category}</span>
                  <span className="text-base font-bold text-slate-900 mt-1 block">
                    {formatINR(cat.amount)}
                  </span>
                </div>
                <div className="mt-2 text-slate-400 text-[11px]">
                  {cat.percentage}% of total
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Expenses List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">
              Expense History Ledger ({expenses.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
                <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
                <span>Loading ledger...</span>
              </div>
            ) : expenses.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No expenses logged yet.</div>
            ) : (
              expenses.map((exp) => (
                <div
                  key={exp.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{exp.title}</span>
                      {exp.isAnomaly && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                          Anomaly
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {exp.category} • Paid by {exp.paidBy} via {exp.paymentMethod} •{" "}
                      {formatIndianDate(exp.date)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-sm">{formatINR(exp.amount)}</div>
                    {exp.vendor && (
                      <span className="text-[10px] text-slate-400">{exp.vendor}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal: Log Expense */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
              <h2 className="text-base font-bold text-slate-900">Log Household Expense</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Record an expense in the household ledger.
              </p>

              <form onSubmit={handleCreateExpense} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Expense Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cook Salary, Blinkit Vegetables, Shell Fuel"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
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
                      <option value="Groceries">Groceries</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Domestic Help">Domestic Help (Cook/Maid)</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Transport">Transport / Fuel</option>
                      <option value="Dining">Dining</option>
                      <option value="Miscellaneous">Miscellaneous</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Credit / Debit Card</option>
                      <option value="Net Banking">Net Banking</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Vendor / Payee</label>
                    <input
                      type="text"
                      placeholder="e.g. Blinkit, Sunita Devi"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
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
                    Record Expense
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
