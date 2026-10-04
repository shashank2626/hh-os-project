import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { calculateAssetMaintenance } from "@/lib/services/maintenance-calculator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        maintenance: {
          orderBy: { serviceDate: "desc" },
        },
      },
    });

    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    const maintenanceStatus = calculateAssetMaintenance(asset);

    return NextResponse.json({
      asset: {
        ...asset,
        maintenanceStatus,
      },
    });
  } catch (error) {
    console.error("Fetch asset error:", error);
    return NextResponse.json({ error: "Failed to fetch asset" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.maintenanceRecord.deleteMany({ where: { assetId: id } });
    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete asset error:", error);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
