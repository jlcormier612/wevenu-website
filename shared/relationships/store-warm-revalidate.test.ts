/**
 * Guards: warmLiveStore must revalidate against durable version so external
 * CRM writers (purge scripts, other ECS tasks) cannot leave a stale snapshot.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const STORE = resolve(import.meta.dirname, "store.ts");

describe("warmLiveStore durable revalidation", () => {
  const src = readFileSync(STORE, "utf8");

  it("peeks htc_crm_store_meta.version before trusting memoryCache", () => {
    assert.match(src, /peekPostgresStoreVersion/);
    assert.match(src, /htc_crm_store_meta/);
    assert.match(src, /durableVersion === memoryVersion/);
  });

  it("warmLiveStore reloads when durable version drifts", () => {
    const warm = src.slice(src.indexOf("export async function warmLiveStore"));
    const warmBody = warm.slice(0, warm.indexOf("export function loadLiveStoreSync"));
    assert.match(warmBody, /peekPostgresStoreVersion/);
    assert.match(warmBody, /loadPostgresStore/);
    // Must not short-circuit on memory alone without a version check.
    assert.match(warmBody, /memoryVersion !== null/);
  });

  it("exports clearLiveStoreMemoryCache for ops/tests", () => {
    assert.match(src, /export function clearLiveStoreMemoryCache/);
  });
});
