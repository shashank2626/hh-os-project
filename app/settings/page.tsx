"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  Settings,
  Shield,
  Key,
  Database,
  CheckCircle2,
  RefreshCw,
  Bell,
  Home,
  Moon,
} from "lucide-react";
import { ThemeSelector } from "@/components/theme/theme-toggle";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      localStorage.setItem("gemini_api_key", apiKey.trim());
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 3000);
    }
  };

  const handleResetDemoData = async () => {
    if (!confirm("This will reset the Sharma Household database to initial demo state. Continue?")) return;
    setResetting(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        setResetSuccess("Database reseeded with fresh demo Indian household records!");
        setTimeout(() => setResetSuccess(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 uppercase">
            <Settings className="w-3.5 h-3.5" />
            <span>Household Preferences &amp; Config</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            System Settings
          </h1>
          <p className="text-sm text-slate-500">
            Configure Gemini AI API keys, household appearance, address details, and demonstration seed state.
          </p>
        </div>

        {resetSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{resetSuccess}</span>
          </div>
        )}

        {/* Theme & Appearance Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center gap-2.5 mb-2">
            <Moon className="w-4 h-4 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-sm">Theme &amp; Appearance</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Customize the interface theme to your preference. Choose between high-contrast light mode, obsidian dark mode, or follow your system setting.
          </p>
          <ThemeSelector />
        </div>

        {/* Gemini AI Key Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center gap-2.5 mb-2">
            <Key className="w-4 h-4 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-sm">Google Gemini AI Configuration</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Household OS uses Gemini 1.5 Flash for multimodal document extraction and tool calling.
            If configured in your server <code>.env</code> file (<code>GEMINI_API_KEY</code>), it is automatically active.
            You can also provide a key here for testing.
          </p>

          <form onSubmit={handleSaveApiKey} className="mt-4 flex gap-2">
            <input
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Save Key
            </button>
          </form>

          {keySaved && (
            <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              API Key configured for current session.
            </p>
          )}
        </div>

        {/* Household Profile */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 text-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <Home className="w-4 h-4 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-sm">Household Location Profile</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-slate-400 block mb-1">Household Title</span>
              <input
                type="text"
                disabled
                defaultValue="Sharma Household"
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-medium"
              />
            </div>
            <div>
              <span className="text-slate-400 block mb-1">City &amp; State</span>
              <input
                type="text"
                disabled
                defaultValue="Satpur, Nashik, Maharashtra"
                className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-800 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Reset / Demo Reseed Action */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center gap-2.5 mb-2">
            <Database className="w-4 h-4 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-sm">Hackathon Demo State Reset</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Quickly restore the Sharma Household database to its default pristine state with realistic Indian grocery items, overdue RO filter alerts, pending Tata Power bill, and active family chores.
          </p>

          <button
            type="button"
            onClick={handleResetDemoData}
            disabled={resetting}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resetting ? "animate-spin" : ""}`} />
            <span>{resetting ? "Reseeding Database..." : "Reset Database to Fresh Demo State"}</span>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
