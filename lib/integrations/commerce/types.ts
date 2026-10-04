export interface CommerceAddress {
  id: string;
  name?: string;
  addressLine: string;
  area?: string;
  city?: string;
  landmark?: string;
  postalCode?: string;
  formattedAddress: string;
  isDefault?: boolean;
}

export interface CommerceCreateAddressInput {
  fullAddress: string;
  addressLine: string;
  addressLine2?: string;
  locality?: string;
  city: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  addressCategory?: "HOME" | "WORK" | "OFFICE" | "FRIENDS_AND_FAMILY" | "OTHER";
  addressTag?: string;
  userName: string;
  userPhone: string;
}

export interface CommerceVariant {
  id: string;
  name: string;
  packSize: string;
  price: number;
  mrp?: number;
  discountPercentage?: number;
  inStock: boolean;
  unit?: string;
  quantityValue?: number;
  skuId?: string;
  spinId?: string;
  maxQuantity?: number;
}

export interface CommerceProduct {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  description?: string;
  imageUrl?: string;
  variants: CommerceVariant[];
  selectedVariant?: CommerceVariant;
}

export interface CommerceCartItem {
  id: string;
  productName: string;
  brand?: string;
  packSize: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantId?: string;
  skuId?: string;
  spinId?: string;
  inStock?: boolean;
}

export interface CommerceCart {
  items: CommerceCartItem[];
  itemCount: number;
  itemTotal: number;
  deliveryFee: number;
  discount: number;
  totalPayable: number;
  selectedAddressId?: string;
  selectedAddressName?: string;
  merchantName: string;
  merchantUrl: string;
  isRealMerchantCart: boolean;
}

export interface ShoppingIntentItem {
  query: string;
  brand?: string;
  maxBudget?: number;
  preferredPackSize?: string;
  quantity?: number;
  preference?: "best_value" | "cheapest" | "premium" | "exact";
  reason?: string;
  source: "INVENTORY_REPLENISHMENT" | "AD_HOC_USER_REQUEST";
}

export interface CommerceProvider {
  name: string;
  isAuthenticated(): Promise<boolean>;
  getAuthUrl(redirectUri: string): Promise<{ url: string; state: string; codeVerifier: string }>;
  handleAuthCallback(code: string, state: string, redirectUri: string): Promise<boolean>;
  getAddresses(page?: number, pageSize?: number, fetchAll?: boolean): Promise<CommerceAddress[]>;
  selectAddress(addressId: string): Promise<boolean>;
  createAddress(input: CommerceCreateAddressInput): Promise<CommerceAddress>;
  searchProducts(query: string, addressId?: string): Promise<CommerceProduct[]>;
  updateCart(
    items: Array<{ variantId?: string; skuId?: string; spinId?: string; quantity: number }>,
    addressId?: string
  ): Promise<CommerceCart>;
  getCart(): Promise<CommerceCart>;
  clearCart(): Promise<boolean>;
}
