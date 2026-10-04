"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import {
  Store,
  Plus,
  Search,
  Phone,
  MessageCircle,
  Wrench,
  ShieldCheck,
  Star,
  RotateCw,
  ExternalLink,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { buildWhatsAppLink } from "@/lib/utils/whatsapp";

interface Vendor {
  id: string;
  name: string;
  businessName?: string;
  category: string;
  phone: string;
  whatsappNumber?: string;
  address?: string;
  area?: string;
  city?: string;
  services?: string;
  notes?: string;
  rating: number;
  reviewCount: number;
  isFavourite: boolean;
  isTrusted: boolean;
  availability: string;
  serviceRequests?: any[];
}

const CATEGORIES = [
  "ALL",
  "Kirana / Grocery",
  "Dairy & Milk",
  "Fresh Fruits & Vegetables",
  "AC Repair & Service",
  "Plumber",
  "Electrician",
  "Appliance Technician",
  "Water Can Delivery",
];

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [serviceModalVendor, setServiceModalVendor] = useState<Vendor | null>(null);

  // Add Vendor Form
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("Kirana / Grocery");
  const [phone, setPhone] = useState("+91 ");
  const [area, setArea] = useState("Hiranandani Gardens");
  const [services, setServices] = useState("");
  const [notes, setNotes] = useState("");

  // Service Request Form
  const [issue, setIssue] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("Morning (9am - 12pm)");
  const [assets, setAssets] = useState<Array<{ id: string; name: string; brand: string }>>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [requestSuccess, setRequestSuccess] = useState<any | null>(null);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const url =
        selectedCategory === "ALL"
          ? "/api/vendors"
          : `/api/vendors?category=${encodeURIComponent(selectedCategory)}`;
      const res = await fetch(url);
      const data = await res.json();
      setVendors(data.vendors || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    try {
      const res = await fetch("/api/assets");
      const data = await res.json();
      setAssets(data.assets || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchVendors();
    fetchAssets();
  }, [selectedCategory]);

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          businessName,
          category,
          phone,
          area,
          services,
          notes,
          isTrusted: true,
        }),
      });

      if (res.ok) {
        setAddModalOpen(false);
        setName("");
        setBusinessName("");
        setPhone("+91 ");
        setServices("");
        fetchVendors();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleServiceRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceModalVendor) return;

    try {
      const res = await fetch("/api/services/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: serviceModalVendor.id,
          assetId: selectedAssetId || undefined,
          category: serviceModalVendor.category,
          issue,
          preferredDate,
          preferredTime,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setRequestSuccess(data);
        // Automatically open WhatsApp in new tab
        if (data.whatsappUrl) {
          window.open(data.whatsappUrl, "_blank");
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredVendors = vendors.filter((v) => {
    const s = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(s) ||
      (v.businessName && v.businessName.toLowerCase().includes(s)) ||
      (v.services && v.services.toLowerCase().includes(s)) ||
      v.category.toLowerCase().includes(s)
    );
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase">
              <Store className="w-3.5 h-3.5 text-teal-600" />
              <span>Human Commerce &bull; Trusted Neighborhood Services</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Local Vendor Network
            </h1>
            <p className="text-sm text-slate-500">
              Direct connection with society Kirana, Milk Dairies, Farm Vegetables, and verified maintenance technicians.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/inventory/smart-kitchen"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-xs font-semibold shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Refill Hub</span>
            </Link>

            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Vendor</span>
            </button>
          </div>
        </div>

        {/* Filter Pills & Search */}
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
                {cat === "ALL" ? "All Vendors" : cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search vendor or service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white text-slate-900"
            />
          </div>
        </div>

        {/* Vendors Grid */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RotateCw className="w-4 h-4 animate-spin text-teal-600" />
            <span>Loading local vendors...</span>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
            No vendors found in this category.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVendors.map((vendor) => {
              const whatsappChatUrl = buildWhatsAppLink(
                vendor.whatsappNumber || vendor.phone,
                `Namaste ${vendor.name} ji,\nInquiring from Flat 402, Palm Heights regarding household services.`
              );

              const isServiceVendor =
                vendor.category.includes("AC") ||
                vendor.category.includes("Plumb") ||
                vendor.category.includes("Electr") ||
                vendor.category.includes("Appliance");

              return (
                <div
                  key={vendor.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    {/* Header: Category Badge & Rating */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                        {vendor.category}
                      </span>

                      <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{vendor.rating.toFixed(1)}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({vendor.reviewCount})
                        </span>
                      </div>
                    </div>

                    {/* Vendor Name & Shop */}
                    <div className="mt-3">
                      <h2 className="text-base font-bold text-slate-900 leading-snug">
                        {vendor.businessName || vendor.name}
                      </h2>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Prop: <strong className="text-slate-700">{vendor.name}</strong>
                      </div>
                    </div>

                    {/* Area & Availability */}
                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      {vendor.area && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{vendor.area}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-emerald-700 font-medium">
                          {vendor.availability}
                        </span>
                      </div>
                    </div>

                    {/* Services Tags */}
                    {vendor.services && (
                      <div className="mt-4 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
                          Supplies &amp; Specialties
                        </span>
                        <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                          {vendor.services}
                        </p>
                      </div>
                    )}

                    {/* Notes */}
                    {vendor.notes && (
                      <p className="text-[11px] text-slate-500 italic mt-2">
                        &ldquo;{vendor.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <a
                      href={whatsappChatUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>

                    <a
                      href={`tel:${vendor.phone}`}
                      className="p-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                      title="Call Vendor"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>

                    {isServiceVendor && (
                      <button
                        type="button"
                        onClick={() => {
                          setServiceModalVendor(vendor);
                          setRequestSuccess(null);
                        }}
                        className="flex items-center gap-1 py-2 px-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-xs font-bold cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Request</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Service Request */}
        {serviceModalVendor && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in zoom-in-95">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Request Service &bull; {serviceModalVendor.businessName || serviceModalVendor.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Category: {serviceModalVendor.category} &bull; Technician: {serviceModalVendor.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setServiceModalVendor(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  &times;
                </button>
              </div>

              {requestSuccess ? (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Service Request Created &amp; WhatsApp Opened!</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Your request has been logged in HH-OS and the formatted dispatch message was sent to WhatsApp.
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <a
                      href={requestSuccess.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-xs"
                    >
                      Re-open WhatsApp Chat &rarr;
                    </a>
                    <button
                      type="button"
                      onClick={() => setServiceModalVendor(null)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleServiceRequestSubmit} className="mt-4 space-y-3 text-xs">
                  {/* Select Asset */}
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Related Appliance / Asset (Optional)
                    </label>
                    <select
                      value={selectedAssetId}
                      onChange={(e) => setSelectedAssetId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                    >
                      <option value="">None / General Issue</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.brand} {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Issue Description */}
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Describe the Problem *
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="e.g. AC cooling low, ice on coils, filter deep clean needed"
                      value={issue}
                      onChange={(e) => setIssue(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  {/* Date & Slot */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        Preferred Date
                      </label>
                      <input
                        type="date"
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        Time Slot
                      </label>
                      <select
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                      >
                        <option value="Morning (9am - 12pm)">Morning (9am - 12pm)</option>
                        <option value="Afternoon (12pm - 4pm)">Afternoon (12pm - 4pm)</option>
                        <option value="Evening (4pm - 8pm)">Evening (4pm - 8pm)</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setServiceModalVendor(null)}
                      className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Create &amp; Open WhatsApp</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Modal: Add Vendor */}
        {addModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95">
              <h2 className="text-base font-bold text-slate-900">Add Local Vendor</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Register a neighborhood shopkeeper, dairy or technician to your trusted network.
              </p>

              <form onSubmit={handleAddVendor} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Contact Person *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Gupta, Mukesh Yadav"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Business / Store Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Gupta Kirana & General Store"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Category *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                    >
                      <option value="Kirana / Grocery">Kirana / Grocery</option>
                      <option value="Dairy & Milk">Dairy & Milk</option>
                      <option value="Fresh Fruits & Vegetables">Fresh Fruits & Vegetables</option>
                      <option value="AC Repair & Service">AC Repair & Service</option>
                      <option value="Plumber">Plumber</option>
                      <option value="Electrician">Electrician</option>
                      <option value="Appliance Technician">Appliance Technician</option>
                      <option value="Water Can Delivery">Water Can Delivery</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Phone / WhatsApp *</label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Area / Locality</label>
                  <input
                    type="text"
                    placeholder="e.g. Palm Heights Market, Sector 4"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Items / Services</label>
                  <input
                    type="text"
                    placeholder="e.g. Atta, Dal, Oil, Milk, Deep cleaning"
                    value={services}
                    onChange={(e) => setServices(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Notes / Timings</label>
                  <input
                    type="text"
                    placeholder="e.g. Delivers in 30 mins, opens 7 AM"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer shadow-xs"
                  >
                    Add Vendor
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
