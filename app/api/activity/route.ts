import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const logs = await prisma.activityLog.findMany({
      where: { householdId: household.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Fetch activity logs error:", error);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}
