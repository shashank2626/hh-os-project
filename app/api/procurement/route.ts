import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateProcurementRecommendation } from "@/lib/services/inventory-calculator";
import { logActivity } from "@/lib/services/activity-service";

export async function GET() {
  try {
    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    // Fetch low stock items and items with estimated days <= 5
    const items = await prisma.inventoryItem.findMany({
      where: {
        householdId: household.id,
        OR: [{ isLowStock: true }, { estimatedDaysRemaining: { lte: 6 } }],
      },
      orderBy: { estimatedDaysRemaining: "asc" },
    });

    // Generate dynamic procurement recommendations
    const dynamicRecommendations = items.map((item) =>
      generateProcurementRecommendation(item)
    );

    // Also fetch persisted recommendations
    const persisted = await prisma.recommendation.findMany({
      where: { householdId: household.id, type: "PROCUREMENT" },
      orderBy: { createdAt: "desc" },
    });

    const totalEstimatedCart = dynamicRecommendations.reduce(
      (sum, r) => sum + (r.estimatedPrice || 0),
      0
    );

    return NextResponse.json({
      recommendations: dynamicRecommendations,
      persistedRecommendations: persisted,
      totalEstimatedCart,
      count: dynamicRecommendations.length,
    });
  } catch (error) {
    console.error("Fetch procurement recommendations error:", error);
    return NextResponse.json({ error: "Failed to fetch procurement" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, itemId, quantity, price, vendor, notes } = body;

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    if (action === "RESTOCK_BOUGHT") {
      const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

      const addQty = Number(quantity) || (item.unit === "kg" ? 5 : item.unit === "L" ? 2 : 1);
      const newQty = item.quantity + addQty;
      const daysLeft = Math.floor(newQty / (item.consumptionRate || 0.1));

      await prisma.inventoryItem.update({
        where: { id: itemId },
        data: {
          quantity: newQty,
          estimatedDaysRemaining: daysLeft,
          isLowStock: false,
          lastPurchasedAt: new Date(),
        },
      });

      await prisma.inventoryEvent.create({
        data: {
          itemId,
          type: "RESTOCK",
          quantityChanged: addQty,
          newQuantity: newQty,
          notes: notes || `Restocked via Procurement (${vendor || item.vendor})`,
        },
      });

      const expAmount = Number(price) || item.price || 200;
      await prisma.expense.create({
        data: {
          householdId: household.id,
          title: `Procurement: ${item.name}`,
          category: "Groceries",
          amount: expAmount,
          vendor: vendor || item.vendor || "Blinkit",
          paymentMethod: "UPI",
        },
      });

      await logActivity({
        householdId: household.id,
        actionType: "INVENTORY_UPDATED",
        title: `Procurement Fulfilled: ${item.name}`,
        description: `Added ${addQty} ${item.unit} (${vendor || "Quick Commerce"}). Expense ₹${expAmount} logged.`,
        entityType: "Inventory",
        entityId: item.id,
        actor: "User",
      });

      return NextResponse.json({
        success: true,
        message: `Successfully restocked ${item.name} (+${addQty} ${item.unit})!`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Procurement action error:", error);
    return NextResponse.json({ error: "Failed to execute procurement action" }, { status: 500 });
  }
}
