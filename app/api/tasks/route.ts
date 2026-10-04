import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/services/activity-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const whereClause: {
      householdId: string;
      status?: string;
      priority?: string;
    } = { householdId: household.id };

    if (status && status !== "ALL") whereClause.status = status;
    if (priority && priority !== "ALL") whereClause.priority = priority;

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedMember: {
          select: { id: true, name: true, role: true, avatar: true },
        },
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Fetch tasks error:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      priority = "MEDIUM",
      dueDate,
      assignedMemberId,
      category = "General",
    } = body;

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    // AI recommendation logic for task assignment if not specified
    let aiRecommendedMemberId: string | null = null;
    let aiReason: string | null = null;

    if (!assignedMemberId) {
      const members = await prisma.householdMember.findMany({
        where: { householdId: household.id },
        include: { tasks: { where: { status: "PENDING" } } },
      });

      // Match based on category / title keywords
      const titleLower = title.toLowerCase();
      if (titleLower.includes("grocer") || titleLower.includes("milk") || titleLower.includes("kitchen")) {
        const priya = members.find((m) => m.name.includes("Priya"));
        if (priya) {
          aiRecommendedMemberId = priya.id;
          aiReason = "Priya oversees pantry, kitchen stock, and daily delivery coordination.";
        }
      } else if (titleLower.includes("bill") || titleLower.includes("power") || titleLower.includes("ac") || titleLower.includes("service")) {
        const ayush = members.find((m) => m.name.includes("Ayush"));
        if (ayush) {
          aiRecommendedMemberId = ayush.id;
          aiReason = "Ayush handles utility payments and technician coordination.";
        }
      } else {
        // Recommend member with fewest active tasks
        const leastBusy = [...members].sort((a, b) => a.tasks.length - b.tasks.length)[0];
        if (leastBusy) {
          aiRecommendedMemberId = leastBusy.id;
          aiReason = `Recommended for ${leastBusy.name} based on lowest current pending task load (${leastBusy.tasks.length} active).`;
        }
      }
    }

    const task = await prisma.task.create({
      data: {
        householdId: household.id,
        title,
        description,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedMemberId: assignedMemberId || null,
        aiRecommendedMemberId,
        aiReason,
        category,
      },
      include: { assignedMember: true },
    });

    await logActivity({
      householdId: household.id,
      actionType: "TASK_ASSIGNED",
      title: `Task Created: ${title}`,
      description: task.assignedMember ? `Assigned to ${task.assignedMember.name}` : "Awaiting assignment",
      entityType: "Task",
      entityId: task.id,
      actor: "User",
    });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, assignedMemberId, priority } = body;

    if (!id) return NextResponse.json({ error: "Task ID is required" }, { status: 400 });

    const existing = await prisma.task.findUnique({
      where: { id },
      include: { assignedMember: true },
    });

    if (!existing) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const isCompleting = status === "COMPLETED" && existing.status !== "COMPLETED";

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status: status !== undefined ? status : existing.status,
        assignedMemberId: assignedMemberId !== undefined ? assignedMemberId : existing.assignedMemberId,
        priority: priority !== undefined ? priority : existing.priority,
        completedAt: isCompleting ? new Date() : existing.completedAt,
      },
      include: { assignedMember: true },
    });

    if (isCompleting) {
      await logActivity({
        householdId: existing.householdId,
        actionType: "TASK_ASSIGNED",
        title: `Task Completed: ${existing.title}`,
        description: `Resolved by ${updated.assignedMember?.name || "Family Member"}`,
        entityType: "Task",
        entityId: id,
        actor: "User",
      });
    }

    return NextResponse.json({ success: true, task: updated });
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Task ID required" }, { status: 400 });

    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
