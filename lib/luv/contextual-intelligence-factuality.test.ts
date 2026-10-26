/**
 * Luv contextual intelligence — factuality + usefulness regressions
 * for overdue-task silence and tour confirmation claims.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  aggregateFocusEntry,
  selectLuvDashboardEntry,
} from "@/lib/dashboard-system/luv-entry";
import type { ClassifiedItem } from "@/lib/dashboard-system/decision-engine";
import {
  buildTourAllSetObservation,
  buildUpcomingTourStatusObservation,
} from "@/lib/luv/observation-quality";
import { isAuthoritativeTourConfirmed } from "@/lib/luv/pipeline-stage-evidence";
import type { LuvObservation } from "@/lib/luv/types";

function focus(overrides: Partial<ClassifiedItem> = {}): ClassifiedItem {
  return {
    id: "x",
    priority: "needs_attention_today",
    domain: "Tasks",
    label: "Task",
    detail: "Overdue",
    href: "/leads/a?tab=tasks",
    sortDate: null,
    crossSectionSubject: null,
    ...overrides,
  };
}

describe("Failure A — overdue tasks already on Focus", () => {
  it("does not emit redundant past-due count + Want to clear them", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [
        focus({ id: "t1", label: "Call Sam" }),
        focus({ id: "t2", href: "/leads/b?tab=tasks", label: "Email Pat" }),
      ],
      observations: [],
      recommendations: [],
    });
    assert.equal(entry, null);
    assert.equal(aggregateFocusEntry([focus({ id: "t1" }), focus({ id: "t2" })]), null);
  });

  it("still allows a distinct live L1 observation alongside overdue tasks", () => {
    const setup: LuvObservation = {
      id: "venue-readiness-inquiry-form",
      kind: "recommendation",
      priority: "high",
      message: "Your inquiry form is missing a required field configuration.",
      link: "/settings/leads",
      actionLabel: "Open settings",
    };
    const entry = selectLuvDashboardEntry({
      focusItems: [focus({ id: "t1" }), focus({ id: "t2" })],
      observations: [setup],
      recommendations: [],
    });
    assert.equal(entry?.message, setup.message);
    assert.doesNotMatch(entry?.message ?? "", /past due|Want to clear/i);
  });
});

describe("Failure B — scheduled is not confirmed", () => {
  const couple = "Ursula Meadows & Brian Valley";

  it("scheduled cannot produce all-set / Good luck", () => {
    const obs = buildUpcomingTourStatusObservation({
      tourId: "tour-1",
      scheduledAt: "2026-10-28T15:00:00Z",
      status: "scheduled",
      confirmationRequestedAt: null,
      contactName: couple,
      leadId: "lead-1",
      daysUntil: 2,
    });
    assert.ok(obs);
    assert.doesNotMatch(obs!.message, /all set|Good luck/i);
    assert.match(obs!.message, /not confirmed yet/i);
    assert.equal(isAuthoritativeTourConfirmed({ status: "scheduled" }), false);
  });

  it("confirmation request sent still does not claim recipient confirmed", () => {
    const obs = buildUpcomingTourStatusObservation({
      tourId: "tour-1",
      scheduledAt: "2026-10-28T15:00:00Z",
      status: "scheduled",
      confirmationRequestedAt: "2026-10-20T12:00:00Z",
      contactName: couple,
      leadId: "lead-1",
      daysUntil: 2,
    });
    assert.ok(obs);
    assert.doesNotMatch(obs!.message, /all set|Good luck|are confirmed/i);
    assert.match(obs!.message, /waiting for their reply/i);
  });

  it("confirmed may use all-set within the window", () => {
    const obs = buildTourAllSetObservation({
      tourId: "tour-1",
      scheduledAt: "2026-10-28T15:00:00Z",
      status: "confirmed",
      contactName: couple,
      leadId: "lead-1",
      daysUntil: 2,
    });
    assert.ok(obs);
    assert.match(obs!.message, /all set/);
  });

  it("completed and cancelled do not surface as upcoming all-set", () => {
    for (const status of ["completed", "cancelled", "no_show"] as const) {
      assert.equal(
        buildUpcomingTourStatusObservation({
          tourId: "tour-1",
          scheduledAt: "2026-10-28T15:00:00Z",
          status,
          contactName: couple,
          leadId: "lead-1",
          daysUntil: 1,
        }),
        null,
      );
    }
  });
});

describe("source locks — no parallel factuality engine", () => {
  it("observations engine uses status dispatcher and confirmation_requested_at", () => {
    const src = readFileSync(resolve("lib/luv/observations.ts"), "utf8");
    assert.match(src, /buildUpcomingTourStatusObservation/);
    assert.match(src, /confirmation_requested_at/);
    assert.doesNotMatch(src, /buildTourAllSetObservation\(/);
  });

  it("all-set builder requires isAuthoritativeTourConfirmed", () => {
    const src = readFileSync(resolve("lib/luv/observation-quality.ts"), "utf8");
    assert.match(src, /isAuthoritativeTourConfirmed/);
    const allSet = src.slice(src.indexOf("export function buildTourAllSetObservation"));
    const body = allSet.slice(0, allSet.indexOf("export function buildTourScheduledUnconfirmedObservation"));
    assert.match(body, /isAuthoritativeTourConfirmed/);
    assert.doesNotMatch(body, /isAuthoritativeTourScheduled/);
  });

  it("Tasks omitted from Focus aggregate map", () => {
    const src = readFileSync(resolve("lib/dashboard-system/luv-entry.ts"), "utf8");
    assert.match(src, /Tasks are likewise omitted/);
    assert.doesNotMatch(src, /Tasks:\s*\{\s*summary:/);
  });
});
