"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Bot,
  FileText,
  Wrench,
  Tv,
  CheckSquare,
  CreditCard,
  Receipt,
  Users,
  History,
  Settings,
  Sparkles,
  ShieldCheck,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Smart Kitchen & Refill", href: "/inventory/smart-kitchen", icon: Sparkles },
  { label: "Smart Inventory", href: "/inventory", icon: Package },
  { label: "Local Vendor Network", href: "/vendors", icon: Store },
  { label: "AI Procurement", href: "/procurement", icon: ShoppingCart },
  { label: "AI Assistant", href: "/assistant", icon: Bot, highlight: true },
  { label: "Document Intel", href: "/documents", icon: FileText },
  { label: "Appliances & Assets", href: "/assets", icon: Tv },
  { label: "Predictive Maintenance", href: "/maintenance", icon: Wrench },
  { label: "Tasks & Chores", href: "/tasks", icon: CheckSquare },
  { label: "Household Bills", href: "/bills", icon: Receipt },
  { label: "Finance & Expenses", href: "/finance", icon: CreditCard },
  { label: "Family Coordination", href: "/family", icon: Users },
  { label: "Activity Audit Feed", href: "/activity", icon: History },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 bg-slate-900 text-slate-200 flex flex-col h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-900/50 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5 text-teal-100" />
          </div>
          <div>
            <div className="font-semibold text-white tracking-tight text-base flex items-center gap-1.5">
              Household OS
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-medium">
                IN
              </span>
            </div>
            <div className="text-xs text-slate-400">Sharma Household</div>
          </div>
        </Link>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Household Management
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-teal-600/15 text-teal-300 font-semibold border-l-2 border-teal-400 pl-2.5"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 transition-colors",
                  isActive
                    ? "text-teal-400"
                    : "text-slate-400 group-hover:text-slate-200"
                )}
              />
              <span className="flex-1">{item.label}</span>
              {item.highlight && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300">
                  <Sparkles className="w-2.5 h-2.5" />
                  Gemini
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Satpur, Nashik</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            System Live
          </span>
        </div>
      </div>
    </aside>
  );
}
