import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateEventVolume,
  planForPeakCount,
  recommendedUpgrade,
} from "./event-volume";

describe("evaluateEventVolume", () => {
  it("counts by event_date calendar year, not bookedAt year", () => {
    const result = evaluateEventVolume({
      events: [
        {
          id: "1",
          status: "confirmed",
          eventDate: "2027-06-15",
          bookedAt: "2025-11-01T12:00:00Z",
        },
      ],
    });
    assert.equal(result.byYear[2027], 1);
    assert.equal(result.byYear[2025], undefined);
    assert.equal(result.peakYear, 2027);
  });

  it("uses the highest count across multiple future years", () => {
    const events = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `a${i}`,
        status: "confirmed" as const,
        eventDate: "2026-01-01",
        bookedAt: "2025-01-01T00:00:00Z",
      })),
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `b${i}`,
        status: "confirmed" as const,
        eventDate: "2028-03-01",
        bookedAt: "2025-01-01T00:00:00Z",
      })),
    ];
    const result = evaluateEventVolume({ events });
    assert.equal(result.peakYear, 2028);
    assert.equal(result.peakCount, 30);
    assert.equal(result.recommendedPlan, "growing");
  });

  it("excludes cancelled even when booked_at remains", () => {
    const result = evaluateEventVolume({
      events: [
        {
          id: "c1",
          status: "cancelled",
          eventDate: "2026-05-01",
          bookedAt: "2025-01-01T00:00:00Z",
        },
        {
          id: "c2",
          status: "confirmed",
          eventDate: "2026-05-02",
          bookedAt: "2025-01-01T00:00:00Z",
        },
      ],
    });
    assert.equal(result.peakCount, 1);
  });

  it("counts a rebooked event once it is qualifying again", () => {
    const cancelled = evaluateEventVolume({
      events: [
        {
          id: "r1",
          status: "cancelled",
          eventDate: "2026-08-01",
          bookedAt: "2025-01-01T00:00:00Z",
        },
      ],
    });
    assert.equal(cancelled.peakCount, 0);

    const rebooked = evaluateEventVolume({
      events: [
        {
          id: "r1",
          status: "confirmed",
          eventDate: "2026-08-01",
          bookedAt: "2025-01-01T00:00:00Z",
        },
      ],
    });
    assert.equal(rebooked.peakCount, 1);
  });

  it("counts completed and in-progress events", () => {
    const result = evaluateEventVolume({
      events: [
        {
          id: "1",
          status: "complete",
          eventDate: "2026-01-01",
          bookedAt: "2025-01-01T00:00:00Z",
        },
        {
          id: "2",
          status: "in_progress",
          eventDate: "2026-01-02",
          bookedAt: "2025-01-01T00:00:00Z",
        },
        {
          id: "3",
          status: "draft",
          eventDate: "2026-01-03",
          bookedAt: null,
        },
      ],
    });
    assert.equal(result.peakCount, 2);
  });

  it("counts multiple events on the same date separately", () => {
    const result = evaluateEventVolume({
      events: [
        {
          id: "1",
          status: "confirmed",
          eventDate: "2026-09-09",
          bookedAt: "2025-01-01T00:00:00Z",
        },
        {
          id: "2",
          status: "confirmed",
          eventDate: "2026-09-09",
          bookedAt: "2025-01-01T00:00:00Z",
        },
      ],
    });
    assert.equal(result.peakCount, 2);
  });

  it("thresholds at 25/26 and 75/76", () => {
    assert.equal(planForPeakCount(25), "starter");
    assert.equal(planForPeakCount(26), "growing");
    assert.equal(planForPeakCount(75), "growing");
    assert.equal(planForPeakCount(76), "professional");
  });

  it("does not recommend downgrade when volume falls", () => {
    const evaluation = evaluateEventVolume({
      events: Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        status: "confirmed" as const,
        eventDate: "2026-01-01",
        bookedAt: "2025-01-01T00:00:00Z",
      })),
    });
    assert.equal(evaluation.recommendedPlan, "starter");
    assert.equal(
      recommendedUpgrade({
        currentPlan: "growing",
        recommendedPlan: evaluation.recommendedPlan,
      }),
      null,
    );
  });

  it("requires bookedAt — status alone is insufficient", () => {
    const result = evaluateEventVolume({
      events: [
        {
          id: "1",
          status: "confirmed",
          eventDate: "2026-01-01",
          bookedAt: null,
        },
      ],
    });
    assert.equal(result.peakCount, 0);
  });

  it("excludes past calendar years from peak (year rollover)", () => {
    const result = evaluateEventVolume({
      asOfDate: "2027-01-15",
      events: [
        ...Array.from({ length: 80 }, (_, i) => ({
          id: `past${i}`,
          status: "confirmed" as const,
          eventDate: "2026-06-01",
          bookedAt: "2025-01-01T00:00:00Z",
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `cur${i}`,
          status: "confirmed" as const,
          eventDate: "2027-03-01",
          bookedAt: "2026-01-01T00:00:00Z",
        })),
      ],
    });
    assert.equal(result.byYear[2026], undefined);
    assert.equal(result.peakYear, 2027);
    assert.equal(result.peakCount, 10);
    assert.equal(result.recommendedPlan, "starter");
    assert.equal(
      recommendedUpgrade({
        currentPlan: "professional",
        recommendedPlan: result.recommendedPlan,
      }),
      null,
    );
  });

  it("uses future-year peak when higher than current year", () => {
    const result = evaluateEventVolume({
      asOfDate: "2026-06-01",
      events: [
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `y${i}`,
          status: "confirmed" as const,
          eventDate: "2026-07-01",
          bookedAt: "2025-01-01T00:00:00Z",
        })),
        ...Array.from({ length: 80 }, (_, i) => ({
          id: `n${i}`,
          status: "confirmed" as const,
          eventDate: "2027-07-01",
          bookedAt: "2025-01-01T00:00:00Z",
        })),
      ],
    });
    assert.equal(result.peakYear, 2027);
    assert.equal(result.peakCount, 80);
    assert.equal(result.recommendedPlan, "professional");
  });
});
