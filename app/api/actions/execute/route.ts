import { NextRequest, NextResponse } from "next/server";
import { executeTool } from "@/lib/tools/registry";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/services/activity-service";

export async function POST(req: NextRequest) {
  try {
    const { actionType, payload } = await req.json();

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    switch (actionType) {
      case "PAY_BILL": {
        const result = await executeTool("mark_bill_paid", payload);
        return NextResponse.json({ success: true, result });
      }

      case "SCHEDULE_MAINTENANCE": {
        const result = await executeTool("schedule_maintenance", payload);
        return NextResponse.json({ success: true, result });
      }

      case "RESTOCK_GROCERIES":
      case "PROCUREMENT_BATCH": {
        // Restock all low items
        const lowItems = await prisma.inventoryItem.findMany({
          where: {
            householdId: household.id,
            OR: [{ isLowStock: true }, { estimatedDaysRemaining: { lte: 3 } }],
          },
        });

        for (const item of lowItems) {
          const add = item.unit === "kg" ? 5 : item.unit === "L" ? 2 : 2;
          await prisma.inventoryItem.update({
            where: { id: item.id },
            data: {
              quantity: item.quantity + add,
              isLowStock: false,
              estimatedDaysRemaining: Math.floor((item.quantity + add) / (item.consumptionRate || 0.1)),
            },
          });
        }

        await logActivity({
          householdId: household.id,
          actionType: "INVENTORY_UPDATED",
          title: "Batch Restock Executed",
          description: `Restocked ${lowItems.length} pantry items from AI recommendation`,
          entityType: "Inventory",
          actor: "AI Assistant",
        });

        return NextResponse.json({
          success: true,
          message: `Successfully restocked ${lowItems.length} grocery items!`,
        });
      }

      case "HANDLE_ALL_4": {
        // 1. Pay electricity bill
        const powerBill = await prisma.bill.findFirst({
          where: { householdId: household.id, title: { contains: "Tata Power" } },
        });
        if (powerBill) {
          await executeTool("mark_bill_paid", { billIdOrTitle: powerBill.id, paymentMethod: "UPI" });
        }

        // 2. Schedule Kent RO
        await executeTool("schedule_maintenance", {
          assetNameOrId: "Kent",
          serviceType: "Filter Replacement",
          provider: "Urban Company",
        });

        // 3. Restock low items
        const low = await prisma.inventoryItem.findMany({
          where: { householdId: household.id, isLowStock: true },
        });
        for (const it of low) {
          await prisma.inventoryItem.update({
            where: { id: it.id },
            data: { quantity: it.quantity + 2, isLowStock: false },
          });
        }

        // 4. Assign grocery task
        const groceryTask = await prisma.task.findFirst({
          where: { householdId: household.id, title: { contains: "grocery" } },
        });
        const priya = await prisma.householdMember.findFirst({
          where: { householdId: household.id, name: { contains: "Priya" } },
        });
        if (groceryTask && priya) {
          await executeTool("assign_task", { taskId: groceryTask.id, memberName: priya.name });
        }

        await logActivity({
          householdId: household.id,
          actionType: "RECOMMENDATION_APPROVED",
          title: "Executed All 4 Action Items",
          description: "Paid Tata Power bill, scheduled Kent RO service, restocked pantry, assigned grocery task to Priya.",
          actor: "AI Assistant",
        });

        return NextResponse.json({
          success: true,
          message: "All 4 critical household items have been resolved and updated in the database!",
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${actionType}` }, { status: 400 });
    }
  } catch (error) {
    console.error("Execute action error:", error);
    return NextResponse.json({ error: "Failed to execute action" }, { status: 500 });
  }
}
