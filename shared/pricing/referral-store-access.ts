/**
 * Server-only referral store accessor.
 */

import "server-only";

import {
  createMemoryReferralStore,
  getTestReferralStoreOverride,
  preferPostgresReferralStore,
  setReferralStoreForTests,
  resetReferralStoreForTests,
  type ReferralStore,
} from "./referral-store";
import { createPostgresReferralStore } from "./referral-store-postgres";

export type { ReferralStore };
export { setReferralStoreForTests, resetReferralStoreForTests };

let cached: ReferralStore | null = null;

export function getReferralStore(): ReferralStore {
  const override = getTestReferralStoreOverride();
  if (override) return override;
  if (cached) return cached;
  if (preferPostgresReferralStore()) {
    cached = createPostgresReferralStore();
  } else {
    cached = createMemoryReferralStore();
  }
  return cached;
}

export function requireDurableReferralStore(): ReferralStore {
  const store = getReferralStore();
  if (!store.durable) {
    throw new Error(
      "Referral store is not durable — set REFERRAL_STORE=postgres and configure service-role.",
    );
  }
  return store;
}
