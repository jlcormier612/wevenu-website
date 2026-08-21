/**
 * Shared Relationship store — Postgres (durable) with optional file fallback.
 *
 * When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (marketing / workspace
 * ECS), the store uses htc_crm_* tables via htc_crm_load_store /
 * htc_crm_replace_store. Set HTC_CRM_STORE=file to force JSONL for local smoke.
 *
 * Cross-task safety: optimistic version on htc_crm_store_meta with retries.
 */

import { createCrmAdminClient, usePostgresCrmStore } from "./pg-client";
import {
  loadFileStore,
  loadFileStoreSync,
  saveFileStore,
  withFileStore,
} from "./store-file";
import type { LiveRelationshipStore } from "./types";

const EMPTY_STORE: LiveRelationshipStore = {
  relationships: [],
  timelineEvents: [],
  communications: [],
  walkthroughs: [],
  subscriptions: [],
  notifications: [],
  tasks: [],
  supportInboxItems: [],
};

const MAX_OPTIMISTIC_RETRIES = 8;

/** Process-local snapshot so sync callers see the latest durable load/save. */
let memoryCache: LiveRelationshipStore | null = null;
let memoryVersion: number | null = null;
let warmInFlight: Promise<LiveRelationshipStore> | null = null;
let mutationChain: Promise<void> = Promise.resolve();

function normalizeStore(raw: LiveRelationshipStore | null | undefined): LiveRelationshipStore {
  const store = raw ? structuredClone(raw) : emptyLiveStore();
  if (!store.tasks) store.tasks = [];
  if (!store.supportInboxItems) store.supportInboxItems = [];
  return store;
}

function setCache(store: LiveRelationshipStore, version?: number | null): LiveRelationshipStore {
  memoryCache = normalizeStore(store);
  if (typeof version === "number") memoryVersion = version;
  return normalizeStore(memoryCache);
}

export function emptyLiveStore(): LiveRelationshipStore {
  return structuredClone(EMPTY_STORE);
}

type LoadedPostgres = { store: LiveRelationshipStore; version: number };

function isVersionConflict(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? "";
  return (
    error.code === "40001" ||
    msg.includes("htc_crm_version_conflict") ||
    msg.includes("40001")
  );
}

async function loadPostgresStore(): Promise<LoadedPostgres> {
  const admin = createCrmAdminClient();
  const { data, error } = await admin.rpc("htc_crm_load_store");
  if (error) {
    throw new Error(`htc_crm_load_store failed: ${error.message}`);
  }
  const payload = data as { version?: number; store?: LiveRelationshipStore } | LiveRelationshipStore;
  // Backward-compatible if an older RPC still returns the bare store.
  if (payload && typeof payload === "object" && "store" in payload) {
    return {
      version: typeof payload.version === "number" ? payload.version : 0,
      store: normalizeStore(payload.store),
    };
  }
  return { version: 0, store: normalizeStore(payload as LiveRelationshipStore) };
}

async function savePostgresStore(
  store: LiveRelationshipStore,
  expectedVersion: number | null,
): Promise<number> {
  const normalized = normalizeStore(store);
  const admin = createCrmAdminClient();
  const { data, error } = await admin.rpc("htc_crm_replace_store", {
    p_store: normalized,
    p_expected_version: expectedVersion,
  });
  if (error) {
    const err = new Error(`htc_crm_replace_store failed: ${error.message}`) as Error & {
      code?: string;
    };
    err.code = error.code;
    throw err;
  }
  const next =
    typeof data === "number"
      ? data
      : typeof data === "string"
        ? Number(data)
        : (expectedVersion ?? 0) + 1;
  setCache(normalized, next);
  return next;
}

/** Ensure the in-memory cache matches Postgres (call from app layouts). */
export async function warmLiveStore(): Promise<LiveRelationshipStore> {
  if (!usePostgresCrmStore()) {
    const store = await loadFileStore();
    return setCache(store, null);
  }
  if (memoryCache) {
    return normalizeStore(memoryCache);
  }
  if (!warmInFlight) {
    warmInFlight = loadPostgresStore()
      .then(({ store, version }) => setCache(store, version))
      .finally(() => {
        warmInFlight = null;
      });
  }
  return warmInFlight;
}

/** Sync load for workspace Server Components / founder capacity. */
export function loadLiveStoreSync(): LiveRelationshipStore {
  if (memoryCache) {
    return normalizeStore(memoryCache);
  }
  if (usePostgresCrmStore()) {
    // Cache not warmed yet — return empty rather than reading a stale file
    // mirror. Callers should await warmLiveStore() in layouts / route handlers.
    return emptyLiveStore();
  }
  return loadFileStoreSync();
}

export async function loadLiveStore(): Promise<LiveRelationshipStore> {
  if (usePostgresCrmStore()) {
    const { store, version } = await loadPostgresStore();
    return setCache(store, version);
  }
  const store = await loadFileStore();
  return setCache(store, null);
}

export async function hasLiveRelationships(): Promise<boolean> {
  const store = await loadLiveStore();
  return store.relationships.length > 0;
}

export function hasLiveRelationshipsSync(): boolean {
  return loadLiveStoreSync().relationships.length > 0;
}

/** Replace the entire live store (used by service mutations under lock). */
export async function saveLiveStore(store: LiveRelationshipStore): Promise<void> {
  if (usePostgresCrmStore()) {
    let version = memoryVersion;
    for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt++) {
      try {
        if (version === null) {
          const loaded = await loadPostgresStore();
          version = loaded.version;
        }
        await savePostgresStore(store, version);
        return;
      } catch (error) {
        if (!isVersionConflict(error as { message?: string; code?: string })) throw error;
        const loaded = await loadPostgresStore();
        version = loaded.version;
      }
    }
    throw new Error("htc_crm_replace_store: exhausted optimistic retries");
  }
  await saveFileStore(store);
  setCache(store, null);
}

/**
 * Mutate the store under an exclusive lock.
 * Prefer this over load+save for concurrent marketing + workspace writes.
 */
export async function withLiveStore<T>(
  mutate: (store: LiveRelationshipStore) => T | Promise<T>,
): Promise<{ result: T; store: LiveRelationshipStore }> {
  if (!usePostgresCrmStore()) {
    const out = await withFileStore(mutate);
    setCache(out.store, null);
    return out;
  }

  let resolveNext!: () => void;
  const gate = new Promise<void>((resolve) => {
    resolveNext = resolve;
  });
  const previous = mutationChain;
  mutationChain = previous.then(() => gate);

  try {
    await previous;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt++) {
      const { store, version } = await loadPostgresStore();
      const result = await mutate(store);
      try {
        await savePostgresStore(store, version);
        return { result, store: normalizeStore(store) };
      } catch (error) {
        lastError = error;
        if (!isVersionConflict(error as { message?: string; code?: string })) throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("htc_crm withLiveStore: exhausted optimistic retries");
  } finally {
    resolveNext();
  }
}
