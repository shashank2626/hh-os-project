import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { calculateDepletion } from "@/lib/services/inventory-calculator";
import { logActivity } from "@/lib/services/activity-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const lowStockOnly = searchParams.get("lowStock") === "true";

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const whereClause: {
      householdId: string;
      category?: string;
      isLowStock?: boolean;
    } = { householdId: household.id };

    if (category && category !== "All") whereClause.category = category;
    if (lowStockOnly) whereClause.isLowStock = true;

    const items = await prisma.inventoryItem.findMany({
      where: whereClause,
      include: {
        events: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: { estimatedDaysRemaining: "asc" },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Fetch inventory error:", error);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      category = "Groceries",
      brand,
      quantity = 1,
      unit = "units",
      minimumStock = 1,
      consumptionRate = 0.2,
      preferredBrand,
      preferredPackSize,
      price = 0,
      vendor = "Blinkit",
    } = body;

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const numQty = Number(quantity);
    const numMin = Number(minimumStock);
    const numRate = Number(consumptionRate) || 0.1;
    const numPrice = Number(price) || 0;

    const depletion = calculateDepletion(numQty, numMin, numRate);

    const item = await prisma.inventoryItem.create({
      data: {
        householdId: household.id,
        name,
        category,
        brand,
        quantity: numQty,
        unit,
        minimumStock: numMin,
        consumptionRate: numRate,
        estimatedDaysRemaining: depletion.estimatedDaysRemaining,
        isLowStock: depletion.isLowStock,
        preferredBrand: preferredBrand || brand,
        preferredPackSize,
        price: numPrice,
        vendor,
        lastPurchasedAt: new Date(),
      },
    });

    await prisma.inventoryEvent.create({
      data: {
        itemId: item.id,
        type: "RESTOCK",
        quantityChanged: numQty,
        newQuantity: numQty,
        notes: `Initial stock added (${vendor})`,
      },
    });

    await logActivity({
      householdId: household.id,
      actionType: "INVENTORY_UPDATED",
      title: `Added item: ${item.name}`,
      description: `Stock: ${numQty} ${unit}, min buffer: ${numMin} ${unit}`,
      entityType: "Inventory",
      entityId: item.id,
      actor: "User",
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Add inventory item error:", error);
    return NextResponse.json({ error: "Failed to add inventory item" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, quantity, consumptionRate, minimumStock, price, vendor, notes } = body;

    if (!id) return NextResponse.json({ error: "Item ID is required" }, { status: 400 });

    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const newQty = quantity !== undefined ? Number(quantity) : existing.quantity;
    const newRate = consumptionRate !== undefined ? Number(consumptionRate) : existing.consumptionRate;
    const newMin = minimumStock !== undefined ? Number(minimumStock) : existing.minimumStock;
    const newPrice = price !== undefined ? Number(price) : existing.price;
    const newVendor = vendor !== undefined ? vendor : existing.vendor;

    const diff = newQty - existing.quantity;
    const depletion = calculateDepletion(newQty, newMin, newRate);

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        quantity: newQty,
        consumptionRate: newRate,
        minimumStock: newMin,
        price: newPrice,
        vendor: newVendor,
        estimatedDaysRemaining: depletion.estimatedDaysRemaining,
        isLowStock: depletion.isLowStock,
      },
    });

    if (diff !== 0) {
      await prisma.inventoryEvent.create({
        data: {
          itemId: id,
          type: diff > 0 ? "RESTOCK" : "CONSUMPTION",
          quantityChanged: diff,
          newQuantity: newQty,
          notes: notes || (diff > 0 ? "Restocked" : "Consumed"),
        },
      });

      await logActivity({
        householdId: existing.householdId,
        actionType: "INVENTORY_UPDATED",
        title: `Stock update: ${existing.name}`,
        description: `Adjusted to ${newQty} ${existing.unit} (~${depletion.estimatedDaysRemaining}d left)`,
        entityType: "Inventory",
        entityId: id,
        actor: "User",
      });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Update inventory error:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Item ID is required" }, { status: 400 });

    await prisma.inventoryEvent.deleteMany({ where: { itemId: id } });
    await prisma.inventoryItem.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete inventory error:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
