/**
 * Tour archive is list hygiene — orthogonal to status. Reporting must keep
 * counting archived tours.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  isPastTourAppointment,
  isUpcomingTourAppointment,
  partitionTourAppointmentsForVenueList,
} from "@/lib/tours/list-order";
import type { TourAppointment } from "@/lib/tours/types";

function appt(
  partial: Pick<TourAppointment, "id" | "scheduledAt" | "status"> &
    Partial<Pick<TourAppointment, "isArchived">>,
): TourAppointment {
  return {
    venueId: "v",
    leadId: "lead-1",
    actualOccurredAt: null,
    origin: "scheduled",
    durationMinutes: 60,
    contactName: "Wilma",
    contactEmail: "wilma@example-customer.com",
    contactPhone: null,
    eventType: "wedding",
    eventDate: null,
    guestCount: null,
    notes: null,
    assignedTo: null,
    confirmedAt: null,
    completedAt: null,
    followUpSentAt: null,
    outcome: null,
    cancellationReason: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    confirmationRequestedAt: null,
    confirmationSource: null,
    isArchived: false,
    ...partial,
  };
}

const serviceSrc = readFileSync(resolve("lib/tours/service.ts"), "utf8");
const funnelSrc = readFileSync(resolve("lib/metrics/business-funnel.ts"), "utf8");
const attributionSrc = readFileSync(resolve("lib/metrics/attribution.ts"), "utf8");
const migrationSrc = readFileSync(
  resolve("supabase/migrations/20261407700000_tour_appointments_archive.sql"),
  "utf8",
);
const deleteGuardSrc = readFileSync(resolve("lib/tours/delete-guard.ts"), "utf8");
const actionsSrc = readFileSync(resolve("app/(app)/tours/actions.ts"), "utf8");
const tourListSrc = readFileSync(resolve("components/tours/tour-list.tsx"), "utf8");
const toursPageSrc = readFileSync(resolve("app/(app)/tours/page.tsx"), "utf8");

describe("tour_appointments archive migration", () => {
  it("adds is_archived not null default false without mutating status", () => {
    assert.match(migrationSrc, /is_archived boolean not null default false/);
    assert.match(migrationSrc, /tour_appointments_venue_archived/);
    assert.doesNotMatch(migrationSrc, /status.*archived|archived.*status/);
  });
});

describe("archive partition + status orthogonality", () => {
  const now = new Date("2026-09-22T15:00:00.000Z");

  it("existing tours default unarchived and appear in Past/Upcoming", () => {
    const completed = appt({
      id: "c1",
      scheduledAt: "2026-09-01T18:00:00.000Z",
      status: "completed",
    });
    assert.equal(completed.isArchived, false);
    assert.equal(isPastTourAppointment(completed, now), true);
  });

  it("archived completed/no_show/scheduled/confirmed leave default lists", () => {
    for (const status of ["completed", "no_show", "scheduled", "confirmed"] as const) {
      const a = appt({
        id: status,
        scheduledAt:
          status === "scheduled" || status === "confirmed"
            ? "2026-10-01T18:00:00.000Z"
            : "2026-09-01T18:00:00.000Z",
        status,
        isArchived: true,
      });
      assert.equal(isUpcomingTourAppointment(a, now), false);
      assert.equal(isPastTourAppointment(a, now), false);
    }
  });

  it("restored completed tour returns to Past without status change", () => {
    const a = appt({
      id: "restored",
      scheduledAt: "2026-09-10T18:00:00.000Z",
      status: "completed",
      isArchived: false,
    });
    const { past, upcoming } = partitionTourAppointmentsForVenueList([a], now);
    assert.deepEqual(past.map((x) => x.id), ["restored"]);
    assert.equal(upcoming.length, 0);
    assert.equal(a.status, "completed");
  });

  it("authoritative queries exclude archived from default fetch and load Archived separately", () => {
    assert.match(serviceSrc, /eq\("is_archived", false\)/);
    assert.match(serviceSrc, /getArchivedTourAppointments/);
    assert.match(serviceSrc, /eq\("is_archived", true\)/);
    assert.match(serviceSrc, /setTourAppointmentArchived/);
    // Lead history still includes archived
    assert.match(serviceSrc, /Lead panel shows full tour history including archived/);
  });

  it("Tours page wires Archived section; overflow uses Archive/Restore/Delete", () => {
    assert.match(toursPageSrc, /getArchivedTourAppointments/);
    assert.match(toursPageSrc, /TourArchivedSection/);
    assert.match(tourListSrc, /LibraryOverflowMenu/);
    assert.match(tourListSrc, /archiveToggleLabel/);
    assert.match(tourListSrc, /LibraryDeleteConfirmDialog/);
    assert.match(actionsSrc, /setTourArchivedAction/);
    assert.match(actionsSrc, /deleteTourAction/);
  });
});

describe("reporting keeps archived tours", () => {
  it("business funnel / attribution do not filter is_archived", () => {
    assert.doesNotMatch(funnelSrc, /is_archived/);
    assert.doesNotMatch(attributionSrc, /is_archived/);
  });
});

describe("delete server guard wiring", () => {
  it("deleteTourAppointment uses canHardDeleteTourAppointment before delete", () => {
    assert.match(serviceSrc, /canHardDeleteTourAppointment/);
    assert.match(serviceSrc, /\.delete\(\)/);
    assert.match(deleteGuardSrc, /allowed: false/);
  });
});
