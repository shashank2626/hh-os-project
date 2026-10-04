import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { calculateAssetMaintenance } from "@/lib/services/maintenance-calculator";

export async function GET() {
  try {
    const household = await prisma.household.findFirst();
    if (!household) {
      return NextResponse.json({ error: "Household not found" }, { status: 404 });
    }

    const [
      inventoryItems,
      bills,
      assets,
      tasks,
      expenses,
      recommendations,
      activityLogs,
    ] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { householdId: household.id },
        orderBy: { estimatedDaysRemaining: "asc" },
      }),
      prisma.bill.findMany({
        where: { householdId: household.id, paymentStatus: "PENDING" },
        orderBy: { dueDate: "asc" },
      }),
      prisma.asset.findMany({
        where: { householdId: household.id },
        include: { maintenance: { orderBy: { serviceDate: "desc" }, take: 1 } },
      }),
      prisma.task.findMany({
        where: { householdId: household.id, status: "PENDING" },
        include: { assignedMember: { select: { name: true, avatar: true } } },
        orderBy: { priority: "desc" },
      }),
      prisma.expense.findMany({
        where: { householdId: household.id },
        orderBy: { date: "desc" },
        take: 10,
      }),
      prisma.recommendation.findMany({
        where: { householdId: household.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
      prisma.activityLog.findMany({
        where: { householdId: household.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    // Calculate Asset Maintenance status
    const assetStatuses = assets.map((a) => ({
      ...a,
      maintenanceStatus: calculateAssetMaintenance(a),
    }));

    const overdueAssets = assetStatuses.filter((a) => a.maintenanceStatus.isOverdue);
    const warningAssets = assetStatuses.filter(
      (a) => !a.maintenanceStatus.isOverdue && a.maintenanceStatus.riskLevel === "Warning"
    );

    // Low stock items
    const lowStockItems = inventoryItems.filter(
      (i) => i.isLowStock || i.estimatedDaysRemaining <= 4
    );

    // Urgent Alerts List
    const urgentAlerts: Array<{
      id: string;
      type: "BILL" | "MAINTENANCE" | "INVENTORY" | "TASK";
      title: string;
      description: string;
      severity: "CRITICAL" | "HIGH" | "MEDIUM";
      actionLabel: string;
      actionUrl: string;
    }> = [];

    // Critical bills (due within 2 days)
    const now = new Date();
    bills.forEach((b) => {
      const daysLeft = Math.round((new Date(b.dueDate).getTime() - now.getTime()) / (1000 * 3600 * 24));
      if (daysLeft <= 2) {
        urgentAlerts.push({
          id: `bill-${b.id}`,
          type: "BILL",
          title: `Bill Due: ${b.title}`,
          description: `₹${b.amount.toLocaleString("en-IN")} is due ${daysLeft <= 0 ? "TODAY" : "TOMORROW"}. Pay to avoid penalty.`,
          severity: "CRITICAL",
          actionLabel: "Pay Bill",
          actionUrl: "/bills",
        });
      }
    });

    // Overdue maintenance
    overdueAssets.forEach((a) => {
      urgentAlerts.push({
        id: `asset-${a.id}`,
        type: "MAINTENANCE",
        title: `Overdue Service: ${a.name}`,
        description: a.maintenanceStatus.explanation,
        severity: "CRITICAL",
        actionLabel: "Schedule Service",
        actionUrl: `/assets/${a.id}`,
      });
    });

    // Critical low stock
    lowStockItems.slice(0, 2).forEach((i) => {
      urgentAlerts.push({
        id: `inv-${i.id}`,
        type: "INVENTORY",
        title: `Low Stock: ${i.name}`,
        description: `Only ${i.quantity} ${i.unit} remaining (~${i.estimatedDaysRemaining} days).`,
        severity: i.estimatedDaysRemaining <= 1 ? "CRITICAL" : "HIGH",
        actionLabel: "Restock Now",
        actionUrl: "/procurement",
      });
    });

    // Household Health Score (0-100)
    // 100 base - penalties for overdue maintenance (-15 each), pending urgent bills (-10 each), low stock (-5 each)
    let healthScore = 100;
    healthScore -= overdueAssets.length * 15;
    healthScore -= bills.filter((b) => new Date(b.dueDate) < now).length * 15;
    healthScore -= Math.min(20, lowStockItems.length * 5);
    healthScore = Math.max(25, Math.min(100, healthScore));

    // Monthly Spending calculation
    const currentMonthExpenses = expenses.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthlySpending = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    return NextResponse.json({
      household: {
        id: household.id,
        name: household.name,
        city: household.city,
        address: household.address,
      },
      healthScore,
      urgentAlerts,
      counts: {
        lowStock: lowStockItems.length,
        pendingBills: bills.length,
        totalPendingBillsAmount: bills.reduce((sum, b) => sum + b.amount, 0),
        pendingTasks: tasks.length,
        overdueMaintenance: overdueAssets.length,
        warningMaintenance: warningAssets.length,
        totalAppliances: assets.length,
      },
      lowStockItems: lowStockItems.slice(0, 5),
      upcomingBills: bills.slice(0, 4),
      upcomingMaintenance: assetStatuses
        .filter((a) => a.maintenanceStatus.daysUntilNextService <= 30)
        .slice(0, 4),
      pendingTasks: tasks.slice(0, 4),
      recentExpenses: expenses.slice(0, 5),
      monthlySpending,
      recommendations,
      activityLogs,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}
