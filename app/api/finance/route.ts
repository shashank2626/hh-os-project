import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { detectExpenseAnomaly } from "@/lib/services/finance-calculator";
import { logActivity } from "@/lib/services/activity-service";

export async function GET() {
  try {
    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const [expenses, bills] = await Promise.all([
      prisma.expense.findMany({
        where: { householdId: household.id },
        orderBy: { date: "desc" },
      }),
      prisma.bill.findMany({
        where: { householdId: household.id },
        orderBy: { dueDate: "asc" },
      }),
    ]);

    // Calculate Category breakdown
    const categoryTotals: Record<string, number> = {};
    let totalSpent = 0;

    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
      totalSpent += e.amount;
    });

    const categoryBreakdown = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
    }));

    // Find anomalies
    const anomalies = expenses.filter((e) => e.isAnomaly);

    // Pending vs Paid bills
    const pendingBills = bills.filter((b) => b.paymentStatus === "PENDING");
    const totalPendingBillsAmount = pendingBills.reduce((sum, b) => sum + b.amount, 0);

    return NextResponse.json({
      totalSpent,
      categoryBreakdown,
      anomalies,
      recentExpenses: expenses.slice(0, 15),
      pendingBills,
      totalPendingBillsAmount,
    });
  } catch (error) {
    console.error("Fetch finance data error:", error);
    return NextResponse.json({ error: "Failed to fetch finance records" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, category, amount, paymentMethod = "UPI", paidBy = "Ayush Sharma", vendor } = body;

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const numAmount = Number(amount);

    // Check for anomalies against recent expenses in same category
    const recent = await prisma.expense.findMany({
      where: { householdId: household.id },
      take: 20,
    });

    const anomalyCheck = detectExpenseAnomaly(title, category, numAmount, recent);

    const expense = await prisma.expense.create({
      data: {
        householdId: household.id,
        title,
        category,
        amount: numAmount,
        paymentMethod,
        paidBy,
        vendor,
        isAnomaly: anomalyCheck.isAnomaly,
        anomalyReason: anomalyCheck.isAnomaly ? anomalyCheck.explanation : null,
      },
    });

    await logActivity({
      householdId: household.id,
      actionType: "EXPENSE_LOGGED",
      title: `Expense Logged: ₹${numAmount.toLocaleString("en-IN")}`,
      description: `${title} (${category}) paid via ${paymentMethod}`,
      entityType: "Expense",
      entityId: expense.id,
      actor: "User",
    });

    return NextResponse.json({ success: true, expense, anomalyCheck });
  } catch (error) {
    console.error("Create expense error:", error);
    return NextResponse.json({ error: "Failed to record expense" }, { status: 500 });
  }
}
