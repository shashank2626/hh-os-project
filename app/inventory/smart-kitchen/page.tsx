"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  Sparkles,
  ShoppingBag,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Plus,
  Minus,
  ArrowRight,
  ShieldCheck,
  CheckSquare,
  Users,
  Store,
  X,
} from "lucide-react";
import { RefillRecommendation } from "@/lib/services/refill-service";

export default function SmartKitchenPage() {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<RefillRecommendation[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [assignments, setAssignments] = useState<Record<string, "LOCAL_VENDOR" | "INSTAMART">>({});

  // Modals & results
  const [executing, setExecuting] = useState(false);
  const [vendorPlan, setVendorPlan] = useState<any | null>(null);
  const [splitResult, setSplitResult] = useState<any | null>(null);
  const [assignedSuccess, setAssignedSuccess] = useState<string | null>(null);
  const [showInstamartModal, setShowInstamartModal] = useState(false);
  const [instamartBasketData, setInstamartBasketData] = useState<any | null>(null);

  const fetchRefillData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/inventory/smart-refill");
      const data = await res.json();
      const recs: RefillRecommendation[] = data.recommendations || [];
      setRecommendations(recs);

      // Default all items to selected
      const initialSelected = new Set<string>();
      const initialQty: Record<string, number> = {};
      const initialAssign: Record<string, "LOCAL_VENDOR" | "INSTAMART"> = {};

      recs.forEach((r) => {
        initialSelected.add(r.itemId);
        initialQty[r.itemId] = r.suggestedRefillQuantity;
        // Default dairy/veg/gas/water to local vendor, packaged goods to Instamart for instant split demonstration
        if (
          r.recommendedVendorCategory === "Dairy & Milk" ||
          r.recommendedVendorCategory === "Fresh Fruits & Vegetables" ||
          r.recommendedVendorCategory === "Water Can Delivery" ||
          r.recommendedVendorCategory === "LPG & Gas Agency"
        ) {
          initialAssign[r.itemId] = "LOCAL_VENDOR";
        } else {
          initialAssign[r.itemId] = "INSTAMART";
        }
      });

      setSelectedItemIds(initialSelected);
      setQuantities(initialQty);
      setAssignments(initialAssign);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefillData();
  }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedItemIds(next);
  };

  const handleSelectAll = () => {
    if (selectedItemIds.size === recommendations.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(recommendations.map((r) => r.itemId)));
    }
  };

  const updateQty = (id: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[id] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const updateAssignment = (id: string, channel: "LOCAL_VENDOR" | "INSTAMART") => {
    setAssignments((prev) => ({ ...prev, [id]: channel }));
  };

  // 1. Send all selected to Local Vendor
  const handleLocalVendorFulfillment = async () => {
    try {
      setExecuting(true);
      const itemsToOrder = Array.from(selectedItemIds).map((id) => ({
        itemId: id,
        quantity: quantities[id] || 1,
      }));

      const res = await fetch("/api/inventory/smart-refill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "LOCAL_VENDOR",
          items: itemsToOrder,
        }),
      });

      const data = await res.json();
      setVendorPlan(data.groups || []);
      setSplitResult(null);
    } catch (e) {
      console.error(e);
    } finally {
      setExecuting(false);
    }
  };

  // 2. Execute Split Refill Plan
  const handleSplitFulfillment = async () => {
    try {
      setExecuting(true);
      const localItems: Array<{ itemId: string; quantity: number }> = [];
      const instamartItems: Array<{ itemId: string; quantity: number }> = [];

      selectedItemIds.forEach((id) => {
        const qty = quantities[id] || 1;
        const channel = assignments[id] || "LOCAL_VENDOR";
        if (channel === "LOCAL_VENDOR") {
          localItems.push({ itemId: id, quantity: qty });
        } else {
          instamartItems.push({ itemId: id, quantity: qty });
        }
      });

      const res = await fetch("/api/inventory/smart-refill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SPLIT",
          localItems,
          instamartItems,
        }),
      });

      const data = await res.json();
      setSplitResult(data);
      if (data.localVendorPlan?.groups) {
        setVendorPlan(data.localVendorPlan.groups);
      }
      if (data.instamartCart) {
        setInstamartBasketData(data.instamartCart);
        setShowInstamartModal(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExecuting(false);
    }
  };

  // 3. Delegate to Family Member
  const handleAssignToFamily = async () => {
    try {
      setExecuting(true);
      const selectedNames = recommendations
        .filter((r) => selectedItemIds.has(r.itemId))
        .map((r) => `${r.name} (${quantities[r.itemId]} ${r.unit})`);

      const res = await fetch("/api/family/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Refill pantry essentials (${selectedNames.length} items)`,
          description: `Items needing replenish: ${selectedNames.join(", ")}. Coordinate with local vendor or check Instamart.`,
          category: "Kitchen",
          priority: "HIGH",
          sourceType: "INVENTORY",
        }),
      });

      if (res.ok) {
        setAssignedSuccess("Task created and assigned to Priya Sharma via AI Household Coordination!");
        setTimeout(() => setAssignedSuccess(null), 5000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExecuting(false);
    }
  };

  const selectedCount = selectedItemIds.size;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Smart Kitchen &bull; Predictive Refill Engine</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Autonomous Inventory Refill
            </h1>
            <p className="text-sm text-slate-500">
              Know what your household needs before it runs out. Choose between Local Kirana &amp; Dairy or Live Instamart.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/inventory"
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-xs"
            >
              &larr; Back to Inventory
            </Link>
            <Link
              href="/vendors"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-xs font-semibold"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Local Vendor Network</span>
            </Link>
          </div>
        </div>

        {/* Notice Banner */}
        {assignedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{assignedSuccess}</span>
            </div>
            <Link href="/family" className="underline font-bold text-emerald-800 hover:text-emerald-950">
              View in Family &rarr;
            </Link>
          </div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Items Needing Refill</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {recommendations.length} items
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Stock depleted below safety buffer</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Selected for Order</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {selectedCount} / {recommendations.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Ready for dispatch or cart addition</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Fulfillment Channels</div>
            <div className="text-xs font-bold text-teal-700 mt-1 flex items-center gap-2">
              <span>💬 Local WhatsApp</span>
              <span>&bull;</span>
              <span>🛵 Swiggy Instamart</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Direct human commerce &amp; live quick commerce</div>
          </div>
        </div>

        {/* Item Selection List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedCount === recommendations.length && recommendations.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800">
                {selectedCount} item{selectedCount === 1 ? "" : "s"} selected for replenishment
              </span>
            </div>

            <div className="text-xs text-slate-500">
              Adjust quantity &bull; Choose fulfillment route
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
              <span>Analyzing depletion rates and vendor availability...</span>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              🎉 All household essentials are well-stocked! No replenishment needed at this time.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recommendations.map((item) => {
                const isChecked = selectedItemIds.has(item.itemId);
                const qty = quantities[item.itemId] || 1;
                const channel = assignments[item.itemId] || "LOCAL_VENDOR";

                return (
                  <div
                    key={item.itemId}
                    className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                      isChecked ? "bg-white" : "bg-slate-50/40 opacity-70"
                    }`}
                  >
                    {/* Item Info */}
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(item.itemId)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-bold text-slate-900">{item.name}</h2>
                          {item.urgency === "HIGH" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Critical ({item.estimatedDaysRemaining}d left)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                          <span>
                            Current: <strong>{item.currentQuantity} {item.unit}</strong>
                          </span>
                          <span>&bull;</span>
                          <span>
                            Min threshold: <strong>{item.minimumStock} {item.unit}</strong>
                          </span>
                          <span>&bull;</span>
                          <span className="text-teal-700 font-medium">
                            {item.recommendedVendorCategory}
                          </span>
                        </div>
                        {item.preferredVendor && (
                          <div className="mt-1 text-[11px] text-slate-600 flex items-center gap-1.5">
                            <Store className="w-3 h-3 text-teal-600" />
                            <span>
                              Recommended Vendor:{" "}
                              <strong>{item.preferredVendor.businessName || item.preferredVendor.name}</strong>{" "}
                              ({item.preferredVendor.phone})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quantity Adjuster */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() => updateQty(item.itemId, -1)}
                          className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 text-xs font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-3 py-1 text-xs font-bold text-slate-800 min-w-12 text-center bg-white">
                          {qty} {item.unit}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.itemId, 1)}
                          className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 text-xs font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Fulfillment Channel Selector */}
                      <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-[11px] font-medium">
                        <button
                          type="button"
                          onClick={() => updateAssignment(item.itemId, "LOCAL_VENDOR")}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            channel === "LOCAL_VENDOR"
                              ? "bg-white text-teal-800 font-bold shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          💬 Local Vendor
                        </button>
                        <button
                          type="button"
                          onClick={() => updateAssignment(item.itemId, "INSTAMART")}
                          className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                            channel === "INSTAMART"
                              ? "bg-white text-orange-800 font-bold shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          🛵 Instamart
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Bar Footer */}
          {recommendations.length > 0 && (
            <div className="p-4 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="text-xs text-slate-300">
                <strong className="text-white">{selectedCount}</strong> items ready for execution
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLocalVendorFulfillment}
                  disabled={selectedCount === 0 || executing}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Send to Local Vendor(s) (WhatsApp)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSplitFulfillment}
                  disabled={selectedCount === 0 || executing}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Execute Split Refill Plan</span>
                </button>

                <button
                  type="button"
                  onClick={handleAssignToFamily}
                  disabled={selectedCount === 0 || executing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Assign to Family</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Local Vendor WhatsApp Generated Orders Section */}
        {vendorPlan && vendorPlan.length > 0 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900">
                Generated Local Vendor Orders ({vendorPlan.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vendorPlan.map((group: any, idx: number) => (
                <div key={idx} className="bg-white rounded-xl border border-emerald-200 p-5 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {group.category}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {group.businessName || group.vendorName}
                      </h3>
                      <div className="text-xs text-slate-500">{group.phone}</div>
                    </div>

                    <a
                      href={group.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Open WhatsApp</span>
                    </a>
                  </div>

                  {/* Items Preview */}
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs font-mono text-slate-700 whitespace-pre-line border border-slate-100">
                    {group.whatsappMessage}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instamart Split Results Preview */}
        {splitResult && (splitResult.instamartCart || (splitResult.instamartResults && splitResult.instamartResults.length > 0)) && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-orange-200 dark:border-orange-800/80 p-5 shadow-xs space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Swiggy Instamart Live Cart</span>
                    {splitResult.instamartCart?.status === "SUCCESS" && (
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        ✓ In Live Basket
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {splitResult.instamartCart?.message || "Autonomous live catalog discovery & cart management."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {splitResult.instamartCart && splitResult.instamartCart.items?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setInstamartBasketData(splitResult.instamartCart);
                      setShowInstamartModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-xs font-semibold cursor-pointer"
                  >
                    View Basket Modal
                  </button>
                )}

                <a
                  href={splitResult.instamartCart?.merchantUrl || "https://www.swiggy.com/instamart"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Open Instamart Basket</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <Link
                  href="/procurement"
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 ml-1"
                >
                  <span>Procurement</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* If Cart Items exist */}
            {splitResult.instamartCart?.items && splitResult.instamartCart.items.length > 0 && (
              <div className="p-3 bg-orange-50/60 dark:bg-orange-950/20 rounded-xl border border-orange-100 dark:border-orange-900/40 flex items-center justify-between text-xs">
                <span className="font-semibold text-orange-900 dark:text-orange-200">
                  {splitResult.instamartCart.items.length} item(s) added to live Instamart basket
                </span>
                <span className="font-bold text-orange-700 dark:text-orange-400 text-sm">
                  Est. Total: ₹{splitResult.instamartCart.totalEstimatedCost}
                </span>
              </div>
            )}

            {/* Results breakdown */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {splitResult.instamartResults?.map((res: any, idx: number) => (
                <div key={idx} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{res.itemName}</span>
                    <span className="text-slate-500 dark:text-slate-400 ml-2">Qty: {res.quantity}</span>
                    {res.error && (
                      <div className="text-rose-600 dark:text-rose-400 text-[11px] mt-0.5">{res.error}</div>
                    )}
                    {res.selectedProduct && (
                      <div className="text-emerald-700 dark:text-emerald-400 text-[11px] mt-0.5 font-medium">
                        Selected: {res.selectedProduct.name} ({res.selectedProduct.packSize}) &bull; ₹{res.selectedProduct.price}
                      </div>
                    )}
                  </div>

                  {res.addedToCart ? (
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Added to Instamart Basket
                      </span>
                    </div>
                  ) : res.availableProducts && res.availableProducts.length > 0 ? (
                    <div className="text-right">
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                        ✓ {res.availableProducts.length} live product match found
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 text-[11px]">Searching catalog...</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instamart Basket Popup Modal */}
        {showInstamartModal && instamartBasketData && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-slate-900 dark:text-slate-100 relative">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowInstamartModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-start gap-3.5 pr-8">
                <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                      Swiggy Instamart Live Cart
                    </span>
                    {instamartBasketData.status === "SUCCESS" && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Synchronized
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    Instamart Basket Updated!
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {instamartBasketData.message || "Your items have been added to your live Swiggy Instamart cart."}
                  </p>
                </div>
              </div>

              {/* Status conditional content */}
              {instamartBasketData.status === "NOT_AUTHENTICATED" ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Swiggy Account Connection Required</span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    To automatically add items to your live Instamart basket, connect your Swiggy account with OAuth 2.1.
                  </p>
                  <a
                    href={instamartBasketData.authUrl || "/api/auth/swiggy/connect"}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <span>Connect Swiggy Account</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : instamartBasketData.items && instamartBasketData.items.length > 0 ? (
                <div className="space-y-4">
                  {/* Items List */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/60">
                    {instamartBasketData.items.map((it: any, idx: number) => (
                      <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {it.productName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            {it.brand && (
                              <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                {it.brand}
                              </span>
                            )}
                            <span>Pack: {it.packSize}</span>
                            <span>&bull;</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              Qty: {it.quantity}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            ₹{it.totalPrice}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            ₹{it.unitPrice}/unit
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Subtotal bar */}
                  <div className="p-3.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-orange-900 dark:text-orange-200">
                      Total Estimated Basket ({instamartBasketData.itemCount} items)
                    </span>
                    <span className="text-base font-bold text-orange-700 dark:text-orange-400">
                      ₹{instamartBasketData.totalEstimatedCost}
                    </span>
                  </div>

                  {/* Safety note */}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 p-2.5 rounded-lg">
                    <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>
                      HH-OS stops at the merchant cart — review quantities and complete payment securely on Swiggy Instamart.
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                    <a
                      href={instamartBasketData.merchantUrl || "https://www.swiggy.com/instamart"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>🛵 Open Instamart Basket &amp; Review</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <Link
                      href="/procurement"
                      onClick={() => setShowInstamartModal(false)}
                      className="w-full sm:w-auto py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 text-center transition-colors"
                    >
                      <span>View in Procurement</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  No items could be added to the Instamart cart at this time.
                </div>
              )}

              {/* Local vendor orders banner if present in this split refill */}
              {vendorPlan && vendorPlan.length > 0 && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{vendorPlan.length} local vendor WhatsApp order(s) generated below.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInstamartModal(false)}
                    className="font-bold text-emerald-700 dark:text-emerald-300 underline cursor-pointer text-[11px]"
                  >
                    Check Orders &darr;
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
