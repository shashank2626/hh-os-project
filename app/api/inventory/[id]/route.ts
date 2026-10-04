import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Fetch inventory item error:", error);
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
  }
}
