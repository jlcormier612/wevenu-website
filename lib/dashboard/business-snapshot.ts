/**
 * Dashboard Business Snapshot — four locked business-state cards.
 *
 * Reuses authoritative HTC metrics (pipeline leads, canonical bookings,
 * Gross Booked Revenue, outstanding balance, Coming-up 60-day horizon).
 * Venue-facing copy never hard-codes Inquiry/Tour/Proposal stage names.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  COMING_UP_HORIZON_DAYS,
  comingUpHorizonEnd,
  clientListFilterHref,
} from "@/lib/clients/list-filters";
import { getCanonicalBookings } from "@/lib/metrics/booking";
import { getGrossBookedRevenue, getOutstandingBalance } from "@/lib/metrics/revenue";
import { loadReportingExclusions } from "@/lib/reporting/business-scope";
import { getCurrentVenue } from "@/lib/venue/service";
import { venueToday } from "@/lib/venue/timezone";

export const BUSINESS_SNAPSHOT_UPCOMING_DAYS = COMING_UP_HORIZON_DAYS;

/** Closed/won pipeline stages — not "active opportunities." */
const CLOSED_PIPELINE_STAGES = new Set(["booked", "lost", "won", "cancelled"]);

export type SnapshotCardModel = {
  key: "pipeline" | "booked" | "upcoming" | "outstanding";
  label: string;
  /** Primary headline number (count or currency depending on card). */
  primary: string;
  /** Secondary supporting line. */
  secondary: string;
  href: string;
  empty: boolean;
};

export type BusinessSnapshotModel = {
  cards: SnapshotCardModel[];
  upcomingWindowDays: number;
};

export type PipelineLeadRow = {
  sales_stage: string | null;
  estimated_budget: number | null;
  exclude_from_business_reporting?: boolean | null;
};

/** Pure: active opportunities = not booked/lost/won/cancelled, reporting-visible. */
export function computeActivePipeline(rows: PipelineLeadRow[]): {
  count: number;
  value: number;
  budgetsPresent: number;
} {
  let count = 0;
  let value = 0;
  let budgetsPresent = 0;
  for (const r of rows) {
    if (r.exclude_from_business_reporting) continue;
    const stage = (r.sales_stage ?? "").toLowerCase();
    if (CLOSED_PIPELINE_STAGES.has(stage)) continue;
    count += 1;
    if (r.estimated_budget != null && Number.isFinite(Number(r.estimated_budget))) {
      value += Number(r.estimated_budget);
      budgetsPresent += 1;
    }
  }
  return { count, value, budgetsPresent };
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCount(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function buildBusinessSnapshotCards(input: {
  pipelineCount: number;
  pipelineValue: number;
  pipelineBudgetsPresent: number;
  bookedCount: number;
  bookedValue: number;
  upcomingCount: number;
  upcomingValue: number;
  outstandingBalance: number;
  outstandingClientCount: number;
  upcomingWindowDays: number;
}): SnapshotCardModel[] {
  const pipelineEmpty = input.pipelineCount === 0;
  const bookedEmpty = input.bookedCount === 0;
  const upcomingEmpty = input.upcomingCount === 0;
  const outstandingEmpty = input.outstandingBalance <= 0;

  return [
    {
      key: "pipeline",
      label: "Pipeline",
      primary: pipelineEmpty
        ? "No active opportunities"
        : formatCount(input.pipelineCount, "active lead", "active leads"),
      secondary: pipelineEmpty
        ? "Nothing currently in your pipeline."
        : input.pipelineBudgetsPresent > 0
          ? `${formatUsd(input.pipelineValue)} estimated value`
          : "Estimated value not set on these leads",
      href: "/leads",
      empty: pipelineEmpty,
    },
    {
      key: "booked",
      label: "Booked",
      primary: bookedEmpty
        ? "No booked events"
        : formatCount(input.bookedCount, "booked event", "booked events"),
      secondary: bookedEmpty
        ? "No committed bookings yet."
        : `${formatUsd(input.bookedValue)} contracted`,
      href: "/clients",
      empty: bookedEmpty,
    },
    {
      key: "upcoming",
      label: "Upcoming",
      primary: upcomingEmpty
        ? "No upcoming events"
        : formatCount(input.upcomingCount, "event", "events"),
      secondary: upcomingEmpty
        ? `Nothing booked in the next ${input.upcomingWindowDays} days.`
        : `${formatUsd(input.upcomingValue)} contracted · next ${input.upcomingWindowDays} days`,
      href: clientListFilterHref("coming_up"),
      empty: upcomingEmpty,
    },
    {
      key: "outstanding",
      label: "Outstanding",
      primary: outstandingEmpty
        ? "Accounts current"
        : formatUsd(input.outstandingBalance),
      secondary: outstandingEmpty
        ? "Nothing outstanding right now."
        : formatCount(
          input.outstandingClientCount,
          "client with a balance",
          "clients with a balance",
        ),
      href: "/payments",
      empty: outstandingEmpty,
    },
  ];
}

/**
 * Load the four Dashboard Business Snapshot cards for the current venue.
 */
export async function getBusinessSnapshot(): Promise<BusinessSnapshotModel | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const today = venueToday(venue.timezone);
  const comingUpOut = comingUpHorizonEnd(today);

  const [{ data: leadRows }, bookings, bookedValue, outstandingBalance, upcomingEventsRes] =
    await Promise.all([
      supabase
        .from("leads")
        .select("sales_stage, estimated_budget, exclude_from_business_reporting")
        .eq("venue_id", venue.id),
      getCanonicalBookings(),
      getGrossBookedRevenue(),
      getOutstandingBalance(),
      supabase
        .from("events")
        .select("id, client_id, event_date, status, exclude_from_business_reporting")
        .eq("venue_id", venue.id)
        .gte("event_date", today)
        .lte("event_date", comingUpOut)
        .not("status", "in", "(cancelled,complete)"),
    ]);

  const pipeline = computeActivePipeline((leadRows ?? []) as PipelineLeadRow[]);
  const exclusions = await loadReportingExclusions(supabase, venue.id);
  const bookedClientIds = new Set(bookings.map((b) => b.clientId));

  const upcomingEvents = ((upcomingEventsRes.data ?? []) as {
    id: string;
    client_id: string | null;
    event_date: string;
    status: string;
    exclude_from_business_reporting: boolean | null;
  }[]).filter((e) => {
    if (e.exclude_from_business_reporting) return false;
    if (!e.client_id || !bookedClientIds.has(e.client_id)) return false;
    if (exclusions.clientIds.has(e.client_id)) return false;
    if (exclusions.eventIds.has(e.id)) return false;
    return true;
  });

  const upcomingClientIds = [...new Set(
    upcomingEvents.map((e) => e.client_id).filter((id): id is string => Boolean(id)),
  )];

  let upcomingValue = 0;
  if (upcomingClientIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("client_id, subtotal, discount_amount, status")
      .eq("venue_id", venue.id)
      .neq("status", "void")
      .in("client_id", upcomingClientIds);
    for (const inv of (invoices ?? []) as {
      client_id: string;
      subtotal: number;
      discount_amount: number;
    }[]) {
      upcomingValue += Number(inv.subtotal) - Number(inv.discount_amount);
    }
  }

  // Outstanding client count: all-time contracted vs collected per canonical booking client.
  let outstandingClientCount = 0;
  if ((outstandingBalance ?? 0) > 0 && bookings.length > 0) {
    const clientIds = bookings.map((b) => b.clientId);
    const [{ data: invoices }, { data: payments }] = await Promise.all([
      supabase
        .from("invoices")
        .select("client_id, subtotal, discount_amount, status")
        .eq("venue_id", venue.id)
        .neq("status", "void")
        .in("client_id", clientIds),
      supabase
        .from("payment_line_items")
        .select("paid_amount, amount, refunded_amount, payment_schedules!inner(client_id)")
        .eq("venue_id", venue.id)
        .in("status", ["paid", "partially_refunded", "refunded"])
        .in("payment_schedules.client_id", clientIds),
    ]);
    const bookedBy = new Map<string, number>();
    for (const inv of (invoices ?? []) as {
      client_id: string; subtotal: number; discount_amount: number;
    }[]) {
      bookedBy.set(
        inv.client_id,
        (bookedBy.get(inv.client_id) ?? 0) + (Number(inv.subtotal) - Number(inv.discount_amount)),
      );
    }
    const collectedBy = new Map<string, number>();
    for (const p of (payments ?? []) as unknown as {
      paid_amount: number | null;
      amount: number;
      refunded_amount: number | null;
      payment_schedules: { client_id: string } | null;
    }[]) {
      const cid = p.payment_schedules?.client_id;
      if (!cid) continue;
      collectedBy.set(
        cid,
        (collectedBy.get(cid) ?? 0)
          + (Number(p.paid_amount ?? p.amount) - Number(p.refunded_amount ?? 0)),
      );
    }
    for (const cid of clientIds) {
      const owed = (bookedBy.get(cid) ?? 0) - (collectedBy.get(cid) ?? 0);
      if (owed > 0) outstandingClientCount += 1;
    }
  }

  const cards = buildBusinessSnapshotCards({
    pipelineCount: pipeline.count,
    pipelineValue: pipeline.value,
    pipelineBudgetsPresent: pipeline.budgetsPresent,
    bookedCount: bookings.length,
    bookedValue: bookedValue ?? 0,
    upcomingCount: upcomingEvents.length,
    upcomingValue,
    outstandingBalance: Math.max(0, outstandingBalance ?? 0),
    outstandingClientCount,
    upcomingWindowDays: BUSINESS_SNAPSHOT_UPCOMING_DAYS,
  });

  return { cards, upcomingWindowDays: BUSINESS_SNAPSHOT_UPCOMING_DAYS };
}
