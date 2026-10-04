import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { calculateAssetMaintenance } from "@/lib/services/maintenance-calculator";
import { logActivity } from "@/lib/services/activity-service";

export async function GET() {
  try {
    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const assets = await prisma.asset.findMany({
      where: { householdId: household.id },
      include: {
        maintenance: {
          orderBy: { serviceDate: "desc" },
          take: 3,
        },
      },
    });

    const statusList = assets.map((a) => ({
      asset: a,
      status: calculateAssetMaintenance(a),
    }));

    const overdue = statusList.filter((s) => s.status.isOverdue);
    const upcoming = statusList.filter(
      (s) => !s.status.isOverdue && s.status.daysUntilNextService <= 30
    );
    const healthy = statusList.filter(
      (s) => !s.status.isOverdue && s.status.daysUntilNextService > 30
    );

    // Recent maintenance logs across all appliances
    const recentLogs = await prisma.maintenanceRecord.findMany({
      where: { asset: { householdId: household.id } },
      include: { asset: { select: { name: true, category: true, brand: true } } },
      orderBy: { serviceDate: "desc" },
      take: 10,
    });

    return NextResponse.json({
      summary: {
        totalAssets: assets.length,
        overdueCount: overdue.length,
        upcomingCount: upcoming.length,
        healthyCount: healthy.length,
      },
      overdue,
      upcoming,
      healthy,
      recentLogs,
    });
  } catch (error) {
    console.error("Fetch maintenance schedule error:", error);
    return NextResponse.json({ error: "Failed to fetch maintenance data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      assetId,
      serviceType = "Preventive",
      provider = "Urban Company",
      cost = 0,
      notes,
      technicianName,
      technicianPhone,
    } = body;

    if (!assetId) return NextResponse.json({ error: "Asset ID is required" }, { status: 400 });

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    const now = new Date();
    const nextDue = new Date(now.getTime() + asset.serviceIntervalDays * 24 * 3600 * 1000);

    // Create Maintenance Record
    const record = await prisma.maintenanceRecord.create({
      data: {
        assetId,
        serviceDate: now,
        serviceType,
        provider,
        cost: Number(cost),
        notes: notes || `Service completed via ${provider}`,
        technicianName,
        technicianPhone,
        nextDueRecommendation: nextDue,
      },
    });

    // Restore Asset Health & update next service date
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        lastServiceDate: now,
        nextServiceDueDate: nextDue,
        healthScore: 95,
        riskLevel: "Good",
      },
    });

    // Record expense if cost > 0
    if (Number(cost) > 0) {
      await prisma.expense.create({
        data: {
          householdId: asset.householdId,
          title: `${asset.name} Maintenance (${serviceType})`,
          category: "Maintenance",
          amount: Number(cost),
          paymentMethod: "UPI",
          vendor: provider,
        },
      });
    }

    await logActivity({
      householdId: asset.householdId,
      actionType: "MAINTENANCE_SCHEDULED",
      title: `Service Logged: ${asset.name}`,
      description: `${serviceType} completed by ${provider} (Cost: ₹${Number(cost).toLocaleString("en-IN")})`,
      entityType: "Asset",
      entityId: asset.id,
      actor: "User",
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("Log maintenance error:", error);
    return NextResponse.json({ error: "Failed to record maintenance" }, { status: 500 });
  }
}
