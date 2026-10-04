"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  Receipt,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  CreditCard,
  Zap,
  Wifi,
  Flame,
  Building,
} from "lucide-react";
import { formatINR, formatIndianDate, formatDaysRemaining } from "@/lib/utils";

interface BillItem {
  id: string;
  title: string;
  provider: string;
  category: string;
  amount: number;
  dueDate: string;
  paymentStatus: string;
  paymentMethod?: string;
  autoPay: boolean;
  billNumber?: string;
  referenceNumber?: string;
  notes?: string;
}

export default function BillsPage() {
  const [bills, setBills] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("Tata Power");
  const [category, setCategory] = useState("Electricity");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [autoPay, setAutoPay] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bills");
      const data = await res.json();
      setBills(data.bills || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const handlePayBill = async (bill: BillItem) => {
    setPayingId(bill.id);
    try {
      const res = await fetch("/api/bills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bill.id, paymentMethod: "UPI" }),
      });

      if (res.ok) {
        setSuccessNotice(`Settled ${bill.title} via UPI!`);
        fetchBills();
        setTimeout(() => setSuccessNotice(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPayingId(null);
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          provider,
          category,
          amount: Number(amount),
          dueDate,
          paymentMethod,
          autoPay,
          referenceNumber,
        }),
      });

      if (res.ok) {
        setModalOpen(false);
        setTitle("");
        setAmount("");
        fetchBills();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Electricity":
        return <Zap className="w-4 h-4 text-amber-500" />;
      case "Internet":
        return <Wifi className="w-4 h-4 text-blue-500" />;
      case "Gas/LPG":
        return <Flame className="w-4 h-4 text-orange-500" />;
      case "Society Maintenance":
        return <Building className="w-4 h-4 text-emerald-600" />;
      default:
        return <Receipt className="w-4 h-4 text-slate-500" />;
    }
  };

  const pendingBills = bills.filter((b) => b.paymentStatus === "PENDING");
  const paidBills = bills.filter((b) => b.paymentStatus === "PAID");
  const totalPending = pendingBills.reduce((acc, b) => acc + b.amount, 0);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase">
              <Receipt className="w-3.5 h-3.5" />
              <span>Household Utility &amp; Maintenance Bills</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Bills &amp; Subscriptions
            </h1>
            <p className="text-sm text-slate-500">
              Track electricity, piped gas, broadband, mobile plans, and society maintenance charges.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs text-xs text-right">
              <span className="text-slate-400 block text-[10px]">Total Due Pending</span>
              <span className="font-bold text-slate-900 text-sm">{formatINR(totalPending)}</span>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Bill</span>
            </button>
          </div>
        </div>

        {/* Success Notice */}
        {successNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Pending Bills Grid */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900">
            Pending Household Bills ({pendingBills.length})
          </h2>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
              <span>Loading bills...</span>
            </div>
          ) : pendingBills.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
              All household utility bills are settled!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingBills.map((bill) => {
                const daysInfo = formatDaysRemaining(bill.dueDate);
                return (
                  <div
                    key={bill.id}
                    className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-slate-100">
                            {getCategoryIcon(bill.category)}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">{bill.title}</h3>
                            <span className="text-xs text-slate-500">{bill.provider}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-lg font-bold text-slate-900">
                            {formatINR(bill.amount)}
                          </span>
                          <span
                            className={`text-[10px] font-bold block ${
                              daysInfo.isOverdue || daysInfo.days <= 1
                                ? "text-rose-600"
                                : "text-amber-600"
                            }`}
                          >
                            {daysInfo.label}
                          </span>
                        </div>
                      </div>

                      {bill.notes && (
                        <p className="mt-3 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {bill.notes}
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Due Date: {formatIndianDate(bill.dueDate)}</span>
                        <span>{bill.autoPay ? "AutoPay Active" : "Manual Pay"}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/family/tasks", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                title: `Pay ${bill.title} (${formatINR(bill.amount)})`,
                                description: `Due on ${formatIndianDate(bill.dueDate)}. Provider: ${bill.provider}`,
                                category: "Bill Payment",
                                priority: "HIGH",
                                sourceType: "BILL",
                                sourceId: bill.id,
                                estimatedCost: bill.amount,
                              }),
                            });
                            if (res.ok) {
                              setSuccessNotice(`Assigned payment of ${bill.title} to family coordinator!`);
                              setTimeout(() => setSuccessNotice(null), 4000);
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-xs font-semibold cursor-pointer"
                      >
                        Assign Task
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePayBill(bill)}
                        disabled={payingId === bill.id}
                        className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {payingId === bill.id ? "Processing UPI..." : "Pay via UPI"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Settled / Paid Bills History */}
        {paidBills.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mt-6">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 text-sm">
                Paid Bills Ledger ({paidBills.length})
              </h2>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {paidBills.map((bill) => (
                <div key={bill.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-900">{bill.title}</div>
                      <div className="text-slate-500 text-[11px]">
                        {bill.provider} • Settled via {bill.paymentMethod || "UPI"}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-slate-900">{formatINR(bill.amount)}</div>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                      PAID
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: Add Bill */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
              <h2 className="text-base font-bold text-slate-900">Add Household Bill</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Register a recurring utility bill to receive due date reminders.
              </p>

              <form onSubmit={handleCreateBill} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Bill Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tata Power Electricity, Mahanagar Gas"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Provider *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tata Power, Jio, BESCOM"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="Electricity">Electricity</option>
                      <option value="Gas/LPG">Gas/LPG</option>
                      <option value="Internet">Internet Broadband</option>
                      <option value="Water">Water</option>
                      <option value="Mobile">Mobile</option>
                      <option value="Society Maintenance">Society Maintenance</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Due Date *</label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
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
                    Save Bill
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
