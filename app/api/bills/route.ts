import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/services/activity-service";

export async function GET() {
  try {
    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const bills = await prisma.bill.findMany({
      where: { householdId: household.id },
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json({ bills });
  } catch (error) {
    console.error("Fetch bills error:", error);
    return NextResponse.json({ error: "Failed to fetch bills" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, provider, category, amount, dueDate, paymentMethod = "UPI", autoPay = false, referenceNumber, notes } = body;

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const bill = await prisma.bill.create({
      data: {
        householdId: household.id,
        title,
        provider,
        category,
        amount: Number(amount),
        dueDate: new Date(dueDate),
        paymentMethod,
        autoPay: Boolean(autoPay),
        referenceNumber,
        notes,
      },
    });

    await logActivity({
      householdId: household.id,
      actionType: "DOCUMENT_EXTRACTED",
      title: `Bill Added: ${title}`,
      description: `₹${Number(amount).toLocaleString("en-IN")} due on ${dueDate}`,
      entityType: "Bill",
      entityId: bill.id,
      actor: "User",
    });

    return NextResponse.json({ success: true, bill });
  } catch (error) {
    console.error("Create bill error:", error);
    return NextResponse.json({ error: "Failed to create bill" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, paymentMethod = "UPI" } = body;

    if (!id) return NextResponse.json({ error: "Bill ID is required" }, { status: 400 });

    const bill = await prisma.bill.findUnique({ where: { id } });
    if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

    const updated = await prisma.bill.update({
      where: { id },
      data: {
        paymentStatus: "PAID",
        paidAt: new Date(),
        paymentMethod,
      },
    });

    // Create corresponding Expense entry
    await prisma.expense.create({
      data: {
        householdId: bill.householdId,
        title: `Bill Paid: ${bill.title}`,
        category: "Utilities",
        amount: bill.amount,
        paymentMethod,
        paidBy: "Ayush Sharma",
        vendor: bill.provider,
        isAnomaly: false,
      },
    });

    await logActivity({
      householdId: bill.householdId,
      actionType: "BILL_PAID",
      title: `Bill Settled: ${bill.title}`,
      description: `Paid ₹${bill.amount.toLocaleString("en-IN")} via ${paymentMethod}`,
      entityType: "Bill",
      entityId: bill.id,
      actor: "User",
    });

    return NextResponse.json({ success: true, bill: updated });
  } catch (error) {
    console.error("Mark bill paid error:", error);
    return NextResponse.json({ error: "Failed to mark bill as paid" }, { status: 500 });
  }
}
