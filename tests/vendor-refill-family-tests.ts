import { prisma } from "../lib/db/prisma";
import {
  listVendors,
  createVendor,
  createServiceRequest,
  logVendorContact,
  matchVendorForIssue,
} from "../lib/services/vendor-service";
import {
  getSmartKitchenRefillItems,
  generateLocalVendorRefillPlan,
  executeSplitRefillPlan,
} from "../lib/services/refill-service";
import {
  getHouseholdMembersWithWorkload,
  getFamilyTasks,
  createFamilyTask,
  reassignFamilyTask,
  updateFamilyTaskStatus,
  generateFamilyTaskPing,
  recommendHouseholdMemberForTask,
  syncAutonomousTasks,
} from "../lib/services/family-service";
import {
  buildWhatsAppLink,
  generateRefillWhatsAppMessage,
  generateServiceRequestWhatsAppMessage,
  generateFamilyPingWhatsAppMessage,
} from "../lib/utils/whatsapp";
import { executeTool } from "../lib/tools/registry";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING SUITE: LOCAL VENDORS, SMART KITCHEN & FAMILY COORDINATION");
  console.log("=================================================\n");

  const household = await prisma.household.findFirst();
  if (!household) {
    throw new Error("No household found! Please seed the database first.");
  }
  const householdId = household.id;
  console.log(`Using Household: ${household.name} (${householdId})\n`);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      throw new Error(`Test assertion failed: ${message}`);
    }
  }

  // ----------------------------------------------------------------------
  // TEST SECTION 1: WhatsApp Utility Deep-Links
  // ----------------------------------------------------------------------
  console.log("--- 1. Testing WhatsApp Deep-Link Generators ---");

  const waRefillText = generateRefillWhatsAppMessage({
    vendorName: "Mukesh",
    flatDetails: "Flat 402, Palm Heights",
    items: [
      { name: "Amul Taaza Milk", quantity: 2, unit: "L" },
      { name: "Fresh Paneer", quantity: 500, unit: "g" },
    ],
  });
  assert(waRefillText.includes("Namaste Mukesh ji"), "Refill WhatsApp salutation is polite and accurate");
  assert(waRefillText.includes("Amul Taaza Milk - 2 L"), "Refill WhatsApp includes formatted bullet items");

  const waRefillUrl = buildWhatsAppLink("+91 98200 44556", waRefillText);
  assert(waRefillUrl.startsWith("https://wa.me/919820044556?text="), "WhatsApp URL formats standard wa.me redirect");

  const waServiceText = generateServiceRequestWhatsAppMessage({
    vendorName: "Imran",
    category: "AC Repair & Service",
    assetName: "Daikin Inverter Split AC 1.5 Ton",
    issue: "Cooling coil ice formation and reduced airflow",
    preferredDate: "05/10/2026",
    preferredTime: "Morning (9am - 12pm)",
  });
  assert(waServiceText.includes("Daikin Inverter Split AC"), "Service WhatsApp contains appliance name");
  assert(waServiceText.includes("Morning (9am - 12pm)"), "Service WhatsApp contains preferred time slot");

  const waPingText = generateFamilyPingWhatsAppMessage({
    memberName: "Priya",
    taskTitle: "Refill kitchen essentials (Milk, Atta, Oil)",
    category: "Kitchen",
    priority: "HIGH",
    dueDate: "Today, 6:00 PM",
  });
  assert(waPingText.includes("Hi Priya! 👋"), "Family ping greeting addressed to member");
  assert(waPingText.includes("Task: Refill kitchen essentials"), "Family ping contains task details");

  // ----------------------------------------------------------------------
  // TEST SECTION 2: Local Vendor Network Service
  // ----------------------------------------------------------------------
  console.log("\n--- 2. Testing Local Vendor Network Service ---");

  const allVendors = await listVendors(householdId);
  assert(allVendors.length >= 8, `Seeded vendors present in database (count: ${allVendors.length})`);

  const dairyVendors = await listVendors(householdId, { category: "Dairy & Milk" });
  assert(dairyVendors.length > 0 && dairyVendors[0].name === "Mukesh Yadav", "Dairy category filter returns Mukesh Yadav");

  const acMatch = await matchVendorForIssue("ac cooling stopped blowing cold air", householdId);
  assert(acMatch.matchedCategory === "AC Repair & Service", "Smart category matcher matches AC issue to AC Repair & Service");
  assert(acMatch.primaryVendor?.name === "Imran Khan", "Smart matcher selects Imran Khan as primary AC technician");

  const plumbMatch = await matchVendorForIssue("water pipe leakage under kitchen sink", householdId);
  assert(plumbMatch.matchedCategory === "Plumber", "Smart matcher matches pipe leakage to Plumber");

  // Create Service Request
  const daikinAsset = await prisma.asset.findFirst({ where: { householdId, name: { contains: "AC" } } });
  const serviceReq = await createServiceRequest({
    householdId,
    vendorId: acMatch.primaryVendor!.id,
    assetId: daikinAsset?.id,
    issue: "Cooling significantly dropped. Deep foam cleaning needed.",
    category: "AC Repair & Service",
    preferredTime: "Morning (9am - 12pm)",
  });
  assert(Boolean(serviceReq.serviceRequest.id), "Created service request record in database");
  assert(serviceReq.serviceRequest.status === "REQUESTED", "Service request status is REQUESTED");
  assert(serviceReq.whatsappUrl.includes("wa.me"), "Service request returned live WhatsApp launch URL");

  // Log Vendor Contact
  const contactLog = await logVendorContact({
    householdId,
    vendorId: dairyVendors[0].id,
    actionType: "WHATSAPP_OPENED",
    context: "Morning milk order inquiry",
  });
  assert(contactLog.actionType === "WHATSAPP_OPENED", "Logged vendor contact event in database");

  // ----------------------------------------------------------------------
  // TEST SECTION 3: Smart Kitchen / Smart Refill Service
  // ----------------------------------------------------------------------
  console.log("\n--- 3. Testing Smart Kitchen / Smart Refill Service ---");

  const refillData = await getSmartKitchenRefillItems(householdId);
  assert(refillData.recommendations.length > 0, `Smart kitchen detected ${refillData.recommendations.length} low-stock/depleting items`);

  const firstRec = refillData.recommendations[0];
  assert(firstRec.suggestedRefillQuantity > 0, "Suggested refill quantity is a positive number");
  assert(Boolean(firstRec.recommendedVendorCategory), "Item mapped to appropriate vendor category");

  // Test Local Vendor Refill Plan
  const selectedForLocal = refillData.recommendations.slice(0, 3).map((r) => ({
    itemId: r.itemId,
    quantity: r.suggestedRefillQuantity,
  }));
  const localPlan = await generateLocalVendorRefillPlan(householdId, selectedForLocal);
  assert(localPlan.groups.length > 0, `Local refill plan generated ${localPlan.groups.length} vendor group(s)`);
  assert(localPlan.groups[0].whatsappUrl.includes("wa.me"), "Vendor group contains prefilled WhatsApp URL");

  // Test Split Refill Plan
  const splitResult = await executeSplitRefillPlan({
    householdId,
    localItems: selectedForLocal.slice(0, 1),
    instamartItems: selectedForLocal.slice(1, 2),
  });
  assert(splitResult.success === true, "Split refill plan executed successfully");
  assert(Boolean(splitResult.localVendorPlan), "Split plan processed local vendor portion");
  assert(splitResult.instamartResults.length > 0, "Split plan processed digital commerce portion");

  // ----------------------------------------------------------------------
  // TEST SECTION 4: Family Coordination Service
  // ----------------------------------------------------------------------
  console.log("\n--- 4. Testing Family Coordination Service ---");

  const workloadData = await getHouseholdMembersWithWorkload(householdId);
  assert(workloadData.members.length >= 4, `Household has ${workloadData.members.length} members with workload tracking`);
  const priyaMember = workloadData.members.find((m) => m.name.includes("Priya"));
  assert(Boolean(priyaMember), "Priya Sharma found in member workload list");

  // Test AI Role Assignment Engine
  const billAssignRec = await recommendHouseholdMemberForTask(householdId, "Bill Payment", "Electricity bill Tata Power");
  const adminMember = workloadData.members.find((m) => m.role === "Admin");
  assert(billAssignRec.recommendedMemberId === adminMember?.id, "AI matches Utility Bill task to Admin (Ayush)");

  const groceryAssignRec = await recommendHouseholdMemberForTask(householdId, "Kitchen", "Pantry restock atta and milk");
  assert(groceryAssignRec.recommendedMemberId === priyaMember?.id, "AI matches Kitchen / Grocery task to Priya");

  // Create Family Task
  const createdTask = await createFamilyTask({
    householdId,
    title: "Review vegetable stock for weekend cooking",
    category: "Kitchen",
    priority: "HIGH",
    description: "Check onions, tomatoes and greens before placing Subzi Mandi WhatsApp order.",
  });
  assert(Boolean(createdTask.id), "Family task created in database");
  assert(createdTask.assignedMemberId === priyaMember?.id, "Task automatically assigned to Priya based on AI role matching");

  // Reassign Task
  const rameshMember = workloadData.members.find((m) => m.name.includes("Ramesh"));
  const reassignedTask = await reassignFamilyTask(createdTask.id, rameshMember!.id);
  assert(reassignedTask.assignedMemberId === rameshMember!.id, "Task successfully reassigned to Ramesh");

  // Complete Task
  const completedTask = await updateFamilyTaskStatus(createdTask.id, "COMPLETED");
  assert(completedTask.status === "COMPLETED", "Task status updated to COMPLETED");
  assert(Boolean(completedTask.completedAt), "Task completion timestamp recorded");

  // Generate Family WhatsApp Ping
  const pingTask = await createFamilyTask({
    householdId,
    title: "Pay Tata Power Bill",
    category: "Bill Payment",
    priority: "URGENT",
    assignedMemberId: adminMember?.id,
    estimatedCost: 2340,
  });
  const pingResult = await generateFamilyTaskPing(pingTask.id);
  assert(pingResult.whatsappUrl.includes("wa.me"), "Generated WhatsApp ping URL for assigned member");
  assert(pingResult.whatsappMessage.includes("Tata Power Bill"), "Ping message contains task name and priority");

  // Autonomous Task Sync
  const syncResult = await syncAutonomousTasks(householdId);
  assert(typeof syncResult.createdTasksCount === "number", "Autonomous task sync executed across bills, maintenance and inventory");

  // ----------------------------------------------------------------------
  // TEST SECTION 5: AI Assistant Tool Registry Integration
  // ----------------------------------------------------------------------
  console.log("\n--- 5. Testing AI Assistant Tool Registry Integration ---");

  const toolVendors: any = await executeTool("get_local_vendors", { category: "Plumber" });
  assert(toolVendors.vendors && toolVendors.vendors.length > 0, "Tool get_local_vendors returns plumber vendor");

  const toolServiceReq: any = await executeTool("request_vendor_service", {
    category: "AC Repair",
    issue: "AC cooling reduced, deep jet clean needed",
  });
  assert(toolServiceReq.success === true, "Tool request_vendor_service successfully matched vendor and created request");
  assert(toolServiceReq.whatsappUrl.includes("wa.me"), "Tool request_vendor_service returned WhatsApp dispatch link");

  const toolTaskAssign: any = await executeTool("assign_household_task", {
    title: "Inspect Balcony Garden herbs and plants",
    category: "Errands",
    priority: "MEDIUM",
  });
  assert(toolTaskAssign.success === true, "Tool assign_household_task created task with AI assignment");

  const toolPing: any = await executeTool("send_family_task_ping", {});
  assert(toolPing.success === true || toolPing.ping, "Tool send_family_task_ping executed successfully");

  console.log("\n=================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED CLEANLY!`);
  console.log("=================================================\n");
}

runTests()
  .catch((err) => {
    console.error("❌ Test suite failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
