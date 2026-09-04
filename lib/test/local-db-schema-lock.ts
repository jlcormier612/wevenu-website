/**
 * Shared filesystem lock for local DB tests that apply DDL or hammer
 * PostgREST against the same Postgres. Prevents concurrent CREATE OR REPLACE
 * / schema reloads from colliding (PGRST002 + statement timeouts under
 * full-suite load). Same lock directory used by availability/tour/migration
 * DB tests — all callers must use these helpers so waiters queue instead of
 * racing with divergent 90s timeouts.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCK_DIR = join(tmpdir(), "wevenu-k7-avail-schema.lock");
/** Long enough for the full suite to serialize DB-heavy tests under contention. */
const WAIT_MS = 900_000;

function waitTimedOut(started: number): boolean {
  return Date.now() - started > WAIT_MS;
}

function pauseBriefly(): void {
  spawnSync("sleep", ["0.05"], { encoding: "utf8" });
}

export async function withLocalDbSchemaLock<T>(fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  while (true) {
    try {
      mkdirSync(LOCK_DIR);
      break;
    } catch {
      if (waitTimedOut(started)) {
        throw new Error("timed out waiting for local DB schema lock");
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  try {
    return await fn();
  } finally {
    try { rmdirSync(LOCK_DIR); } catch { /* ignore */ }
  }
}

/** Sync variant for DB tests that apply migrations then run sync assertions. */
export function withLocalDbSchemaLockSync<T>(fn: () => T): T {
  const started = Date.now();
  while (true) {
    try {
      mkdirSync(LOCK_DIR);
      break;
    } catch {
      if (waitTimedOut(started)) {
        throw new Error("timed out waiting for k7 availability schema lock");
      }
      pauseBriefly();
    }
  }
  try {
    return fn();
  } finally {
    try { rmdirSync(LOCK_DIR); } catch { /* ignore */ }
  }
}
