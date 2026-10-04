import { prisma } from "@/lib/db/prisma";

export async function logActivity({
  householdId,
  actionType,
  title,
  description,
  entityType,
  entityId,
  actor = "System",
  metadata,
}: {
  householdId?: string;
  actionType: string;
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  actor?: string;
  metadata?: Record<string, unknown> | string;
}) {
  try {
    let targetHouseholdId = householdId;
    if (!targetHouseholdId) {
      const firstHousehold = await prisma.household.findFirst({ select: { id: true } });
      targetHouseholdId = firstHousehold?.id;
    }

    if (!targetHouseholdId) return null;

    const metaString =
      typeof metadata === "object" ? JSON.stringify(metadata) : metadata || null;

    return await prisma.activityLog.create({
      data: {
        householdId: targetHouseholdId,
        actionType,
        title,
        description,
        entityType,
        entityId,
        actor,
        metadata: metaString,
      },
    });
  } catch (error) {
    console.error("Failed to log activity event:", error);
    return null;
  }
}
