import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const DEFAULT_VENDORS = [
  {
    name: "Ramesh Gupta",
    businessName: "Gupta Kirana & General Store",
    category: "Kirana / Grocery",
    phone: "+91 98200 11223",
    whatsappNumber: "919820011223",
    address: "Shop 4, Palm Heights Commercial Wing",
    area: "Palm Heights Market, Sector 4",
    city: "Mumbai",
    services: "Aashirvaad Atta, Daal, Basmati Rice, Fortune Sunflower Oil, Spices, Cleaning Supplies, Toiletries, Daily Provisions",
    notes: "Offers 30-min free home delivery above ₹300. Accepts UPI and monthly household ledger.",
    rating: 4.8,
    reviewCount: 38,
    isFavourite: true,
    isTrusted: true,
    isDemo: true,
    availability: "Open • Closes 10 PM",
  },
  {
    name: "Mukesh Yadav",
    businessName: "Yadav Fresh Milk & Dairy Farm",
    category: "Dairy & Milk",
    phone: "+91 98200 44556",
    whatsappNumber: "919820044556",
    address: "Kiosk 2, Near Main Gate, Hiranandani Gardens",
    area: "Hiranandani Gardens",
    city: "Mumbai",
    services: "Amul Taaza / Gold Milk, Buffalo Full Cream Milk, Fresh Malai Paneer, Cow Ghee, Curd (Dahi), Country Eggs",
    notes: "Daily morning 6:30 AM doorstep delivery. Fresh evening malai paneer batch ready by 5 PM.",
    rating: 4.9,
    reviewCount: 54,
    isFavourite: true,
    isTrusted: true,
    isDemo: true,
    availability: "Open • 6 AM - 12 PM, 4 PM - 9 PM",
  },
  {
    name: "Sanjay Maurya",
    businessName: "Sanjay Farm Fresh Vegetables & Fruits",
    category: "Fresh Fruits & Vegetables",
    phone: "+91 98200 77889",
    whatsappNumber: "919820077889",
    address: "Stall 12, Subzi Mandi",
    area: "Opposite Palm Heights Tower 2",
    city: "Mumbai",
    services: "Nashik Onions, Potatoes, Vine Tomatoes, Fresh Palak, Coriander, Ginger-Garlic, Seasonal Apples, Bananas",
    notes: "Direct farm produce arrives daily at 6:30 AM. Sends daily fresh arrival prices on WhatsApp.",
    rating: 4.7,
    reviewCount: 29,
    isFavourite: true,
    isTrusted: true,
    isDemo: true,
    availability: "Open • 7 AM - 9 PM",
  },
  {
    name: "Imran Khan",
    businessName: "CoolCare HVAC & AC Solutions",
    category: "AC Repair & Service",
    phone: "+91 98200 33441",
    whatsappNumber: "919820033441",
    address: "B-14, Powai Commercial Complex",
    area: "Sector 7, Powai",
    city: "Mumbai",
    services: "AC Deep Foam Jet Cleaning, Gas Refill (R32/R410), PCB Diagnostics, Cooling Coil Replacement, Split AC Installation",
    notes: "Urban Company certified senior technician. Gives 60-day cooling warranty on gas charges.",
    rating: 4.9,
    reviewCount: 67,
    isFavourite: true,
    isTrusted: true,
    isDemo: true,
    availability: "On Call • 9 AM - 8 PM",
  },
  {
    name: "Santosh Verma",
    businessName: "Apex Plumbing & RO Purifier Care",
    category: "Plumber",
    phone: "+91 98200 88993",
    whatsappNumber: "919820088993",
    address: "Shop 18, Galleria Market",
    area: "Galleria Market, Powai",
    city: "Mumbai",
    services: "Kent/Aquaguard Filter Replacement, Membrane Change, Tap Leakage, Pipe Blockage, Flush Tank Repair, RO Water Testing",
    notes: "Carries genuine Kent and Eureka Forbes filters with TDS testing kit. Society approved plumber.",
    rating: 4.8,
    reviewCount: 31,
    isFavourite: true,
    isTrusted: true,
    isDemo: true,
    availability: "Open • 8:30 AM - 8:30 PM",
  },
  {
    name: "Dinesh Patel",
    businessName: "Patel Electricals & Home Services",
    category: "Electrician",
    phone: "+91 98200 55662",
    whatsappNumber: "919820055662",
    address: "Shop 9, Hiranandani Market",
    area: "Hiranandani Market Complex",
    city: "Mumbai",
    services: "MCB & Short Circuit Repair, Inverter Wiring, Geyser Element Replacement, Ceiling Fan Repair, Switchboard Rewiring",
    notes: "Arrives within 45 mins for emergency residential calls. Equipped with heavy load testing meters.",
    rating: 4.8,
    reviewCount: 42,
    isFavourite: false,
    isTrusted: true,
    isDemo: true,
    availability: "Open • 8 AM - 9 PM",
  },
  {
    name: "Arun Nair",
    businessName: "SmartTech Multi-Brand Appliance Repair",
    category: "Appliance Technician",
    phone: "+91 98200 22338",
    whatsappNumber: "919820022338",
    address: "Shop 21, Central Avenue",
    area: "Central Avenue, Powai",
    city: "Mumbai",
    services: "Washing Machine Drum & Motor Repair, Refrigerator Compressor Service, Microwave Magnetron, Chimney Motor Servicing",
    notes: "Specializes in Samsung, LG, IFB, Whirlpool appliances. Fixed ₹250 visit charge adjusted against repair invoice.",
    rating: 4.7,
    reviewCount: 26,
    isFavourite: false,
    isTrusted: true,
    isDemo: true,
    availability: "On Call • 9:30 AM - 7:30 PM",
  },
  {
    name: "Mahesh Singh",
    businessName: "PureFlow Water Supplies",
    category: "Water Can Delivery",
    phone: "+91 98200 66774",
    whatsappNumber: "919820066774",
    address: "Gate 1 Logistics Depot",
    area: "Palm Heights Society",
    city: "Mumbai",
    services: "20L Sealed Bisleri Water Cans, Aquafina Cans, Dispenser Service",
    notes: "Guaranteed 15-minute doorstep drop to Flat 402.",
    rating: 4.9,
    reviewCount: 45,
    isFavourite: true,
    isTrusted: true,
    isDemo: true,
    availability: "Open • 7 AM - 9 PM",
  },
];

async function seedVendors() {
  console.log("Seeding Local Vendors...");
  const households = await prisma.household.findMany();
  if (households.length === 0) {
    console.log("No household found! Please run main seed first.");
    return;
  }

  for (const household of households) {
    const existingCount = await prisma.vendor.count({ where: { householdId: household.id } });
    if (existingCount > 0) {
      console.log(`Household ${household.name} already has ${existingCount} vendors.`);
      continue;
    }

    for (const vendorData of DEFAULT_VENDORS) {
      await prisma.vendor.create({
        data: {
          ...vendorData,
          householdId: household.id,
        },
      });
    }
    console.log(`✓ Seeded ${DEFAULT_VENDORS.length} local vendors for ${household.name}`);
  }
}

seedVendors()
  .catch((e) => {
    console.error("Failed to seed vendors:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
