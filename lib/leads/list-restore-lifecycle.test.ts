/**
 * Behavioral lifecycle for Wave 1 restore correctness — models the lead-list
 * mount/persist/restore state machine without regex source assertions.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLeadsListSession,
  planLeadsListRestore,
  sessionAfterRestoreCancelled,
  shouldPersistLeadsListSession,
  type LeadsListRestorePhase,
  type LeadsListSessionV1,
} from "@/lib/leads/list-session";

function ids(n: number, prefix = "id"): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
}

type Store = { session: LeadsListSessionV1 | null };

/** Minimal stand-in for lead-list persist + restore phase gating. */
function createListLifecycle(store: Store) {
  let phase: LeadsListRestorePhase = "idle";
  let settled = false;
  let displayed = ids(20);
  let loadingMore = false;
  let scrollY = 0;
  const fingerprint = "||wedding|newest|all|active";

  function persist(nextIds: string[], opts?: { force?: boolean; scrollY?: number }) {
    if (
      !shouldPersistLeadsListSession({
        phase,
        force: opts?.force,
        existing: store.session,
        nextLeadIds: nextIds,
        fingerprint,
      })
    ) {
      return false;
    }
    store.session = buildLeadsListSession({
      href: "/leads?eventType=wedding",
      fingerprint,
      leadIds: nextIds,
      scrollY: opts?.scrollY ?? scrollY,
    });
    return true;
  }

  return {
    get phase() {
      return phase;
    },
    get settled() {
      return settled;
    },
    get displayedCount() {
      return displayed.length;
    },
    get loadingMore() {
      return loadingMore;
    },
    /** User: Show more to 40, then open Detail (session saved with scroll). */
    saveProgressive40(y: number) {
      phase = "done";
      settled = true;
      displayed = ids(40);
      scrollY = y;
      assert.equal(persist(displayed, { force: true, scrollY: y }), true);
    },
    /** Remount on Back / sidebar: first paint is authoritative 20. */
    remountFirst20() {
      const priorCount = store.session?.leadIds.length ?? 0;
      phase = "idle";
      settled = false;
      displayed = ids(20);
      loadingMore = false;
      // Scroll effect must not run until settled — simulate attempted clobber.
      const wrote = persist(displayed);
      assert.equal(wrote, false, "must not persist 20-row mount over saved progressive session");
      assert.equal(store.session?.leadIds.length, priorCount);
    },
    /** Restore effect: plan + pending hydrate. */
    beginRestore() {
      const plan = planLeadsListRestore({
        session: store.session,
        urlFingerprint: fingerprint,
        serverFirstIds: displayed,
        pageSize: 20,
      });
      assert.equal(plan.action, "restore");
      if (plan.action !== "restore") throw new Error("expected restore");
      phase = "pending";
      loadingMore = true;
      // Persist/scroll while pending must still be blocked.
      const priorCount = store.session?.leadIds.length ?? 0;
      assert.equal(persist(ids(20)), false);
      assert.equal(store.session?.leadIds.length, priorCount);
      return plan;
    },
    completeRestoreOk(limit: number, y: number) {
      displayed = ids(limit);
      phase = "done";
      settled = true;
      loadingMore = false;
      scrollY = y;
      assert.equal(persist(displayed, { force: true, scrollY: y }), true);
      assert.equal(store.session?.leadIds.length, limit);
      assert.equal(store.session?.scrollY, y);
    },
    failRestoreToServerWindow() {
      displayed = ids(20);
      phase = "done";
      settled = true;
      loadingMore = false;
      assert.equal(persist(displayed, { force: true }), true);
      assert.equal(store.session?.leadIds.length, 20);
      assert.equal(loadingMore, false);
    },
    cancelInFlight() {
      assert.equal(phase, "pending");
      const before = store.session;
      store.session = sessionAfterRestoreCancelled(store.session);
      phase = "idle";
      settled = false;
      loadingMore = false;
      assert.deepEqual(store.session, before);
      assert.equal(store.session?.leadIds.length, 40);
    },
  };
}

describe("Leads restore lifecycle (navigation behavior)", () => {
  it("Filter → Show more 40 → Detail → Back restores 40 and keeps scroll; no 20-row clobber", () => {
    const store: Store = { session: null };
    const life = createListLifecycle(store);
    life.saveProgressive40(420);
    life.remountFirst20();
    const plan = life.beginRestore();
    assert.equal(plan.scrollY, 420);
    assert.equal(plan.limit, 40);
    life.completeRestoreOk(40, 420);
    assert.equal(life.displayedCount, 40);
    assert.equal(life.settled, true);
    assert.equal(life.loadingMore, false);
  });

  it("Show more 60 → sidebar Leads return restores 60", () => {
    const store: Store = { session: null };
    const life = createListLifecycle(store);
    life.saveProgressive40(100);
    // Extend to 60 while on list.
    store.session = buildLeadsListSession({
      href: "/leads?eventType=wedding",
      fingerprint: "||wedding|newest|all|active",
      leadIds: ids(60),
      scrollY: 880,
    });
    life.remountFirst20();
    const plan = life.beginRestore();
    assert.equal(plan.limit, 60);
    life.completeRestoreOk(60, 880);
    assert.equal(life.displayedCount, 60);
  });

  it("restoration failure falls back to first 20 without stuck loading", () => {
    const store: Store = { session: null };
    const life = createListLifecycle(store);
    life.saveProgressive40(200);
    life.remountFirst20();
    life.beginRestore();
    life.failRestoreToServerWindow();
    assert.equal(life.displayedCount, 20);
    assert.equal(life.loadingMore, false);
    assert.equal(life.settled, true);
  });

  it("rapid nav cancel mid-restore preserves the saved 40 session", () => {
    const store: Store = { session: null };
    const life = createListLifecycle(store);
    life.saveProgressive40(300);
    life.remountFirst20();
    life.beginRestore();
    life.cancelInFlight();
    assert.equal(store.session?.leadIds.length, 40);
    assert.equal(store.session?.scrollY, 300);
    // Second remount can still restore.
    life.remountFirst20();
    const plan = life.beginRestore();
    assert.equal(plan.limit, 40);
    life.completeRestoreOk(40, 300);
  });

  it("new lead at top invalidates progressive restore; URL filters still apply via fingerprint gate", () => {
    const session = buildLeadsListSession({
      href: "/leads?eventType=wedding",
      fingerprint: "||wedding|newest|all|active",
      leadIds: ids(40),
      scrollY: 150,
    });
    const plan = planLeadsListRestore({
      session,
      urlFingerprint: "||wedding|newest|all|active",
      serverFirstIds: ["brand-new", ...ids(19)],
      pageSize: 20,
    });
    assert.equal(plan.action, "use_server_window");
  });
});
