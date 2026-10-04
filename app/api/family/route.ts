import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const members = await prisma.householdMember.findMany({
      where: { householdId: household.id },
      include: {
        tasks: {
          orderBy: { dueDate: "asc" },
        },
      },
    });

    const enriched = members.map((m) => {
      const pendingTasks = m.tasks.filter((t) => t.status === "PENDING");
      const completedTasks = m.tasks.filter((t) => t.status === "COMPLETED");
      return {
        ...m,
        pendingTasksCount: pendingTasks.length,
        completedTasksCount: completedTasks.length,
        pendingTasks,
      };
    });

    return NextResponse.json({ members: enriched });
  } catch (error) {
    console.error("Fetch family members error:", error);
    return NextResponse.json({ error: "Failed to fetch family members" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, role = "Member", phone, email, availability = "Available", responsibilities, preferences } = body;

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const member = await prisma.householdMember.create({
      data: {
        householdId: household.id,
        name,
        role,
        phone,
        email,
        availability,
        responsibilities,
        preferences,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      },
    });

    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error("Create family member error:", error);
    return NextResponse.json({ error: "Failed to create member" }, { status: 500 });
  }
}
