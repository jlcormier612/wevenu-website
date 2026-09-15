import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyBriefingItems,
  classifyDashboardItems,
  classifyTodayDatedItems,
  classifyUpcomingItems,
  collectCrossSectionSubjects,
  excludeByCrossSectionSubject,
} from "@/lib/dashboard-system/decision-engine";
import type { DashboardData } from "@/lib/dashboard/types";
import { resolveVenueNextSteps } from "@/lib/dashboard/venue-next-steps";

const TODAY = "2026-08-31";
const TOMORROW = "2026-09-01";
const LATER = "2026-09-20";
const PAST = "2026-08-01";

/**
 * Only the fields the classifiers actually read. DashboardData carries ~40
 * Luv/activation fields none of these functions touch, so filling them in would
 * hide what each assertion depends on.
 */
function dashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    todayIso: TODAY,
    needsAttention: [],
    followupsDue: [],
    openTasks: [],
    upcomingTours: [],
    upcomingEvents: [],
    upcomingPayments: [],
    briefing: { needsAttentionNow: [] },
    ...overrides,
  } as unknown as DashboardData;
}

function tour(id: string, tourDate: string) {
  return { id, firstName: "Sara", lastName: "Parker", partnerFirstName: null, partnerLastName: null, tourDate, tourTime: "11:00" };
}

function event(id: string, eventDate: string) {
  return { id, name: `Event ${id}`, eventDate, startTime: null, status: "confirmed", guestCount: null, clientId: null, clientName: `Client ${id}` };
}

function payment(id: string, dueDate: string) {
  return { id, scheduleId: `sched-${id}`, label: "Deposit", amount: 500, dueDate, isOverdue: false, clientName: "Client" };
}


// The whole point of the deduplication pass: one fact, one section. Today's
// Focus owns what needs attention now; Upcoming owns what comes later.
describe("Today's Focus and Upcoming partition the same data", () => {
  it("puts an event dated today in Today's Focus and never in Upcoming", () => {
    const data = dashboard({ upcomingEvents: [event("e1", TODAY)] as never });

    const focus = classifyBriefingItems(data).map((i) => i.id);
    const upcoming = classifyUpcomingItems(data).map((i) => i.id);

    assert.ok(focus.includes("up-event-e1"), "today's event belongs to Today's Focus");
    assert.equal(upcoming.length, 0, "Upcoming must not repeat today's event");
  });

  it("puts a later event in Upcoming and never in Today's Focus", () => {
    const data = dashboard({ upcomingEvents: [event("e2", LATER)] as never });

    assert.deepEqual(classifyUpcomingItems(data).map((i) => i.id), ["up-event-e2"]);
    assert.equal(classifyBriefingItems(data).length, 0, "Today's Focus is not forward-looking");
  });

  it("does not let today's payments appear twice", () => {
    const data = dashboard({
      upcomingPayments: [payment("p1", TODAY), payment("p2", LATER)] as never,
    });
    const focus = classifyTodayDatedItems(data).map((i) => i.id);
    const upcoming = classifyUpcomingItems(data).map((i) => i.id);
    assert.deepEqual(focus.sort(), ["up-payment-p1"]);
    assert.deepEqual(upcoming, [], "Coming up is events-only — payments stay out");
  });

  it("surfaces a tour happening today exactly once", () => {
    const data = dashboard({ upcomingTours: [tour("l1", TODAY)] as never });

    const focus = classifyBriefingItems(data);
    const tourRows = focus.filter((i) => i.href === "/leads/l1");

    assert.equal(tourRows.length, 1, "one tour, one row");
    assert.equal(tourRows[0].id, "tour-l1", "published as actionable work, not as a dated item");
    assert.equal(classifyUpcomingItems(data).length, 0);
    assert.equal(classifyTodayDatedItems(data).length, 0, "today's tour is not also a dated item");
  });

  it("does not put a future tour in Coming up", () => {
    const data = dashboard({ upcomingTours: [tour("l2", TOMORROW)] as never });

    assert.deepEqual(classifyUpcomingItems(data).map((i) => i.id), []);
    assert.equal(classifyBriefingItems(data).length, 0);
  });

  it("assigns every dated item to exactly one of the two sections", () => {
    const data = dashboard({
      upcomingTours: [tour("l1", TODAY), tour("l2", LATER)] as never,
      upcomingEvents: [event("e1", TODAY), event("e2", TOMORROW)] as never,
      upcomingPayments: [payment("p1", TODAY), payment("p2", LATER)] as never,
    });

    const focus = classifyBriefingItems(data);
    const upcoming = classifyUpcomingItems(data);

    // Temporal role is the rule: nothing later than today may sit in Today's
    // Focus, and nothing dated today may sit in Upcoming.
    for (const item of focus) {
      assert.ok(item.sortDate == null || item.sortDate <= TODAY, `${item.id} is not today's business`);
    }
    for (const item of upcoming) {
      assert.ok(item.sortDate != null && item.sortDate > TODAY, `${item.id} is not upcoming`);
      assert.equal(item.domain, "Events");
    }
    assert.equal(focus.filter((f) => upcoming.some((u) => u.id === f.id)).length, 0);
    assert.deepEqual(upcoming.map((i) => i.id), ["up-event-e2"]);
  });
});

describe("Coming up is events only", () => {
  it("includes a legitimate event inside the 60-day window", () => {
    const data = dashboard({ upcomingEvents: [event("e2", LATER)] as never });
    const upcoming = classifyUpcomingItems(data);
    assert.deepEqual(upcoming.map((i) => i.id), ["up-event-e2"]);
    assert.equal(upcoming[0]!.domain, "Events");
    assert.equal(upcoming[0]!.href, "/events/e2");
    assert.equal(upcoming[0]!.sortDate, LATER);
  });

  it("does not include a remaining-balance payment attached to a real event", () => {
    const data = dashboard({
      upcomingEvents: [event("colby", LATER)] as never,
      upcomingPayments: [{
        id: "bal-1",
        scheduleId: "sched-colby",
        label: "Remaining balance",
        amount: 2400,
        dueDate: "2027-12-04",
        isOverdue: false,
        clientName: "Colby SpineE2E3",
      }] as never,
    });
    const upcoming = classifyUpcomingItems(data);
    assert.deepEqual(upcoming.map((i) => i.id), ["up-event-colby"]);
    assert.equal(upcoming.some((i) => /remaining balance/i.test(i.label) || /remaining balance/i.test(i.detail ?? "") || /remaining balance/i.test(i.rightLabel ?? "")), false);
    assert.equal(upcoming.some((i) => i.domain === "Payments"), false);
    assert.equal(upcoming.some((i) => i.sortDate === "2027-12-04"), false);
  });

  it("does not treat a payment due date outside the 60-day event window as Coming up", () => {
    const data = dashboard({
      upcomingEvents: [],
      upcomingPayments: [payment("far", "2027-12-04")] as never,
    });
    assert.deepEqual(classifyUpcomingItems(data), []);
  });

  it("drops an event beyond the 60-day horizon even if it leaked into upcomingEvents", () => {
    const data = dashboard({
      upcomingEvents: [event("far-event", "2027-12-04")] as never,
    });
    assert.deepEqual(classifyUpcomingItems(data), []);
  });
});

describe("Upcoming identity exclusion (not date partitioning alone)", () => {
  it("does not emit Coming up payment rows to identity-dedupe", () => {
    const data = dashboard({
      upcomingPayments: [payment("line-a", TOMORROW)] as never,
    });
    assert.deepEqual(classifyUpcomingItems(data), []);
  });

  it("keeps a Coming up event when Focus claimed a payment on the same booking", () => {
    const scheduleId = "sched-shared";
    const data = dashboard({
      upcomingEvents: [event("e2", LATER)] as never,
      upcomingPayments: [
        { id: "due-today", scheduleId, label: "Deposit", amount: 500, dueDate: TODAY, isOverdue: false, clientName: "Client" },
        { id: "due-later", scheduleId, label: "Remaining balance", amount: 2400, dueDate: "2027-12-04", isOverdue: false, clientName: "Client" },
      ] as never,
    });

    const focus = classifyBriefingItems(data);
    assert.ok(
      focus.some((i) => i.crossSectionSubject === `payment:${scheduleId}`),
      "Focus still claims today's payment line",
    );

    const upcoming = excludeByCrossSectionSubject(
      classifyUpcomingItems(data),
      collectCrossSectionSubjects(focus),
    );
    assert.deepEqual(upcoming.map((i) => i.id), ["up-event-e2"]);
  });

  it("Next Steps payment identity does not invent a Coming up payment row", () => {
    const data = dashboard({
      upcomingPayments: [payment("p9", TOMORROW)] as never,
    });
    assert.deepEqual(classifyUpcomingItems(data), []);

    const { visible: nextSteps } = resolveVenueNextSteps({
      today: TODAY,
      clients: [],
      venueTasks: [],
      leadFollowUps: [],
      payments: [{
        id: "overdue-line",
        scheduleId: "sched-p9",
        label: "Deposit",
        dueDate: PAST,
        isOverdue: true,
        clientName: "Client",
      }],
    });
    assert.ok(nextSteps.some((s) => s.subjectKey === "payment:sched-p9"));
  });
});

function lead(id: string, over: Record<string, unknown> = {}) {
  return {
    id, firstName: "Ada", lastName: "Lovelace", partnerFirstName: null, partnerLastName: null,
    nextActionText: null, ...over,
  };
}

// getDashboardData() has always computed followupsDue and nothing rendered it,
// so a follow-up deliberately scheduled for today stayed invisible until it
// aged into "overdue" the next morning.
describe("today's scheduled follow-ups reach Today's Focus", () => {
  it("surfaces a follow-up due today", () => {
    const data = dashboard({ followupsDue: [lead("l1")] as never });

    const focus = classifyBriefingItems(data);
    assert.deepEqual(focus.map((i) => i.id), ["followup-l1"]);
    assert.equal(focus[0].priority, "needs_attention_today");
    assert.equal(focus[0].href, "/leads/l1");
    assert.equal(focus[0].rightLabel, "Today");
  });

  it("uses the lead's own next action as the row detail when there is one", () => {
    const data = dashboard({ followupsDue: [lead("l1", { nextActionText: "Send the barn photos" })] as never });
    assert.equal(classifyBriefingItems(data)[0].detail, "Send the barn photos");
  });

  it("falls back to a plain explanation when no next action is recorded", () => {
    const data = dashboard({ followupsDue: [lead("l1")] as never });
    assert.equal(classifyBriefingItems(data)[0].detail, "Follow-up scheduled for today");
  });

  it("never lists a lead twice when it is also flagged as needing attention", () => {
    // The two feeds partition by definition, but a rule change on either side
    // must not be able to start double-listing the same lead.
    const data = dashboard({
      needsAttention: [{ ...lead("l1"), reason: "No reply in 5 days" }] as never,
      followupsDue: [lead("l1")] as never,
    });

    const rows = classifyBriefingItems(data).filter((i) => i.href === "/leads/l1");
    assert.equal(rows.length, 1, "one lead, one row");
    assert.equal(rows[0].id, "lead-l1", "the needs-attention row wins");
  });

  it("keeps today's follow-ups out of Upcoming", () => {
    const data = dashboard({ followupsDue: [lead("l1")] as never });
    assert.equal(classifyUpcomingItems(data).length, 0);
  });
});

describe("Today's Focus Event Readiness payment attention is intact", () => {
  it("still publishes briefing payment/invoice rows", () => {
    const data = dashboard({
      briefing: {
        needsAttentionNow: [{
          id: "briefing-payments-e1",
          eventId: "e1",
          eventName: "Colby SpineE2E3",
          eventDate: LATER,
          label: "Payments",
          detail: "1 invoice overdue",
          link: "/events/e1?tab=payments",
        }],
      },
    } as never);

    const focus = classifyBriefingItems(data);
    assert.equal(focus.length, 1);
    assert.equal(focus[0]!.id, "briefing-payments-e1");
    assert.equal(focus[0]!.domain, "Event Readiness");
    assert.match(focus[0]!.detail ?? "", /invoice overdue/);
    assert.equal(classifyUpcomingItems(data).length, 0);
  });
});

describe("Today's Focus carries the whole actionable set", () => {
  // It used to truncate at five because a separate Today's Attention list
  // rendered the same classification ten deep right below it. With that section
  // removed, truncating here would drop work off the Dashboard entirely.
  it("returns more than five items rather than silently cutting the list", () => {
    const data = dashboard({
      openTasks: Array.from({ length: 8 }, (_, i) => ({
        id: `t${i}`, leadId: `l${i}`, title: `Task ${i}`, dueDate: PAST, leadName: "Client",
      })) as never,
    });

    const focus = classifyBriefingItems(data);
    assert.equal(focus.length, 8, "nothing is dropped by the classifier");
    assert.equal(focus.length, classifyDashboardItems(data).length);
  });

  it("still orders by priority, critical first", () => {
    const data = dashboard({
      needsAttention: [{ id: "lead1", firstName: "Ada", lastName: "Lovelace", partnerFirstName: null, partnerLastName: null, reason: "No reply in 5 days" }] as never,
      openTasks: [{ id: "t1", leadId: "l1", title: "Send contract", dueDate: PAST, leadName: "Client" }] as never,
    });

    const focus = classifyBriefingItems(data);
    assert.equal(focus[0].priority, "critical");
    assert.equal(focus[0].id, "task-t1");
  });
});
