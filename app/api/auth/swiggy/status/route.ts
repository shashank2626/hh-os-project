import { NextResponse } from "next/server";
import { getSwiggySession, getValidSwiggyToken } from "@/lib/integrations/commerce/swiggy-instamart/auth";

export async function GET() {
  try {
    const token = await getValidSwiggyToken();
    const session = await getSwiggySession();

    return NextResponse.json({
      connected: Boolean(token),
      provider: "swiggy-instamart",
      endpoint: "https://mcp.swiggy.com/im",
      expiresAt: session?.expiresAt || null,
      selectedAddressId: session?.selectedAddressId || null,
      selectedAddressName: session?.selectedAddressName || null,
      lastSyncAt: session?.lastSyncAt || null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, error: error.message },
      { status: 500 }
    );
  }
}
