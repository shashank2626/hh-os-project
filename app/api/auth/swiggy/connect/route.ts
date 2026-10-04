import { NextRequest, NextResponse } from "next/server";
import { getSwiggyAuthorizationUrl } from "@/lib/integrations/commerce/swiggy-instamart/auth";

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin || "http://localhost:3000";
    const redirectUri = `${origin}/api/auth/swiggy/callback`;

    const { url, state } = await getSwiggyAuthorizationUrl(redirectUri);

    // If request asks for json, return the url
    if (req.nextUrl.searchParams.get("format") === "json") {
      return NextResponse.json({ success: true, url, state });
    }

    // Otherwise redirect directly to Swiggy MCP Auth server
    return NextResponse.redirect(url);
  } catch (error: any) {
    console.error("[Swiggy Connect] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to initialize Swiggy OAuth" },
      { status: 500 }
    );
  }
}
