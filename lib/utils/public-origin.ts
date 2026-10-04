import type { NextRequest } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host.split(":")[0].toLowerCase());
}

/**
 * Resolve the browser-facing origin rather than the internal origin exposed by
 * the Next.js request URL inside the managed container. This is required for
 * OAuth providers that validate the redirect URI exactly.
 */
export function getPublicOrigin(req: NextRequest): string {
  const configuredOrigin =
    process.env.PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      console.warn("[Public Origin] Ignoring invalid configured app URL");
    }
  }

  const forwardedHost = firstHeaderValue(req.headers.get("x-forwarded-host"));
  const forwardedProto = firstHeaderValue(req.headers.get("x-forwarded-proto"));
  const requestHost = forwardedHost || firstHeaderValue(req.headers.get("host"));

  if (requestHost && !isLocalHost(requestHost)) {
    return `${forwardedProto === "http" ? "http" : "https"}://${requestHost}`;
  }

  try {
    const requestOrigin = new URL(req.nextUrl.origin);
    if (!isLocalHost(requestOrigin.hostname)) {
      return requestOrigin.origin;
    }
  } catch {
    // Fall through to the local development default.
  }

  return "http://localhost:3000";
}
