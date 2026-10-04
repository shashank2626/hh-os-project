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
          take: 5,
        },
      },
      orderBy: { healthScore: "asc" },
    });

    const enriched = assets.map((asset) => {
      const maintenanceStatus = calculateAssetMaintenance(asset);
      return {
        ...asset,
        maintenanceStatus,
      };
    });

    return NextResponse.json({ assets: enriched });
  } catch (error) {
    console.error("Fetch assets error:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      category = "Appliance",
      brand,
      model,
      serialNumber,
      purchaseDate,
      purchasePrice,
      warrantyPeriodMonths = 12,
      serviceIntervalDays = 180,
      usageLevel = "Medium",
      location = "Living Room",
      technicianContact,
      notes,
    } = body;

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const pDate = purchaseDate ? new Date(purchaseDate) : new Date();
    const warrantyExpiresAt = new Date(
      pDate.getTime() + Number(warrantyPeriodMonths) * 30 * 24 * 3600 * 1000
    );
    const nextServiceDueDate = new Date(
      pDate.getTime() + Number(serviceIntervalDays) * 24 * 3600 * 1000
    );

    const asset = await prisma.asset.create({
      data: {
        householdId: household.id,
        name,
        category,
        brand,
        model,
        serialNumber: serialNumber || `SN-${Date.now().toString().slice(-6)}`,
        purchaseDate: pDate,
        purchasePrice: purchasePrice ? Number(purchasePrice) : null,
        warrantyPeriodMonths: Number(warrantyPeriodMonths),
        warrantyExpiresAt,
        lastServiceDate: pDate,
        nextServiceDueDate,
        serviceIntervalDays: Number(serviceIntervalDays),
        usageLevel,
        location,
        technicianContact,
        notes,
        healthScore: 100,
        riskLevel: "Good",
      },
    });

    await logActivity({
      householdId: household.id,
      actionType: "ASSET_ADDED",
      title: `Appliance Added: ${name}`,
      description: `${brand} ${category} installed in ${location}`,
      entityType: "Asset",
      entityId: asset.id,
      actor: "User",
    });

    return NextResponse.json({ success: true, asset });
  } catch (error) {
    console.error("Create asset error:", error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}
