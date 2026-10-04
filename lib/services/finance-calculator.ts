export interface ExpenseAnomaly {
  isAnomaly: boolean;
  category: string;
  currentAmount: number;
  benchmarkAmount: number;
  percentageChange: number;
  explanation: string;
}

/**
 * Detect financial anomalies in household spending
 * Flags when a category's current expense exceeds baseline/average by > 20%
 */
export function detectExpenseAnomaly(
  title: string,
  category: string,
  currentAmount: number,
  recentExpenses: Array<{ category: string; amount: number; date: Date | string }>
): ExpenseAnomaly {
  const categoryExpenses = recentExpenses.filter(
    (e) => e.category.toLowerCase() === category.toLowerCase() && e.amount > 0
  );

  if (categoryExpenses.length < 2) {
    return {
      isAnomaly: false,
      category,
      currentAmount,
      benchmarkAmount: currentAmount,
      percentageChange: 0,
      explanation: "Normal expense: Insufficient historical baseline.",
    };
  }

  // Calculate trailing mean
  const total = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
  const average = total / categoryExpenses.length;

  const percentageChange = Math.round(((currentAmount - average) / average) * 100);

  if (percentageChange > 20) {
    let context = "";
    if (category.toLowerCase().includes("util") || title.toLowerCase().includes("power") || title.toLowerCase().includes("electric")) {
      context = "Higher consumption detected, commonly linked to AC running hours during summer/heatwave.";
    } else if (category.toLowerCase().includes("grocer")) {
      context = "Bulk restocking or premium brand purchases detected.";
    } else {
      context = "Higher than typical household monthly allocation.";
    }

    return {
      isAnomaly: true,
      category,
      currentAmount,
      benchmarkAmount: Math.round(average),
      percentageChange,
      explanation: `${title} (${category}) spending is ${percentageChange}% higher than your recent average of ₹${Math.round(
        average
      ).toLocaleString("en-IN")}. ${context}`,
    };
  }

  return {
    isAnomaly: false,
    category,
    currentAmount,
    benchmarkAmount: Math.round(average),
    percentageChange,
    explanation: "Within normal expected seasonal spending band.",
  };
}
