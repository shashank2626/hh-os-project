"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  ArrowRight,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

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
  preferredPackSize?: string;
  price: number;
  vendor: string;
  isLowStock: boolean;
  events?: Array<{ type: string; quantityChanged: number; createdAt: string }>;
}

const CATEGORIES = [
  "All",
  "Groceries",
  "Dairy",
  "Spices",
  "Cleaning",
  "Personal Care",
  "Medicines",
  "Beverages",
];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Groceries");
  const [brand, setBrand] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("kg");
  const [minimumStock, setMinimumStock] = useState("2");
  const [consumptionRate, setConsumptionRate] = useState("0.2");
  const [price, setPrice] = useState("150");
  const [vendor, setVendor] = useState("Blinkit");
  const [preferredPackSize, setPreferredPackSize] = useState("");

  const fetchItems = async () => {
    try {
      setLoading(true);
      const url =
        selectedCategory === "All"
          ? "/api/inventory"
          : `/api/inventory?category=${encodeURIComponent(selectedCategory)}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedCategory]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          brand,
          quantity: Number(quantity),
          unit,
          minimumStock: Number(minimumStock),
          consumptionRate: Number(consumptionRate),
          price: Number(price),
          vendor,
          preferredPackSize,
        }),
      });

      if (res.ok) {
        setModalOpen(false);
        setSuccessNotice(`Added ${name} to pantry inventory!`);
        setName("");
        setBrand("");
        fetchItems();
        setTimeout(() => setSuccessNotice(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdjustStock = async (item: InventoryItem, delta: number) => {
    setAdjustingId(item.id);
    const newQty = Math.max(0, Math.round((item.quantity + delta) * 10) / 10);
    try {
      await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          quantity: newQty,
          notes: delta > 0 ? "Manual restock addition" : "Daily consumption update",
        }),
      });
      await fetchItems();
    } catch (err) {
      console.error(err);
    } finally {
      setAdjustingId(null);
    }
  };

  const handleDelete = async (id: string, itemName: string) => {
    if (!confirm(`Are you sure you want to remove ${itemName}?`)) return;
    try {
      await fetch(`/api/inventory?id=${id}`, { method: "DELETE" });
      setSuccessNotice(`Removed ${itemName} from inventory`);
      fetchItems();
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase">
              <Package className="w-3.5 h-3.5" />
              <span>Smart Inventory Management</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Household Pantry &amp; Supplies
            </h1>
            <p className="text-sm text-slate-500">
              Live consumption tracking, automated depletion prediction, and buffer stock alerts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/inventory/smart-kitchen"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Smart Refill Hub</span>
            </Link>

            <Link
              href="/procurement"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 text-xs font-semibold transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>AI Procurement Basket</span>
            </Link>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Item</span>
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

        {/* Category Tabs & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white text-slate-900"
            />
          </div>
        </div>

        {/* Inventory Cards Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
            <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
            <span>Loading inventory records...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
            No items found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const stockRatio = Math.min(
                100,
                Math.round((item.quantity / (item.minimumStock * 2 || 1)) * 100)
              );
              const isUrgent = item.isLowStock || item.estimatedDaysRemaining <= 3;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
                    isUrgent ? "border-amber-200 bg-amber-50/20" : "border-slate-200"
                  }`}
                >
                  <div>
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {item.category} • {item.brand || item.vendor}
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm mt-0.5">
                          {item.name}
                        </h3>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.estimatedDaysRemaining <= 1
                            ? "bg-rose-100 text-rose-800"
                            : item.estimatedDaysRemaining <= 4
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {item.estimatedDaysRemaining <= 0
                          ? "Depleted"
                          : `~${item.estimatedDaysRemaining} days left`}
                      </span>
                    </div>

                    {/* Stock level visualization */}
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-xs mb-1.5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-slate-900">
                            {item.quantity}
                          </span>
                          <span className="text-slate-500 font-medium">{item.unit}</span>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Min Buffer: {item.minimumStock} {item.unit}
                        </span>
                      </div>

                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isUrgent ? "bg-amber-500" : "bg-teal-600"
                          }`}
                          style={{ width: `${Math.max(8, stockRatio)}%` }}
                        />
                      </div>
                    </div>

                    {/* Consumption metrics */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Daily Burn</span>
                        <span className="font-semibold">
                          {item.consumptionRate} {item.unit}/day
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Est. Cost</span>
                        <span className="font-semibold">{formatINR(item.price)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAdjustStock(item, -0.5)}
                        disabled={adjustingId === item.id || item.quantity <= 0}
                        title="Consume 0.5"
                        className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs disabled:opacity-40 cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustStock(item, 1)}
                        disabled={adjustingId === item.id}
                        title="Add 1 unit"
                        className="w-7 h-7 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs disabled:opacity-40 cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/inventory/${item.id}`}
                        className="text-xs text-teal-600 font-semibold hover:underline flex items-center gap-0.5"
                      >
                        <span>History</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.name)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Add Inventory Item */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
              <h2 className="text-base font-bold text-slate-900">Add Household Item</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Register a consumable or grocery item to track depletion.
              </p>

              <form onSubmit={handleAddItem} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aashirvaad Atta, Surf Excel, Amul Milk"
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
                      {CATEGORIES.filter((c) => c !== "All").map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Brand</label>
                    <input
                      type="text"
                      placeholder="e.g. Tata, Amul"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Quantity *</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Unit</label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="L">L</option>
                      <option value="ml">ml</option>
                      <option value="packs">packs</option>
                      <option value="pcs">pcs</option>
                      <option value="tablets">tablets</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Min Buffer</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={minimumStock}
                      onChange={(e) => setMinimumStock(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Daily Consumption Rate
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      required
                      placeholder="Units/day"
                      value={consumptionRate}
                      onChange={(e) => setConsumptionRate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Price (₹)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Quick Vendor</label>
                    <select
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="Blinkit">Blinkit</option>
                      <option value="Zepto">Zepto</option>
                      <option value="Swiggy Instamart">Swiggy Instamart</option>
                      <option value="Amazon">Amazon</option>
                      <option value="Local Kirana">Local Kirana</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Preferred Pack
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 10kg Value Bag"
                      value={preferredPackSize}
                      onChange={(e) => setPreferredPackSize(e.target.value)}
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
                    Save Item
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
