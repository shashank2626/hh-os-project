export class SwiggyAuthError extends Error {
  constructor(message = "Swiggy Instamart is not connected or authorization token expired.") {
    super(message);
    this.name = "SwiggyAuthError";
  }
}

export class SwiggyAddressRequiredError extends Error {
  constructor(message = "Swiggy delivery address is required. Please call get_addresses or provide an address first.") {
    super(message);
    this.name = "SwiggyAddressRequiredError";
  }
}

export interface SwiggyCreateAddressParams {
  fullAddress: string;
  addressLine: string;
  addressLine2?: string;
  locality?: string;
  city: string;
  postalCode: string;
  addressCategory?: "HOME" | "WORK" | "OFFICE" | "FRIENDS_AND_FAMILY" | "OTHER";
  addressTag?: string;
  userName: string;
  userPhone: string;
  latitude?: number;
  longitude?: number;
}

export interface SwiggyRawToolResult<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code?: string;
    message: string;
    details?: unknown;
  };
}

export class SwiggyInstamartClient {
  private endpoint = "https://mcp.swiggy.com/im";
  private accessToken: string | null;

  constructor(accessToken: string | null) {
    this.accessToken = accessToken;
  }

  /**
   * Execute an official Swiggy Instamart MCP tool call over HTTP POST with JSON-RPC
   */
  async callTool<T = unknown>(
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<SwiggyRawToolResult<T>> {
    if (!this.accessToken) {
      throw new SwiggyAuthError(
        "Instamart isn't connected yet. Connect your Swiggy account to enable real shopping."
      );
    }

    const payload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    console.log(`[Swiggy MCP Request] -> Tool: ${toolName}`, JSON.stringify(args));

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
    } catch (networkErr: unknown) {
      const msg = networkErr instanceof Error ? networkErr.message : "Network error";
      console.error(`[Swiggy MCP Network Error] Tool: ${toolName}:`, msg);
      throw new Error(`Unable to reach Swiggy Instamart MCP service (${this.endpoint}): ${msg}`);
    }

    if (response.status === 401) {
      console.error(`[Swiggy MCP Auth Error] HTTP 401 Unauthorized for tool ${toolName}`);
      throw new SwiggyAuthError(
        "Swiggy access token expired or invalid (HTTP 401). Please reconnect your Swiggy account."
      );
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Swiggy MCP HTTP Error] HTTP ${response.status} for tool ${toolName}:`, errText);
      throw new Error(
        `Swiggy Instamart MCP error [HTTP ${response.status}]: ${errText || response.statusText}`
      );
    }

    const resJson = await response.json();
    console.log(`[Swiggy MCP Response] <- Tool: ${toolName}:`, JSON.stringify(resJson, null, 2));

    // Check JSON-RPC top-level error response
    if (resJson.error) {
      const errCode = resJson.error.code;
      if (errCode === -32001 || resJson.error.message?.includes("token") || resJson.error.message?.includes("auth")) {
        throw new SwiggyAuthError(resJson.error.message);
      }
      return {
        success: false,
        error: {
          code: String(resJson.error.code || "MCP_ERROR"),
          message: resJson.error.message || "Unknown Swiggy MCP error",
        },
      };
    }

    // Swiggy tool result format in MCP
    const result = resJson.result;
    if (result && typeof result === "object") {
      // Priority 1: Check for MCP structuredContent (official Swiggy MCP provides parsed JSON here)
      if (result.structuredContent && typeof result.structuredContent === "object") {
        const sc = result.structuredContent as Record<string, unknown>;
        console.log(`[Swiggy MCP StructuredContent] Tool: ${toolName}:`, JSON.stringify(sc, null, 2));

        if (sc.success === false || sc.error || result.isError) {
          return {
            success: false,
            error: (sc.error as SwiggyRawToolResult["error"]) || {
              message: (sc.message as string) || "MCP Tool reported error in structuredContent",
            },
            data: (sc.data !== undefined ? sc.data : sc) as T,
          };
        }

        return {
          success: true,
          data: (sc.data !== undefined ? sc.data : sc) as T,
          message: typeof sc.message === "string" ? sc.message : undefined,
        };
      }

      // Case A: Result is content-wrapped MCP format (JSON inside content[0].text)
      if (Array.isArray(result.content)) {
        const textItem = result.content.find((c: { type: string; text?: string }) => c.type === "text");
        if (textItem?.text) {
          try {
            const parsed = JSON.parse(textItem.text);
            console.log(`[Swiggy MCP Parsed Content] Tool: ${toolName}:`, JSON.stringify(parsed, null, 2));

            // Check if parsed payload indicates error
            if (parsed && typeof parsed === "object" && (parsed.success === false || parsed.error)) {
              return {
                success: false,
                error: parsed.error || { message: parsed.message || "MCP Tool reported failure" },
                data: (parsed.data ?? parsed) as T,
              };
            }

            // If parsed payload has a data property, normalize it
            if (parsed && typeof parsed === "object" && parsed.data !== undefined) {
              return {
                success: parsed.success !== false,
                data: parsed.data as T,
                message: parsed.message,
              };
            }

            return {
              success: !result.isError,
              data: parsed as T,
            };
          } catch {
            return {
              success: !result.isError,
              data: textItem.text as unknown as T,
            };
          }
        }
      }

      // Case B: Result is directly the Swiggy payload
      if ("success" in result) {
        const resObj = result as Record<string, unknown>;
        return {
          success: Boolean(resObj.success),
          data: (resObj.data !== undefined ? resObj.data : resObj) as T,
          message: typeof resObj.message === "string" ? resObj.message : undefined,
          error: resObj.error as SwiggyRawToolResult["error"],
        };
      }

      return {
        success: true,
        data: result as T,
      };
    }

    return {
      success: true,
      data: resJson as T,
    };
  }

  /**
   * Tool: get_addresses
   * Official Swiggy MCP arguments: { page?: number, pageSize?: number }
   */
  async getAddresses(page = 1, pageSize = 10) {
    return await this.callTool<{
      addresses?: Array<Record<string, unknown>>;
      pagination?: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
      };
    }>("get_addresses", { page, pageSize });
  }

  /**
   * Tool: create_address
   * Official Swiggy MCP arguments: SwiggyCreateAddressParams
   */
  async createAddress(params: SwiggyCreateAddressParams) {
    return await this.callTool<Record<string, unknown>>("create_address", params as unknown as Record<string, unknown>);
  }

  /**
   * Tool: search_products
   */
  async searchProducts(query: string, addressId: string, offset = 0) {
    if (!addressId) {
      throw new SwiggyAddressRequiredError();
    }
    return await this.callTool<{
      products?: Array<Record<string, unknown>>;
    }>("search_products", {
      addressId,
      query: query.trim(),
      offset,
    });
  }

  /**
   * Tool: update_cart
   */
  async updateCart(
    selectedAddressId: string,
    items: Array<{ spinId?: string; skuId?: string; variantId?: string; quantity: number }>
  ) {
    if (!selectedAddressId) {
      throw new SwiggyAddressRequiredError();
    }
    return await this.callTool<{
      selectedAddress?: string;
      items?: Array<Record<string, unknown>>;
      cartTotal?: {
        itemTotal: number;
        deliveryFee: number;
        discount: number;
        totalPayable: number;
      };
    }>("update_cart", {
      selectedAddressId,
      items,
    });
  }

  /**
   * Tool: get_cart
   */
  async getCart() {
    return await this.callTool<{
      selectedAddress?: string;
      selectedAddressDetails?: Record<string, unknown>;
      items?: Array<Record<string, unknown>>;
      cartTotal?: {
        itemTotal: number;
        deliveryFee: number;
        discount: number;
        totalPayable: number;
      };
      totalPayable?: number;
    }>("get_cart", {});
  }

  /**
   * Tool: clear_cart
   */
  async clearCart() {
    return await this.callTool("clear_cart", {});
  }
}
