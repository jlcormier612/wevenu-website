/**
 * Server-only founder arrangement store accessor.
 * Do not import from marketing Client Components.
 */

import "server-only";

import {
  createMemoryFounderArrangementStore,
  preferPostgresFounderArrangementStore,
  setFounderArrangementStoreForTests,
  resetFounderArrangementStoreForTests,
  type FounderArrangementStore,
} from "./founder-store";
import { createPostgresFounderArrangementStore } from "./founder-store-postgres";

export type { FounderArrangementStore };
export {
  setFounderArrangementStoreForTests,
  resetFounderArrangementStoreForTests,
};

let cached: FounderArrangementStore | null = null;

export function getFounderArrangementStore(): FounderArrangementStore {
  if (cached) return cached;
  if (preferPostgresFounderArrangementStore()) {
    cached = createPostgresFounderArrangementStore();
  } else {
    cached = createMemoryFounderArrangementStore();
  }
  return cached;
}

export function requireDurableFounderArrangementStore(): FounderArrangementStore {
  const store = getFounderArrangementStore();
  if (!store.durable) {
    throw new Error(
      "Founder arrangement store is not durable — set PRICING_FOUNDER_STORE=postgres and configure service-role.",
    );
  }
  return store;
}
