/**
 * Regression: CRM optimistic writes must not tight-loop replace_store on
 * version conflicts / timeouts (2026-10-11 Sandbox htc_crm_version_conflict storm).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fingerprintLiveStore, emptyLiveStore } from "./store.ts";
import type { LiveRelationshipStore } from "./types.ts";

describe("fingerprintLiveStore", () => {
  it("is stable for identical store contents", () => {
    const a = emptyLiveStore();
    const b = emptyLiveStore();
    assert.equal(fingerprintLiveStore(a), fingerprintLiveStore(b));
  });

  it("changes when a relationship is added", () => {
    const a = emptyLiveStore();
    const b: LiveRelationshipStore = emptyLiveStore();
    b.relationships.push({
      id: "rel_test",
      venue: { name: "Test" },
      owner: { email: "t@example.com" },
    } as LiveRelationshipStore["relationships"][number]);
    assert.notEqual(fingerprintLiveStore(a), fingerprintLiveStore(b));
  });
});

describe("contention helpers (source contract)", () => {
  it("store.ts treats timeouts as retryable and skips no-op replaces", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "shared/relationships/store.ts"), "utf8");
    assert.match(src, /fingerprintLiveStore/);
    assert.match(src, /before === after/);
    assert.match(src, /isRetryableStoreContention/);
    assert.match(src, /upstream request timeout/);
    assert.match(src, /backoffBeforeRetry/);
    assert.match(src, /CONFLICT_BACKOFF_BASE_MS/);
  });

  it("tickPaymentDunning no longer N+1 calls recordPaymentFailed", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "shared/relationships/lifecycle.ts"), "utf8");
    const tickFn = src.slice(src.indexOf("export async function tickPaymentDunning"));
    const body = tickFn.slice(0, tickFn.indexOf("export async function refreshRelationshipHealth"));
    assert.doesNotMatch(body, /recordPaymentFailed\(/);
    assert.match(body, /withLiveStore/);
  });
});
