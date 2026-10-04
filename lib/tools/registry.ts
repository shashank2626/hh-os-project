import { prisma } from "@/lib/db/prisma";
import { calculateDepletion } from "@/lib/services/inventory-calculator";
import { calculateAssetMaintenance } from "@/lib/services/maintenance-calculator";
import { logActivity } from "@/lib/services/activity-service";
import {
  searchQuickCommerceProducts,
  compareProductOptions,
  addItemsToCart,
  getHouseholdCart,
  ProductOption,
} from "@/lib/services/quick-commerce-service";
import { executeShoppingWorkflow, parseShoppingIntent } from "@/lib/services/shopping-agent-service";
import { buildInventoryRequirement } from "@/lib/services/product-matcher";
import { getCommerceProvider } from "@/lib/integrations/commerce/provider";
import { listVendors, createServiceRequest, matchVendorForIssue } from "@/lib/services/vendor-service";
import { buildWhatsAppLink, generateRefillWhatsAppMessage } from "@/lib/utils/whatsapp";
import { createFamilyTask, generateFamilyTaskPing } from "@/lib/services/family-service";

export async function executeTool(name: string, args: Record<string, unknown> = {}) {
  // Ensure we have a household
  const household = await prisma.household.findFirst();
  const householdId = household?.id;
  if (!householdId) {
    return { error: "No household found in database" };
  }

  switch (name) {
    case "get_household_summary": {
      const [membersCount, lowStockItems, pendingBills, assets, pendingTasks] = await Promise.all([
        prisma.householdMember.count({ where: { householdId } }),
        prisma.inventoryItem.findMany({ where: { householdId, isLowStock: true } }),
        prisma.bill.findMany({ where: { householdId, paymentStatus: "PENDING" } }),
        prisma.asset.findMany({ where: { householdId } }),
        prisma.task.findMany({ where: { householdId, status: "PENDING" } }),
      ]);

      const overdueAssets = assets.filter((a) => {
        const status = calculateAssetMaintenance(a);
        return status.isOverdue;
      });

      const totalPendingBillAmount = pendingBills.reduce((acc, b) => acc + b.amount, 0);

      return {
        householdName: household.name,
        city: household.city,
        membersCount,
        lowStockCount: lowStockItems.length,
        lowStockItems: lowStockItems.map((i) => ({ name: i.name, quantity: `${i.quantity} ${i.unit}`, daysRemaining: i.estimatedDaysRemaining })),
        pendingBillsCount: pendingBills.length,
        totalPendingBillAmount,
        upcomingBills: pendingBills.map((b) => ({ title: b.title, amount: `₹${b.amount}`, dueDate: b.dueDate.toISOString().split("T")[0] })),
        totalAppliancesTracked: assets.length,
        overdueMaintenanceCount: overdueAssets.length,
        overdueAppliances: overdueAssets.map((a) => a.name),
        pendingTasksCount: pendingTasks.length,
      };
    }

    case "get_inventory": {
      const category = args.category as string | undefined;
      const whereClause = category
        ? { householdId, category: { contains: category } }
        : { householdId };
      const items = await prisma.inventoryItem.findMany({
        where: whereClause,
        orderBy: { estimatedDaysRemaining: "asc" },
      });
      return items.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unit: i.unit,
        minimumStock: i.minimumStock,
        estimatedDaysRemaining: i.estimatedDaysRemaining,
        isLowStock: i.isLowStock,
        preferredBrand: i.preferredBrand,
        preferredPackSize: i.preferredPackSize,
        price: i.price,
        vendor: i.vendor,
      }));
    }

    case "get_low_stock_items": {
      const items = await prisma.inventoryItem.findMany({
        where: {
          householdId,
          OR: [{ isLowStock: true }, { estimatedDaysRemaining: { lte: 4 } }],
        },
        orderBy: { estimatedDaysRemaining: "asc" },
      });
      return items.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        currentStock: `${i.quantity} ${i.unit}`,
        minimumStock: `${i.minimumStock} ${i.unit}`,
        consumptionRate: `${i.consumptionRate} ${i.unit}/day`,
        estimatedDaysRemaining: i.estimatedDaysRemaining,
        preferredPackSize: i.preferredPackSize,
        preferredBrand: i.preferredBrand,
        estimatedPrice: `₹${i.price}`,
        vendor: i.vendor,
      }));
    }

    case "get_upcoming_bills": {
      const status = (args.status as string) || "PENDING";
      const whereClause: { householdId: string; paymentStatus?: string } = { householdId };
      if (status !== "ALL") {
        whereClause.paymentStatus = status;
      }
      const bills = await prisma.bill.findMany({
        where: whereClause,
        orderBy: { dueDate: "asc" },
      });
      return bills.map((b) => ({
        id: b.id,
        title: b.title,
        provider: b.provider,
        category: b.category,
        amount: b.amount,
        formattedAmount: `₹${b.amount.toLocaleString("en-IN")}`,
        dueDate: b.dueDate.toISOString().split("T")[0],
        status: b.paymentStatus,
        paymentMethod: b.paymentMethod,
        autoPay: b.autoPay,
        notes: b.notes,
      }));
    }

    case "get_household_expenses": {
      const category = args.category as string | undefined;
      const whereClause = category
        ? { householdId, category: { contains: category } }
        : { householdId };
      const expenses = await prisma.expense.findMany({
        where: whereClause,
        orderBy: { date: "desc" },
        take: 15,
      });
      return expenses.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: e.amount,
        formattedAmount: `₹${e.amount.toLocaleString("en-IN")}`,
        date: e.date.toISOString().split("T")[0],
        paidBy: e.paidBy,
        paymentMethod: e.paymentMethod,
        isAnomaly: e.isAnomaly,
        anomalyReason: e.anomalyReason,
      }));
    }

    case "get_appliances": {
      const assets = await prisma.asset.findMany({
        where: { householdId },
        orderBy: { healthScore: "asc" },
      });
      return assets.map((a) => {
        const maintenance = calculateAssetMaintenance(a);
        return {
          id: a.id,
          name: a.name,
          category: a.category,
          brand: a.brand,
          location: a.location,
          healthScore: maintenance.healthScore,
          riskLevel: maintenance.riskLevel,
          daysSinceLastService: maintenance.daysSinceLastService,
          daysUntilNextService: maintenance.daysUntilNextService,
          isOverdue: maintenance.isOverdue,
          warrantyStatus: maintenance.warrantyStatus.label,
          explanation: maintenance.explanation,
        };
      });
    }

    case "get_maintenance_schedule": {
      const assets = await prisma.asset.findMany({
        where: { householdId },
      });
      const schedules = assets.map((a) => calculateAssetMaintenance(a));
      return schedules.sort((a, b) => a.daysUntilNextService - b.daysUntilNextService);
    }

    case "get_family_members": {
      const members = await prisma.householdMember.findMany({
        where: { householdId },
        include: {
          tasks: {
            where: { status: "PENDING" },
            select: { id: true, title: true, priority: true },
          },
        },
      });
      return members.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role,
        phone: m.phone,
        availability: m.availability,
        responsibilities: m.responsibilities,
        preferences: m.preferences,
        pendingTasksCount: m.tasks.length,
        currentTasks: m.tasks.map((t) => t.title),
      }));
    }

    case "get_pending_tasks": {
      const priority = args.priority as string | undefined;
      const whereClause: { householdId: string; status: string; priority?: string } = {
        householdId,
        status: "PENDING",
      };
      if (priority) whereClause.priority = priority;

      const tasks = await prisma.task.findMany({
        where: whereClause,
        include: { assignedMember: { select: { name: true } } },
        orderBy: { priority: "desc" },
      });
      return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString().split("T")[0] || "No date set",
        assignedTo: t.assignedMember?.name || "Unassigned",
        category: t.category,
        aiRecommendation: t.aiReason,
      }));
    }

    case "create_task": {
      const title = args.title as string;
      const description = (args.description as string) || null;
      const priority = (args.priority as string) || "MEDIUM";
      const category = (args.category as string) || "General";
      const dueDate = args.dueDate ? new Date(args.dueDate as string) : null;
      const assignedMemberName = args.assignedMemberName as string | undefined;

      let assignedMemberId: string | null = null;
      if (assignedMemberName) {
        const member = await prisma.householdMember.findFirst({
          where: { householdId, name: { contains: assignedMemberName } },
        });
        if (member) assignedMemberId = member.id;
      }

      const task = await prisma.task.create({
        data: {
          householdId,
          title,
          description,
          priority,
          category,
          dueDate,
          assignedMemberId,
        },
      });

      await logActivity({
        householdId,
        actionType: "TASK_ASSIGNED",
        title: `Task created: ${title}`,
        description: assignedMemberName ? `Assigned to ${assignedMemberName}` : "Added to pending household tasks",
        entityType: "Task",
        entityId: task.id,
        actor: "AI Assistant",
      });

      return {
        success: true,
        message: `Task "${title}" created successfully in the household planner.`,
        task,
      };
    }

    case "assign_task": {
      const taskId = args.taskId as string;
      const memberName = args.memberName as string;

      const member = await prisma.householdMember.findFirst({
        where: { householdId, name: { contains: memberName } },
      });

      if (!member) {
        return { error: `Family member "${memberName}" not found in this household.` };
      }

      const updated = await prisma.task.update({
        where: { id: taskId },
        data: { assignedMemberId: member.id },
      });

      await logActivity({
        householdId,
        actionType: "TASK_ASSIGNED",
        title: `Task reassigned: ${updated.title}`,
        description: `Handed over to ${member.name}`,
        entityType: "Task",
        entityId: updated.id,
        actor: "AI Assistant",
      });

      return {
        success: true,
        message: `Task "${updated.title}" assigned to ${member.name}.`,
      };
    }

    case "update_inventory": {
      const itemId = args.itemId as string;
      const newQuantity = Number(args.newQuantity);
      const notes = (args.notes as string) || "Updated by AI Assistant";

      const item = await prisma.inventoryItem.findFirst({
        where: {
          householdId,
          OR: [{ id: itemId }, { name: { contains: itemId } }],
        },
      });

      if (!item) return { error: `Inventory item "${itemId}" not found.` };

      const diff = newQuantity - item.quantity;
      const depletion = calculateDepletion(newQuantity, item.minimumStock, item.consumptionRate);

      const updated = await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          quantity: newQuantity,
          estimatedDaysRemaining: depletion.estimatedDaysRemaining,
          isLowStock: depletion.isLowStock,
        },
      });

      await prisma.inventoryEvent.create({
        data: {
          itemId: updated.id,
          type: diff >= 0 ? "RESTOCK" : "CONSUMPTION",
          quantityChanged: diff,
          newQuantity,
          notes,
        },
      });

      await logActivity({
        householdId,
        actionType: "INVENTORY_UPDATED",
        title: `Updated stock: ${item.name}`,
        description: `New stock level: ${newQuantity} ${item.unit} (~${depletion.estimatedDaysRemaining} days remaining)`,
        entityType: "Inventory",
        entityId: item.id,
        actor: "AI Assistant",
      });

      return {
        success: true,
        message: `Inventory for ${item.name} updated to ${newQuantity} ${item.unit}. Estimated days remaining: ${depletion.estimatedDaysRemaining} days.`,
        item: updated,
      };
    }

    case "schedule_maintenance": {
      const assetNameOrId = args.assetNameOrId as string;
      const serviceType = (args.serviceType as string) || "Preventive";
      const serviceDate = args.serviceDate ? new Date(args.serviceDate as string) : new Date();
      const provider = (args.provider as string) || "Urban Company";

      const asset = await prisma.asset.findFirst({
        where: {
          householdId,
          OR: [{ id: assetNameOrId }, { name: { contains: assetNameOrId } }],
        },
      });

      if (!asset) return { error: `Appliance "${assetNameOrId}" not found.` };

      // Log maintenance record
      const record = await prisma.maintenanceRecord.create({
        data: {
          assetId: asset.id,
          serviceDate,
          serviceType,
          provider,
          notes: `Scheduled via Household OS assistant.`,
        },
      });

      // Update asset health & next due date
      const nextDue = new Date(serviceDate.getTime() + asset.serviceIntervalDays * 24 * 3600 * 1000);
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          lastServiceDate: serviceDate,
          nextServiceDueDate: nextDue,
          healthScore: 95,
          riskLevel: "Good",
        },
      });

      await logActivity({
        householdId,
        actionType: "MAINTENANCE_SCHEDULED",
        title: `Service logged: ${asset.name}`,
        description: `${serviceType} by ${provider} on ${serviceDate.toISOString().split("T")[0]}`,
        entityType: "Asset",
        entityId: asset.id,
        actor: "AI Assistant",
      });

      return {
        success: true,
        message: `Maintenance recorded for ${asset.name}. Next service scheduled for ${nextDue.toISOString().split("T")[0]}. Appliance health restored to 95%.`,
        record,
      };
    }

    case "mark_bill_paid": {
      const billIdOrTitle = args.billIdOrTitle as string;
      const paymentMethod = (args.paymentMethod as string) || "UPI";

      const bill = await prisma.bill.findFirst({
        where: {
          householdId,
          OR: [{ id: billIdOrTitle }, { title: { contains: billIdOrTitle } }],
        },
      });

      if (!bill) return { error: `Bill "${billIdOrTitle}" not found.` };

      const updated = await prisma.bill.update({
        where: { id: bill.id },
        data: {
          paymentStatus: "PAID",
          paidAt: new Date(),
          paymentMethod,
        },
      });

      // Also create an Expense entry
      await prisma.expense.create({
        data: {
          householdId,
          title: `Bill Paid: ${bill.title}`,
          category: bill.category === "Electricity" || bill.category === "Gas/LPG" || bill.category === "Water" ? "Utilities" : bill.category,
          amount: bill.amount,
          paymentMethod,
          paidBy: "Ayush Sharma",
          vendor: bill.provider,
          isAnomaly: false,
        },
      });

      await logActivity({
        householdId,
        actionType: "BILL_PAID",
        title: `Bill Paid: ${bill.title}`,
        description: `Amount of ₹${bill.amount.toLocaleString("en-IN")} settled via ${paymentMethod}`,
        entityType: "Bill",
        entityId: bill.id,
        actor: "AI Assistant",
      });

      return {
        success: true,
        message: `Bill "${bill.title}" marked as PAID (₹${bill.amount.toLocaleString("en-IN")}) via ${paymentMethod}.`,
      };
    }

    case "create_purchase_recommendation": {
      const product = args.product as string;
      const quantity = args.quantity as string;
      const estimatedPrice = Number(args.estimatedPrice) || 0;
      const reason = args.reason as string;
      const retailer = (args.retailer as string) || "Blinkit";

      const rec = await prisma.recommendation.create({
        data: {
          householdId,
          type: "PROCUREMENT",
          title: `Restock ${product} (${quantity})`,
          description: `Recommended purchase for household pantry`,
          reason,
          urgency: "HIGH",
          status: "PENDING",
          estimatedCost: estimatedPrice,
          metadata: JSON.stringify({
            product,
            quantity,
            estimatedPrice,
            retailer,
            retailerUrl: `https://${retailer.toLowerCase().includes("zepto") ? "zeptonow.com" : "blinkit.com"}/s/?q=${encodeURIComponent(product)}`,
          }),
        },
      });

      await logActivity({
        householdId,
        actionType: "RECOMMENDATION_APPROVED",
        title: `Procurement recommendation generated`,
        description: `Added "${product}" to shopping list recommendations`,
        entityType: "Recommendation",
        entityId: rec.id,
        actor: "AI Assistant",
      });

      return {
        success: true,
        message: `Recommendation created for ${product} (${quantity}) at ₹${estimatedPrice} on ${retailer}.`,
        recommendation: rec,
      };
    }

    case "search_products": {
      const query = (args.query as string) || "grocery";
      const category = args.category as string | undefined;
      try {
        const options = await searchQuickCommerceProducts(query, category, householdId);
        return { query, count: options.length, options };
      } catch (err: any) {
        return {
          query,
          count: 0,
          options: [],
          message: err.message || "Failed to search quick-commerce catalog",
          authenticated: false,
          authUrl: "/api/auth/swiggy/connect",
        };
      }
    }

    case "compare_products": {
      const itemName = args.itemName as string;
      const requiredQuantity = Number(args.requiredQuantity) || 1;
      const unit = (args.unit as string) || "units";
      let options = (args.options as ProductOption[]) || [];
      if (options.length === 0) {
        try {
          options = await searchQuickCommerceProducts(itemName, undefined, householdId);
        } catch {
          return { error: `Cannot search options for ${itemName}. Swiggy Instamart is not connected.` };
        }
      }
      const comparison = compareProductOptions(itemName, requiredQuantity, unit, options);
      return comparison;
    }

    case "add_to_cart": {
      const rawItems = (args.items as Array<Record<string, unknown>>) || [];
      const formattedItems = rawItems.map((it) => ({
        productName: String(it.productName || "Item"),
        brand: it.brand ? String(it.brand) : undefined,
        packSize: String(it.packSize || "Standard"),
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        totalPrice: Number(it.totalPrice) || Number(it.unitPrice) || 0,
        retailer: (it.retailer as string) || "Swiggy Instamart",
        retailerUrl: it.retailerUrl ? String(it.retailerUrl) : "https://www.swiggy.com/instamart",
        valueScore: it.valueScore ? String(it.valueScore) : undefined,
        comparisonNotes: it.comparisonNotes ? String(it.comparisonNotes) : undefined,
      }));

      const added = await addItemsToCart(formattedItems, householdId);
      const cart = await getHouseholdCart(householdId);

      return {
        success: true,
        message: `Added ${added.length} items to household replenishment cart.`,
        cart,
      };
    }

    case "refill_inventory": {
      // Delegates to the real Swiggy Instamart shopping workflow
      const result = await executeShoppingWorkflow({
        request: "Refill inventory",
        refillLowStock: true,
        householdId,
      });

      if (result.success) {
        await logActivity({
          householdId,
          actionType: "INVENTORY_UPDATED",
          title: `Refill Cart Prepared on Instamart`,
          description: `Prepared live Instamart cart with ${result.merchantCart?.itemCount || 0} items. Total est: ₹${result.totalEstimatedCost}.`,
          entityType: "Inventory",
          actor: "AI Assistant",
        });
      }

      return result;
    }

    case "shop_for_items": {
      const userRequest = (args.request as string) || "Refill inventory";
      const refillLowStock = args.refillLowStock as boolean | undefined;
      const rawItems = (args.items as Array<Record<string, unknown>>) || [];
      const explicitItems = rawItems.map((it) => ({
        query: String(it.productName || it.query || ""),
        brand: it.brand ? String(it.brand) : undefined,
        maxBudget: it.maxBudget ? Number(it.maxBudget) : undefined,
        quantity: it.quantity ? Number(it.quantity) : undefined,
        preference: (it.preference as any) || undefined,
      })).filter((it) => Boolean(it.query));

      const result = await executeShoppingWorkflow({
        request: userRequest,
        refillLowStock,
        explicitItems: explicitItems.length > 0 ? explicitItems : undefined,
        householdId,
      });

      if (result.success) {
        await logActivity({
          householdId,
          actionType: "INVENTORY_UPDATED",
          title: `Shopping Cart Updated on Instamart`,
          description: `Processed request "${userRequest}". Live Instamart cart total: ₹${result.totalEstimatedCost}.`,
          entityType: "Procurement",
          actor: "AI Assistant",
        });
      }

      return result;
    }

    case "get_inventory_needing_refill": {
      const items = await prisma.inventoryItem.findMany({
        where: {
          householdId,
          OR: [
            { isLowStock: true },
            { estimatedDaysRemaining: { lte: 4 } },
            { quantity: { lte: 2 } },
          ],
        },
        orderBy: [{ estimatedDaysRemaining: "asc" }, { quantity: "asc" }],
      });
      return items.map((i) => buildInventoryRequirement(i));
    }

    case "get_inventory_item": {
      const id = args.id as string | undefined;
      const name = args.name as string | undefined;
      const item = await prisma.inventoryItem.findFirst({
        where: {
          householdId,
          OR: [
            id ? { id } : {},
            name ? { name: { contains: name } } : {},
          ],
        },
      });
      return item ? buildInventoryRequirement(item) : { error: "Item not found in inventory" };
    }

    case "get_household_inventory": {
      const items = await prisma.inventoryItem.findMany({
        where: { householdId },
        orderBy: { name: "asc" },
      });
      return items.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        brand: i.brand,
        currentStock: `${i.quantity} ${i.unit}`,
        minimumStock: `${i.minimumStock} ${i.unit}`,
        isLowStock: i.isLowStock,
        estimatedDaysRemaining: i.estimatedDaysRemaining,
      }));
    }

    case "build_refill_plan": {
      const userRequest = (args.request as string) || "Refill inventory";
      return await executeShoppingWorkflow({
        request: userRequest,
        refillLowStock: true,
        householdId,
      });
    }

    case "parse_shopping_request": {
      const userRequest = (args.request as string) || "";
      return parseShoppingIntent(userRequest);
    }

    case "get_instamart_cart": {
      const provider = await getCommerceProvider(householdId);
      return await provider.getCart();
    }

    case "remove_from_shopping_session": {
      const cartItemId = args.cartItemId as string;
      if (!cartItemId) return { error: "cartItemId required" };
      await prisma.cartItem.delete({ where: { id: cartItemId } });
      const provider = await getCommerceProvider(householdId);
      return await provider.getCart();
    }

    case "get_local_vendors": {
      const category = args.category as string | undefined;
      const vendors = await listVendors(householdId, { category });
      return { count: vendors.length, vendors };
    }

    case "order_from_local_vendor": {
      const vendorName = args.vendorName as string | undefined;
      const rawItems = (args.items as Array<{ name: string; quantity: string }>) || [];
      const vendors = await listVendors(householdId);

      let targetVendor = vendors.find(
        (v) =>
          (vendorName && (v.name.toLowerCase().includes(vendorName.toLowerCase()) || (v.businessName && v.businessName.toLowerCase().includes(vendorName.toLowerCase())))) ||
          v.isFavourite
      ) || vendors[0];

      if (!targetVendor) {
        return { error: "No local vendor found in household database" };
      }

      const formattedItems = rawItems.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: "",
      }));

      const message = generateRefillWhatsAppMessage({
        vendorName: targetVendor.name,
        flatDetails: "Flat 402, Palm Heights",
        items: formattedItems,
      });

      const whatsappUrl = buildWhatsAppLink(targetVendor.whatsappNumber || targetVendor.phone, message);

      return {
        success: true,
        vendor: {
          name: targetVendor.name,
          businessName: targetVendor.businessName,
          phone: targetVendor.phone,
        },
        whatsappUrl,
        whatsappMessage: message,
      };
    }

    case "request_vendor_service": {
      const category = (args.category as string) || "General";
      const issue = (args.issue as string) || "Maintenance required";
      const assetName = args.assetName as string | undefined;
      const preferredTime = args.preferredTime as string | undefined;

      const match = await matchVendorForIssue(`${category} ${issue}`, householdId);
      if (!match.primaryVendor) {
        return { error: "Could not find a suitable local technician for this issue" };
      }

      const reqResult = await createServiceRequest({
        householdId,
        vendorId: match.primaryVendor.id,
        issue: assetName ? `[${assetName}] ${issue}` : issue,
        category: match.matchedCategory,
        preferredTime,
      });

      return {
        success: true,
        vendor: {
          name: match.primaryVendor.name,
          businessName: match.primaryVendor.businessName,
          category: match.primaryVendor.category,
        },
        serviceRequestId: reqResult.serviceRequest.id,
        whatsappUrl: reqResult.whatsappUrl,
        whatsappMessage: reqResult.whatsappMessage,
      };
    }

    case "assign_household_task": {
      const title = args.title as string;
      const description = args.description as string | undefined;
      const category = (args.category as string) || "General";
      const priority = (args.priority as any) || "MEDIUM";
      const assigneeName = args.assigneeName as string | undefined;

      let assignedMemberId = undefined;
      if (assigneeName) {
        const member = await prisma.householdMember.findFirst({
          where: {
            householdId,
            name: { contains: assigneeName },
          },
        });
        if (member) assignedMemberId = member.id;
      }

      const task = await createFamilyTask({
        householdId,
        title,
        description,
        category,
        priority,
        assignedMemberId,
      });

      return {
        success: true,
        task: {
          id: task.id,
          title: task.title,
          priority: task.priority,
          assignedTo: task.assignedMember?.name,
          aiReason: task.aiReason,
        },
      };
    }

    case "send_family_task_ping": {
      const taskId = args.taskId as string | undefined;
      const memberName = args.memberName as string | undefined;

      let targetTask = null;
      if (taskId) {
        targetTask = await prisma.task.findUnique({
          where: { id: taskId },
          include: { assignedMember: true },
        });
      } else if (memberName) {
        targetTask = await prisma.task.findFirst({
          where: {
            householdId,
            status: { in: ["PENDING", "IN_PROGRESS"] },
            assignedMember: { name: { contains: memberName } },
          },
          include: { assignedMember: true },
          orderBy: { priority: "desc" },
        });
      } else {
        // Pick the top urgent pending task
        targetTask = await prisma.task.findFirst({
          where: {
            householdId,
            status: { in: ["PENDING", "IN_PROGRESS"] },
            priority: { in: ["URGENT", "HIGH"] },
            assignedMemberId: { not: null },
          },
          include: { assignedMember: true },
          orderBy: { priority: "desc" },
        });
      }

      if (!targetTask || !targetTask.assignedMember) {
        return { error: "No pending assigned task found to ping" };
      }

      const ping = await generateFamilyTaskPing(targetTask.id);
      return {
        success: true,
        ping,
      };
    }

    default:
      return { error: `Tool ${name} is not recognized` };
  }
}
