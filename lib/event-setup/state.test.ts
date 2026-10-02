import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { DEFAULT_PLANNING_CAPABILITIES } from "@/lib/playbooks/capabilities";
import type { ReadinessSection } from "@/lib/readiness/types";

import {
  applicableSetupSteps,
  selectOverviewExceptions,
  setupDecisionsComplete,
  undecidedSetupSteps,
  withSetupCollapsed,
  withSetupDecision,
  withSetupReopened,
  type EventSetupState,
  type SetupStepKey,
} from "@/lib/event-setup/state";

function section(partial: Partial<ReadinessSection> & Pick<ReadinessSection, "key" | "status" | "detail">): ReadinessSection {
  return {
    label: partial.label ?? partial.key,
    nav: partial.nav ?? { kind: "tab", tab: partial.key },
    ...partial,
  };
}

const empty: EventSetupState = { decisions: {}, collapsedAt: null };

describe("event setup state", () => {
  it("offers every step when capabilities are on, and omits disabled ones", () => {
    const all = applicableSetupSteps(DEFAULT_PLANNING_CAPABILITIES);
    assert.deepEqual(all, [
      "planning", "timeline", "floor_plans", "vendors", "questionnaires", "inventory", "event_order", "portal",
    ]);
    const limited = applicableSetupSteps({
      ...DEFAULT_PLANNING_CAPABILITIES,
      timeline: false,
      floorPlan: false,
      vendors: false,
    });
    assert.deepEqual(limited, ["planning", "questionnaires", "inventory", "event_order", "portal"]);
  });

  it("set up and skip are explicit and do not invent module records", () => {
    const applicable = applicableSetupSteps(DEFAULT_PLANNING_CAPABILITIES);
    const afterSkip = withSetupDecision(empty, applicable, "timeline", "skipped");
    assert.equal(afterSkip.decisions.timeline, "skipped");
    assert.equal(afterSkip.collapsedAt, null);
    const afterSetup = withSetupDecision(afterSkip, applicable, "planning", "set_up");
    assert.equal(afterSetup.decisions.planning, "set_up");
    assert.equal(afterSetup.decisions.timeline, "skipped");
    const repo = readFileSync(resolve("lib/event-setup/repository.ts"), "utf8");
    assert.match(repo, /event_setup_states/);
    assert.doesNotMatch(repo, /from\("event_tasks"\)|from\("timeline_entries"\)|from\("floor_plans"\)/);
  });

  it("collapses only when every applicable step has a decision", () => {
    const applicable: SetupStepKey[] = ["planning", "portal"];
    let state = empty;
    state = withSetupDecision(state, applicable, "planning", "set_up");
    assert.equal(setupDecisionsComplete(applicable, state.decisions), false);
    assert.equal(state.collapsedAt, null);
    state = withSetupDecision(state, applicable, "portal", "skipped");
    assert.equal(setupDecisionsComplete(applicable, state.decisions), true);
    assert.ok(state.collapsedAt);
    assert.deepEqual(undecidedSetupSteps(applicable, state.decisions), []);
  });

  it("reopen clears collapse and keeps decisions", () => {
    const applicable: SetupStepKey[] = ["planning"];
    const collapsed = withSetupDecision(empty, applicable, "planning", "set_up");
    const opened = withSetupReopened(collapsed);
    assert.equal(opened.collapsedAt, null);
    assert.equal(opened.decisions.planning, "set_up");
    const hidden = withSetupCollapsed(opened);
    assert.ok(hidden.collapsedAt);
    assert.equal(hidden.decisions.planning, "set_up");
  });

  it("ignores a step the venue does not use", () => {
    const applicable = applicableSetupSteps({ ...DEFAULT_PLANNING_CAPABILITIES, timeline: false });
    const next = withSetupDecision(empty, applicable, "timeline", "skipped");
    assert.equal(next.decisions.timeline, undefined);
  });
});

describe("overview exceptions", () => {
  it("shows overdue work and hides empty modules", () => {
    const rows = selectOverviewExceptions([
      section({ key: "payments", status: "needs_attention", detail: "1 payment overdue.", label: "Payments" }),
      section({ key: "planning", status: "needs_attention", detail: "0 of 4 required tasks done · 1 overdue", label: "Planning" }),
      section({ key: "floorplans", status: "not_started", detail: "No floor plan created yet.", label: "Floor Plans" }),
      section({ key: "timeline", status: "not_started", detail: "No timeline items yet.", label: "Timeline" }),
      section({ key: "guests", status: "not_started", detail: "No guests added yet.", label: "Guests" }),
      section({ key: "documents", status: "not_started", detail: "No documents yet.", label: "Documents" }),
      section({ key: "communication", status: "not_started", detail: "No messages yet.", label: "Communication" }),
      section({ key: "contracts", status: "not_started", detail: "No contract yet.", label: "Contract" }),
      section({ key: "payments", status: "complete", detail: "Paid in full.", label: "Payments" }),
    ].filter((row) => row.key !== "payments" || row.status === "needs_attention"));
    // The complete payments row was filtered out of the input above; assert the selector drops complete too.
    const withResolved = selectOverviewExceptions([
      section({ key: "payments", status: "complete", detail: "Paid in full.", label: "Payments" }),
      section({ key: "documents", status: "waiting", detail: "1 document expiring within 30 days.", label: "Documents" }),
      section({ key: "communication", status: "needs_attention", detail: "2 unread from the client.", label: "Communication" }),
    ]);
    assert.equal(rows.some((row) => row.key === "payments"), true);
    assert.equal(rows.some((row) => row.detail.includes("No floor plan")), false);
    assert.equal(rows.some((row) => row.key === "timeline"), false);
    assert.equal(rows.some((row) => row.key === "contracts"), false);
    assert.equal(withResolved.some((row) => row.detail === "Paid in full."), false);
    assert.equal(withResolved.some((row) => row.key === "documents"), true);
    assert.equal(withResolved.some((row) => row.key === "communication"), true);
  });

  it("includes a questionnaire waiting on the venue and drops a draft", () => {
    const rows = selectOverviewExceptions([], [
      { id: "q1", kind: "final_details", status: "submitted" },
      { id: "q2", kind: "client_planning", status: "draft" },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.label, "Final Details");
    assert.match(rows[0]?.detail ?? "", /waiting on you/);
  });
});
