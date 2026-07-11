import { createClient } from "@/integrations/supabase/server";
import type { LuvObservation } from "@/lib/luv/types";
import type { MonthlyAverage, RawMemoryRow, VenueMemories } from "./memory-types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthName(n: number): string { return MONTH_NAMES[(n - 1) % 12] ?? ""; }

// ── Parse raw DB rows into typed structure ────────────────────────────────────

export function parseMemories(rows: RawMemoryRow[]): VenueMemories {
  const m: VenueMemories = {
    totalBookings:          null,
    firstBookingDate:       null,
    avgLeadToBookingDays:   null,
    busiestEventMonth:      null,
    monthlyInquiryAverages: [],
  };
  for (const row of rows) {
    const v = row.value;
    if (row.key === "total_bookings")          m.totalBookings          = (v.count as number) ?? null;
    if (row.key === "first_booking_date")      m.firstBookingDate       = (v.date as string) ?? null;
    if (row.key === "avg_lead_to_booking_days") m.avgLeadToBookingDays  = (v.days as number) ?? null;
    if (row.key === "busiest_event_month")     m.busiestEventMonth      = v as { month: number; count: number };
    if (row.key === "monthly_inquiry_averages") {
      m.monthlyInquiryAverages = (v as unknown as MonthlyAverage[]) ?? [];
    }
  }
  return m;
}

// ── DB fetch (compute if stale, then read) ────────────────────────────────────

export async function getVenueMemories(): Promise<VenueMemories | null> {
  try {
    const supabase = await createClient();

    // Compute (no-op if fresh < 24h)
    await supabase.rpc("compute_venue_memories");

    const { data, error } = await supabase.rpc("get_venue_memories");
    if (error || !data) return null;

    return parseMemories(data as RawMemoryRow[]);
  } catch {
    return null;
  }
}

// ── Generate LuvObservations from memories ────────────────────────────────────

export function computeMemoryObservations(
  memories: VenueMemories,
  currentMonthNum: number,   // 1-12
): LuvObservation[] {
  const obs: LuvObservation[] = [];

  // 1. Milestone: total bookings
  const { totalBookings } = memories;
  if (totalBookings !== null && totalBookings > 0) {
    const milestones = [1, 5, 10, 25, 50, 100, 150, 200, 250, 500];
    const hit = milestones.filter(m => m <= totalBookings).pop();
    if (hit) {
      const message = hit === totalBookings
        ? `You just reached ${hit} booking${hit !== 1 ? "s" : ""} — a milestone worth celebrating. 💗`
        : `You've booked ${totalBookings} clients on Wevenu. ${totalBookings >= 50 ? "An incredible community you've built." : "Keep the momentum going."}`;
      obs.push({
        id:          "memory_total_bookings",
        priority:    "low",
        message,
        link:        "/clients",
        actionLabel: "View clients →",
      });
    }
  }

  // 2. Business pattern: avg lead-to-booking speed
  const { avgLeadToBookingDays: avgDays } = memories;
  if (avgDays !== null && avgDays > 0) {
    const fast   = avgDays <= 14;
    const slow   = avgDays >= 60;
    const detail = fast
      ? `Leads who inquire typically book within ${avgDays} days — that's a fast, decisive pipeline.`
      : slow
      ? `Your average lead-to-booking time is ${avgDays} days. Nurturing earlier in the cycle may accelerate decisions.`
      : `Leads at your venue typically take about ${avgDays} days from first inquiry to booking.`;
    obs.push({
      id:          "memory_avg_lead_time",
      priority:    "low",
      message:     `Your average lead-to-booking time is ${avgDays} days.`,
      detail,
      link:        "/leads",
      actionLabel: "View pipeline →",
    });
  }

  // 3. Seasonal: current month context
  const { monthlyInquiryAverages: avgs } = memories;
  if (avgs.length >= 6) {
    const overallAvg = avgs.reduce((sum, a) => sum + a.avg, 0) / avgs.length;
    const thisMonth  = avgs.find(a => a.month === currentMonthNum);

    if (thisMonth && overallAvg > 0) {
      const ratio = thisMonth.avg / overallAvg;
      const name  = monthName(currentMonthNum);

      if (ratio >= 1.3) {
        obs.push({
          id:          "memory_seasonal_peak",
          priority:    "low",
          message:     `${name} is historically one of your busiest months for inquiries.`,
          detail:      `Based on past years, you typically see ${Math.round(thisMonth.avg)} inquiries in ${name} — above your yearly average. Stay responsive.`,
          link:        "/leads",
          actionLabel: "View inquiries →",
        });
      } else if (ratio <= 0.7) {
        obs.push({
          id:          "memory_seasonal_slow",
          priority:    "low",
          message:     `${name} is historically quieter for your venue.`,
          detail:      `Past years show about ${Math.round(thisMonth.avg)} inquiries in ${name}. A slower pace is normal — a good time for planning or marketing.`,
          link:        "/analytics",
          actionLabel: "View trends →",
        });
      }
    }

    // Forward-looking: next month
    const nextMonthNum = (currentMonthNum % 12) + 1;
    const nextMonth    = avgs.find(a => a.month === nextMonthNum);
    if (nextMonth && overallAvg > 0) {
      const nextRatio = nextMonth.avg / overallAvg;
      const nextName  = monthName(nextMonthNum);
      if (nextRatio >= 1.35) {
        obs.push({
          id:          "memory_next_month_peak",
          priority:    "low",
          message:     `${nextName} is typically your peak inquiry season — get ready.`,
          detail:      `Historically you receive around ${Math.round(nextMonth.avg)} inquiries in ${nextName}. Make sure your availability and tour slots are set.`,
          link:        "/settings",
          actionLabel: "Review availability →",
        });
      }
    }
  }

  // 4. Busiest event month
  const { busiestEventMonth } = memories;
  if (busiestEventMonth && totalBookings !== null && totalBookings >= 5) {
    obs.push({
      id:          "memory_busiest_event_month",
      priority:    "low",
      message:     `${monthName(busiestEventMonth.month)} is your most popular month for events.`,
      detail:      `You've hosted ${busiestEventMonth.count} event${busiestEventMonth.count !== 1 ? "s" : ""} in ${monthName(busiestEventMonth.month)} — more than any other month.`,
      link:        "/calendar",
      actionLabel: "View calendar →",
    });
  }

  return obs.slice(0, 3); // cap at 3 memory observations on dashboard
}
