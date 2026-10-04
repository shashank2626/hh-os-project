import { prisma } from "@/lib/db/prisma";
import { logActivity } from "@/lib/services/activity-service";
import { buildWhatsAppLink, generateServiceRequestWhatsAppMessage } from "@/lib/utils/whatsapp";

export interface VendorFilterOptions {
  category?: string;
  search?: string;
  favouritesOnly?: boolean;
}

export async function getHouseholdId(preferredId?: string): Promise<string> {
  if (preferredId) return preferredId;
  const household = await prisma.household.findFirst({ select: { id: true } });
  if (!household) throw new Error("No household found in database");
  return household.id;
}

export async function listVendors(householdId?: string, options?: VendorFilterOptions) {
  const targetHouseholdId = await getHouseholdId(householdId);

  const where: any = { householdId: targetHouseholdId };

  if (options?.category && options.category !== "ALL") {
    where.category = options.category;
  }

  if (options?.favouritesOnly) {
    where.isFavourite = true;
  }

  if (options?.search) {
    const s = options.search.toLowerCase();
    where.OR = [
      { name: { contains: s } },
      { businessName: { contains: s } },
      { category: { contains: s } },
      { services: { contains: s } },
      { area: { contains: s } },
    ];
  }

  return await prisma.vendor.findMany({
    where,
    orderBy: [{ isFavourite: "desc" }, { rating: "desc" }, { name: "asc" }],
    include: {
      serviceRequests: {
        take: 3,
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getVendorById(id: string) {
  return await prisma.vendor.findUnique({
    where: { id },
    include: {
      serviceRequests: {
        orderBy: { createdAt: "desc" },
        include: { asset: true },
      },
      contactLogs: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
}

export async function createVendor(data: {
  householdId?: string;
  name: string;
  businessName?: string;
  category: string;
  phone: string;
  whatsappNumber?: string;
  address?: string;
  area?: string;
  city?: string;
  services?: string;
  notes?: string;
  rating?: number;
  isFavourite?: boolean;
  isTrusted?: boolean;
}) {
  const targetHouseholdId = await getHouseholdId(data.householdId);

  const vendor = await prisma.vendor.create({
    data: {
      ...data,
      householdId: targetHouseholdId,
      whatsappNumber: data.whatsappNumber || data.phone,
    },
  });

  await logActivity({
    householdId: targetHouseholdId,
    actionType: "VENDOR_ADDED",
    title: `Added local vendor: ${vendor.businessName || vendor.name}`,
    description: `Registered ${vendor.category} provider (${vendor.name}, ${vendor.phone}) to household network.`,
    entityType: "Vendor",
    entityId: vendor.id,
    actor: "User",
  });

  return vendor;
}

export async function updateVendor(id: string, data: any) {
  const updated = await prisma.vendor.update({
    where: { id },
    data,
  });

  return updated;
}

export async function deleteVendor(id: string) {
  return await prisma.vendor.delete({
    where: { id },
  });
}

export async function logVendorContact({
  householdId,
  vendorId,
  actionType,
  context,
  messageSent,
}: {
  householdId?: string;
  vendorId: string;
  actionType: "WHATSAPP_OPENED" | "CALL_INITIATED" | "SERVICE_REQUESTED";
  context?: string;
  messageSent?: string;
}) {
  const targetHouseholdId = await getHouseholdId(householdId);

  const log = await prisma.vendorContactLog.create({
    data: {
      householdId: targetHouseholdId,
      vendorId,
      actionType,
      context,
      messageSent,
    },
    include: {
      vendor: true,
    },
  });

  await logActivity({
    householdId: targetHouseholdId,
    actionType: `VENDOR_${actionType}`,
    title: `Contacted vendor: ${log.vendor.businessName || log.vendor.name}`,
    description: `Initiated ${actionType.replace("_", " ").toLowerCase()} for ${context || "inquiry"}.`,
    entityType: "Vendor",
    entityId: vendorId,
    actor: "User",
  });

  return log;
}

export async function createServiceRequest(data: {
  householdId?: string;
  vendorId: string;
  assetId?: string;
  issue: string;
  category: string;
  preferredDate?: Date | string;
  preferredTime?: string;
  notes?: string;
  estimatedCost?: number;
}) {
  const targetHouseholdId = await getHouseholdId(data.householdId);

  const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
  if (!vendor) throw new Error("Vendor not found");

  let assetName = undefined;
  if (data.assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: data.assetId } });
    if (asset) assetName = `${asset.brand} ${asset.name}`;
  }

  const preferredDateObj = data.preferredDate ? new Date(data.preferredDate) : undefined;
  const dateStr = preferredDateObj ? preferredDateObj.toLocaleDateString("en-IN") : undefined;

  const whatsappMessage = generateServiceRequestWhatsAppMessage({
    vendorName: vendor.name,
    category: data.category,
    assetName,
    issue: data.issue,
    preferredDate: dateStr,
    preferredTime: data.preferredTime,
  });

  const whatsappUrl = buildWhatsAppLink(vendor.whatsappNumber || vendor.phone, whatsappMessage);

  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      householdId: targetHouseholdId,
      vendorId: data.vendorId,
      assetId: data.assetId,
      issue: data.issue,
      category: data.category,
      preferredDate: preferredDateObj,
      preferredTime: data.preferredTime,
      notes: data.notes,
      estimatedCost: data.estimatedCost,
      status: "REQUESTED",
      whatsappUrl,
    },
    include: {
      vendor: true,
      asset: true,
    },
  });

  // Automatically log contact & activity
  await logVendorContact({
    householdId: targetHouseholdId,
    vendorId: data.vendorId,
    actionType: "SERVICE_REQUESTED",
    context: `Service request #${serviceRequest.id.slice(-5)}: ${data.issue}`,
    messageSent: whatsappMessage,
  });

  return { serviceRequest, whatsappUrl, whatsappMessage };
}

export async function matchVendorForIssue(categoryOrProblem: string, householdId?: string) {
  const targetHouseholdId = await getHouseholdId(householdId);
  const text = categoryOrProblem.toLowerCase();

  let targetCategory = "Kirana / Grocery";
  if (text.includes("ac") || text.includes("air condition") || text.includes("cooling") || text.includes("compressor")) {
    targetCategory = "AC Repair & Service";
  } else if (text.includes("leak") || text.includes("plumb") || text.includes("pipe") || text.includes("tap") || text.includes("ro") || text.includes("purifier") || text.includes("drain")) {
    targetCategory = "Plumber";
  } else if (text.includes("electric") || text.includes("mcb") || text.includes("short circuit") || text.includes("switch") || text.includes("wiring") || text.includes("fan") || text.includes("geyser")) {
    targetCategory = "Electrician";
  } else if (text.includes("washing machine") || text.includes("fridge") || text.includes("refrigerator") || text.includes("microwave") || text.includes("chimney") || text.includes("appliance")) {
    targetCategory = "Appliance Technician";
  } else if (text.includes("milk") || text.includes("dairy") || text.includes("paneer") || text.includes("curd") || text.includes("dahi")) {
    targetCategory = "Dairy & Milk";
  } else if (text.includes("vegetable") || text.includes("fruit") || text.includes("sabzi") || text.includes("subzi") || text.includes("onion") || text.includes("potato") || text.includes("tomato")) {
    targetCategory = "Fresh Fruits & Vegetables";
  } else if (text.includes("water can") || text.includes("bisleri") || text.includes("drinking water")) {
    targetCategory = "Water Can Delivery";
  }

  // Find best match in household vendors
  const vendors = await prisma.vendor.findMany({
    where: {
      householdId: targetHouseholdId,
      category: targetCategory,
    },
    orderBy: [{ isFavourite: "desc" }, { rating: "desc" }],
  });

  return {
    matchedCategory: targetCategory,
    vendors,
    primaryVendor: vendors[0] || null,
  };
}
