import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  classifyBriefingItems,
  classifyUpcomingItems,
} from "@/lib/dashboard-system/decision-engine";
import { aggregateFocusEntry } from "@/lib/dashboard-system/luv-entry";
import type { DashboardData } from "@/lib/dashboard/types";
import {
  leadCountsOnTodaySchedule,
  leadMatchesFocusTourRules,
} from "@/lib/dashboard/focus-lead-membership";
import {
  isPastTourAppointment,
  isUpcomingTourAppointment,
  partitionTourAppointmentsForVenueList,
  tourDisplayClockIso,
} from "@/lib/tours/list-order";
import type { TourAppointment } from "@/lib/tours/types";

const TODAY = "2026-10-18";
const TWO_WEEKS = "2026-11-01";
const NOW = new Date("2026-10-18T19:40:00.000Z");

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

function lead(id: string, tourDate: string, tourCompleted: boolean, tourTime = "10:30") {
  return {
    id,
    firstName: "Synthetic",
    lastName: id,
    partnerFirstName: null,
    partnerLastName: null,
    tourDate,
    tourTime,
    tourCompleted,
  };
}

function appt(partial: Partial<TourAppointment> & Pick<TourAppointment, "id" | "scheduledAt" | "status">): TourAppointment {
  return {
    venueId: "venue-a",
    leadId: "lead-a",
    actualOccurredAt: null,
    origin: "scheduled",
    durationMinutes: 60,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    eventType: null,
    eventDate: null,
    guestCount: null,
    notes: null,
    assignedTo: null,
    confirmedAt: null,
    completedAt: null,
    followUpSentAt: null,
    outcome: null,
    cancellationReason: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    confirmationRequestedAt: null,
    confirmationSource: null,
    isArchived: false,
    ...partial,
  };
}

describe("early tour completion lifecycle", () => {
  it("keeps an explicitly completed early tour out of upcoming and on the past list", () => {
    const completedEarly = appt({
      id: "early",
      status: "completed",
      scheduledAt: "2026-10-18T19:00:00.000Z",
      actualOccurredAt: "2026-10-18T15:00:00.000Z",
      completedAt: "2026-10-18T15:05:00.000Z",
    });
    const stillAhead = appt({
      id: "later",
      status: "confirmed",
      scheduledAt: "2026-10-18T22:00:00.000Z",
    });
    assert.equal(isUpcomingTourAppointment(completedEarly, NOW), false);
    assert.equal(isPastTourAppointment(completedEarly, NOW), true);
    assert.equal(tourDisplayClockIso(completedEarly), "2026-10-18T15:00:00.000Z");
    assert.equal(completedEarly.scheduledAt, "2026-10-18T19:00:00.000Z");
    const { upcoming, past } = partitionTourAppointmentsForVenueList([completedEarly, stillAhead], NOW);
    assert.deepEqual(upcoming.map((a) => a.id), ["later"]);
    assert.deepEqual(past.map((a) => a.id), ["early"]);
    assert.equal(past[0].status, "completed");
  });

  it("does not mark a past-due tour completed just because its scheduled time passed", () => {
    const pastDue = appt({
      id: "pastdue",
      status: "confirmed",
      scheduledAt: "2026-10-18T14:30:00.000Z",
    });
    assert.equal(pastDue.status, "confirmed");
    assert.equal(isUpcomingTourAppointment(pastDue, NOW), false);
    assert.equal(isPastTourAppointment(pastDue, NOW), true);
    assert.equal(tourDisplayClockIso(pastDue), pastDue.scheduledAt);
    assert.equal(
      leadMatchesFocusTourRules({ tourDate: TODAY, tourCompleted: false }, TODAY, TWO_WEEKS),
      true,
    );
    assert.equal(leadCountsOnTodaySchedule({ tourDate: TODAY, tourCompleted: false }, TODAY), true);
  });

  it("dashboard today-count and Luv summary exclude completed tours and keep the remaining one", () => {
    const data = dashboard({
      upcomingTours: [
        lead("done-1", TODAY, true, "09:00"),
        lead("done-2", TODAY, true, "11:00"),
        lead("still", TODAY, false, "16:00"),
      ] as never,
    });
    const focus = classifyBriefingItems(data);
    const tours = focus.filter((item) => item.domain === "Calendar");
    assert.deepEqual(tours.map((item) => item.id), ["tour-still"]);
    const luv = aggregateFocusEntry(focus);
    assert.match(luv?.message ?? "", /one tour is on today's schedule/);
    assert.equal(
      leadMatchesFocusTourRules({ tourDate: TODAY, tourCompleted: true }, TODAY, TWO_WEEKS),
      false,
    );
  });

  it("a completed tour does not stay in Coming up when its booked day is still ahead", () => {
    const data = dashboard({
      upcomingTours: [lead("done-future-slot", "2026-10-20", true)] as never,
    });
    assert.deepEqual(classifyUpcomingItems(data).map((item) => item.id), []);
  });

  it("completion write confirms the saved row and does not assign scheduled_at", () => {
    const src = readFileSync(join(process.cwd(), "lib/tours/service.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function updateTourStatus"));
    const body = fn.slice(0, fn.indexOf("export async function requestTourConfirmation"));
    const completed = body.slice(body.indexOf('if (status === "completed")'), body.indexOf("const becameConfirmed"));
    assert.match(completed, /patch\.completed_at/);
    assert.match(completed, /patch\.actual_occurred_at/);
    assert.doesNotMatch(completed, /patch\.scheduled_at/);
    assert.match(body, /\.eq\("venue_id", venue\.id\)/);
    assert.match(body, /\.select\("id, status, scheduled_at, actual_occurred_at, completed_at"\)/);
    assert.match(body, /saved\.status !== status/);
  });

  it("dashboard tour load only treats scheduled and confirmed rows as remaining work", () => {
    const src = readFileSync(join(process.cwd(), "lib/dashboard/service.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function loadFocusPopulationLeads"));
    const body = fn.slice(0, fn.indexOf("const rows = [...byId.values()]"));
    assert.match(body, /\.in\("status", \["scheduled", "confirmed"\]\)/);
  });

  it("cancellation and confirmation branches remain on the status writer", () => {
    const src = readFileSync(join(process.cwd(), "lib/tours/service.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function updateTourStatus"));
    const body = fn.slice(0, fn.indexOf("export async function requestTourConfirmation"));
    assert.match(body, /status === "cancelled"/);
    assert.match(body, /becameConfirmed/);
    assert.match(body, /status === "no_show"/);
  });
});
