import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  compareTourScheduledAtAsc,
  partitionTourAppointmentsForVenueList,
} from "@/lib/tours/list-order";
import type { TourAppointment } from "@/lib/tours/types";

function appt(
  partial: Pick<TourAppointment, "id" | "scheduledAt" | "status">,
): TourAppointment {
  return {
    venueId: "v",
    leadId: null,
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
    createdAt: "2026-01-01T00:00:00.000Z",
    confirmationRequestedAt: null,
    confirmationSource: null,
    ...partial,
  };
}

describe("Upcoming Tours scheduled_at ascending", () => {
  it("sorts soonest upcoming first → latest last", () => {
    const now = new Date("2026-09-22T15:00:00.000Z");
    const { upcoming } = partitionTourAppointmentsForVenueList(
      [
        appt({ id: "oct5", scheduledAt: "2026-10-05T18:00:00.000Z", status: "scheduled" }),
        appt({ id: "sep29", scheduledAt: "2026-09-29T18:00:00.000Z", status: "confirmed" }),
        appt({ id: "sep25", scheduledAt: "2026-09-25T18:00:00.000Z", status: "scheduled" }),
        appt({ id: "sep28", scheduledAt: "2026-09-28T18:00:00.000Z", status: "scheduled" }),
        appt({ id: "sep27b", scheduledAt: "2026-09-27T20:00:00.000Z", status: "scheduled" }),
        appt({ id: "sep27a", scheduledAt: "2026-09-27T15:00:00.000Z", status: "confirmed" }),
      ],
      now,
    );
    assert.deepEqual(
      upcoming.map((a) => a.id),
      ["sep25", "sep27a", "sep27b", "sep28", "sep29", "oct5"],
    );
  });

  it("same calendar day orders by scheduled start time ascending", () => {
    const a = appt({ id: "later", scheduledAt: "2026-09-27T20:00:00.000Z", status: "scheduled" });
    const b = appt({ id: "earlier", scheduledAt: "2026-09-27T15:00:00.000Z", status: "scheduled" });
    assert.equal(compareTourScheduledAtAsc(b, a), -1);
    assert.equal(compareTourScheduledAtAsc(a, b), 1);
    const { upcoming } = partitionTourAppointmentsForVenueList(
      [a, b],
      new Date("2026-09-22T00:00:00.000Z"),
    );
    assert.deepEqual(upcoming.map((x) => x.id), ["earlier", "later"]);
  });

  it("Past stays most-recently-past first (not soonest-first)", () => {
    const now = new Date("2026-09-22T15:00:00.000Z");
    const { past } = partitionTourAppointmentsForVenueList(
      [
        appt({ id: "old", scheduledAt: "2026-09-01T18:00:00.000Z", status: "completed" }),
        appt({ id: "newer", scheduledAt: "2026-09-20T18:00:00.000Z", status: "completed" }),
      ],
      now,
    );
    assert.deepEqual(past.map((a) => a.id), ["newer", "old"]);
  });

  it("getTourAppointments orders Upcoming scheduled_at ascending at the query layer", () => {
    const src = readFileSync(join(process.cwd(), "lib/tours/service.ts"), "utf8");
    const fn = src.slice(src.indexOf("export async function getTourAppointments"));
    const body = fn.slice(0, fn.indexOf("export async function getTourAppointmentsForLead"));
    // Upcoming window: scheduled/confirmed + gte now + ascending true
    assert.match(
      body,
      /\.in\(\s*[\"']status[\"']\s*,\s*\[[^\]]*scheduled[^\]]*\]\s*\)[\s\S]*?\.gte\(\s*[\"']scheduled_at[\"']/ ,
    );
    assert.match(
      body,
      /\.gte\(\s*[\"']scheduled_at[\"'][\s\S]*?\.order\(\s*[\"']scheduled_at[\"']\s*,\s*\{\s*ascending:\s*true/,
    );
  });

  it("Tours page uses partition helper (not raw filter order alone)", () => {
    const page = readFileSync(join(process.cwd(), "app/(app)/tours/page.tsx"), "utf8");
    assert.match(page, /partitionTourAppointmentsForVenueList/);
  });
});
