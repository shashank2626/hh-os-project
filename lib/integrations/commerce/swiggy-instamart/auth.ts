import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";

export interface SwiggyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
}

const SWIGGY_AUTH_BASE = "https://mcp.swiggy.com";

/**
 * Generate PKCE code_verifier and code_challenge (S256) per RFC 7636
 */
export function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");

  return { codeVerifier, codeChallenge, state };
}

/**
 * Get or create current commerce session for the household
 */
export async function getSwiggySession(householdId?: string) {
  let targetId = householdId;
  if (!targetId) {
    const hh = await prisma.household.findFirst();
    targetId = hh?.id;
  }
  if (!targetId) return null;

  return await prisma.commerceSession.findFirst({
    where: {
      householdId: targetId,
      provider: "swiggy-instamart",
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Save access token or update session
 */
export async function saveSwiggyToken(
  tokenData: SwiggyTokenResponse,
  householdId?: string,
  selectedAddressId?: string
) {
  let targetId = householdId;
  if (!targetId) {
    const hh = await prisma.household.findFirst();
    targetId = hh?.id;
  }
  if (!targetId) throw new Error("No household found to bind Swiggy session");

  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 432000) * 1000);

  const existing = await prisma.commerceSession.findFirst({
    where: { householdId: targetId, provider: "swiggy-instamart" },
  });

  if (existing) {
    return await prisma.commerceSession.update({
      where: { id: existing.id },
      data: {
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type || "Bearer",
        expiresAt,
        scope: tokenData.scope || "mcp:tools",
        selectedAddressId: selectedAddressId || existing.selectedAddressId,
        lastSyncAt: new Date(),
      },
    });
  }

  return await prisma.commerceSession.create({
    data: {
      householdId: targetId,
      provider: "swiggy-instamart",
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type || "Bearer",
      expiresAt,
      scope: tokenData.scope || "mcp:tools",
      selectedAddressId,
      lastSyncAt: new Date(),
    },
  });
}

/**
 * Build the official OAuth 2.1 + PKCE Authorization URL
 */
export async function getSwiggyAuthorizationUrl(
  redirectUri: string,
  householdId?: string
): Promise<{ url: string; state: string; codeVerifier: string }> {
  let targetId = householdId;
  if (!targetId) {
    const hh = await prisma.household.findFirst();
    targetId = hh?.id;
  }
  if (!targetId) throw new Error("Household required to initialize Swiggy OAuth");

  const { codeVerifier, codeChallenge, state } = generatePkcePair();

  // Store in-flight state and verifier in session record
  const existing = await prisma.commerceSession.findFirst({
    where: { householdId: targetId, provider: "swiggy-instamart" },
  });

  if (existing) {
    await prisma.commerceSession.update({
      where: { id: existing.id },
      data: { codeVerifier, state },
    });
  } else {
    await prisma.commerceSession.create({
      data: {
        householdId: targetId,
        provider: "swiggy-instamart",
        codeVerifier,
        state,
      },
    });
  }

  const clientId = process.env.SWIGGY_CLIENT_ID || "household-os-agent";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    scope: "mcp:tools",
  });

  const url = `${SWIGGY_AUTH_BASE}/auth/authorize?${params.toString()}`;
  return { url, state, codeVerifier };
}

/**
 * Exchange Authorization Code for Access Token via POST /auth/token
 */
export async function exchangeSwiggyCode(
  code: string,
  state: string,
  redirectUri: string,
  householdId?: string
): Promise<SwiggyTokenResponse> {
  let targetId = householdId;
  if (!targetId) {
    const hh = await prisma.household.findFirst();
    targetId = hh?.id;
  }
  if (!targetId) throw new Error("Household required for token exchange");

  const session = await prisma.commerceSession.findFirst({
    where: { householdId: targetId, provider: "swiggy-instamart" },
  });

  if (!session || !session.codeVerifier) {
    throw new Error("No active PKCE code_verifier found for this authorization session");
  }

  if (session.state && session.state !== state) {
    throw new Error("CSRF State mismatch in Swiggy OAuth callback");
  }

  const tokenEndpoint = `${SWIGGY_AUTH_BASE}/auth/token`;
  const body = {
    grant_type: "authorization_code",
    code,
    code_verifier: session.codeVerifier,
    redirect_uri: redirectUri,
    client_id: process.env.SWIGGY_CLIENT_ID || "household-os-agent",
  };

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Swiggy token exchange failed [${res.status}]: ${errorText}`);
  }

  const data = (await res.json()) as SwiggyTokenResponse;
  await saveSwiggyToken(data, targetId);
  return data;
}

/**
 * Retrieve active access token from database or environment
 */
export async function getValidSwiggyToken(householdId?: string): Promise<string | null> {
  // Check static or manual token override in process.env
  if (process.env.SWIGGY_ACCESS_TOKEN?.trim()) {
    return process.env.SWIGGY_ACCESS_TOKEN.trim();
  }

  const session = await getSwiggySession(householdId);
  if (!session || !session.accessToken) return null;

  // Check expiration (if token expired, return null to force re-auth)
  if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return session.accessToken;
}
