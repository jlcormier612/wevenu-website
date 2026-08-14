import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computePlanningProgress,
  countOwnedPendingVendorRequests,
  countVendorRequestsNeedingCoupleAction,
  countVendorRequestsWaitingOnVendor,
  PLANNING_PROGRESS_MEANINGFUL_COMPLETE_STATEMENT,
  PLANNING_PROGRESS_SETUP_STATEMENT,
  PLANNING_PROGRESS_SOURCE_NOTE,
  planningProgressSupportingStatement,
} from "@/lib/portal/planning-progress";

const venueReadyBase = {
  requiredTasks: [{ status: "complete", isRequired: true }],
  paymentLineItems: [] as { status: string }[],
  contracts: [] as { status: string | null }[],
  questionnaire: null as { status: string } | null,
};

describe("Planning Progress (canonical composite — Option A)", () => {
  // ── Items 1–4: primary readiness formula + honest display ───────────────

  it("1 — uses Phase 1 formula: (reqDone+payDone+contractDone+qDone)/total", () => {
    const result = computePlanningProgress({
      requiredTasks: [
        { status: "complete", isRequired: true },
        { status: "complete", isRequired: true },
        { status: "pending", isRequired: true },
        { status: "pending", isRequired: true },
      ],
      paymentLineItems: [
        { status: "paid" },
        { status: "upcoming" },
        { status: "upcoming" },
      ],
      contracts: [{ status: "sent" }, { status: "signed" }],
      questionnaire: { status: "submitted" },
    });

    assert.equal(result.kind, "ready");
    if (result.kind !== "ready") return;

    // completed: 2 tasks + 1 payment + 1 contract + 1 questionnaire = 5
    // total: 4 + 3 + 2 + 1 = 10 → 50%
    assert.equal(result.completed, 5);
    assert.equal(result.total, 10);
    assert.equal(result.percent, 50);
    assert.equal(result.primaryPercent, 50);
    assert.equal(result.meaningfulComplete, false);
    assert.equal(result.sourceNote, PLANNING_PROGRESS_SOURCE_NOTE);
    assert.match(result.supportingStatement, /headway|coming together|lovely/i);
    assert.match(result.accessibleLabel, /50 percent readiness/i);
    assert.deepEqual(
      result.categories.map((c) => c.label),
      ["Venue tasks", "Payments", "Contracts", "Questionnaire"],
    );
  });

  it("2 — vendor/personal MUST NOT lower primary readiness %", () => {
    const result = computePlanningProgress({
      requiredTasks: [
        { status: "complete", isRequired: true },
        { status: "pending", isRequired: true },
      ],
      paymentLineItems: [],
      contracts: [],
      questionnaire: null,
      personalTodos: Array.from({ length: 20 }, () => ({ completed: false })),
      vendorOpenRequestCount: 5,
      vendorWaitingOnVendorCount: 2,
    });
    assert.equal(result.kind, "ready");
    if (result.kind !== "ready") return;
    assert.equal(result.primaryPercent, 50);
    assert.equal(result.percent, 50);
    assert.equal(result.venueReady, false);
    assert.equal(result.meaningfulComplete, false);
    assert.doesNotMatch(result.supportingStatement, /all set|Venue requirements complete/i);
  });

  it("3 — removes old min(primary, 99) cap; venue-ready shows honest 100%", () => {
    const venueComplete = computePlanningProgress({
      requiredTasks: [
        { status: "complete", isRequired: true },
        { status: "complete", isRequired: true },
      ],
      paymentLineItems: [{ status: "paid" }],
      contracts: [],
      questionnaire: { status: "submitted" },
      personalTodos: [{ completed: false }, { completed: false }],
      vendorOpenRequestCount: 1,
      vendorWaitingOnVendorCount: 0,
    });
    assert.equal(venueComplete.kind, "ready");
    if (venueComplete.kind === "ready") {
      assert.equal(venueComplete.primaryPercent, 100);
      assert.equal(venueComplete.percent, 100);
      assert.equal(venueComplete.completed, 4);
      assert.equal(venueComplete.total, 4);
      assert.notEqual(venueComplete.percent, 99);
    }
  });

  it("4 — empty setup never invents a misleading 0%", () => {
    const result = computePlanningProgress({
      requiredTasks: [],
      paymentLineItems: [],
      contracts: [],
      questionnaire: null,
    });
    assert.equal(result.kind, "empty");
    if (result.kind !== "empty") return;
    assert.equal(result.supportingStatement, PLANNING_PROGRESS_SETUP_STATEMENT);
    assert.doesNotMatch(result.accessibleLabel, /\b0%/);
    assert.doesNotMatch(result.supportingStatement, /\b0%/);
  });

  // ── Items 5–8: questionnaire + category surface + mid bands ─────────────

  it("5 — does not invent categories when inputs are out of scope", () => {
    const result = computePlanningProgress({
      requiredTasks: [{ status: "complete", isRequired: true }],
      paymentLineItems: [],
      contracts: [],
      questionnaire: null,
    });
    assert.equal(result.kind, "ready");
    if (result.kind !== "ready") return;
    assert.equal(result.percent, 100);
    assert.equal(result.meaningfulComplete, true);
    assert.deepEqual(result.categories, [{ label: "Venue tasks", detail: "1/1" }]);
  });

  it("6 — questionnaire only when in scope; completed/submitted both count", () => {
    const open = computePlanningProgress({
      requiredTasks: [],
      paymentLineItems: [],
      contracts: [],
      questionnaire: { status: "draft" },
    });
    assert.equal(open.kind, "ready");
    if (open.kind === "ready") {
      assert.equal(open.percent, 0);
      assert.equal(open.total, 1);
    }

    const done = computePlanningProgress({
      requiredTasks: [],
      paymentLineItems: [],
      contracts: [],
      questionnaire: { status: "completed" },
    });
    assert.equal(done.kind, "ready");
    if (done.kind === "ready") assert.equal(done.percent, 100);
  });

  it("7 — warm supporting statements by percent band without SaaS language", () => {
    assert.match(planningProgressSupportingStatement(0), /begins|started/i);
    assert.match(planningProgressSupportingStatement(15), /lovely start/i);
    assert.match(planningProgressSupportingStatement(40), /headway/i);
    assert.match(planningProgressSupportingStatement(60), /beautifully/i);
    assert.match(planningProgressSupportingStatement(90), /So close|finishing/i);
    assert.equal(
      planningProgressSupportingStatement(100),
      PLANNING_PROGRESS_MEANINGFUL_COMPLETE_STATEMENT,
    );
    for (const pct of [0, 28, 50, 100]) {
      const line = planningProgressSupportingStatement(pct);
      assert.doesNotMatch(line, /health|score|productivity|performance|streak|badge/i);
    }
  });

  it("8 — mid venue progress ignores secondary volume for % and copy band", () => {
    const mid = computePlanningProgress({
      requiredTasks: [
        { status: "complete", isRequired: true },
        { status: "pending", isRequired: true },
      ],
      paymentLineItems: [],
      contracts: [],
      questionnaire: null,
      personalTodos: Array.from({ length: 20 }, () => ({ completed: false })),
      vendorOpenRequestCount: 9,
    });
    assert.equal(mid.kind, "ready");
    if (mid.kind === "ready") {
      assert.equal(mid.primaryPercent, 50);
      assert.equal(mid.percent, 50);
      assert.equal(mid.venueReady, false);
      assert.equal(mid.meaningfulComplete, false);
    }
  });

  // ── Items 9–12: personal to-dos secondary ───────────────────────────────

  it("9 — Your to-dos chip surfaces X/Y when present; omits when none (never 0/0)", () => {
    const withTodos = computePlanningProgress({
      requiredTasks: [{ status: "complete", isRequired: true }],
      paymentLineItems: [{ status: "paid" }, { status: "upcoming" }],
      contracts: [],
      questionnaire: { status: "submitted" },
      personalTodos: [{ completed: true }, { completed: false }],
    });
    assert.equal(withTodos.kind, "ready");
    if (withTodos.kind === "ready") {
      assert.deepEqual(
        withTodos.categories.find((c) => c.label === "Your to-dos"),
        { label: "Your to-dos", detail: "1/2" },
      );
    }

    const none = computePlanningProgress({
      ...venueReadyBase,
      personalTodos: [],
    });
    assert.equal(none.kind, "ready");
    if (none.kind === "ready") {
      assert.equal(
        none.categories.some((c) => c.label === "Your to-dos"),
        false,
      );
      assert.equal(
        none.categories.some((c) => c.detail === "0/0"),
        false,
      );
    }
  });

  it("10 — personal incomplete: 100% readiness, blocks meaningfulComplete", () => {
    const result = computePlanningProgress({
      requiredTasks: [{ status: "complete", isRequired: true }],
      paymentLineItems: [{ status: "paid" }],
      contracts: [],
      questionnaire: null,
      personalTodos: [{ completed: true }, { completed: false }],
    });
    assert.equal(result.kind, "ready");
    if (result.kind !== "ready") return;
    assert.equal(result.venueReady, true);
    assert.equal(result.percent, 100);
    assert.equal(result.meaningfulComplete, false);
    assert.equal(result.reviewDestination, "todos");
    assert.match(
      result.supportingStatement,
      /Venue requirements complete\. You still have 1 personal planning item to finish\./,
    );
    assert.doesNotMatch(result.supportingStatement, /all set|beautifully in place/i);
    assert.deepEqual(
      result.categories.map((c) => `${c.label} · ${c.detail}`),
      ["Venue tasks · 1/1", "Payments · 1/1", "Your to-dos · 1/2"],
    );
  });

  it("11 — completed personal checklist does not block meaningfulComplete", () => {
    const result = computePlanningProgress({
      ...venueReadyBase,
      personalTodos: [{ completed: true }, { completed: true }],
    });
    assert.equal(result.kind, "ready");
    if (result.kind !== "ready") return;
    assert.equal(result.percent, 100);
    assert.equal(result.personalIncompleteCount, 0);
    assert.equal(result.meaningfulComplete, true);
    assert.deepEqual(
      result.categories.find((c) => c.label === "Your to-dos"),
      { label: "Your to-dos", detail: "2/2" },
    );
    assert.equal(result.supportingStatement, PLANNING_PROGRESS_MEANINGFUL_COMPLETE_STATEMENT);
  });

  it("12 — personal never enters primary denominator", () => {
    const without = computePlanningProgress(venueReadyBase);
    const withTodos = computePlanningProgress({
      ...venueReadyBase,
      personalTodos: [{ completed: false }, { completed: false }, { completed: false }],
    });
    assert.equal(without.kind, "ready");
    assert.equal(withTodos.kind, "ready");
    if (without.kind === "ready" && withTodos.kind === "ready") {
      assert.equal(without.total, withTodos.total);
      assert.equal(without.completed, withTodos.completed);
      assert.equal(without.percent, withTodos.percent);
    }
  });

  // ── Items 13–16: vendor actionable vs waiting ───────────────────────────

  it("13 — venue ready + actionable vendor: 100%, not meaningfulComplete", () => {
    const withOpen = computePlanningProgress({
      ...venueReadyBase,
      vendorOpenRequestCount: 2,
      vendorWaitingOnVendorCount: 0,
    });
    assert.equal(withOpen.kind, "ready");
    if (withOpen.kind === "ready") {
      assert.equal(withOpen.primaryPercent, 100);
      assert.equal(withOpen.percent, 100);
      assert.equal(withOpen.meaningfulComplete, false);
      assert.equal(withOpen.vendorCoupleActionCount, 2);
      assert.equal(withOpen.reviewDestination, "tasks");
      assert.deepEqual(
        withOpen.categories.find((c) => c.label === "Vendor requests"),
        { label: "Vendor requests", detail: "2 open" },
      );
      assert.doesNotMatch(withOpen.supportingStatement, /beautifully in place|all set/i);
      assert.match(
        withOpen.supportingStatement,
        /Venue requirements complete\. You still have 2 vendor requests waiting for your attention\./,
      );
      assert.match(withOpen.sourceNote, /vendor requests/i);
    }
  });

  it("14 — waiting-only: not couple unfinished; meaningfulComplete true; Review=waiting", () => {
    const waitingOnVendor = computePlanningProgress({
      ...venueReadyBase,
      vendorOpenRequestCount: 1,
      vendorWaitingOnVendorCount: 1,
      venueAttentionIncompleteCount: 0,
    });
    assert.equal(waitingOnVendor.kind, "ready");
    if (waitingOnVendor.kind === "ready") {
      assert.equal(waitingOnVendor.percent, 100);
      assert.equal(waitingOnVendor.vendorOpenRequestCount, 1);
      assert.equal(waitingOnVendor.vendorCoupleActionCount, 0);
      assert.equal(waitingOnVendor.vendorWaitingOnVendorCount, 1);
      // Contract: no actionable owned vendor + no personal incomplete → complete.
      assert.equal(waitingOnVendor.meaningfulComplete, true);
      assert.equal(waitingOnVendor.reviewDestination, "waiting");
      assert.deepEqual(
        waitingOnVendor.categories.find((c) => c.label === "Vendor requests"),
        { label: "Vendor requests", detail: "1 waiting" },
      );
      assert.equal(
        waitingOnVendor.supportingStatement,
        PLANNING_PROGRESS_MEANINGFUL_COMPLETE_STATEMENT,
      );
      assert.doesNotMatch(waitingOnVendor.supportingStatement, /your attention|all set/i);
    }
  });

  it("15 — vendor + personal both visible; mixed waiting + couple-action copy", () => {
    const both = computePlanningProgress({
      ...venueReadyBase,
      vendorOpenRequestCount: 2,
      vendorWaitingOnVendorCount: 0,
      personalTodos: [{ completed: false }],
    });
    assert.equal(both.kind, "ready");
    if (both.kind === "ready") {
      assert.equal(both.percent, 100);
      assert.equal(both.meaningfulComplete, false);
      assert.equal(both.reviewDestination, "tasks");
      assert.match(
        both.supportingStatement,
        /2 vendor requests and 1 personal planning item/,
      );
      assert.match(both.sourceNote, /personal to-dos.*vendor requests/i);
      assert.deepEqual(
        both.categories.map((c) => c.label),
        ["Venue tasks", "Vendor requests", "Your to-dos"],
      );
    }

    const mixed = computePlanningProgress({
      ...venueReadyBase,
      vendorOpenRequestCount: 3,
      vendorWaitingOnVendorCount: 1,
    });
    assert.equal(mixed.kind, "ready");
    if (mixed.kind === "ready") {
      assert.equal(mixed.vendorCoupleActionCount, 2);
      assert.equal(mixed.meaningfulComplete, false);
      assert.equal(mixed.reviewDestination, "tasks");
      assert.match(mixed.supportingStatement, /2 vendor requests waiting for your attention/);
      assert.match(mixed.supportingStatement, /waiting on your vendor for 1/);
    }
  });

  it("16 — waiting + personal incomplete blocks meaningfulComplete; Review prefers todos", () => {
    const waitingPlusPersonal = computePlanningProgress({
      ...venueReadyBase,
      personalTodos: [{ completed: false }],
      venueAttentionIncompleteCount: 0,
      vendorOpenRequestCount: 1,
      vendorWaitingOnVendorCount: 1,
    });
    assert.equal(waitingPlusPersonal.kind, "ready");
    if (waitingPlusPersonal.kind === "ready") {
      assert.equal(waitingPlusPersonal.meaningfulComplete, false);
      assert.equal(waitingPlusPersonal.reviewDestination, "todos");
      assert.match(waitingPlusPersonal.supportingStatement, /Waiting for your vendor/);
      assert.match(waitingPlusPersonal.supportingStatement, /personal planning/);
      assert.doesNotMatch(waitingPlusPersonal.supportingStatement, /beautifully in place|all set/i);
    }
  });

  // ── Items 17–18: meaningfulComplete language ────────────────────────────

  it("17 — completion language only when meaningfulComplete; never invent You're all set!", () => {
    const allDone = computePlanningProgress({
      requiredTasks: [{ status: "complete", isRequired: true }],
      paymentLineItems: [{ status: "paid" }],
      contracts: [{ status: "signed" }],
      questionnaire: { status: "submitted" },
      personalTodos: [{ completed: true }],
      vendorOpenRequestCount: 0,
    });
    assert.equal(allDone.kind, "ready");
    if (allDone.kind === "ready") {
      assert.equal(allDone.percent, 100);
      assert.equal(allDone.meaningfulComplete, true);
      assert.equal(allDone.supportingStatement, PLANNING_PROGRESS_MEANINGFUL_COMPLETE_STATEMENT);
      assert.doesNotMatch(allDone.supportingStatement, /You're all set|all set!/i);
    }

    const actionable = computePlanningProgress({
      ...venueReadyBase,
      vendorOpenRequestCount: 1,
      vendorWaitingOnVendorCount: 0,
    });
    assert.equal(actionable.kind, "ready");
    if (actionable.kind === "ready") {
      assert.equal(actionable.meaningfulComplete, false);
      assert.doesNotMatch(actionable.supportingStatement, /beautifully in place|all set/i);
    }
  });

  it("18 — State matrix 1–6: empty / mid / personal / actionable / waiting / complete", () => {
    // State 1 — empty setup
    const s1 = computePlanningProgress({
      requiredTasks: [],
      paymentLineItems: [],
      contracts: [],
      questionnaire: null,
    });
    assert.equal(s1.kind, "empty");

    // State 2 — mid venue (incomplete primary)
    const s2 = computePlanningProgress({
      requiredTasks: [
        { status: "complete", isRequired: true },
        { status: "pending", isRequired: true },
      ],
      paymentLineItems: [],
      contracts: [],
      questionnaire: null,
    });
    assert.equal(s2.kind, "ready");
    if (s2.kind === "ready") {
      assert.equal(s2.percent, 50);
      assert.equal(s2.venueReady, false);
      assert.equal(s2.meaningfulComplete, false);
    }

    // State 3 — venue ready + personal incomplete
    const s3 = computePlanningProgress({
      ...venueReadyBase,
      personalTodos: [{ completed: false }],
    });
    assert.equal(s3.kind, "ready");
    if (s3.kind === "ready") {
      assert.equal(s3.percent, 100);
      assert.equal(s3.meaningfulComplete, false);
      assert.equal(s3.reviewDestination, "todos");
    }

    // State 4 — venue ready + actionable vendor
    const s4 = computePlanningProgress({
      ...venueReadyBase,
      vendorOpenRequestCount: 1,
      vendorWaitingOnVendorCount: 0,
    });
    assert.equal(s4.kind, "ready");
    if (s4.kind === "ready") {
      assert.equal(s4.percent, 100);
      assert.equal(s4.meaningfulComplete, false);
      assert.equal(s4.reviewDestination, "tasks");
    }

    // State 5 — venue ready + waiting-only
    const s5 = computePlanningProgress({
      ...venueReadyBase,
      vendorOpenRequestCount: 2,
      vendorWaitingOnVendorCount: 2,
      venueAttentionIncompleteCount: 0,
    });
    assert.equal(s5.kind, "ready");
    if (s5.kind === "ready") {
      assert.equal(s5.percent, 100);
      assert.equal(s5.meaningfulComplete, true);
      assert.equal(s5.reviewDestination, "waiting");
      assert.equal(s5.supportingStatement, PLANNING_PROGRESS_MEANINGFUL_COMPLETE_STATEMENT);
    }

    // State 6 — fully meaningful complete
    const s6 = computePlanningProgress({
      ...venueReadyBase,
      personalTodos: [{ completed: true }],
      vendorOpenRequestCount: 0,
    });
    assert.equal(s6.kind, "ready");
    if (s6.kind === "ready") {
      assert.equal(s6.percent, 100);
      assert.equal(s6.meaningfulComplete, true);
      assert.equal(s6.supportingStatement, PLANNING_PROGRESS_MEANINGFUL_COMPLETE_STATEMENT);
    }
  });

  // ── Items 19–20: Review What's Left + durable vendor helpers ────────────

  it("19 — Review What's Left priority: venue > couple-action vendor > personal > waiting", () => {
    const vendorOverPersonal = computePlanningProgress({
      ...venueReadyBase,
      personalTodos: [{ completed: false }],
      venueAttentionIncompleteCount: 0,
      vendorOpenRequestCount: 1,
      vendorWaitingOnVendorCount: 0,
    });
    assert.equal(vendorOverPersonal.kind, "ready");
    if (vendorOverPersonal.kind === "ready") {
      assert.equal(vendorOverPersonal.reviewDestination, "tasks");
    }

    const venueWins = computePlanningProgress({
      requiredTasks: [{ status: "pending", isRequired: true }],
      paymentLineItems: [],
      contracts: [],
      questionnaire: null,
      personalTodos: [{ completed: false }],
      venueAttentionIncompleteCount: 2,
      vendorOpenRequestCount: 5,
    });
    assert.equal(venueWins.kind, "ready");
    if (venueWins.kind === "ready") {
      assert.equal(venueWins.reviewDestination, "tasks");
    }

    const personalOnly = computePlanningProgress({
      ...venueReadyBase,
      personalTodos: [{ completed: false }],
      venueAttentionIncompleteCount: 0,
      vendorOpenRequestCount: 0,
    });
    assert.equal(personalOnly.kind, "ready");
    if (personalOnly.kind === "ready") {
      assert.equal(personalOnly.reviewDestination, "todos");
    }

    const waitingOnly = computePlanningProgress({
      ...venueReadyBase,
      venueAttentionIncompleteCount: 0,
      vendorOpenRequestCount: 2,
      vendorWaitingOnVendorCount: 2,
    });
    assert.equal(waitingOnly.kind, "ready");
    if (waitingOnly.kind === "ready") {
      // Critical: waiting-only must NOT route back to acked Tasks CTA.
      assert.equal(waitingOnly.reviewDestination, "waiting");
    }
  });

  it("20 — durable helpers: owned pending only; exclude visible/private/complete; dual-state", () => {
    assert.equal(
      countOwnedPendingVendorRequests([
        { coupleVisibility: "owned", status: "pending" },
        { coupleVisibility: "owned", status: "complete" },
        { coupleVisibility: "visible", status: "pending" },
        { coupleVisibility: "private", status: "pending" },
        { coupleVisibility: "owned", status: "pending" },
      ]),
      2,
    );
    assert.equal(countOwnedPendingVendorRequests([]), 0);

    const rows = [
      {
        coupleVisibility: "owned",
        status: "pending",
        completionAuthority: "vendor_confirm",
        coupleAcknowledgedAt: null,
      },
      {
        coupleVisibility: "owned",
        status: "pending",
        completionAuthority: "vendor_confirm",
        coupleAcknowledgedAt: "2026-08-01T00:00:00Z",
      },
      {
        coupleVisibility: "owned",
        status: "complete",
        completionAuthority: "vendor_confirm",
        coupleAcknowledgedAt: "2026-08-01T00:00:00Z",
      },
      {
        coupleVisibility: "owned",
        status: "pending",
        completionAuthority: "couple_acknowledge",
        coupleAcknowledgedAt: null,
      },
      {
        coupleVisibility: "visible",
        status: "pending",
        completionAuthority: "couple_acknowledge",
        coupleAcknowledgedAt: null,
      },
    ];
    assert.equal(countOwnedPendingVendorRequests(rows), 3);
    assert.equal(countVendorRequestsWaitingOnVendor(rows), 1);
    assert.equal(countVendorRequestsNeedingCoupleAction(rows), 2);
    // Actionable ≠ waiting: no double-count.
    assert.equal(
      countVendorRequestsNeedingCoupleAction(rows) + countVendorRequestsWaitingOnVendor(rows),
      countOwnedPendingVendorRequests(rows),
    );
  });
});
