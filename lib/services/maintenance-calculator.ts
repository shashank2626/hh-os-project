export interface AssetMaintenanceStatus {
  assetId: string;
  name: string;
  category: string;
  daysSinceLastService: number;
  daysUntilNextService: number;
  isOverdue: boolean;
  healthScore: number; // 0 - 100
  riskLevel: "Good" | "Warning" | "Critical";
  explanation: string;
  warrantyStatus: {
    isUnderWarranty: boolean;
    expiresInDays: number | null;
    label: string;
  };
}

/**
 * Deterministic predictive maintenance calculation for household appliances
 * Does NOT rely solely on AI for numerical checks; uses exact application math.
 */
export function calculateAssetMaintenance(asset: {
  id: string;
  name: string;
  category: string;
  brand: string;
  lastServiceDate?: Date | string | null;
  nextServiceDueDate?: Date | string | null;
  serviceIntervalDays: number;
  usageLevel: string; // Low, Medium, Heavy
  warrantyExpiresAt?: Date | string | null;
}): AssetMaintenanceStatus {
  const now = new Date();
  const lastService = asset.lastServiceDate ? new Date(asset.lastServiceDate) : null;
  
  // 1. Days since last service
  const daysSinceLastService = lastService
    ? Math.max(0, Math.floor((now.getTime() - lastService.getTime()) / (1000 * 3600 * 24)))
    : asset.serviceIntervalDays;

  // 2. Next service due calculations
  let daysUntilNextService = asset.serviceIntervalDays - daysSinceLastService;
  if (asset.nextServiceDueDate) {
    const nextDue = new Date(asset.nextServiceDueDate);
    daysUntilNextService = Math.round((nextDue.getTime() - now.getTime()) / (1000 * 3600 * 24));
  }

  const isOverdue = daysUntilNextService < 0;

  // 3. Health Score (0-100)
  // Usage multipliers: Heavy usage accelerates wear
  const usageMultiplier = asset.usageLevel === "Heavy" ? 1.25 : asset.usageLevel === "Low" ? 0.85 : 1.0;
  const effectiveDaysPassed = daysSinceLastService * usageMultiplier;

  let calculatedHealth = 100 - Math.round((effectiveDaysPassed / asset.serviceIntervalDays) * 45);
  if (isOverdue) {
    // Penalty for each overdue week
    const weeksOverdue = Math.abs(daysUntilNextService) / 7;
    calculatedHealth -= Math.round(weeksOverdue * 8);
  }
  const healthScore = Math.max(10, Math.min(100, calculatedHealth));

  // 4. Deterministic Risk Level
  let riskLevel: "Good" | "Warning" | "Critical" = "Good";
  if (isOverdue || healthScore < 55) {
    riskLevel = "Critical";
  } else if (daysUntilNextService <= 14 || healthScore < 75) {
    riskLevel = "Warning";
  }

  // 5. Warranty Status
  let isUnderWarranty = false;
  let expiresInDays: number | null = null;
  let warrantyLabel = "No warranty registered";

  if (asset.warrantyExpiresAt) {
    const warrantyDate = new Date(asset.warrantyExpiresAt);
    const diffDays = Math.round((warrantyDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    expiresInDays = diffDays;
    if (diffDays > 0) {
      isUnderWarranty = true;
      warrantyLabel = `Active (${diffDays} days remaining)`;
    } else {
      isUnderWarranty = false;
      warrantyLabel = `Expired ${Math.abs(diffDays)} days ago`;
    }
  }

  // 6. Natural Language Deterministic Explanation
  const monthsSinceLast = Math.round(daysSinceLastService / 30);
  const intervalMonths = Math.round(asset.serviceIntervalDays / 30);

  let explanation = "";
  if (isOverdue) {
    const overdueDays = Math.abs(daysUntilNextService);
    explanation = `Your ${asset.name} is ${overdueDays} days OVERDUE for maintenance. Its last service was ${monthsSinceLast} months ago and your configured service interval is ${intervalMonths} months (${asset.usageLevel.toLowerCase()} usage profile). Prompt service will prevent breakdown.`;
  } else if (daysUntilNextService <= 14) {
    explanation = `Your ${asset.name} is due for maintenance in ${daysUntilNextService} days because its last service was ${monthsSinceLast} months ago and your configured service interval is ${intervalMonths} months.`;
  } else {
    explanation = `Your ${asset.name} is in good health (score: ${healthScore}/100). Next preventive service is expected in ${daysUntilNextService} days.`;
  }

  return {
    assetId: asset.id,
    name: asset.name,
    category: asset.category,
    daysSinceLastService,
    daysUntilNextService,
    isOverdue,
    healthScore,
    riskLevel,
    explanation,
    warrantyStatus: {
      isUnderWarranty,
      expiresInDays,
      label: warrantyLabel,
    },
  };
}
