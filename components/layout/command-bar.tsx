"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Package, Tv, Receipt, CheckSquare, FileText, ArrowRight } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: string;
  url: string;
}

export function CommandBar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onClose();
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && open) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return null;

  const navigateTo = (url: string) => {
    onClose();
    router.push(url);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "Inventory":
        return <Package className="w-4 h-4 text-emerald-600" />;
      case "Appliance":
        return <Tv className="w-4 h-4 text-blue-600" />;
      case "Bill":
        return <Receipt className="w-4 h-4 text-amber-600" />;
      case "Task":
        return <CheckSquare className="w-4 h-4 text-purple-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center pt-20 px-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input Box */}
        <div className="flex items-center px-4 py-3 border-b border-slate-100 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search assets, groceries, bills, tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-slate-900 placeholder:text-slate-400 text-sm focus:outline-hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
            ESC
          </kbd>
        </div>

        {/* Results or Quick Actions */}
        <div className="max-h-80 overflow-y-auto p-2">
          {loading && (
            <div className="p-4 text-center text-xs text-slate-500">
              Searching household data...
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">
                Household Items Found ({results.length})
              </div>
              {results.map((r) => (
                <button
                  type="button"
                  key={`${r.type}-${r.id}`}
                  onClick={() => navigateTo(r.url)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 text-left transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-slate-100 group-hover:bg-white group-hover:shadow-xs transition-all">
                      {getIcon(r.type)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-800">{r.title}</div>
                      <div className="text-xs text-slate-500">{r.subtitle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {r.type}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500">
              No matching records found in household database.
            </div>
          )}

          {!query && (
            <div className="space-y-1 p-1">
              <div className="text-[11px] font-semibold text-slate-400 px-3 py-1 uppercase tracking-wider">
                Quick Commands
              </div>
              <button
                type="button"
                onClick={() => navigateTo("/assistant?q=What+needs+my+attention+today")}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-teal-50 text-left text-xs font-medium text-teal-800 transition-colors cursor-pointer"
              >
                <span>Ask AI: &quot;What needs my attention today?&quot;</span>
                <span className="text-[10px] text-teal-600">Assistant</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo("/procurement")}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-left text-xs text-slate-700 transition-colors cursor-pointer"
              >
                <span>View Low-Stock Groceries & Procurement</span>
                <span className="text-[10px] text-slate-500">Inventory</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo("/bills")}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-left text-xs text-slate-700 transition-colors cursor-pointer"
              >
                <span>Pay Tata Power Electricity Bill</span>
                <span className="text-[10px] text-slate-500">Bills</span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo("/documents")}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-left text-xs text-slate-700 transition-colors cursor-pointer"
              >
                <span>Upload Invoice / Receipt Document</span>
                <span className="text-[10px] text-slate-500">Document Intel</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
