import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  completedTourDisplayClockIso,
  completedTourHoursAgo,
  tourActualDiffersFromScheduled,
  tourOccurrenceIso,
} from "@/lib/tours/occurrence-clock";
import { tourDisplayClockIso } from "@/lib/tours/list-order";
import type { TourAppointment } from "@/lib/tours/types";

describe("occurrence clock — Oct 4 / -69h", () => {
  const scheduledOct4 = "2026-10-04T17:00:00.000Z";
  const actualOct1 = "2026-10-01T18:45:00.000Z";
  const completedAt = "2026-10-01T22:30:28.898Z";
  const now = Date.parse("2026-10-01T22:40:00.000Z");

  it("recency uses actual_occurred_at, never a future scheduled_at", () => {
    const occurrence = tourOccurrenceIso({
      actual_occurred_at: actualOct1,
      completed_at: completedAt,
    });
    assert.equal(occurrence, actualOct1);
    assert.equal(completedTourHoursAgo(scheduledOct4, now), 0);
    assert.equal(completedTourHoursAgo(actualOct1, now), 4);
  });

  it("falls back to completed_at when actual is missing", () => {
    assert.equal(
      tourOccurrenceIso({ actual_occurred_at: null, completed_at: completedAt }),
      completedAt,
    );
  });

  it("completed display clock prefers actual over the booked Oct 4 slot", () => {
    assert.equal(
      completedTourDisplayClockIso({
        status: "completed",
        origin: "scheduled",
        scheduled_at: scheduledOct4,
        actual_occurred_at: actualOct1,
      }),
      actualOct1,
    );
    assert.equal(
      tourDisplayClockIso({
        venueId: "v",
        leadId: null,
        id: "jasmine",
        scheduledAt: scheduledOct4,
        actualOccurredAt: actualOct1,
        origin: "scheduled",
        status: "completed",
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
        completedAt,
        followUpSentAt: null,
        outcome: null,
        cancellationReason: null,
        createdAt: "2026-09-01T00:00:00.000Z",
        confirmationRequestedAt: null,
        confirmationSource: null,
        isArchived: false,
      } satisfies TourAppointment),
      actualOct1,
    );
  });

  it("occupying scheduled tours still display from scheduled_at", () => {
    assert.equal(
      completedTourDisplayClockIso({
        status: "confirmed",
        origin: "scheduled",
        scheduled_at: scheduledOct4,
        actual_occurred_at: null,
      }),
      scheduledOct4,
    );
  });
});

describe("occurrence clock — Oct 11 scheduled / Oct 9 actual acceptance", () => {
  const scheduledOct11 = "2026-10-11T18:00:00.000Z"; // 2:00 PM ET
  const actualOct9 = "2026-10-09T18:00:00.000Z";
  const completedLater = "2026-10-12T15:00:00.000Z"; // recorded days later
  const completedSameDay = "2026-10-09T19:30:00.000Z";

  function appt(overrides: Partial<TourAppointment> = {}): TourAppointment {
    return {
      venueId: "v",
      leadId: null,
      id: "acceptance",
      scheduledAt: scheduledOct11,
      actualOccurredAt: actualOct9,
      origin: "scheduled",
      status: "completed",
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
      completedAt: completedSameDay,
      followUpSentAt: null,
      outcome: null,
      cancellationReason: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      confirmationRequestedAt: null,
      confirmationSource: null,
      isArchived: false,
      ...overrides,
    };
  }

  it("1. completed on originally scheduled date keeps scheduled display when actual matches", () => {
    const same = appt({ actualOccurredAt: scheduledOct11, completedAt: scheduledOct11 });
    assert.equal(tourDisplayClockIso(same), scheduledOct11);
    assert.equal(tourActualDiffersFromScheduled(same), false);
    assert.equal(same.scheduledAt, scheduledOct11);
  });

  it("2. early occurrence preserves scheduled and displays actual", () => {
    const early = appt();
    assert.equal(early.scheduledAt, scheduledOct11);
    assert.equal(tourDisplayClockIso(early), actualOct9);
    assert.equal(tourOccurrenceIso({
      actual_occurred_at: early.actualOccurredAt,
      completed_at: early.completedAt,
    }), actualOct9);
    assert.equal(tourActualDiffersFromScheduled(early), true);
  });

  it("3. later occurrence preserves scheduled and displays actual", () => {
    const laterActual = "2026-10-14T18:00:00.000Z";
    const late = appt({ actualOccurredAt: laterActual });
    assert.equal(late.scheduledAt, scheduledOct11);
    assert.equal(tourDisplayClockIso(late), laterActual);
  });

  it("4. completion recorded days later does not become the occurrence clock", () => {
    const delayed = appt({ completedAt: completedLater });
    assert.equal(
      tourOccurrenceIso({
        actual_occurred_at: delayed.actualOccurredAt,
        completed_at: delayed.completedAt,
      }),
      actualOct9,
    );
    assert.notEqual(delayed.completedAt, delayed.actualOccurredAt);
    assert.equal(delayed.scheduledAt, scheduledOct11);
  });

  it("5–7. scheduled, actual, and completed_at remain three distinct facts", () => {
    const row = appt({ completedAt: completedLater });
    assert.equal(row.scheduledAt, scheduledOct11);
    assert.equal(row.actualOccurredAt, actualOct9);
    assert.equal(row.completedAt, completedLater);
    assert.notEqual(row.scheduledAt, row.actualOccurredAt);
    assert.notEqual(row.actualOccurredAt, row.completedAt);
  });
});
