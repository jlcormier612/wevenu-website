import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  completedTourDisplayClockIso,
  completedTourHoursAgo,
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
