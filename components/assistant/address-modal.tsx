"use client";

import { useState, useEffect } from "react";
import {
  MapPin,
  CheckCircle2,
  Plus,
  Loader2,
  X,
  AlertCircle,
  Building,
  Home,
  Briefcase,
} from "lucide-react";

export interface AddressItem {
  id: string;
  name?: string;
  addressLine: string;
  area?: string;
  city?: string;
  landmark?: string;
  postalCode?: string;
  formattedAddress: string;
  isDefault?: boolean;
}

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddressSelected?: (selected: AddressItem) => void;
  currentAddressId?: string;
}

export function AddressModal({
  isOpen,
  onClose,
  onAddressSelected,
  currentAddressId,
}: AddressModalProps) {
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>(currentAddressId || "");
  const [loading, setLoading] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New address form state
  const [addressLine, setAddressLine] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("Mumbai");
  const [postalCode, setPostalCode] = useState("");
  const [userName, setUserName] = useState("Ayush Sinha");
  const [userPhone, setUserPhone] = useState("9876543210");
  const [category, setCategory] = useState<"HOME" | "WORK" | "OTHER">("HOME");

  const loadAddresses = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/commerce/address");
      const data = await res.json();
      if (res.ok && data.addresses) {
        setAddresses(data.addresses);
        if (data.selectedAddressId) {
          setSelectedId(data.selectedAddressId);
        } else if (data.addresses.length > 0 && !selectedId) {
          setSelectedId(data.addresses[0].id);
        }
      } else if (data.error) {
        setErrorMessage(data.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load addresses";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAddresses();
    }
  }, [isOpen]);

  const handleSelectAddress = async (addr: AddressItem) => {
    setSelectedId(addr.id);
    try {
      const res = await fetch("/api/commerce/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectAddressId: addr.id }),
      });
      if (res.ok) {
        onAddressSelected?.(addr);
        onClose();
      }
    } catch (e) {
      console.error("Failed to select address:", e);
    }
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressLine.trim() || !city.trim() || !postalCode.trim()) {
      setErrorMessage("Please complete all required address fields.");
      return;
    }

    setSavingNew(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/commerce/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressLine: addressLine.trim(),
          locality: area.trim() || city.trim(),
          city: city.trim(),
          postalCode: postalCode.trim(),
          userName: userName.trim() || "Resident",
          userPhone: userPhone.trim() || "9876543210",
          addressCategory: category,
          addressTag: category === "HOME" ? "Home" : category === "WORK" ? "Office" : "Other",
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to create delivery address on Swiggy Instamart.");
      }

      const created: AddressItem = data.address || {
        id: data.selectedAddressId,
        addressLine,
        city,
        postalCode,
        formattedAddress: data.selectedAddressName || `${addressLine}, ${city} ${postalCode}`,
      };

      setAddresses((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setShowAddForm(false);
      onAddressSelected?.(created);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating address";
      setErrorMessage(msg);
    } finally {
      setSavingNew(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-900">Swiggy Instamart Delivery Address</div>
              <div className="text-[11px] text-slate-500">Live addresses synced with Swiggy MCP</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
              <span>Fetching addresses from Swiggy Instamart...</span>
            </div>
          ) : (
            <>
              {/* Existing Address List */}
              {addresses.length > 0 && !showAddForm && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Saved Addresses ({addresses.length}):
                  </div>
                  {addresses.map((addr) => {
                    const isSelected = selectedId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        onClick={() => handleSelectAddress(addr)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-3 ${
                          isSelected
                            ? "border-teal-500 bg-teal-50/40 text-slate-900 shadow-xs"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-slate-900">
                            {addr.name?.toLowerCase().includes("work") || addr.name?.toLowerCase().includes("office") ? (
                              <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                            ) : (
                              <Home className="w-3.5 h-3.5 text-teal-600" />
                            )}
                            <span>{addr.name || "Delivery Address"}</span>
                            {addr.isDefault && (
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                                Default
                              </span>
                            )}
                          </div>
                          <div className="text-slate-600 leading-snug">{addr.formattedAddress}</div>
                          {addr.postalCode && (
                            <div className="text-[11px] text-slate-400 font-mono">
                              PIN: {addr.postalCode}
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <div className="shrink-0 text-teal-600 mt-0.5">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty State when no address found */}
              {addresses.length === 0 && !loading && !showAddForm && (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                  <MapPin className="w-8 h-8 text-orange-400 mx-auto" />
                  <div className="font-semibold text-xs text-slate-800">No delivery address found on your Swiggy account</div>
                  <div className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Add your delivery address below. Household OS will create it on Instamart via the official MCP tool.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Delivery Address</span>
                  </button>
                </div>
              )}

              {/* Add New Address Form */}
              {showAddForm && (
                <form onSubmit={handleCreateAddress} className="space-y-3 pt-1">
                  <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                    <span>Enter New Delivery Address:</span>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-[11px] text-slate-500 hover:text-slate-700 underline"
                    >
                      Back to list
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(["HOME", "WORK", "OTHER"] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          category === cat
                            ? "border-teal-500 bg-teal-50 text-teal-800 font-bold"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      House / Flat / Building / Street *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Flat 402, Palm Heights, Central Avenue"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Locality / Area
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Powai / Andheri East"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mumbai"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        PIN Code *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 400076"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Recipient Name
                      </label>
                      <input
                        type="text"
                        placeholder="Name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        placeholder="10-digit phone"
                        value={userPhone}
                        onChange={(e) => setUserPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingNew}
                      className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs shadow-xs disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      {savingNew ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating via Swiggy MCP...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Save &amp; Deliver Here</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!showAddForm && addresses.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Address</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
