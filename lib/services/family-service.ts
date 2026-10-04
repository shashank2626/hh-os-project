import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/services/activity-service";
import { buildWhatsAppLink, generateFamilyPingWhatsAppMessage } from "@/lib/utils/whatsapp";
import { getHouseholdId } from "@/lib/services/vendor-service";

export interface MemberWorkload {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  availability: string;
  responsibilities: string | null;
  preferences: string | null;
  avatar: string | null;
  activeTaskCount: number;
  urgentTaskCount: number;
  completedTaskCount: number;
  workloadScore: number; // weighted: urgent*3 + high*2 + medium*1
}

export async function getHouseholdMembersWithWorkload(householdId?: string): Promise<{
  members: MemberWorkload[];
  totalActiveTasks: number;
}> {
  const targetHouseholdId = await getHouseholdId(householdId);

  const members = await prisma.householdMember.findMany({
    where: { householdId: targetHouseholdId },
    include: {
      tasks: {
        select: {
          id: true,
          status: true,
          priority: true,
        },
      },
    },
    orderBy: { role: "asc" },
  });

  let totalActive = 0;

  const enrichedMembers: MemberWorkload[] = members.map((member) => {
    const activeTasks = member.tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS");
    const urgentTasks = activeTasks.filter((t) => t.priority === "URGENT");
    const highTasks = activeTasks.filter((t) => t.priority === "HIGH");
    const mediumTasks = activeTasks.filter((t) => t.priority === "MEDIUM" || t.priority === "LOW");
    const completedTasks = member.tasks.filter((t) => t.status === "COMPLETED");

    totalActive += activeTasks.length;

    const workloadScore = urgentTasks.length * 3 + highTasks.length * 2 + mediumTasks.length * 1;

    return {
      id: member.id,
      name: member.name,
      role: member.role,
      phone: member.phone,
      email: member.email,
      availability: member.availability,
      responsibilities: member.responsibilities,
      preferences: member.preferences,
      avatar: member.avatar,
      activeTaskCount: activeTasks.length,
      urgentTaskCount: urgentTasks.length,
      completedTaskCount: completedTasks.length,
      workloadScore,
    };
  });

  return {
    members: enrichedMembers,
    totalActiveTasks: totalActive,
  };
}

export async function getFamilyTasks(
  householdId?: string,
  filter?: {
    memberId?: string;
    priority?: string;
    status?: string;
    category?: string;
  }
) {
  const targetHouseholdId = await getHouseholdId(householdId);

  const where: any = { householdId: targetHouseholdId };

  if (filter?.memberId && filter.memberId !== "ALL") {
    where.assignedMemberId = filter.memberId;
  }

  if (filter?.priority && filter.priority !== "ALL") {
    where.priority = filter.priority;
  }

  if (filter?.status && filter.status !== "ALL") {
    where.status = filter.status;
  } else if (!filter?.status) {
    // Default to active tasks if not specified
    where.status = { in: ["PENDING", "IN_PROGRESS"] };
  }

  if (filter?.category && filter.category !== "ALL") {
    where.category = filter.category;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignedMember: true,
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  // Sort custom: URGENT -> HIGH -> MEDIUM -> LOW
  const priorityWeights: Record<string, number> = {
    URGENT: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  return tasks.sort((a, b) => {
    const weightDiff = (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
    if (weightDiff !== 0) return weightDiff;
    if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Intelligent AI Household Member Assignment
 */
export async function recommendHouseholdMemberForTask(
  householdId: string,
  category: string,
  title: string
): Promise<{ recommendedMemberId: string; reason: string }> {
  const members = await prisma.householdMember.findMany({
    where: { householdId },
    include: {
      tasks: {
        where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
      },
    },
  });

  if (members.length === 0) {
    throw new Error("No household members available");
  }

  const t = `${category} ${title}`.toLowerCase();

  let preferredRole = "Member";
  let reason = "Assigned based on current availability and balanced workload";

  if (t.includes("bill") || t.includes("electricity") || t.includes("finance") || t.includes("wifi") || t.includes("tax") || t.includes("ac") || t.includes("inverter")) {
    preferredRole = "Admin"; // Ayush
    reason = "Best matched to Admin (responsible for utility bills, tech operations and major finances)";
  } else if (t.includes("grocer") || t.includes("refill") || t.includes("atta") || t.includes("vegetable") || t.includes("swiggy") || t.includes("kitchen") || t.includes("snack")) {
    // Look for Priya (Groceries & kitchen)
    const priya = members.find((m) => m.name.toLowerCase().includes("priya") || (m.responsibilities && m.responsibilities.toLowerCase().includes("grocer")));
    if (priya) {
      return {
        recommendedMemberId: priya.id,
        reason: "Assigned to Priya (handles daily groceries, kitchen supplies, and online quick-commerce)",
      };
    }
  } else if (t.includes("medicine") || t.includes("garden") || t.includes("newspaper") || t.includes("plant") || t.includes("morning milk")) {
    const ramesh = members.find((m) => m.name.toLowerCase().includes("ramesh") || m.role === "Parent");
    if (ramesh) {
      return {
        recommendedMemberId: ramesh.id,
        reason: "Assigned to Ramesh (manages daily medicines, balcony garden, and morning vendor coordination)",
      };
    }
  } else if (t.includes("cleaning") || t.includes("utensil") || t.includes("cook") || t.includes("dusting") || t.includes("mop")) {
    const sunita = members.find((m) => m.role === "Helper" || m.name.toLowerCase().includes("sunita"));
    if (sunita) {
      return {
        recommendedMemberId: sunita.id,
        reason: "Assigned to Sunita Devi (in charge of kitchen prep and deep cleaning tasks)",
      };
    }
  }

  // Fallback: pick member with matching role or lowest active workload
  const matchedByRole = members.filter((m) => m.role === preferredRole);
  const candidates = matchedByRole.length > 0 ? matchedByRole : members;

  // Sort by lowest active task count
  candidates.sort((a, b) => a.tasks.length - b.tasks.length);

  return {
    recommendedMemberId: candidates[0].id,
    reason,
  };
}

export async function createFamilyTask(data: {
  householdId?: string;
  title: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: Date | string;
  assignedMemberId?: string;
  category?: string;
  sourceType?: "BILL" | "MAINTENANCE" | "INVENTORY" | "DOCUMENT" | "MANUAL";
  sourceId?: string;
  estimatedCost?: number;
}) {
  const targetHouseholdId = await getHouseholdId(data.householdId);

  let finalMemberId = data.assignedMemberId;
  let aiReason = null;
  let aiRecommendedMemberId = null;

  if (!finalMemberId) {
    const rec = await recommendHouseholdMemberForTask(
      targetHouseholdId,
      data.category || "General",
      data.title
    );
    finalMemberId = rec.recommendedMemberId;
    aiRecommendedMemberId = rec.recommendedMemberId;
    aiReason = rec.reason;
  }

  const dueDateObj = data.dueDate ? new Date(data.dueDate) : undefined;

  const task = await prisma.task.create({
    data: {
      householdId: targetHouseholdId,
      title: data.title,
      description: data.description,
      priority: data.priority || "MEDIUM",
      dueDate: dueDateObj,
      assignedMemberId: finalMemberId,
      category: data.category || "General",
      sourceType: data.sourceType || "MANUAL",
      sourceId: data.sourceId,
      estimatedCost: data.estimatedCost,
      aiRecommendedMemberId,
      aiReason,
      status: "PENDING",
    },
    include: {
      assignedMember: true,
    },
  });

  await logActivity({
    householdId: targetHouseholdId,
    actionType: "TASK_ASSIGNED",
    title: `Assigned task: ${task.title}`,
    description: `Assigned to ${task.assignedMember?.name || "family member"} (Priority: ${task.priority})`,
    entityType: "Task",
    entityId: task.id,
    actor: "Family Coordinator",
  });

  return task;
}

export async function reassignFamilyTask(taskId: string, newMemberId: string) {
  const newMember = await prisma.householdMember.findUnique({ where: { id: newMemberId } });
  if (!newMember) throw new Error("Target member not found");

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      assignedMemberId: newMemberId,
    },
    include: {
      assignedMember: true,
    },
  });

  await logActivity({
    householdId: task.householdId,
    actionType: "TASK_REASSIGNED",
    title: `Reassigned task: ${task.title}`,
    description: `Handed over to ${newMember.name}.`,
    entityType: "Task",
    entityId: task.id,
    actor: "User",
  });

  return task;
}

export async function updateFamilyTaskStatus(taskId: string, status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
  const isCompleted = status === "COMPLETED";

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: isCompleted ? new Date() : null,
    },
    include: {
      assignedMember: true,
    },
  });

  await logActivity({
    householdId: task.householdId,
    actionType: isCompleted ? "TASK_COMPLETED" : "TASK_UPDATED",
    title: `${isCompleted ? "Completed" : "Updated"} task: ${task.title}`,
    description: `Marked as ${status} by ${task.assignedMember?.name || "family member"}.`,
    entityType: "Task",
    entityId: task.id,
    actor: "User",
  });

  return task;
}

export async function generateFamilyTaskPing(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignedMember: true,
    },
  });

  if (!task) throw new Error("Task not found");
  if (!task.assignedMember) throw new Error("No member assigned to this task");
  if (!task.assignedMember.phone) throw new Error(`${task.assignedMember.name} has no phone number on record`);

  const dueDateStr = task.dueDate ? task.dueDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : undefined;

  const whatsappMessage = generateFamilyPingWhatsAppMessage({
    memberName: task.assignedMember.name,
    taskTitle: task.title,
    category: task.category,
    priority: task.priority,
    dueDate: dueDateStr,
    amount: task.estimatedCost || undefined,
    notes: task.description || undefined,
    senderName: "Household OS",
  });

  const whatsappUrl = buildWhatsAppLink(task.assignedMember.phone, whatsappMessage);

  return {
    taskId: task.id,
    memberName: task.assignedMember.name,
    phone: task.assignedMember.phone,
    whatsappUrl,
    whatsappMessage,
  };
}

/**
 * Auto-generate tasks from real household state (Bills, Assets, Low Stock)
 */
export async function syncAutonomousTasks(householdId?: string) {
  const targetHouseholdId = await getHouseholdId(householdId);
  const createdTasks: any[] = [];

  // 1. Check Unpaid Bills due in <= 5 days
  const pendingBills = await prisma.bill.findMany({
    where: {
      householdId: targetHouseholdId,
      paymentStatus: { in: ["PENDING", "OVERDUE"] },
    },
  });

  for (const bill of pendingBills) {
    const existing = await prisma.task.findFirst({
      where: { householdId: targetHouseholdId, sourceType: "BILL", sourceId: bill.id, status: { in: ["PENDING", "IN_PROGRESS"] } },
    });

    if (!existing) {
      const isOverdue = bill.dueDate < new Date();
      const task = await createFamilyTask({
        householdId: targetHouseholdId,
        title: `Pay ${bill.title} (₹${bill.amount.toLocaleString("en-IN")})`,
        description: `Utility bill payment due on ${bill.dueDate.toLocaleDateString("en-IN")}. Consumer No: ${bill.referenceNumber || "N/A"}.`,
        priority: isOverdue ? "URGENT" : "HIGH",
        dueDate: bill.dueDate,
        category: "Bill Payment",
        sourceType: "BILL",
        sourceId: bill.id,
        estimatedCost: bill.amount,
      });
      createdTasks.push(task);
    }
  }

  // 2. Check Critical or Warning Assets needing service
  const highRiskAssets = await prisma.asset.findMany({
    where: {
      householdId: targetHouseholdId,
      OR: [{ riskLevel: { in: ["Critical", "Warning"] } }, { healthScore: { lte: 60 } }],
    },
  });

  for (const asset of highRiskAssets) {
    const existing = await prisma.task.findFirst({
      where: { householdId: targetHouseholdId, sourceType: "MAINTENANCE", sourceId: asset.id, status: { in: ["PENDING", "IN_PROGRESS"] } },
    });

    if (!existing) {
      const task = await createFamilyTask({
        householdId: targetHouseholdId,
        title: `Schedule maintenance for ${asset.brand} ${asset.name}`,
        description: `Asset health score dropped to ${asset.healthScore}%. Risk level: ${asset.riskLevel}. Last service was on ${asset.lastServiceDate?.toLocaleDateString("en-IN") || "unknown"}.`,
        priority: asset.riskLevel === "Critical" ? "URGENT" : "HIGH",
        dueDate: asset.nextServiceDueDate || new Date(Date.now() + 3 * 24 * 3600 * 1000),
        category: "Maintenance",
        sourceType: "MAINTENANCE",
        sourceId: asset.id,
      });
      createdTasks.push(task);
    }
  }

  // 3. Check Low Inventory Items (Milk, Groceries)
  const urgentLowStock = await prisma.inventoryItem.findMany({
    where: {
      householdId: targetHouseholdId,
      OR: [{ isLowStock: true }, { estimatedDaysRemaining: { lte: 2 } }],
    },
  });

  if (urgentLowStock.length > 0) {
    const existing = await prisma.task.findFirst({
      where: {
        householdId: targetHouseholdId,
        sourceType: "INVENTORY",
        status: { in: ["PENDING", "IN_PROGRESS"] },
        title: { contains: "Replenish kitchen essentials" },
      },
    });

    if (!existing) {
      const names = urgentLowStock.slice(0, 3).map((i) => i.name).join(", ");
      const task = await createFamilyTask({
        householdId: targetHouseholdId,
        title: `Replenish kitchen essentials (${urgentLowStock.length} items low)`,
        description: `Running low on: ${names}${urgentLowStock.length > 3 ? " and others" : ""}. Review in Smart Kitchen and send order via Local Kirana/Dairy or Swiggy Instamart.`,
        priority: "HIGH",
        dueDate: new Date(Date.now() + 1 * 24 * 3600 * 1000),
        category: "Kitchen",
        sourceType: "INVENTORY",
      });
      createdTasks.push(task);
    }
  }

  return { createdTasksCount: createdTasks.length, createdTasks };
}
