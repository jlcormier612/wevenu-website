/**
 * Luv intelligence recovery — prioritization + celebration next-step regressions.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ClassifiedItem } from "@/lib/dashboard-system/decision-engine";
import {
  interpretOverdueTaskPriority,
  selectLuvDashboardEntry,
} from "@/lib/dashboard-system/luv-entry";
import {
  buildTourAllSetObservation,
  buildUpcomingTourStatusObservation,
} from "@/lib/luv/observation-quality";

function task(
  overrides: Partial<ClassifiedItem> & { id: string; label: string; href: string; sortDate: string },
): ClassifiedItem {
  return {
    priority: "critical",
    domain: "Tasks",
    detail: "Lead",
    rightLabel: "Overdue",
    crossSectionSubject: null,
    ...overrides,
  };
}

describe("intelligence recovery — overdue task priority", () => {
  it("picks oldest due among Focus overdue tasks without restating the count", () => {
    const entry = interpretOverdueTaskPriority([
      task({ id: "a", label: "Newer", href: "/leads/a?tab=tasks", sortDate: "2026-10-18", detail: "A" }),
      task({ id: "b", label: "Older", href: "/leads/b?tab=tasks", sortDate: "2026-10-02", detail: "B" }),
      task({ id: "c", label: "Mid", href: "/leads/c?tab=tasks", sortDate: "2026-10-10", detail: "C" }),
    ]);
    assert.ok(entry);
    assert.match(entry!.message, /Older/);
    assert.match(entry!.message, /most time-sensitive/);
    assert.doesNotMatch(entry!.message, /\b(two|three|2|3)\b.*past due|Want to clear/i);
    assert.equal(entry!.actionHref, "/leads/b?tab=tasks");
  });

  it("stays silent for a single overdue task (Focus already shows it)", () => {
    assert.equal(
      interpretOverdueTaskPriority([
        task({ id: "a", label: "Only", href: "/leads/a?tab=tasks", sortDate: "2026-10-01" }),
      ]),
      null,
    );
  });

  it("selectLuvDashboardEntry uses tasks priority when Focus is Tasks-only", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [
        task({ id: "a", label: "Send contract", href: "/leads/a?tab=tasks", sortDate: "2026-09-01", detail: "Sam" }),
        task({ id: "b", label: "Confirm caterer", href: "/leads/b?tab=tasks", sortDate: "2026-10-01", detail: "Pat" }),
      ],
      observations: [],
      recommendations: [],
    });
    assert.ok(entry);
    assert.match(entry!.message, /Send contract/);
    assert.equal(entry!.suggestion, "Want to start there?");
  });
});

describe("intelligence recovery — confirmed tour celebration", () => {
  it("celebrates confirmed tours with a logistics next step", () => {
    const obs = buildUpcomingTourStatusObservation({
      tourId: "t1",
      scheduledAt: "2026-10-28T15:00:00Z",
      status: "confirmed",
      contactName: "Alex & Jordan",
      leadId: "lead-1",
      daysUntil: 1,
    });
    assert.ok(obs);
    assert.equal(obs!.kind, "celebration");
    assert.match(obs!.message, /all set/);
    assert.match(obs!.detail ?? "", /confirmed/);
    assert.equal(obs!.recommendation?.type, "navigate");
  });

  it("still refuses celebration for scheduled-only", () => {
    assert.equal(
      buildTourAllSetObservation({
        tourId: "t1",
        scheduledAt: "2026-10-28T15:00:00Z",
        status: "scheduled",
        contactName: "Alex",
        leadId: "lead-1",
        daysUntil: 1,
      }),
      null,
    );
  });
});
