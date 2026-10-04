/**
 * WhatsApp Deep-Link and Message Formatting Utilities
 * Standard: https://wa.me/<phone_with_country_code>?text=<encoded_text>
 */

export function sanitizePhoneNumber(phone: string): string {
  // Remove non-digit characters (+, -, spaces, parentheses)
  const digits = phone.replace(/\D/g, "");
  // If 10 digits (Indian mobile without prefix), prepend 91
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export function buildWhatsAppLink(phone: string, text: string): string {
  const cleanPhone = sanitizePhoneNumber(phone);
  const encodedText = encodeURIComponent(text.trim());
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

export interface RefillItemForWhatsApp {
  name: string;
  quantity: number | string;
  unit: string;
  notes?: string;
}

export interface RefillWhatsAppOptions {
  vendorName: string;
  flatDetails?: string;
  items: RefillItemForWhatsApp[];
  senderName?: string;
  deliveryPreference?: string;
}

export function generateRefillWhatsAppMessage(opts: RefillWhatsAppOptions): string {
  const itemsList = opts.items
    .map((item) => `• ${item.name} - ${item.quantity} ${item.unit}${item.notes ? ` (${item.notes})` : ""}`)
    .join("\n");

  const flat = opts.flatDetails || "Flat 402, Palm Heights";
  const sender = opts.senderName || "Ayush Sharma";
  const preference = opts.deliveryPreference ? `\nPreferred timing: ${opts.deliveryPreference}` : "";

  return (
    `Namaste ${opts.vendorName} ji,\n\n` +
    `Please deliver the following household refill items to ${flat}:\n\n` +
    `${itemsList}\n` +
    `${preference}\n\n` +
    `Please share the total bill amount and UPI QR code or notify when the delivery boy is dispatched.\n\n` +
    `Thank you!\n` +
    `- ${sender} (${flat})`
  );
}

export interface ServiceRequestWhatsAppOptions {
  vendorName: string;
  category: string;
  assetName?: string;
  issue: string;
  preferredDate?: string;
  preferredTime?: string;
  flatDetails?: string;
  senderName?: string;
  senderPhone?: string;
}

export function generateServiceRequestWhatsAppMessage(opts: ServiceRequestWhatsAppOptions): string {
  const flat = opts.flatDetails || "Flat 402, Palm Heights";
  const sender = opts.senderName || "Ayush Sharma";
  const phone = opts.senderPhone || "+91 98201 12345";
  const slot = [opts.preferredDate, opts.preferredTime].filter(Boolean).join(" - ") || "Earliest available";

  const assetLine = opts.assetName ? `\nAppliance / Equipment: ${opts.assetName}` : "";

  return (
    `Namaste ${opts.vendorName} ji,\n\n` +
    `Need service assistance for ${opts.category} at ${flat}:${assetLine}\n` +
    `Issue details: ${opts.issue}\n` +
    `Preferred Time Slot: ${slot}\n\n` +
    `Could you please confirm technician availability and estimated visit charges?\n\n` +
    `Thank you!\n` +
    `- ${sender} (${phone})`
  );
}

export interface FamilyPingWhatsAppOptions {
  memberName: string;
  taskTitle: string;
  category?: string;
  priority: string;
  dueDate?: string;
  amount?: number;
  notes?: string;
  senderName?: string;
}

export function generateFamilyPingWhatsAppMessage(opts: FamilyPingWhatsAppOptions): string {
  const sender = opts.senderName || "Household OS";
  const priorityIcon = opts.priority === "URGENT" ? "🚨 URGENT" : opts.priority === "HIGH" ? "⚠️ HIGH" : "📌";
  const dueLine = opts.dueDate ? `\n📅 Due: ${opts.dueDate}` : "";
  const amountLine = opts.amount ? `\n💳 Amount: ₹${opts.amount.toLocaleString("en-IN")}` : "";
  const notesLine = opts.notes ? `\n💡 Context: ${opts.notes}` : "";

  return (
    `Hi ${opts.memberName}! 👋\n\n` +
    `*HH-OS Household Task Reminder*\n` +
    `${priorityIcon} Task: ${opts.taskTitle}\n` +
    (opts.category ? `🏷️ Category: ${opts.category}\n` : "") +
    `${dueLine}` +
    `${amountLine}` +
    `${notesLine}\n\n` +
    `Please review in HH-OS or let me know when completed.\n` +
    `- ${sender}`
  );
}
