import { z } from "zod";

// --- Document Extraction Schemas ---

export const GroceryReceiptExtractionSchema = z.object({
  docType: z.literal("RECEIPT"),
  vendor: z.string().describe("Store or platform name, e.g. Blinkit, Zepto, Swiggy Instamart, DMart"),
  billNumber: z.string().optional().describe("Invoice or order ID"),
  date: z.string().describe("Date of purchase in YYYY-MM-DD or DD/MM/YYYY format"),
  items: z.array(
    z.object({
      name: z.string().describe("Item name e.g. Aashirvaad Atta"),
      category: z.string().default("Groceries"),
      quantity: z.number().positive(),
      unit: z.string().default("units"),
      price: z.number().nonnegative(),
    })
  ),
  taxes: z.number().nonnegative().optional().default(0),
  total: z.number().positive().describe("Total amount paid in INR"),
  paymentMethod: z.string().optional().default("UPI"),
});

export const ApplianceInvoiceExtractionSchema = z.object({
  docType: z.literal("APPLIANCE_INVOICE"),
  brand: z.string().describe("Appliance manufacturer e.g. Daikin, LG, IFB, Kent, Samsung"),
  model: z.string().optional().describe("Model number or name"),
  applianceType: z.string().describe("AC, Refrigerator, Washing Machine, RO Water Purifier, Geyser, TV, Microwave"),
  serialNumber: z.string().optional().describe("Serial number of the appliance"),
  purchaseDate: z.string().describe("Date of invoice in YYYY-MM-DD format"),
  purchasePrice: z.number().positive().describe("Price paid in INR"),
  warrantyPeriodMonths: z.number().int().nonnegative().default(12),
  recommendedServiceIntervalDays: z.number().int().positive().default(180),
  retailerOrDealer: z.string().optional().describe("Seller name e.g. Vijay Sales, Croma, Amazon"),
  serviceInformation: z.string().optional().describe("Customer care number or service notes"),
});

export const UtilityBillExtractionSchema = z.object({
  docType: z.literal("UTILITY_BILL"),
  provider: z.string().describe("Utility provider e.g. Tata Power, Adani Electricity, Mahanagar Gas, Jio Fiber, Airtel"),
  category: z.enum(["Electricity", "Water", "Gas/LPG", "Internet", "Mobile", "DTH", "Society Maintenance", "Other"]),
  accountOrConsumerNumber: z.string().optional().describe("Account number or CA number"),
  billingPeriodStart: z.string().optional(),
  billingPeriodEnd: z.string().optional(),
  billNumber: z.string().optional(),
  totalAmount: z.number().positive().describe("Total bill amount in INR"),
  dueDate: z.string().describe("Due date in YYYY-MM-DD format"),
  unitsOrUsage: z.string().optional().describe("e.g. 284 kWh, 18 SCM"),
  notes: z.string().optional(),
});

export const ServiceInvoiceExtractionSchema = z.object({
  docType: z.literal("SERVICE_INVOICE"),
  provider: z.string().describe("Service company e.g. Urban Company, Daikin Service, Local Technician"),
  applianceOrItem: z.string().describe("What was serviced e.g. Split AC, RO Purifier"),
  serviceType: z.string().default("Preventive"),
  serviceDate: z.string().describe("Date of service in YYYY-MM-DD format"),
  totalCost: z.number().nonnegative().describe("Total service cost in INR"),
  technicianName: z.string().optional(),
  technicianPhone: z.string().optional(),
  nextServiceDueDate: z.string().optional(),
  notes: z.string().optional(),
});

export const GeneralDocumentExtractionSchema = z.object({
  docType: z.literal("GENERAL_DOCUMENT"),
  title: z.string().describe("Title or subject of the document"),
  documentType: z.string().describe("e.g. Society Maintenance, Rent Agreement, Insurance, Tax Receipt"),
  issuerOrVendor: z.string().describe("Issuing entity or vendor"),
  date: z.string().optional(),
  totalAmount: z.number().optional(),
  dueDate: z.string().optional(),
  summary: z.string().describe("Concise summary of document contents"),
  recommendedAction: z.string().optional(),
  notes: z.string().optional(),
});

export const DocumentExtractionUnionSchema = z.discriminatedUnion("docType", [
  GroceryReceiptExtractionSchema,
  ApplianceInvoiceExtractionSchema,
  UtilityBillExtractionSchema,
  ServiceInvoiceExtractionSchema,
  GeneralDocumentExtractionSchema,
]);

export type ExtractedReceipt = z.infer<typeof GroceryReceiptExtractionSchema>;
export type ExtractedAppliance = z.infer<typeof ApplianceInvoiceExtractionSchema>;
export type ExtractedUtilityBill = z.infer<typeof UtilityBillExtractionSchema>;
export type ExtractedServiceInvoice = z.infer<typeof ServiceInvoiceExtractionSchema>;
export type ExtractedGeneralDoc = z.infer<typeof GeneralDocumentExtractionSchema>;
export type DocumentExtractionResult = z.infer<typeof DocumentExtractionUnionSchema>;

// --- Inventory Input Schemas ---

export const InventoryItemInputSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  category: z.string().default("Groceries"),
  brand: z.string().optional(),
  quantity: z.number().min(0, "Quantity must be 0 or more"),
  unit: z.string().default("units"),
  minimumStock: z.number().min(0),
  consumptionRate: z.number().positive("Consumption rate must be greater than 0"),
  preferredBrand: z.string().optional(),
  preferredPackSize: z.string().optional(),
  price: z.number().min(0).default(0),
  vendor: z.string().optional().default("Blinkit"),
});

// --- Asset Input Schemas ---

export const AssetInputSchema = z.object({
  name: z.string().min(1, "Asset name is required"),
  category: z.string(),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().optional(),
  warrantyPeriodMonths: z.number().int().default(12),
  serviceIntervalDays: z.number().int().default(180),
  usageLevel: z.enum(["Low", "Medium", "Heavy"]).default("Medium"),
  location: z.string().default("Living Room"),
  technicianContact: z.string().optional(),
  notes: z.string().optional(),
});

// --- Task Input Schemas ---

export const TaskInputSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().optional(),
  assignedMemberId: z.string().optional().nullable(),
  category: z.string().default("General"),
});

// --- Bill Input Schemas ---

export const BillInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  provider: z.string().min(1, "Provider is required"),
  category: z.string(),
  amount: z.number().positive("Amount must be greater than 0"),
  dueDate: z.string(),
  paymentMethod: z.string().default("UPI"),
  autoPay: z.boolean().default(false),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});
