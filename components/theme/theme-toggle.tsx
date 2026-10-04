"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Laptop } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        aria-label="Toggle theme"
      >
        <Sun className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors relative cursor-pointer flex items-center gap-1.5"
      title={`Current: ${theme} (${resolvedTheme}). Click to switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-slate-600 transition-transform hover:-rotate-12" />
      )}
      {showLabel && (
        <span className="text-xs font-medium">
          {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </button>
  );
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
          theme === "light"
            ? "border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-xs block">Light Theme</span>
            <span className="text-[10px] text-slate-500">Daytime clarity</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Clean, high-contrast crisp daytime view.
        </p>
      </button>

      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
          theme === "dark"
            ? "border-teal-600 bg-teal-900/20 ring-2 ring-teal-500/20"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-900 text-indigo-300 flex items-center justify-center">
            <Moon className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-xs block">Dark Theme</span>
            <span className="text-[10px] text-slate-500">Midnight obsidian</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Easy on the eyes, low-glare nighttime management.
        </p>
      </button>

      <button
        type="button"
        onClick={() => setTheme("system")}
        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
          theme === "system"
            ? "border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <Laptop className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-xs block">System Auto</span>
            <span className="text-[10px] text-slate-500">Device sync</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">
          Automatically mirrors your device OS preference.
        </p>
      </button>
    </div>
  );
}
