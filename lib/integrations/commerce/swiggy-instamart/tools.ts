import { SwiggyInstamartClient, SwiggyAuthError, SwiggyCreateAddressParams } from "./client";
import { getValidSwiggyToken, getSwiggyAuthorizationUrl, exchangeSwiggyCode, getSwiggySession } from "./auth";
import { mapSwiggyAddress, mapSwiggyProduct, mapSwiggyCart } from "./mapper";
import {
  CommerceProvider,
  CommerceAddress,
  CommerceCreateAddressInput,
  CommerceProduct,
  CommerceCart,
} from "../types";
import { prisma } from "@/lib/db/prisma";

export class SwiggyInstamartProvider implements CommerceProvider {
  name = "Swiggy Instamart";
  private householdId?: string;

  constructor(householdId?: string) {
    this.householdId = householdId;
  }

  private async getClient(): Promise<SwiggyInstamartClient> {
    const token = await getValidSwiggyToken(this.householdId);
    return new SwiggyInstamartClient(token);
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await getValidSwiggyToken(this.householdId);
    return Boolean(token && token.length > 10);
  }

  async getAuthUrl(redirectUri: string) {
    return await getSwiggyAuthorizationUrl(redirectUri, this.householdId);
  }

  async handleAuthCallback(code: string, state: string, redirectUri: string): Promise<boolean> {
    const tokenData = await exchangeSwiggyCode(code, state, redirectUri, this.householdId);
    return Boolean(tokenData && tokenData.access_token);
  }

  /**
   * Fetch all delivery addresses with full pagination and fallback extraction
   */
  async getAddresses(page = 1, pageSize = 10, fetchAll = true): Promise<CommerceAddress[]> {
    const client = await this.getClient();
    const collectedRaw: Array<Record<string, unknown>> = [];

    let currentPage = page;
    let hasMore = true;
    let maxPages = fetchAll ? 5 : 1;

    while (hasMore && currentPage <= maxPages) {
      console.log(`[Swiggy Provider] Fetching addresses page ${currentPage}...`);
      const result = await client.getAddresses(currentPage, pageSize);

      if (!result.success && result.error) {
        console.error(`[Swiggy Provider] getAddresses error on page ${currentPage}:`, result.error);
        if (currentPage === 1) {
          throw new Error(result.error.message || "Failed to fetch Swiggy delivery addresses");
        }
        break;
      }

      // Robust extraction from various response structures
      const data = result.data as Record<string, unknown> | undefined;
      let pageAddresses: Array<Record<string, unknown>> = [];

      if (Array.isArray(data)) {
        pageAddresses = data as Array<Record<string, unknown>>;
      } else if (data && Array.isArray(data.addresses)) {
        pageAddresses = data.addresses as Array<Record<string, unknown>>;
      } else if (data && Array.isArray((data as Record<string, unknown>).data)) {
        pageAddresses = (data as Record<string, unknown>).data as Array<Record<string, unknown>>;
      } else if (Array.isArray((result as unknown as Record<string, unknown>).addresses)) {
        pageAddresses = (result as unknown as Record<string, unknown>).addresses as Array<Record<string, unknown>>;
      }

      console.log(`[Swiggy Provider] Page ${currentPage} found ${pageAddresses.length} addresses`);
      collectedRaw.push(...pageAddresses);

      // Pagination check
      const pagination = data?.pagination as { hasMore?: boolean; totalPages?: number } | undefined;
      if (fetchAll && pagination) {
        if (pagination.hasMore !== undefined) {
          hasMore = Boolean(pagination.hasMore);
        } else if (pagination.totalPages !== undefined) {
          hasMore = currentPage < pagination.totalPages;
        } else {
          hasMore = pageAddresses.length >= pageSize;
        }
      } else {
        hasMore = false;
      }

      currentPage++;
    }

    const addresses = collectedRaw
      .map((addr) => mapSwiggyAddress(addr))
      .filter((addr) => Boolean(addr.id && addr.id !== "undefined"));

    console.log(`[Swiggy Provider] Total mapped addresses: ${addresses.length}`);

    // Cache in session metadata and set default address if none is active
    const session = await getSwiggySession(this.householdId);
    if (session && addresses.length > 0) {
      const existingSelected = addresses.find((a) => a.id === session.selectedAddressId);
      const defaultAddr = existingSelected || addresses.find((a) => a.isDefault) || addresses[0];

      await prisma.commerceSession.update({
        where: { id: session.id },
        data: {
          selectedAddressId: defaultAddr.id,
          selectedAddressName: defaultAddr.formattedAddress,
          metadata: JSON.stringify({ addresses }),
        },
      });
    }

    return addresses;
  }

  async selectAddress(addressId: string): Promise<boolean> {
    const session = await getSwiggySession(this.householdId);
    if (!session) return false;

    let addressName: string | undefined;
    if (session.metadata) {
      try {
        const parsed = JSON.parse(session.metadata);
        const match = parsed.addresses?.find((a: CommerceAddress) => a.id === addressId);
        if (match) addressName = match.formattedAddress;
      } catch {
        // ignore
      }
    }

    await prisma.commerceSession.update({
      where: { id: session.id },
      data: {
        selectedAddressId: addressId,
        selectedAddressName: addressName || `Address ${addressId}`,
      },
    });

    return true;
  }

  /**
   * Create a new address on Swiggy Instamart via MCP create_address tool
   */
  async createAddress(input: CommerceCreateAddressInput): Promise<CommerceAddress> {
    const client = await this.getClient();

    const swiggyParams: SwiggyCreateAddressParams = {
      fullAddress: input.fullAddress || `${input.addressLine}, ${input.city} ${input.postalCode}`,
      addressLine: input.addressLine,
      addressLine2: input.addressLine2 || "",
      locality: input.locality || "",
      city: input.city,
      postalCode: input.postalCode,
      addressCategory: input.addressCategory || "HOME",
      addressTag: input.addressTag || "Home",
      userName: input.userName || "Resident",
      userPhone: input.userPhone || "9876543210",
      latitude: input.latitude,
      longitude: input.longitude,
    };

    console.log(`[Swiggy Provider] Calling create_address MCP tool with:`, JSON.stringify(swiggyParams));
    const result = await client.createAddress(swiggyParams);

    if (!result.success || !result.data) {
      const errMsg = result.error?.message || result.message || "Failed to create Swiggy delivery address";
      console.error(`[Swiggy Provider] create_address error:`, errMsg);
      throw new Error(errMsg);
    }

    const rawCreated = (result.data as Record<string, unknown>).address || result.data;
    const mapped = mapSwiggyAddress(rawCreated as Record<string, unknown>);

    // Ensure fallback ID if Swiggy returned addressId under another field
    if (!mapped.id || mapped.id === "undefined") {
      const extractedId = String(
        (rawCreated as Record<string, unknown>).addressId ||
        (rawCreated as Record<string, unknown>).id ||
        `addr_${Date.now()}`
      );
      mapped.id = extractedId;
    }

    // Auto-select this newly created address
    const session = await getSwiggySession(this.householdId);
    if (session) {
      await prisma.commerceSession.update({
        where: { id: session.id },
        data: {
          selectedAddressId: mapped.id,
          selectedAddressName: mapped.formattedAddress,
        },
      });
    }

    console.log(`[Swiggy Provider] Successfully created and selected address: ${mapped.id} (${mapped.formattedAddress})`);
    return mapped;
  }

  async searchProducts(query: string, addressId?: string): Promise<CommerceProduct[]> {
    const client = await this.getClient();

    let targetAddressId = addressId;
    if (!targetAddressId) {
      const session = await getSwiggySession(this.householdId);
      targetAddressId = session?.selectedAddressId || undefined;
    }

    if (!targetAddressId) {
      // Auto-fetch delivery addresses if not yet selected
      const addresses = await this.getAddresses();
      if (addresses.length === 0) {
        throw new Error(
          "No delivery address found on your Swiggy account. Please select or add an address to continue."
        );
      }
      targetAddressId = addresses[0].id;
    }

    const result = await client.searchProducts(query, targetAddressId);

    if (!result.success || !result.data) {
      if (result.error) {
        throw new Error(result.error.message || `Swiggy search error for "${query}"`);
      }
      return [];
    }

    const data = result.data as Record<string, unknown>;
    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data.products)
      ? (data.products as Array<Record<string, unknown>>)
      : [];

    return rawList.map((p) =>
      mapSwiggyProduct(p as Record<string, unknown>)
    );
  }

  async updateCart(
    items: Array<{ variantId?: string; skuId?: string; spinId?: string; quantity: number }>,
    addressId?: string
  ): Promise<CommerceCart> {
    const client = await this.getClient();

    let targetAddressId = addressId;
    if (!targetAddressId) {
      const session = await getSwiggySession(this.householdId);
      targetAddressId = session?.selectedAddressId || undefined;
    }

    if (!targetAddressId) {
      const addresses = await this.getAddresses();
      if (addresses.length === 0) {
        throw new Error("No delivery address selected for cart update. Please select or add an address.");
      }
      targetAddressId = addresses[0].id;
    }

    const payloadItems = items.map((it) => ({
      spinId: it.spinId,
      skuId: it.skuId || it.variantId,
      variantId: it.variantId,
      quantity: it.quantity,
    }));

    const result = await client.updateCart(targetAddressId, payloadItems);

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || "Failed to update Swiggy Instamart cart");
    }

    return mapSwiggyCart(result.data as Record<string, unknown>);
  }

  async getCart(): Promise<CommerceCart> {
    const client = await this.getClient();
    const result = await client.getCart();

    if (!result.success || !result.data) {
      throw new Error(result.error?.message || "Failed to retrieve current Swiggy Instamart cart");
    }

    return mapSwiggyCart(result.data as Record<string, unknown>);
  }

  async clearCart(): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.clearCart();
    return Boolean(result.success);
  }
}
