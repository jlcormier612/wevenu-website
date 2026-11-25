/**
 * Durable Program 3 persistence via Supabase/Postgres (htc_program3_store).
 * Uses the same service-role client posture as the Relationships CRM store.
 */

import {
  createCrmAdminClient,
  usePostgresCrmStore,
} from "@shared/relationships/pg-client";

import {
  emptyProgram3Document,
  normalizeProgram3Document,
  type Program3Document,
} from "./document";

export function usePostgresProgram3Store(): boolean {
  return usePostgresCrmStore();
}

type LoadResult = {
  version: number;
  document: Program3Document;
};

let memory: Program3Document | null = null;
let memoryVersion = 0;
let warmInFlight: Promise<LoadResult> | null = null;
let mutationChain: Promise<void> = Promise.resolve();

const MAX_RETRIES = 8;

export function getProgram3MemorySync(): Program3Document | null {
  return memory ? structuredClone(memory) : null;
}

export function getProgram3MemoryVersionSync(): number {
  return memoryVersion;
}

async function loadFromPostgres(): Promise<LoadResult> {
  const client = createCrmAdminClient();
  const { data, error } = await client.rpc("htc_program3_load_store");
  if (error) {
    throw new Error(`htc_program3_load_store failed: ${error.message}`);
  }
  const payload = (data ?? {}) as {
    version?: number;
    document?: Partial<Program3Document>;
  };
  const version = Number(payload.version ?? 0);
  const document = normalizeProgram3Document(payload.document);
  memory = document;
  memoryVersion = version;
  return { version, document: structuredClone(document) };
}

export async function loadProgram3Document(): Promise<LoadResult> {
  if (warmInFlight) return warmInFlight;
  warmInFlight = loadFromPostgres().finally(() => {
    warmInFlight = null;
  });
  return warmInFlight;
}

export function ensureProgram3MemorySync(): Program3Document {
  if (memory) return structuredClone(memory);
  // Sync path before first async warm — empty until ensureProgram3Data.
  return emptyProgram3Document();
}

export async function mutateProgram3Document<T>(
  fn: (doc: Program3Document) => T | Promise<T>,
): Promise<T> {
  const run = async (): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      try {
        const loaded = memory
          ? { version: memoryVersion, document: structuredClone(memory) }
          : await loadProgram3Document();
        const working = structuredClone(loaded.document);
        const result = await fn(working);
        const client = createCrmAdminClient();
        const { data, error } = await client.rpc("htc_program3_replace_store", {
          p_document: working,
          p_expected_version: loaded.version,
        });
        if (error) {
          const msg = error.message || "";
          if (msg.includes("htc_program3_version_conflict")) {
            memory = null;
            await loadProgram3Document();
            lastError = error;
            continue;
          }
          throw new Error(`htc_program3_replace_store failed: ${msg}`);
        }
        const payload = (data ?? {}) as {
          version?: number;
          document?: Partial<Program3Document>;
        };
        memory = normalizeProgram3Document(payload.document ?? working);
        memoryVersion = Number(payload.version ?? loaded.version + 1);
        return result;
      } catch (error) {
        lastError = error;
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("htc_program3_version_conflict")) {
          memory = null;
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("htc_program3_replace_store exhausted retries");
  };

  const next = mutationChain.then(run, run);
  mutationChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function resetProgram3MemoryForTests(): void {
  memory = null;
  memoryVersion = 0;
  warmInFlight = null;
  mutationChain = Promise.resolve();
}
