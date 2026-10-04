"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Bell, Sparkles, MapPin } from "lucide-react";
import { CommandBar } from "@/components/layout/command-bar";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Header() {
  const [commandBarOpen, setCommandBarOpen] = useState(false);

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Left: Household Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
            <MapPin className="w-3.5 h-3.5 text-teal-600" />
            <span>Flat 402, Palm Heights • Satpur, Nashik</span>
          </div>
        </div>

        {/* Middle: Universal Search Bar Trigger */}
        <div className="flex-1 max-w-md mx-6">
          <button
            type="button"
            onClick={() => setCommandBarOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-400 text-sm transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <span>Search inventory, appliances, bills, tasks...</span>
            </div>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-500 shadow-xs">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right: Quick Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          <Link
            href="/assistant"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100 text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600 animate-spin-slow" />
            <span>Ask AI</span>
          </Link>

          <Link
            href="/activity"
            title="Activity Feed"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
          </Link>

          <div className="h-4 w-px bg-slate-200" />

          {/* Profile snippet */}
          <Link href="/family" className="flex items-center gap-2.5 pl-1 group">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold ring-2 ring-slate-100 group-hover:ring-teal-200 transition-all">
              AS
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-medium text-slate-800">Ayush Sharma</div>
              <div className="text-[10px] text-slate-500">Home Admin</div>
            </div>
          </Link>
        </div>
      </header>

      {/* Global Command Bar Modal */}
      <CommandBar open={commandBarOpen} onClose={() => setCommandBarOpen(false)} />
    </>
  );
}
