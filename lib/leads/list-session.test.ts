import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LEADS_PAGE_SIZE } from "@/lib/leads/list-query";
import {
  LEADS_LIST_RESTORE_MAX_ROWS,
  LEADS_LIST_SESSION_TTL_MS,
  buildLeadsListSession,
  clampLeadsRestoreCount,
  isLeadDetailPath,
  leadsShellHrefFromSession,
  parseLeadsListSession,
  planLeadsListRestore,
  serializeLeadsListSession,
  sessionAfterRestoreCancelled,
  shouldPersistLeadsListSession,
  shouldRestoreProgressiveSession,
} from "@/lib/leads/list-session";

function ids(n: number, prefix = "id"): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
}

describe("Leads list session (Wave 1 working context)", () => {
  it("detects lead detail paths without matching list/new/pipeline", () => {
    assert.equal(isLeadDetailPath("/leads/a415ac52-cd74-42a6-8df7-7a8f6e71d080"), true);
    assert.equal(isLeadDetailPath("/leads/a415ac52-cd74-42a6-8df7-7a8f6e71d080/edit"), true);
    assert.equal(isLeadDetailPath("/leads"), false);
    assert.equal(isLeadDetailPath("/leads?eventType=wedding"), false);
    assert.equal(isLeadDetailPath("/leads/new"), false);
    assert.equal(isLeadDetailPath("/leads/pipeline"), false);
  });

  it("restores shell Leads href from session only when leaving a detail path", () => {
    assert.equal(
      leadsShellHrefFromSession({
        pathname: "/leads/a415ac52-cd74-42a6-8df7-7a8f6e71d080",
        defaultHref: "/leads",
        sessionHref: "/leads?eventType=wedding&sort=oldest",
      }),
      "/leads?eventType=wedding&sort=oldest",
    );
    assert.equal(
      leadsShellHrefFromSession({
        pathname: "/dashboard",
        defaultHref: "/leads",
        sessionHref: "/leads?eventType=wedding",
      }),
      "/leads",
    );
    assert.equal(
      leadsShellHrefFromSession({
        pathname: "/leads",
        search: "?eventType=wedding",
        defaultHref: "/leads",
        sessionHref: "/leads?stage=tour",
      }),
      "/leads?eventType=wedding",
    );
  });

  it("Filter → Show more to 40 → Detail → Back plans restore of 40", () => {
    const serverFirst = ids(20);
    const progressive = ids(40);
    const session = buildLeadsListSession({
      href: "/leads?eventType=wedding",
      fingerprint: "||wedding|newest|all|active",
      leadIds: progressive,
      scrollY: 420,
    });
    const plan = planLeadsListRestore({
      session,
      urlFingerprint: "||wedding|newest|all|active",
      serverFirstIds: serverFirst,
      pageSize: LEADS_PAGE_SIZE,
    });
    assert.equal(plan.action, "restore");
    if (plan.action === "restore") {
      assert.equal(plan.limit, 40);
      assert.equal(plan.scrollY, 420);
    }
  });

  it("Filter → Show more to 60 → sidebar return plans restore of 60", () => {
    const session = buildLeadsListSession({
      href: "/leads?stage=tour",
      fingerprint: "|tour||newest|all|active",
      leadIds: ids(60),
      scrollY: 880,
    });
    // Sidebar uses same session href + list remount with first 20 from server.
    assert.equal(
      leadsShellHrefFromSession({
        pathname: "/leads/a415ac52-cd74-42a6-8df7-7a8f6e71d080",
        defaultHref: "/leads",
        sessionHref: session.href,
      }),
      "/leads?stage=tour",
    );
    const plan = planLeadsListRestore({
      session,
      urlFingerprint: "|tour||newest|all|active",
      serverFirstIds: ids(20),
      pageSize: LEADS_PAGE_SIZE,
    });
    assert.equal(plan.action, "restore");
    if (plan.action === "restore") assert.equal(plan.limit, 60);
  });

  it("preserves scrollY on the restore plan until rows are available", () => {
    const session = buildLeadsListSession({
      href: "/leads",
      fingerprint: "|||||active",
      leadIds: ids(40),
      scrollY: 640,
    });
    const plan = planLeadsListRestore({
      session,
      urlFingerprint: "|||||active",
      serverFirstIds: ids(20),
      pageSize: 20,
    });
    assert.equal(plan.action, "restore");
    if (plan.action === "restore") assert.equal(plan.scrollY, 640);
  });

  it("invalidates progressive restore when a new lead appears at the top while on Detail", () => {
    const session = buildLeadsListSession({
      href: "/leads",
      fingerprint: "|||||active",
      leadIds: ids(40),
      scrollY: 200,
    });
    const serverWithNewLead = ["brand-new", ...ids(19)];
    assert.equal(
      shouldRestoreProgressiveSession({
        session,
        urlFingerprint: "|||||active",
        serverFirstIds: serverWithNewLead,
        pageSize: 20,
      }),
      false,
    );
    const plan = planLeadsListRestore({
      session,
      urlFingerprint: "|||||active",
      serverFirstIds: serverWithNewLead,
      pageSize: 20,
    });
    assert.deepEqual(plan, { action: "use_server_window", reason: "invalidated_or_mismatch" });
  });

  it("expires sessions past TTL", () => {
    const session = buildLeadsListSession({
      href: "/leads",
      fingerprint: "|||||active",
      leadIds: ids(40),
      scrollY: 0,
      now: Date.now() - LEADS_LIST_SESSION_TTL_MS - 1,
    });
    assert.equal(parseLeadsListSession(serializeLeadsListSession(session)), null);
  });

  it("blocks persist during pending restore so 20-row mount cannot clobber 40+", () => {
    const existing = buildLeadsListSession({
      href: "/leads?eventType=wedding",
      fingerprint: "||wedding|newest|all|active",
      leadIds: ids(40),
      scrollY: 300,
    });
    assert.equal(
      shouldPersistLeadsListSession({
        phase: "pending",
        existing,
        nextLeadIds: ids(20),
        fingerprint: "||wedding|newest|all|active",
      }),
      false,
    );
    assert.equal(
      shouldPersistLeadsListSession({
        phase: "idle",
        existing,
        nextLeadIds: ids(20),
        fingerprint: "||wedding|newest|all|active",
      }),
      false,
    );
    assert.equal(
      shouldPersistLeadsListSession({
        phase: "done",
        existing,
        nextLeadIds: ids(20),
        fingerprint: "||wedding|newest|all|active",
      }),
      false,
      "still refuse shrinking a larger matching session without force",
    );
    assert.equal(
      shouldPersistLeadsListSession({
        phase: "done",
        force: true,
        existing,
        nextLeadIds: ids(20),
        fingerprint: "||wedding|newest|all|active",
      }),
      true,
    );
    assert.equal(
      shouldPersistLeadsListSession({
        phase: "done",
        existing,
        nextLeadIds: ids(40),
        fingerprint: "||wedding|newest|all|active",
      }),
      true,
    );
  });

  it("cancelled in-flight restore leaves the prior session untouched", () => {
    const existing = buildLeadsListSession({
      href: "/leads",
      fingerprint: "|||||active",
      leadIds: ids(60),
      scrollY: 500,
    });
    assert.deepEqual(sessionAfterRestoreCancelled(existing), existing);
    assert.equal(sessionAfterRestoreCancelled(null), null);
  });

  it("clamps restore requests to a safe bound (no unbounded session loads)", () => {
    assert.equal(clampLeadsRestoreCount(40), 40);
    assert.equal(clampLeadsRestoreCount(60), 60);
    assert.equal(clampLeadsRestoreCount(10), 20);
    assert.equal(clampLeadsRestoreCount(10_000), LEADS_LIST_RESTORE_MAX_ROWS);
    assert.equal(LEADS_LIST_RESTORE_MAX_ROWS, 100);
    const huge = buildLeadsListSession({
      href: "/leads",
      fingerprint: "|||||active",
      leadIds: ids(500),
      scrollY: 0,
    });
    assert.equal(huge.leadIds.length, LEADS_LIST_RESTORE_MAX_ROWS);
    const plan = planLeadsListRestore({
      session: huge,
      urlFingerprint: "|||||active",
      serverFirstIds: ids(20),
      pageSize: 20,
    });
    assert.equal(plan.action, "restore");
    if (plan.action === "restore") assert.equal(plan.limit, LEADS_LIST_RESTORE_MAX_ROWS);
  });

  it("URL filter fingerprint mismatch keeps filters on URL but skips progressive restore", () => {
    const session = buildLeadsListSession({
      href: "/leads?eventType=wedding",
      fingerprint: "||wedding|newest|all|active",
      leadIds: ids(40),
      scrollY: 100,
    });
    // User landed on tour filter URL — filters come from URL; progressive invalid.
    const plan = planLeadsListRestore({
      session,
      urlFingerprint: "|tour||newest|all|active",
      serverFirstIds: ids(20, "tour"),
      pageSize: 20,
    });
    assert.equal(plan.action, "use_server_window");
  });
});
