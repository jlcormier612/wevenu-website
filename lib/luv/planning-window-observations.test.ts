import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EventReadiness } from "@/lib/playbooks/types";
import type { TimelineEntry } from "@/lib/timeline/types";

import {
  buildPlanningWindowObservationsForEvent,
  type PlanningWindowEvent,
  type PlanningWindowReadiness,
} from "./planning-window-observations";

function readiness(overrides: Partial<EventReadiness> = {}): EventReadiness {
  return {
    score: 80,
    completedRequired: 4,
    totalRequired: 5,
    completedOptional: 0,
    totalOptional: 0,
    tasks: [],
    blockedCount: 0,
    overdueCount: 0,
    ...overrides,
  };
}

function eventInWindow(daysFromNow: number, id = "ev-p7"): PlanningWindowEvent {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const event_date = d.toISOString().slice(0, 10);
  return {
    id,
    name: "The Event",
    event_date,
    client_id: "cl1",
    clients: { first_name: "Ada", partner_first_name: "Grace" },
  };
}

describe("P7 planning-window observations", () => {
  it("emits planning-attention when readiness needs attention", () => {
    const ev = eventInWindow(45);
    const rk: PlanningWindowReadiness = {
      client: readiness({ overdueCount: 2, completedRequired: 1, totalRequired: 6, score: 16 }),
      venue: null,
    };
    const obs = buildPlanningWindowObservationsForEvent(ev, rk, [], 3);
    assert.equal(obs.some((o) => o.id === `planning-attention-${ev.id}`), true);
    assert.equal(obs.some((o) => o.id === `strong-momentum-${ev.id}`), false);
  });

  it("emits strong-momentum when ≥70% required and no exceptions", () => {
    const ev = eventInWindow(60);
    const rk: PlanningWindowReadiness = {
      client: readiness({ completedRequired: 4, totalRequired: 5, overdueCount: 0, blockedCount: 0 }),
      venue: null,
    };
    const obs = buildPlanningWindowObservationsForEvent(ev, rk, [], 3);
    assert.equal(obs.some((o) => o.id === `strong-momentum-${ev.id}`), true);
    assert.match(obs.find((o) => o.id === `strong-momentum-${ev.id}`)?.link ?? "", /\/events\/ev-p7/);
  });

  it("emits timeline-attention only outside the 21-day briefing window", () => {
    const far = eventInWindow(40, "far");
    const near = eventInWindow(10, "near");
    const entries = Array.from({ length: 6 }, (_, i) => ({
      status: i === 0 ? "complete" : "pending",
    })) as Pick<TimelineEntry, "status">[];
    const rk: PlanningWindowReadiness = { client: null, venue: null };
    const farObs = buildPlanningWindowObservationsForEvent(far, rk, entries, 2);
    const nearObs = buildPlanningWindowObservationsForEvent(near, rk, entries, 2);
    assert.equal(farObs.some((o) => o.id === "timeline-attention-far"), true);
    assert.equal(nearObs.some((o) => o.id === "timeline-attention-near"), false);
  });

  it("emits communication-none when ≤30 days and no messages", () => {
    const ev = eventInWindow(20, "quiet");
    const obs = buildPlanningWindowObservationsForEvent(ev, { client: null, venue: null }, [], 0);
    assert.equal(obs.some((o) => o.id === "communication-none-quiet"), true);
    const withMail = buildPlanningWindowObservationsForEvent(ev, { client: null, venue: null }, [], 2);
    assert.equal(withMail.some((o) => o.id === "communication-none-quiet"), false);
  });

  it("parallel readiness mapping produces the same observations as sequential", () => {
    const events = [eventInWindow(25, "a"), eventInWindow(50, "b"), eventInWindow(12, "c")];
    const readinessById: Record<string, PlanningWindowReadiness> = {
      a: { client: readiness({ overdueCount: 1, totalRequired: 3, completedRequired: 0 }), venue: null },
      b: { client: readiness({ completedRequired: 7, totalRequired: 8 }), venue: null },
      c: { client: null, venue: null },
    };
    const timelines: Record<string, Pick<TimelineEntry, "status">[]> = {
      a: [],
      b: Array.from({ length: 6 }, (_, i) => ({ status: i < 2 ? "complete" : "pending" })) as Pick<TimelineEntry, "status">[],
      c: [],
    };
    const messages: Record<string, number> = { a: 0, b: 4, c: 0 };

    const sequential = events.flatMap((ev) =>
      buildPlanningWindowObservationsForEvent(ev, readinessById[ev.id], timelines[ev.id], messages[ev.id]),
    );
    const parallel = events.map((ev) =>
      buildPlanningWindowObservationsForEvent(ev, readinessById[ev.id], timelines[ev.id], messages[ev.id]),
    ).flat();

    assert.deepEqual(
      parallel.map((o) => o.id),
      sequential.map((o) => o.id),
    );
    assert.deepEqual(parallel, sequential);
  });

  it("does not invent observations for events that have no matching readiness signal", () => {
    const ev = eventInWindow(80, "empty");
    const obs = buildPlanningWindowObservationsForEvent(ev, { client: null, venue: null }, [], 1);
    assert.deepEqual(obs, []);
  });
});
