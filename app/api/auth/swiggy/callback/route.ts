import { NextRequest, NextResponse } from "next/server";
import { exchangeSwiggyCode } from "@/lib/integrations/commerce/swiggy-instamart/auth";

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin || "http://localhost:3000";
    const redirectUri = `${origin}/api/auth/swiggy/callback`;
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state") || "";
    const error = req.nextUrl.searchParams.get("error");
    const errorDescription = req.nextUrl.searchParams.get("error_description");

    if (error) {
      console.error("[Swiggy Callback] Error from auth server:", error, errorDescription);
      return NextResponse.redirect(
        `${origin}/assistant?swiggy_error=${encodeURIComponent(errorDescription || error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${origin}/assistant?swiggy_error=${encodeURIComponent("Missing authorization code")}`
      );
    }

    await exchangeSwiggyCode(code, state, redirectUri);

    return NextResponse.redirect(`${origin}/assistant?swiggy_connected=true`);
  } catch (err: any) {
    console.error("[Swiggy Callback] Exchange failed:", err);
    const origin = req.nextUrl.origin || "http://localhost:3000";
    return NextResponse.redirect(
      `${origin}/assistant?swiggy_error=${encodeURIComponent(err.message || "Token exchange failed")}`
    );
  }
}
