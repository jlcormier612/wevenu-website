/**
 * Server-only sales offer store accessor.
 * Do not import from Client Components.
 */

import "server-only";

import {
  createMemorySalesOfferStore,
  type SalesOfferStore,
} from "./sales-offer-store";
import { createPostgresSalesOfferStore } from "./sales-offer-store-postgres";

let testStore: SalesOfferStore | null = null;
let cached: SalesOfferStore | null = null;

export function setSalesOfferStoreForTests(store: SalesOfferStore | null) {
  testStore = store;
  cached = null;
}

export function resetSalesOfferStoreForTests() {
  testStore = null;
  cached = null;
}

export function preferPostgresSalesOfferStore(): boolean {
  if (process.env.PRICING_SALES_OFFER_STORE === "memory") return false;
  if (process.env.PRICING_SALES_OFFER_STORE === "postgres") return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url?.trim() && key?.trim());
}

export function getSalesOfferStore(): SalesOfferStore {
  if (testStore) return testStore;
  if (cached) return cached;
  if (preferPostgresSalesOfferStore()) {
    cached = createPostgresSalesOfferStore();
  } else {
    cached = createMemorySalesOfferStore();
  }
  return cached;
}

export function requireDurableSalesOfferStore(): SalesOfferStore {
  const store = getSalesOfferStore();
  if (!store.durable) {
    throw new Error(
      "Sales offer store is not durable — set PRICING_SALES_OFFER_STORE=postgres and configure service-role.",
    );
  }
  return store;
}

export type { SalesOfferStore };
