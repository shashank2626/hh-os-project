"use client";

import { useState } from "react";
import {
  ShoppingCart,
  Trash2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Eye,
  Info,
  ChevronDown,
  ChevronUp,
  Store,
  Layers,
  Sparkles,
  MapPin,
  Search,
  Loader2,
  Check,
} from "lucide-react";
import { AddressModal, AddressItem } from "./address-modal";

export interface CartItemData {
  id: string;
  productName: string;
  brand?: string;
  packSize: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  retailer: string;
  retailerUrl?: string;
  valueScore?: string;
  comparisonNotes?: string;
  skuId?: string;
  spinId?: string;
  variantId?: string;
}

export interface CartData {
  items: CartItemData[];
  estimatedTotal: number;
  totalItems: number;
  continueToMerchantUrl: string;
  selectedAddress?: AddressItem | {
    id: string;
    formattedAddress: string;
    name?: string;
  };
  addresses?: AddressItem[];
}

export interface AlternativeProductOption {
  productId: string;
  name: string;
  brand?: string;
  packSize: string;
  price: number;
  mrp?: number;
  discountPercentage?: number;
  imageUrl?: string;
  skuId?: string;
  spinId?: string;
  variantId?: string;
  inStock: boolean;
}

export interface RefillCartCardProps {
  initialCart: CartData;
  comparisons?: Array<{
    itemName: string;
    requiredQuantity: string;
    options: string[];
    bestOption: string;
    reasoning: string;
  }> | null;
  onCartUpdated?: (updatedCart: CartData) => void;
}

export function RefillCartCard({
  initialCart,
  comparisons,
  onCartUpdated,
}: RefillCartCardProps) {
  const [cart, setCart] = useState<CartData>(initialCart);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);
  const [showComparisons, setShowComparisons] = useState<boolean>(true);
  const [activeAlternativeModalItem, setActiveAlternativeModalItem] = useState<CartItemData | null>(null);
  const [alternativeSearchQuery, setAlternativeSearchQuery] = useState("");
  const [alternatives, setAlternatives] = useState<AlternativeProductOption[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [changingProduct, setChangingProduct] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<AddressItem | undefined>(
    cart.selectedAddress as AddressItem | undefined
  );
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const calculateTotal = (items: CartItemData[]) =>
    items.reduce((sum, item) => sum + (item.totalPrice || item.unitPrice * item.quantity), 0);

  // 1. Remove Item Handler
  const handleRemoveItem = async (item: CartItemData) => {
    const targetId = item.id || item.skuId || item.spinId || item.variantId;
    if (!targetId) return;

    setRemovingId(targetId);
    try {
      const res = await fetch(`/api/cart?id=${encodeURIComponent(targetId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        let updatedItems: CartItemData[];
        if (data.cart?.items && Array.isArray(data.cart.items)) {
          updatedItems = data.cart.items.map((it: any) => ({
            id: it.id || it.skuId || it.spinId || it.variantId,
            productName: it.productName || it.name,
            brand: it.brand,
            packSize: it.packSize || "Standard",
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || 0,
            totalPrice: it.totalPrice || (it.unitPrice || 0) * (it.quantity || 1),
            retailer: "Swiggy Instamart",
            retailerUrl: "https://www.swiggy.com/instamart",
            valueScore: it.valueScore,
            comparisonNotes: it.comparisonNotes,
            skuId: it.skuId,
            spinId: it.spinId,
            variantId: it.variantId,
          }));
        } else {
          updatedItems = cart.items.filter(
            (it) => it.id !== targetId && it.skuId !== targetId && it.spinId !== targetId
          );
        }

        const newCart: CartData = {
          items: updatedItems,
          estimatedTotal: data.cart?.totalPayable || data.cart?.totalEstimatedPrice || calculateTotal(updatedItems),
          totalItems: updatedItems.length,
          continueToMerchantUrl: data.cart?.merchantUrl || cart.continueToMerchantUrl,
          selectedAddress: cart.selectedAddress,
          addresses: cart.addresses,
        };

        setCart(newCart);
        onCartUpdated?.(newCart);
        setStatusNotice(`Removed "${item.productName}" from Swiggy Instamart cart`);
        setTimeout(() => setStatusNotice(null), 3500);
      }
    } catch (err) {
      console.error("Failed to remove cart item:", err);
      setStatusNotice("Failed to remove item. Please try again.");
      setTimeout(() => setStatusNotice(null), 3500);
    } finally {
      setRemovingId(null);
    }
  };

  // 2. Open Change Product Modal and Fetch Live Alternatives
  const handleOpenChangeProduct = async (item: CartItemData) => {
    setActiveAlternativeModalItem(item);
    const initialQuery = item.brand ? `${item.brand} ${item.productName.split(" ").slice(0, 2).join(" ")}` : item.productName;
    setAlternativeSearchQuery(initialQuery);
    await fetchLiveAlternatives(initialQuery, item.brand);
  };

  const fetchLiveAlternatives = async (query: string, brand?: string) => {
    setLoadingAlternatives(true);
    try {
      const res = await fetch(
        `/api/cart/alternatives?query=${encodeURIComponent(query)}&brand=${encodeURIComponent(brand || "")}`
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.alternatives)) {
        setAlternatives(data.alternatives);
      } else {
        setAlternatives([]);
      }
    } catch (err) {
      console.error("Failed to fetch alternatives:", err);
      setAlternatives([]);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (alternativeSearchQuery.trim()) {
      fetchLiveAlternatives(alternativeSearchQuery.trim(), activeAlternativeModalItem?.brand);
    }
  };

  // 3. Select Alternative Product and Replace in Cart
  const handleSelectAlternative = async (
    item: CartItemData,
    alt: AlternativeProductOption
  ) => {
    const targetId = item.id || item.skuId || item.spinId || item.variantId;
    if (!targetId) return;

    setChangingProduct(true);
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetId,
          replacement: {
            name: alt.name,
            brand: alt.brand,
            packSize: alt.packSize,
            price: alt.price,
            quantity: item.quantity || 1,
            skuId: alt.skuId,
            spinId: alt.spinId,
            variantId: alt.variantId,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        let updatedItems: CartItemData[];
        if (data.cart?.items && Array.isArray(data.cart.items)) {
          updatedItems = data.cart.items.map((it: any) => ({
            id: it.id || it.skuId || it.spinId || it.variantId,
            productName: it.productName || it.name,
            brand: it.brand,
            packSize: it.packSize || "Standard",
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || 0,
            totalPrice: it.totalPrice || (it.unitPrice || 0) * (it.quantity || 1),
            retailer: "Swiggy Instamart",
            retailerUrl: "https://www.swiggy.com/instamart",
            valueScore: it.valueScore,
            comparisonNotes: it.comparisonNotes,
            skuId: it.skuId,
            spinId: it.spinId,
            variantId: it.variantId,
          }));
        } else {
          updatedItems = cart.items.map((it) => {
            if (it.id === targetId || it.skuId === targetId || it.spinId === targetId) {
              return {
                ...it,
                productName: alt.name,
                brand: alt.brand,
                packSize: alt.packSize,
                unitPrice: alt.price,
                totalPrice: alt.price * it.quantity,
                skuId: alt.skuId,
                spinId: alt.spinId,
                variantId: alt.variantId,
              };
            }
            return it;
          });
        }

        const newCart: CartData = {
          items: updatedItems,
          estimatedTotal: data.cart?.totalPayable || data.cart?.totalEstimatedPrice || calculateTotal(updatedItems),
          totalItems: updatedItems.length,
          continueToMerchantUrl: data.cart?.merchantUrl || cart.continueToMerchantUrl,
          selectedAddress: cart.selectedAddress,
          addresses: cart.addresses,
        };

        setCart(newCart);
        onCartUpdated?.(newCart);
        setActiveAlternativeModalItem(null);
        setStatusNotice(`Replaced with ${alt.name} (${alt.packSize})`);
        setTimeout(() => setStatusNotice(null), 3500);
      }
    } catch (err) {
      console.error("Failed to replace product:", err);
      setStatusNotice("Failed to update product. Please try again.");
      setTimeout(() => setStatusNotice(null), 3500);
    } finally {
      setChangingProduct(false);
    }
  };

  const handleOpenMerchant = () => {
    const url = cart.continueToMerchantUrl || "https://www.swiggy.com/instamart";
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-500">
        All items removed from refill cart. Replenishment complete or cart cleared.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-teal-200 dark:border-teal-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 via-teal-900 to-slate-900 text-white p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white shadow-xs font-bold text-xs">
            IM
          </div>
          <div>
            <div className="font-bold text-sm flex items-center gap-2">
              🛒 Swiggy Instamart Cart
              <span className="text-[10px] bg-orange-500/20 text-orange-200 px-2 py-0.5 rounded-full font-semibold border border-orange-500/30">
                {cart.items.length} items
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              Live Instamart items selected by value &amp; stock availability
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400">Estimated Total</div>
          <div className="text-base font-extrabold text-teal-300">
            ₹{cart.estimatedTotal.toLocaleString("en-IN")}
          </div>
        </div>
      </div>

      {/* Delivery Address Bar */}
      <div className="bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-800/40 px-3.5 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 min-w-0 pr-2">
          <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <span className="font-semibold text-slate-900 dark:text-slate-100 shrink-0">Delivering to:</span>
          <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
            {selectedAddress?.formattedAddress || selectedAddress?.name || "Selected Delivery Address"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsAddressModalOpen(true)}
          className="text-orange-600 hover:text-orange-700 font-bold shrink-0 hover:underline cursor-pointer ml-2"
        >
          Change
        </button>
      </div>

      {/* Dynamic Status / Feedback Notice Banner */}
      {statusNotice && (
        <div className="bg-teal-50 dark:bg-teal-950/50 border-b border-teal-200 dark:border-teal-800 px-3.5 py-2 text-xs text-teal-800 dark:text-teal-200 flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Items List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {cart.items.map((item, index) => (
          <div
            key={item.id || item.skuId || item.spinId || index}
            className="p-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            {/* Left: Product Info */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                  {item.productName}
                </span>
                <span className="text-[11px] font-bold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-800/60">
                  × {item.quantity}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                <span>{item.packSize}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-orange-600 font-medium">
                  <Store className="w-3 h-3" />
                  {item.retailer}
                </span>
              </div>

              {/* Provenance note */}
              {item.comparisonNotes && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <Sparkles className="w-2.5 h-2.5 text-teal-600 shrink-0" />
                  <span className="italic">{item.comparisonNotes}</span>
                </div>
              )}
            </div>

            {/* Right: Price & Action Buttons */}
            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <div className="text-right">
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  ₹{item.totalPrice || item.unitPrice * item.quantity}
                </div>
                <div className="text-[10px] text-slate-400">
                  ₹{item.unitPrice} / item
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Change Product Button */}
                <button
                  type="button"
                  onClick={() => handleOpenChangeProduct(item)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-950/50 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                  title="Change Product / Pack Variant"
                >
                  <RefreshCw className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  <span>Change Product</span>
                </button>

                {/* Remove Item Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item)}
                  disabled={removingId === (item.id || item.skuId || item.spinId)}
                  className="px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Remove Item from Cart"
                >
                  {removingId === (item.id || item.skuId || item.spinId) ? (
                    <Loader2 className="w-3 h-3 animate-spin text-red-500" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  <span>
                    {removingId === (item.id || item.skuId || item.spinId) ? "Removing..." : "Remove Item"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Details Section */}
      {isDetailsExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 p-3 text-xs text-slate-600 dark:text-slate-400 space-y-2">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-teal-600" />
            <span>Full Cart Manifest &amp; Delivery Breakdown:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Fulfillment</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">Swiggy Instamart 10-Minute Darkstore</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Cart Items Count</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{cart.totalItems} distinct items</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="bg-slate-50 dark:bg-slate-950 p-3.5 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
          className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-semibold flex items-center gap-1 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>{isDetailsExpanded ? "Hide Details" : "View Cart"}</span>
          {isDetailsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        <button
          type="button"
          onClick={handleOpenMerchant}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
        >
          <span>Open Cart / Continue to Merchant</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-amber-50/70 dark:bg-amber-950/30 border-t border-amber-200/50 dark:border-amber-800/40 px-3.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>
          <strong>User Approval Policy:</strong> Household OS never places orders or debits accounts autonomously. You will review and finalize this order on the merchant platform.
        </span>
      </div>

      {/* Live Change Product & Pack Variant Flyout Modal */}
      {activeAlternativeModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-teal-600" />
                  <span>Change Product / Pack Variant</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Current: <strong>{activeAlternativeModalItem.productName}</strong> ({activeAlternativeModalItem.packSize} • ₹{activeAlternativeModalItem.unitPrice})
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveAlternativeModalItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold p-1 cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={alternativeSearchQuery}
                    onChange={(e) => setAlternativeSearchQuery(e.target.value)}
                    placeholder="Search Swiggy Instamart catalog..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-teal-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingAlternatives}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {loadingAlternatives ? "Searching..." : "Search"}
                </button>
              </form>
            </div>

            {/* Alternatives List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
              {loadingAlternatives ? (
                <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                  <span>Searching live Swiggy Instamart darkstore...</span>
                </div>
              ) : alternatives.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                  <p>No alternative products found matching "{alternativeSearchQuery}".</p>
                  <p className="text-[11px] text-slate-400">Try searching for generic terms like "milk", "atta", or "detergent".</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Available Live Instamart Products:
                  </div>

                  {alternatives.map((alt) => {
                    const isCurrent =
                      alt.name.toLowerCase() === activeAlternativeModalItem.productName.toLowerCase() &&
                      alt.packSize.toLowerCase() === activeAlternativeModalItem.packSize.toLowerCase();

                    return (
                      <div
                        key={alt.skuId || alt.spinId || alt.variantId || alt.name + alt.packSize}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isCurrent
                            ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/40"
                            : "border-slate-200 dark:border-slate-700 hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        {/* Image & Title */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {alt.imageUrl ? (
                            <img
                              src={alt.imageUrl}
                              alt={alt.name}
                              className="w-10 h-10 object-contain rounded-lg border border-slate-100 dark:border-slate-800 bg-white shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 text-xs">
                              🛍️
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                              {alt.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                              <span className="font-medium text-slate-700 dark:text-slate-300">{alt.packSize}</span>
                              {alt.brand && <span>• {alt.brand}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Price & Select Button */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              ₹{alt.price}
                            </div>
                            {alt.mrp && alt.mrp > alt.price && (
                              <div className="text-[10px] text-slate-400 line-through">
                                ₹{alt.mrp}
                              </div>
                            )}
                          </div>

                          {isCurrent ? (
                            <span className="px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-[11px] font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Current
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={changingProduct}
                              onClick={() => handleSelectAlternative(activeAlternativeModalItem, alt)}
                              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50"
                            >
                              {changingProduct ? "Updating..." : "Select"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveAlternativeModalItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swiggy Instamart Delivery Address Selector Modal */}
      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        currentAddressId={selectedAddress?.id}
        onAddressSelected={(addr) => {
          setSelectedAddress(addr);
          setStatusNotice(`Delivery address set to: ${addr.formattedAddress}`);
          setTimeout(() => setStatusNotice(null), 3500);
        }}
      />
    </div>
  );
}
