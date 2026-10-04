import { CommerceProvider } from "./types";
import { SwiggyInstamartProvider } from "./swiggy-instamart/tools";

/**
 * Get active commerce provider instance for a household
 */
export async function getCommerceProvider(householdId?: string): Promise<CommerceProvider> {
  return new SwiggyInstamartProvider(householdId);
}
