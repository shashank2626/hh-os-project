import {
  CommerceAddress,
  CommerceProduct,
  CommerceVariant,
  CommerceCart,
  CommerceCartItem,
} from "../types";

export function mapSwiggyAddress(raw: Record<string, unknown>): CommerceAddress {
  const id = String(
    raw.id ||
    raw.addressId ||
    raw.address_id ||
    raw.addrId ||
    raw.addr_id ||
    raw.id_ ||
    raw._id ||
    ""
  );

  const addressLine = String(
    raw.addressLine ||
    raw.address_line ||
    raw.addressLine1 ||
    raw.address ||
    raw.fullAddress ||
    raw.full_address ||
    raw.display_address ||
    raw.formattedAddress ||
    raw.formatted_address ||
    "Delivery Address"
  );

  const area = (raw.area || raw.locality || raw.sublocality)
    ? String(raw.area || raw.locality || raw.sublocality)
    : undefined;

  const city = (raw.city || raw.cityName || raw.city_name)
    ? String(raw.city || raw.cityName || raw.city_name)
    : undefined;

  const landmark = raw.landmark ? String(raw.landmark) : undefined;

  const postalCode = (raw.postalCode || raw.postal_code || raw.pincode || raw.pinCode || raw.zip)
    ? String(raw.postalCode || raw.postal_code || raw.pincode || raw.pinCode || raw.zip)
    : undefined;

  const name = (raw.name || raw.addressTag || raw.address_tag || raw.tag || raw.addressCategory)
    ? String(raw.name || raw.addressTag || raw.address_tag || raw.tag || raw.addressCategory)
    : undefined;

  let formatted = String(raw.formattedAddress || raw.formatted_address || raw.fullAddress || raw.full_address || "");
  if (!formatted || formatted === "undefined" || formatted === "null") {
    const parts = [addressLine, landmark, area, city, postalCode].filter(Boolean);
    formatted = parts.join(", ");
  }

  const isDefault = Boolean(raw.isDefault ?? raw.is_default ?? raw.default ?? false);

  return {
    id,
    name: name || (isDefault ? "Home (Default)" : "Delivery Address"),
    addressLine,
    area,
    city,
    landmark,
    postalCode,
    formattedAddress: formatted || addressLine || "Selected Delivery Address",
    isDefault,
  };
}

export function mapSwiggyProduct(raw: Record<string, unknown>): CommerceProduct {
  const id = String(
    raw.productId ||
    raw.id ||
    raw.skuId ||
    raw.parentProductId ||
    ""
  );

  const name = String(
    raw.displayName ||
    raw.name ||
    raw.title ||
    raw.productName ||
    ""
  );

  const brand = (raw.brand || raw.brandName) ? String(raw.brand || raw.brandName) : undefined;
  const description = raw.description ? String(raw.description) : undefined;
  const images = Array.isArray(raw.images) ? (raw.images as string[]) : [];
  const imageUrl =
    images[0] ||
    (typeof raw.imageUrl === "string" ? raw.imageUrl : undefined);

  // Check variations (Swiggy format) vs variants vs items
  let rawVariants = Array.isArray(raw.variations)
    ? (raw.variations as Array<Record<string, unknown>>)
    : Array.isArray(raw.variants)
    ? (raw.variants as Array<Record<string, unknown>>)
    : Array.isArray(raw.items)
    ? (raw.items as Array<Record<string, unknown>>)
    : [];

  // If no separate variations array is returned, use the root product as a single variant
  if (rawVariants.length === 0) {
    rawVariants = [raw];
  }

  const variants: CommerceVariant[] = rawVariants.map((v) => {
    const vId = String(v.spinId || v.skuId || v.id || v.variantId || id);
    const vName = String(v.displayName || v.name || v.title || name || "Standard");
    const packSize = String(v.quantityDescription || v.packSize || v.name || "Standard Pack");

    // Price handling: Swiggy returns { mrp: 435, offerPrice: 274 } or a number
    let price = 0;
    let mrp: number | undefined;

    if (v.price && typeof v.price === "object") {
      const pObj = v.price as Record<string, unknown>;
      price = Number(pObj.offerPrice ?? pObj.price ?? pObj.sellingPrice ?? pObj.mrp ?? 0);
      mrp = pObj.mrp ? Number(pObj.mrp) : undefined;
    } else {
      price = Number(v.price ?? v.offerPrice ?? v.sellingPrice ?? 0);
      mrp = v.mrp ? Number(v.mrp) : undefined;
    }

    const discount = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : undefined;

    const inStock =
      v.isInStockAndAvailable !== false &&
      v.inStock !== false &&
      v.isAvailable !== false &&
      v.isAvail !== false &&
      raw.inStock !== false &&
      raw.isAvail !== false;

    return {
      id: vId,
      name: vName,
      packSize,
      price,
      mrp,
      discountPercentage: discount,
      inStock,
      unit: v.unit ? String(v.unit) : undefined,
      quantityValue: v.quantity ? Number(v.quantity) : undefined,
      skuId: v.skuId ? String(v.skuId) : undefined,
      spinId: v.spinId ? String(v.spinId) : undefined,
      maxQuantity: v.maxQuantity ? Number(v.maxQuantity) : raw.maxQuantity ? Number(raw.maxQuantity) : undefined,
    };
  });

  return {
    id,
    name,
    brand: brand || (rawVariants[0]?.brandName ? String(rawVariants[0].brandName) : undefined),
    category: raw.category ? String(raw.category) : undefined,
    description,
    imageUrl: imageUrl || (rawVariants[0]?.imageUrl ? String(rawVariants[0].imageUrl) : undefined),
    variants,
  };
}

export function mapSwiggyCart(raw: Record<string, unknown>): CommerceCart {
  const rawItems = Array.isArray(raw.items)
    ? (raw.items as Array<Record<string, unknown>>)
    : Array.isArray(raw.cartItems)
    ? (raw.cartItems as Array<Record<string, unknown>>)
    : [];

  const cartTotal = (raw.cartTotal as Record<string, unknown>) || {};

  const items: CommerceCartItem[] = rawItems.map((item) => {
    const id = String(item.id || item.cartItemId || item.skuId || item.spinId || item.productId || "");
    const productName = String(item.itemName || item.displayName || item.name || item.productName || "Item");
    const brand = (item.brand || item.brandName) ? String(item.brand || item.brandName) : undefined;
    const packSize = String(item.itemVariant || item.quantityDescription || item.packSize || "Standard");
    const quantity = Number(item.quantity || 1);

    let unitPrice = 0;
    if (item.discountedFinalPrice !== undefined && item.discountedFinalPrice !== null) {
      unitPrice = typeof item.discountedFinalPrice === "string"
        ? parseFloat(item.discountedFinalPrice.replace(/[^0-9.]/g, "")) || 0
        : Number(item.discountedFinalPrice);
    } else if (item.price && typeof item.price === "object") {
      const pObj = item.price as Record<string, unknown>;
      unitPrice = Number(pObj.offerPrice ?? pObj.price ?? pObj.sellingPrice ?? pObj.mrp ?? 0);
    } else {
      unitPrice = Number(item.price ?? item.unitPrice ?? item.mrp ?? 0);
    }

    const totalPrice = Number(item.totalPrice || unitPrice * quantity);

    return {
      id,
      productName,
      brand,
      packSize,
      quantity,
      unitPrice,
      totalPrice,
      variantId: item.variantId ? String(item.variantId) : undefined,
      skuId: item.skuId ? String(item.skuId) : undefined,
      spinId: item.spinId ? String(item.spinId) : undefined,
      inStock: item.inStock !== false && item.isInStockAndAvailable !== false,
    };
  });

  // Extract totals from cartTotal, cartTotalAmount, or billBreakdown
  const billBreakdown = (raw.billBreakdown as Record<string, unknown>) || {};
  const toPayObj = (billBreakdown.toPay as Record<string, unknown>) || {};
  const lineItems = Array.isArray(billBreakdown.lineItems) ? (billBreakdown.lineItems as Array<Record<string, unknown>>) : [];

  const rawItemTotalLine = lineItems.find((l) => String(l.label || "").toLowerCase().includes("item total"));
  const itemTotalParsed = rawItemTotalLine?.value
    ? parseFloat(String(rawItemTotalLine.value).replace(/[^0-9.]/g, ""))
    : undefined;

  const itemTotal = Number(
    itemTotalParsed ||
    cartTotal.itemTotal ||
    cartTotal.subtotal ||
    cartTotal.cartSubtotal ||
    items.reduce((acc, curr) => acc + curr.totalPrice, 0)
  );

  const rawDeliveryLine = lineItems.find((l) => String(l.label || "").toLowerCase().includes("delivery"));
  const deliveryParsed = rawDeliveryLine?.value && !String(rawDeliveryLine.value).toUpperCase().includes("FREE")
    ? parseFloat(String(rawDeliveryLine.value).replace(/[^0-9.]/g, ""))
    : 0;
  const deliveryFee = Number(deliveryParsed || cartTotal.deliveryFee || cartTotal.deliveryCharge || 0);

  const discount = Number(cartTotal.discount || 0);

  let totalPayable = 0;
  if (raw.cartTotalAmount) {
    totalPayable = parseFloat(String(raw.cartTotalAmount).replace(/[^0-9.]/g, "")) || 0;
  } else if (toPayObj.value) {
    totalPayable = parseFloat(String(toPayObj.value).replace(/[^0-9.]/g, "")) || 0;
  } else {
    totalPayable = Number(
      cartTotal.totalPayable ||
      cartTotal.toPay ||
      raw.totalPayable ||
      raw.toPay ||
      itemTotal + deliveryFee - discount
    );
  }

  const addressDetails = raw.selectedAddressDetails as Record<string, unknown> | undefined;
  const addressName = addressDetails?.name || addressDetails?.address || raw.selectedAddress;

  return {
    items,
    itemCount: items.reduce((sum, it) => sum + it.quantity, 0),
    itemTotal,
    deliveryFee,
    discount,
    totalPayable,
    selectedAddressId: raw.selectedAddress
      ? String(raw.selectedAddress)
      : addressDetails?.id
      ? String(addressDetails.id)
      : undefined,
    selectedAddressName: addressName ? String(addressName) : undefined,
    merchantName: "Swiggy Instamart",
    merchantUrl: "https://www.swiggy.com/instamart",
    isRealMerchantCart: true,
  };
}
