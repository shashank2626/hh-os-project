import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/services/activity-service";
import { calculateDepletion } from "@/lib/services/inventory-calculator";
import {
  ExtractedAppliance,
  ExtractedReceipt,
  ExtractedUtilityBill,
} from "@/lib/validation/schemas";

export async function applyDownstreamDocumentChanges({
  documentId,
  householdId,
  docType,
  extractedData,
}: {
  documentId: string;
  householdId?: string;
  docType: string;
  extractedData: unknown;
}) {
  let targetHouseholdId = householdId;
  if (!targetHouseholdId) {
    const hh = await prisma.household.findFirst();
    targetHouseholdId = hh?.id;
  }
  if (!targetHouseholdId) throw new Error("No household found");

  if (docType === "APPLIANCE_INVOICE") {
    const data = extractedData as ExtractedAppliance;
    const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : new Date();
    const warrantyMonths = data.warrantyPeriodMonths || 12;
    const warrantyExpiresAt = new Date(purchaseDate.getTime() + warrantyMonths * 30 * 24 * 3600 * 1000);
    const serviceIntervalDays = data.recommendedServiceIntervalDays || 180;
    const nextServiceDueDate = new Date(purchaseDate.getTime() + serviceIntervalDays * 24 * 3600 * 1000);

    // 1. Create the Asset
    const asset = await prisma.asset.create({
      data: {
        householdId: targetHouseholdId,
        name: `${data.brand} ${data.model || data.applianceType}`,
        category: data.applianceType,
        brand: data.brand,
        model: data.model,
        serialNumber: data.serialNumber || `SN-${Date.now().toString().slice(-6)}`,
        purchaseDate,
        purchasePrice: data.purchasePrice,
        warrantyPeriodMonths: warrantyMonths,
        warrantyExpiresAt,
        lastServiceDate: purchaseDate,
        nextServiceDueDate,
        serviceIntervalDays,
        usageLevel: "Medium",
        healthScore: 100,
        riskLevel: "Good",
        location: data.applianceType === "AC" ? "Bedroom" : data.applianceType === "RO Water Purifier" ? "Kitchen" : "Living Area",
        technicianContact: data.serviceInformation,
        notes: `Extracted automatically from invoice: ${data.retailerOrDealer || "Retail Store"}`,
      },
    });

    // 2. Create Initial Maintenance Record
    await prisma.maintenanceRecord.create({
      data: {
        assetId: asset.id,
        serviceDate: purchaseDate,
        serviceType: "Preventive",
        provider: data.retailerOrDealer || "Authorized Brand Service",
        cost: 0,
        notes: "Appliance registered into Household OS. Initial warranty inspection and verification.",
        invoiceDocId: documentId,
      },
    });

    // 3. Create First Preventive Service Task
    await prisma.task.create({
      data: {
        householdId: targetHouseholdId,
        title: `Schedule 1st Free Service for ${asset.name}`,
        description: `Service due in ${serviceIntervalDays} days. Contact: ${data.serviceInformation || "Brand Helpline"}`,
        priority: "MEDIUM",
        dueDate: nextServiceDueDate,
        category: "Maintenance",
        aiReason: "Automatic preventive maintenance schedule generated from appliance invoice extraction.",
      },
    });

    // 4. Update Document status and log activity
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "CONFIRMED" },
    });

    await logActivity({
      householdId: targetHouseholdId,
      actionType: "ASSET_ADDED",
      title: `New Appliance Added: ${asset.name}`,
      description: `Invoice processed: ₹${data.purchasePrice.toLocaleString("en-IN")}, ${warrantyMonths}mo warranty, service scheduled for ${nextServiceDueDate.toISOString().split("T")[0]}`,
      entityType: "Asset",
      entityId: asset.id,
      actor: "Document Intelligence",
    });

    return {
      success: true,
      entityType: "Asset",
      entityId: asset.id,
      message: `Successfully created ${asset.name}, registered ${warrantyMonths}-month warranty, and scheduled next maintenance!`,
    };
  }

  if (docType === "UTILITY_BILL") {
    const data = extractedData as ExtractedUtilityBill;
    const dueDate = new Date(data.dueDate);

    // 1. Create the Bill
    const bill = await prisma.bill.create({
      data: {
        householdId: targetHouseholdId,
        title: `${data.provider} ${data.category} Bill`,
        provider: data.provider,
        category: data.category,
        amount: data.totalAmount,
        dueDate,
        paymentStatus: "PENDING",
        billNumber: data.billNumber || `BILL-${Date.now().toString().slice(-6)}`,
        referenceNumber: data.accountOrConsumerNumber,
        notes: data.notes || `Units: ${data.unitsOrUsage || "N/A"}`,
        documentId,
      },
    });

    // 2. Create Bill Payment Task
    await prisma.task.create({
      data: {
        householdId: targetHouseholdId,
        title: `Pay ${data.provider} Bill (₹${data.totalAmount.toLocaleString("en-IN")})`,
        description: `Account: ${data.accountOrConsumerNumber || "N/A"}. Due date: ${data.dueDate}`,
        priority: "HIGH",
        dueDate,
        category: "Bill Payment",
        aiReason: "Extracted from utility bill document.",
      },
    });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "CONFIRMED" },
    });

    await logActivity({
      householdId: targetHouseholdId,
      actionType: "DOCUMENT_EXTRACTED",
      title: `Bill Recorded: ${bill.title}`,
      description: `Amount: ₹${data.totalAmount.toLocaleString("en-IN")}, due on ${data.dueDate}`,
      entityType: "Bill",
      entityId: bill.id,
      actor: "Document Intelligence",
    });

    return {
      success: true,
      entityType: "Bill",
      entityId: bill.id,
      message: `Recorded ${data.provider} bill of ₹${data.totalAmount.toLocaleString("en-IN")} due on ${data.dueDate}.`,
    };
  }

  if (docType === "RECEIPT") {
    const data = extractedData as ExtractedReceipt;
    let restockedCount = 0;

    // 1. Update/Add inventory items
    for (const item of data.items) {
      const existing = await prisma.inventoryItem.findFirst({
        where: {
          householdId: targetHouseholdId,
          name: { contains: item.name },
        },
      });

      if (existing) {
        const newQty = existing.quantity + item.quantity;
        const depletion = calculateDepletion(newQty, existing.minimumStock, existing.consumptionRate);
        await prisma.inventoryItem.update({
          where: { id: existing.id },
          data: {
            quantity: newQty,
            price: item.price,
            lastPurchasedAt: new Date(data.date),
            estimatedDaysRemaining: depletion.estimatedDaysRemaining,
            isLowStock: depletion.isLowStock,
          },
        });

        await prisma.inventoryEvent.create({
          data: {
            itemId: existing.id,
            type: "RESTOCK",
            quantityChanged: item.quantity,
            newQuantity: newQty,
            notes: `Restocked from ${data.vendor} receipt`,
          },
        });
        restockedCount++;
      } else {
        const depletion = calculateDepletion(item.quantity, 1, 0.2);
        const newItem = await prisma.inventoryItem.create({
          data: {
            householdId: targetHouseholdId,
            name: item.name,
            category: item.category || "Groceries",
            quantity: item.quantity,
            unit: item.unit || "units",
            minimumStock: 1,
            consumptionRate: 0.2,
            price: item.price,
            vendor: data.vendor,
            estimatedDaysRemaining: depletion.estimatedDaysRemaining,
            isLowStock: depletion.isLowStock,
            lastPurchasedAt: new Date(data.date),
          },
        });

        await prisma.inventoryEvent.create({
          data: {
            itemId: newItem.id,
            type: "RESTOCK",
            quantityChanged: item.quantity,
            newQuantity: item.quantity,
            notes: `Added from ${data.vendor} receipt`,
          },
        });
        restockedCount++;
      }
    }

    // 2. Record Expense
    await prisma.expense.create({
      data: {
        householdId: targetHouseholdId,
        title: `${data.vendor} Quick-Commerce Restock`,
        category: "Groceries",
        amount: data.total,
        date: new Date(data.date),
        paymentMethod: data.paymentMethod || "UPI",
        vendor: data.vendor,
        receiptDocId: documentId,
      },
    });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "CONFIRMED" },
    });

    await logActivity({
      householdId: targetHouseholdId,
      actionType: "INVENTORY_UPDATED",
      title: `Inventory Restocked: ${data.vendor}`,
      description: `Updated ${restockedCount} items totaling ₹${data.total.toLocaleString("en-IN")}`,
      entityType: "Inventory",
      actor: "Document Intelligence",
    });

    return {
      success: true,
      entityType: "Inventory",
      message: `Restocked ${restockedCount} items in pantry from ${data.vendor} receipt!`,
    };
  }

  throw new Error(`Unsupported document type: ${docType}`);
}
