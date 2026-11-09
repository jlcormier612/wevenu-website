/**
 * Server-only accessor for the Phase 4 organization store.
 *
 * Import this module only from Route Handlers / server code — never from
 * Client Components. Kept out of the `@shared/pricing` barrel so marketing
 * Client Components that import readiness helpers never pull the service-role
 * Postgres adapter into the browser bundle.
 */
import { createPostgresGroupOrgStore } from "./group-org-store-postgres";
import {
  createMemoryGroupOrgStore,
  preferPostgresGroupOrgStore,
  type GroupOrgStore,
} from "./group-org-store";

export type { GroupOrgStore };

let testStore: GroupOrgStore | null = null;
let postgresSingleton: GroupOrgStore | null = null;

export function setGroupOrgStoreForTests(store: GroupOrgStore | null) {
  testStore = store;
}

export function resetGroupOrgStoreForTests() {
  testStore = null;
}

export function getGroupOrgStore(): GroupOrgStore {
  if (testStore) return testStore;
  if (preferPostgresGroupOrgStore()) {
    if (!postgresSingleton) {
      postgresSingleton = createPostgresGroupOrgStore();
    }
    return postgresSingleton;
  }
  return createMemoryGroupOrgStore();
}

export function requireDurableGroupOrgStore(): GroupOrgStore {
  const store = getGroupOrgStore();
  if (!store.durable) {
    throw new Error(
      "Phase 4 organization group pricing requires durable Postgres persistence (saas_organizations).",
    );
  }
  return store;
}
