import assert from "assert";
import {
  planCartMerge,
  isSameCartItem,
  syncAndMergeCartWithInstamart,
  DesiredCartAddition,
} from "../lib/services/cart-sync-service";
import { CommerceCart, CommerceCartItem, CommerceProvider } from "../lib/integrations/commerce/types";
import { getCommerceProvider } from "../lib/integrations/commerce/provider";
import { prisma } from "../lib/db/prisma";

async function runCartMergeSyncTests() {
  console.log("==================================================");
  console.log("🛒 RUNNING HH-OS SWIGGY CART MERGE & SYNC TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      const res = fn();
      if (res instanceof Promise) {
        return res
          .then(() => {
            console.log(`✓ PASS: ${name}`);
            passed++;
          })
          .catch((err) => {
            console.error(`✗ FAIL: ${name}`, err);
            failed++;
          });
      } else {
        console.log(`✓ PASS: ${name}`);
        passed++;
      }
    } catch (err) {
      console.error(`✗ FAIL: ${name}`, err);
      failed++;
    }
  }

  function createMockCart(items: CommerceCartItem[]): CommerceCart {
    return {
      items,
      itemCount: items.reduce((acc, it) => acc + it.quantity, 0),
      itemTotal: items.reduce((acc, it) => acc + it.totalPrice, 0),
      deliveryFee: 0,
      discount: 0,
      totalPayable: items.reduce((acc, it) => acc + it.totalPrice, 0),
      selectedAddressId: "mock_addr_1",
      selectedAddressName: "Home Address",
      merchantName: "Swiggy Instamart",
      merchantUrl: "https://www.swiggy.com/instamart",
      isRealMerchantCart: true,
    };
  }

  // ----------------------------------------------------
  // TEST SCENARIO A: EMPTY SWIGGY CART
  // ----------------------------------------------------
  console.log("--- Scenario A: Empty Swiggy Cart ---");

  test("adds refill items to an empty cart without issues", () => {
    const emptyCart = createMockCart([]);
    const desired: DesiredCartAddition[] = [
      {
        productName: "Amul Taaza Toned Milk",
        brand: "Amul",
        packSize: "1 L",
        quantity: 2,
        unitPrice: 56,
        spinId: "milk_spin_1",
        skuId: "milk_sku_1",
      },
      {
        productName: "Aashirvaad Shudh Chakki Atta",
        brand: "Aashirvaad",
        packSize: "5 kg",
        quantity: 1,
        unitPrice: 248,
        spinId: "atta_spin_1",
        skuId: "atta_sku_1",
      },
    ];

    const plan = planCartMerge(emptyCart, desired);

    assert.strictEqual(plan.unrelatedPreservedCount, 0, "No unrelated items to preserve");
    assert.strictEqual(plan.toppedUpCount, 0, "No items to top up");
    assert.strictEqual(plan.alreadySatisfiedCount, 0, "No items already satisfied");
    assert.strictEqual(plan.newlyAddedCount, 2, "Both items should be newly added");
    assert.strictEqual(plan.itemsToUpdate.length, 2, "Update payload must have 2 items");

    const milk = plan.itemsToUpdate.find((i) => i.spinId === "milk_spin_1");
    const atta = plan.itemsToUpdate.find((i) => i.spinId === "atta_spin_1");
    assert(milk !== undefined);
    assert.strictEqual(milk.quantity, 2);
    assert(atta !== undefined);
    assert.strictEqual(atta.quantity, 1);
  });

  // ----------------------------------------------------
  // TEST SCENARIO B: CART CONTAINING UNRELATED ITEMS
  // ----------------------------------------------------
  console.log("\n--- Scenario B: Cart Containing Unrelated Items ---");

  test("preserves unrelated items (Chips × 1, Coke × 2) when adding Milk × 2 and Atta × 1", () => {
    const existingCart = createMockCart([
      {
        id: "chips_1",
        productName: "Lay's Classic Salted Potato Chips",
        brand: "Lay's",
        packSize: "50 g",
        quantity: 1,
        unitPrice: 20,
        totalPrice: 20,
        spinId: "chips_spin",
        skuId: "chips_sku",
      },
      {
        id: "coke_1",
        productName: "Coca-Cola Original Taste",
        brand: "Coca-Cola",
        packSize: "750 ml",
        quantity: 2,
        unitPrice: 40,
        totalPrice: 80,
        spinId: "coke_spin",
        skuId: "coke_sku",
      },
    ]);

    const desired: DesiredCartAddition[] = [
      {
        productName: "Amul Taaza Toned Milk",
        brand: "Amul",
        packSize: "1 L",
        quantity: 2,
        unitPrice: 56,
        spinId: "milk_spin",
        skuId: "milk_sku",
      },
      {
        productName: "Aashirvaad Shudh Chakki Atta",
        brand: "Aashirvaad",
        packSize: "5 kg",
        quantity: 1,
        unitPrice: 248,
        spinId: "atta_spin",
        skuId: "atta_sku",
      },
    ];

    const plan = planCartMerge(existingCart, desired);

    // Assertions matching user's exact specification:
    // Final cart must have:
    // - Chips × 1 (preserved)
    // - Coke × 2 (preserved)
    // - Milk × 2 (added)
    // - Atta × 1 (added)
    assert.strictEqual(plan.unrelatedPreservedCount, 2, "Both unrelated items must be preserved");
    assert.strictEqual(plan.newlyAddedCount, 2, "Both refill items must be added");
    assert.strictEqual(plan.itemsToUpdate.length, 4, "Total items in update payload must be 4");

    const chips = plan.itemsToUpdate.find((i) => i.spinId === "chips_spin");
    assert(chips !== undefined, "Chips must be present in update payload");
    assert.strictEqual(chips.quantity, 1, "Chips quantity must remain 1");

    const coke = plan.itemsToUpdate.find((i) => i.spinId === "coke_spin");
    assert(coke !== undefined, "Coke must be present in update payload");
    assert.strictEqual(coke.quantity, 2, "Coke quantity must remain 2");

    const milk = plan.itemsToUpdate.find((i) => i.spinId === "milk_spin");
    assert(milk !== undefined, "Milk must be present in update payload");
    assert.strictEqual(milk.quantity, 2, "Milk quantity must be 2");

    const atta = plan.itemsToUpdate.find((i) => i.spinId === "atta_spin");
    assert(atta !== undefined, "Atta must be present in update payload");
    assert.strictEqual(atta.quantity, 1, "Atta quantity must be 1");
  });

  // ----------------------------------------------------
  // TEST SCENARIO C: CART ALREADY CONTAINS ONE REFILL ITEM (SUFFICIENT QUANTITY)
  // ----------------------------------------------------
  console.log("\n--- Scenario C: Cart Containing One of Requested Items ---");

  test("does not duplicate or over-increment item if cart already has sufficient quantity (Milk × 2)", () => {
    const existingCart = createMockCart([
      {
        id: "chips_1",
        productName: "Lay's Classic Salted Potato Chips",
        brand: "Lay's",
        packSize: "50 g",
        quantity: 1,
        unitPrice: 20,
        totalPrice: 20,
        spinId: "chips_spin",
        skuId: "chips_sku",
      },
      {
        id: "milk_1",
        productName: "Amul Taaza Toned Milk",
        brand: "Amul",
        packSize: "1 L",
        quantity: 2,
        unitPrice: 56,
        totalPrice: 112,
        spinId: "milk_spin",
        skuId: "milk_sku",
      },
    ]);

    const desired: DesiredCartAddition[] = [
      {
        productName: "Amul Taaza Toned Milk",
        brand: "Amul",
        packSize: "1 L",
        quantity: 2, // Requested 2, cart already has 2!
        unitPrice: 56,
        spinId: "milk_spin",
        skuId: "milk_sku",
      },
      {
        productName: "Aashirvaad Shudh Chakki Atta",
        brand: "Aashirvaad",
        packSize: "5 kg",
        quantity: 1,
        unitPrice: 248,
        spinId: "atta_spin",
        skuId: "atta_sku",
      },
    ];

    const plan = planCartMerge(existingCart, desired);

    assert.strictEqual(plan.alreadySatisfiedCount, 1, "Milk should be recognized as already satisfied");
    assert.strictEqual(plan.newlyAddedCount, 1, "Only Atta should be newly added");
    assert.strictEqual(plan.unrelatedPreservedCount, 1, "Chips must be preserved");
    assert.strictEqual(plan.itemsToUpdate.length, 3, "Cart payload must have 3 items total");

    const milk = plan.itemsToUpdate.find((i) => i.spinId === "milk_spin");
    assert(milk !== undefined);
    assert.strictEqual(milk.quantity, 2, "Milk quantity must remain 2, not 4");

    const detailMilk = plan.mergedDetails.find((d) => d.spinId === "milk_spin");
    assert.strictEqual(detailMilk?.addedQuantity, 0, "Added quantity for Milk must be 0");
    assert.strictEqual(detailMilk?.source, "ALREADY_SATISFIED");
  });

  // ----------------------------------------------------
  // TEST SCENARIO D: CART CONTAINS SMALLER QUANTITY OF REQUESTED ITEM
  // ----------------------------------------------------
  console.log("\n--- Scenario D: Cart Contains Smaller Quantity of Requested Item ---");

  test("adds only missing quantity when cart has Milk × 1 and HH-OS requires Milk × 2", () => {
    // Exact user example:
    // Existing cart: Milk × 1, Coke × 2
    // HH-OS requires: Milk × 2, Atta × 1
    // Expected final: Milk × 2 (topped up by 1), Coke × 2 (preserved), Atta × 1 (added)
    const existingCart = createMockCart([
      {
        id: "milk_1",
        productName: "Amul Taaza Toned Milk",
        brand: "Amul",
        packSize: "1 L",
        quantity: 1, // Only 1 in cart
        unitPrice: 56,
        totalPrice: 56,
        spinId: "milk_spin",
        skuId: "milk_sku",
      },
      {
        id: "coke_1",
        productName: "Coca-Cola Original Taste",
        brand: "Coca-Cola",
        packSize: "750 ml",
        quantity: 2,
        unitPrice: 40,
        totalPrice: 80,
        spinId: "coke_spin",
        skuId: "coke_sku",
      },
    ]);

    const desired: DesiredCartAddition[] = [
      {
        productName: "Amul Taaza Toned Milk",
        brand: "Amul",
        packSize: "1 L",
        quantity: 2, // Needs 2
        unitPrice: 56,
        spinId: "milk_spin",
        skuId: "milk_sku",
      },
      {
        productName: "Aashirvaad Shudh Chakki Atta",
        brand: "Aashirvaad",
        packSize: "5 kg",
        quantity: 1, // Needs 1
        unitPrice: 248,
        spinId: "atta_spin",
        skuId: "atta_sku",
      },
    ];

    const plan = planCartMerge(existingCart, desired);

    assert.strictEqual(plan.toppedUpCount, 1, "Milk must be topped up");
    assert.strictEqual(plan.newlyAddedCount, 1, "Atta must be newly added");
    assert.strictEqual(plan.unrelatedPreservedCount, 1, "Coke must be preserved");

    const milk = plan.itemsToUpdate.find((i) => i.spinId === "milk_spin");
    assert(milk !== undefined);
    assert.strictEqual(milk.quantity, 2, "Final quantity of Milk must be 2");

    const detailMilk = plan.mergedDetails.find((d) => d.spinId === "milk_spin");
    assert.strictEqual(detailMilk?.existingQuantity, 1, "Existing quantity was 1");
    assert.strictEqual(detailMilk?.addedQuantity, 1, "Added missing quantity must be 1");
    assert.strictEqual(detailMilk?.source, "QUANTITY_TOPPED_UP");

    const coke = plan.itemsToUpdate.find((i) => i.spinId === "coke_spin");
    assert(coke !== undefined);
    assert.strictEqual(coke.quantity, 2, "Coke must remain 2");

    const atta = plan.itemsToUpdate.find((i) => i.spinId === "atta_spin");
    assert(atta !== undefined);
    assert.strictEqual(atta.quantity, 1, "Atta must be 1");
  });

  // ----------------------------------------------------
  // TEST SCENARIO E: LIVE NON-DESTRUCTIVE SYNC WITH SWIGGY INSTAMART
  // ----------------------------------------------------
  console.log("\n--- Scenario E: Live Swiggy Instamart Basket Sync ---");

  await test("live syncAndMergeCartWithInstamart fetches real cart and preserves items", async () => {
    const provider = await getCommerceProvider();
    const isAuth = await provider.isAuthenticated();

    if (isAuth) {
      const addresses = await provider.getAddresses();
      assert(addresses.length > 0, "Should have saved delivery address");

      const existingBefore = await provider.getCart();
      console.log(`   Live basket before test: ${existingBefore.itemCount} items (₹${existingBefore.totalPayable})`);

      // Request adding Tata Salt (or updating its quantity)
      const desiredAddition: DesiredCartAddition = {
        productName: "Tata Salt, Iodised Namak, Vacuum Evaporated Salt",
        brand: "Tata",
        packSize: "1 kg",
        quantity: 2,
        unitPrice: 29,
        spinId: "UEURIRMFHO",
        skuId: "OPK854953A",
      };

      const result = await syncAndMergeCartWithInstamart(
        provider,
        addresses[0].id,
        [desiredAddition]
      );

      assert(result.liveCart !== null, "Must return verified live cart");
      assert(result.liveCart.itemCount >= 1, "Live cart must contain items");
      console.log(`   Live basket after test: ${result.liveCart.itemCount} items (₹${result.liveCart.totalPayable})`);

      // Verify that Tata Salt is in the cart with at least quantity 2
      const saltInCart = result.liveCart.items.find(
        (i) => i.productName.toLowerCase().includes("salt") || i.spinId === "UEURIRMFHO"
      );
      assert(saltInCart !== undefined, "Tata Salt must be present in live cart");
      assert(saltInCart.quantity >= 2, "Tata Salt quantity must be at least 2");

      // Verify Prisma mirroring
      const dbItems = await prisma.cartItem.findMany();
      assert(dbItems.length > 0, "Prisma CartItem table must have mirrored records");
      console.log(`   Prisma mirrored items: ${dbItems.length}`);
    } else {
      console.log("   (Swiggy account not connected, skipping live MCP check)");
    }
  });

  console.log("\n==================================================");
  console.log(`🏁 CART MERGE TEST SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runCartMergeSyncTests()
  .then(() => {
    prisma.$disconnect().then(() => process.exit(0));
  })
  .catch((err) => {
    console.error("Test runner error:", err);
    prisma.$disconnect().then(() => process.exit(1));
  });
