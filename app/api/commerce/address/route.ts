import { NextRequest, NextResponse } from "next/server";
import { getCommerceProvider } from "@/lib/integrations/commerce/provider";
import { getSwiggySession } from "@/lib/integrations/commerce/swiggy-instamart/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const householdId = searchParams.get("householdId") || undefined;

    const provider = await getCommerceProvider(householdId);
    const isAuth = await provider.isAuthenticated();

    if (!isAuth) {
      return NextResponse.json({
        authenticated: false,
        addresses: [],
        selectedAddressId: null,
      });
    }

    const addresses = await provider.getAddresses();
    const session = await getSwiggySession(householdId);

    // If no address is selected yet, default to the first one or default
    let selectedAddressId = session?.selectedAddressId || null;
    let selectedAddressName = session?.selectedAddressName || null;

    if (!selectedAddressId && addresses.length > 0) {
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      selectedAddressId = def.id;
      selectedAddressName = def.formattedAddress;
      await provider.selectAddress(def.id);
    }

    return NextResponse.json({
      authenticated: true,
      addresses,
      selectedAddressId,
      selectedAddressName,
    });
  } catch (error: unknown) {
    console.error("GET /api/commerce/address error:", error);
    const message = error instanceof Error ? error.message : "Failed to retrieve addresses";
    return NextResponse.json({ error: message, addresses: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const householdId = body.householdId || undefined;

    const provider = await getCommerceProvider(householdId);
    const isAuth = await provider.isAuthenticated();

    if (!isAuth) {
      return NextResponse.json(
        { error: "Swiggy Instamart is not connected." },
        { status: 401 }
      );
    }

    // Action 1: Select an existing address
    if (body.selectAddressId) {
      const ok = await provider.selectAddress(body.selectAddressId);
      return NextResponse.json({
        success: ok,
        selectedAddressId: body.selectAddressId,
      });
    }

    // Action 2: Create a new address on Swiggy Instamart via MCP
    const {
      fullAddress,
      addressLine,
      addressLine2,
      locality,
      city,
      postalCode,
      addressCategory = "HOME",
      addressTag = "Home",
      userName,
      userPhone,
      latitude,
      longitude,
    } = body;

    if (!addressLine || !city || !postalCode) {
      return NextResponse.json(
        { error: "Address line, city, and postal code are required to add a delivery address." },
        { status: 400 }
      );
    }

    // Default resident name and phone if not provided
    let contactName = userName;
    let contactPhone = userPhone;
    if (!contactName || !contactPhone) {
      const hh = await prisma.household.findFirst({
        include: { members: true },
      });
      if (hh && hh.members.length > 0) {
        contactName = contactName || hh.members[0].name;
        contactPhone = contactPhone || hh.members[0].phone || "9876543210";
      } else {
        contactName = contactName || "Resident";
        contactPhone = contactPhone || "9876543210";
      }
    }

    const createdAddress = await provider.createAddress({
      fullAddress: fullAddress || `${addressLine}, ${city} ${postalCode}`,
      addressLine,
      addressLine2,
      locality: locality || city,
      city,
      postalCode,
      addressCategory,
      addressTag,
      userName: contactName,
      userPhone: contactPhone,
      latitude,
      longitude,
    });

    return NextResponse.json({
      success: true,
      address: createdAddress,
      selectedAddressId: createdAddress.id,
      selectedAddressName: createdAddress.formattedAddress,
    });
  } catch (error: unknown) {
    console.error("POST /api/commerce/address error:", error);
    const message = error instanceof Error ? error.message : "Failed to create delivery address";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
