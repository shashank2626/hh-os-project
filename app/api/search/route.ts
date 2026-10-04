import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const household = await prisma.household.findFirst();
    if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

    const [inventory, assets, bills, tasks, documents] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: {
          householdId: household.id,
          OR: [
            { name: { contains: q } },
            { category: { contains: q } },
            { brand: { contains: q } },
          ],
        },
        take: 4,
      }),
      prisma.asset.findMany({
        where: {
          householdId: household.id,
          OR: [
            { name: { contains: q } },
            { brand: { contains: q } },
            { location: { contains: q } },
          ],
        },
        take: 4,
      }),
      prisma.bill.findMany({
        where: {
          householdId: household.id,
          OR: [
            { title: { contains: q } },
            { provider: { contains: q } },
          ],
        },
        take: 4,
      }),
      prisma.task.findMany({
        where: {
          householdId: household.id,
          OR: [
            { title: { contains: q } },
            { category: { contains: q } },
          ],
        },
        take: 4,
      }),
      prisma.document.findMany({
        where: {
          householdId: household.id,
          OR: [
            { title: { contains: q } },
            { docType: { contains: q } },
          ],
        },
        take: 4,
      }),
    ]);

    const results = [
      ...inventory.map((i) => ({
        id: i.id,
        title: i.name,
        subtitle: `${i.quantity} ${i.unit} (${i.category})`,
        type: "Inventory",
        url: `/inventory/${i.id}`,
      })),
      ...assets.map((a) => ({
        id: a.id,
        title: a.name,
        subtitle: `${a.brand} • ${a.location} (Health: ${a.healthScore}%)`,
        type: "Appliance",
        url: `/assets/${a.id}`,
      })),
      ...bills.map((b) => ({
        id: b.id,
        title: b.title,
        subtitle: `₹${b.amount.toLocaleString("en-IN")} • ${b.paymentStatus}`,
        type: "Bill",
        url: `/bills`,
      })),
      ...tasks.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: `Priority: ${t.priority} • ${t.status}`,
        type: "Task",
        url: `/tasks`,
      })),
      ...documents.map((d) => ({
        id: d.id,
        title: d.title,
        subtitle: `${d.docType} (${d.status})`,
        type: "Document",
        url: `/documents/${d.id}`,
      })),
    ];

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}
