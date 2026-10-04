import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in Indian Rupees with correct Indian lakh/crore formatting
 * e.g., 2340 -> ₹2,340 | 125000 -> ₹1,25,000 | 1500000 -> ₹15,00,000
 */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date in Indian readable format: "05 Oct 2026"
 */
export function formatIndianDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Human readable relative or countdown time for maintenance & bills
 */
export function formatDaysRemaining(targetDate: Date | string | null | undefined): {
  days: number;
  label: string;
  isOverdue: boolean;
} {
  if (!targetDate) return { days: 0, label: "No date set", isOverdue: false };
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
  const now = new Date();
  
  // Set to beginning of today
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  const diffTime = targetDay.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { days: Math.abs(diffDays), label: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
  } else if (diffDays === 0) {
    return { days: 0, label: "Due Today", isOverdue: false };
  } else if (diffDays === 1) {
    return { days: 1, label: "Due Tomorrow", isOverdue: false };
  } else {
    return { days: diffDays, label: `In ${diffDays} days`, isOverdue: false };
  }
}
