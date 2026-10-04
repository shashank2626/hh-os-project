export interface DepletionCalculation {
  estimatedDaysRemaining: number;
  isLowStock: boolean;
  depletionDate: Date;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/**
 * Deterministic depletion calculation for Indian household inventory items
 */
export function calculateDepletion(
  quantity: number,
  minimumStock: number,
  consumptionRate: number
): DepletionCalculation {
  const safeRate = consumptionRate > 0 ? consumptionRate : 0.1;
  const days = Math.max(0, Math.floor(quantity / safeRate));
  const isLowStock = quantity <= minimumStock || days <= 3;

  const now = new Date();
  const depletionDate = new Date(now.getTime() + days * 24 * 3600 * 1000);

  let urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  if (days <= 0) {
    urgency = "CRITICAL";
  } else if (days <= 2) {
    urgency = "HIGH";
  } else if (isLowStock || days <= 5) {
    urgency = "MEDIUM";
  }

  return {
    estimatedDaysRemaining: days,
    isLowStock,
    depletionDate,
    urgency,
  };
}

/**
 * Generate smart Indian procurement recommendation with pack size and savings analysis
 */
export function generateProcurementRecommendation(item: {
  id: string;
  name: string;
  category: string;
  brand?: string | null;
  quantity: number;
  unit: string;
  minimumStock: number;
  consumptionRate: number;
  preferredBrand?: string | null;
  preferredPackSize?: string | null;
  price: number;
  vendor?: string | null;
}) {
  const { estimatedDaysRemaining, isLowStock, urgency } = calculateDepletion(
    item.quantity,
    item.minimumStock,
    item.consumptionRate
  );

  const vendor = item.vendor || "Blinkit";
  const brand = item.brand || item.preferredBrand || "Standard";
  
  // Recommend optimal pack size based on unit
  let recommendedPack = item.preferredPackSize;
  let estimatedPrice = item.price;
  let reason = `Current inventory has ${item.quantity} ${item.unit} remaining (~${estimatedDaysRemaining} days). Buffer stock threshold is ${item.minimumStock} ${item.unit}.`;
  let alternative = "Standard retail pack";
  let valueSavings = "Normal price";

  if (item.unit === "kg") {
    recommendedPack = item.preferredPackSize || "5kg Value Bag";
    estimatedPrice = item.price > 0 ? item.price : 350;
    reason = `Only ${item.quantity} kg left (${estimatedDaysRemaining} days remaining at ${item.consumptionRate} kg/day consumption). Purchasing the larger pack provides a 12% per-kg saving.`;
    alternative = "1kg standard refill pack";
    valueSavings = "Saves approx. ₹40 - ₹60 compared to buying small single packs";
  } else if (item.unit === "L") {
    recommendedPack = item.preferredPackSize || "2L Refill";
    estimatedPrice = item.price > 0 ? item.price : 240;
    reason = `Critical kitchen essential running out in ${estimatedDaysRemaining} days.`;
    alternative = "1L bottle";
    valueSavings = "Saves ₹25 on bundle packs";
  } else if (item.unit === "tablets") {
    recommendedPack = "Strip of 15 tablets";
    estimatedPrice = item.price > 0 ? item.price : 40;
    reason = `First aid & medicine box stock is low (${item.quantity} tablets remaining).`;
    alternative = "Strip of 10";
    valueSavings = "Emergency home reserve";
  }

  // Deep link integration helper for Indian quick-commerce platforms
  const searchQuery = encodeURIComponent(`${brand} ${item.name}`.trim());
  let deepLinkUrl = `https://blinkit.com/s/?q=${searchQuery}`;
  if (vendor.toLowerCase().includes("zepto")) {
    deepLinkUrl = `https://www.zeptonow.com/search?query=${searchQuery}`;
  } else if (vendor.toLowerCase().includes("instamart") || vendor.toLowerCase().includes("swiggy")) {
    deepLinkUrl = `https://www.swiggy.com/instamart/search?query=${searchQuery}`;
  } else if (vendor.toLowerCase().includes("amazon")) {
    deepLinkUrl = `https://www.amazon.in/s?k=${searchQuery}`;
  }

  return {
    itemId: item.id,
    productName: item.name,
    brand,
    category: item.category,
    recommendedPack,
    estimatedPrice,
    vendor,
    deepLinkUrl,
    urgency,
    isLowStock,
    reason,
    alternative,
    valueSavings,
  };
}
