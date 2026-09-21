/**
 * Dashboard Business Snapshot — four business-health cards.
 *
 * Lead Flow · Booked Business · Cash Collected · Outstanding
 * No Upcoming card (Coming up above already covers events).
 * Venue-facing copy never hard-codes custom pipeline stage names.
 */
import { getCanonicallyBookedClientIds } from "@/lib/booking-journey/canonical-booked";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { clientListFilterHref } from "@/lib/clients/list-filters";
import {
  isOpenLeadLifecycle,
  isOpenLeadOpportunity,
  TERMINAL_LEAD_LIFECYCLE_STATES,
} from "@/lib/leads/open-lifecycle";
import {
  getGrossBookedRevenue,
  getOutstandingBalance,
  getPaymentsCollected,
} from "@/lib/metrics/revenue";
import { getCurrentVenue } from "@/lib/venue/service";
import { venueToday } from "@/lib/venue/timezone";

/** @deprecated Import from `@/lib/leads/open-lifecycle` — re-exported for existing callers. */
export { isOpenLeadLifecycle, TERMINAL_LEAD_LIFECYCLE_STATES };
export const LEAD_FLOW_OPEN_HREF = "/leads?attention=open";

export type SnapshotCardModel = {
  key: "lead_flow" | "booked_business" | "cash_collected" | "outstanding";
  label: string;
  primary: string;
  secondary: string;
  /** Optional third context line (e.g. new-this-month). Always rendered for equal height. */
  tertiary: string;
  href: string;
  actionLabel: string;
  empty: boolean;
};

export type BusinessSnapshotModel = {
  cards: SnapshotCardModel[];
};

export type OpenLeadRow = {
  sales_stage: string | null;
  estimated_budget: number | null;
  created_at: string | null;
  /** Pipeline reporting category when resolved; preferred over sales_stage. */
  canonical_stage?: string | null;
};

/**
 * Pure: open leads = sales_stage still in the funnel, and reporting category not terminal.
 * A booked/lost/cancelled sales_stage is not an open lead even if a venue stage id remains.
 * Does not use exclude_from_business_reporting or client_id.
 */
export function computeOpenLeadFlow(
  rows: OpenLeadRow[],
  monthStartIso: string,
): {
  count: number;
  value: number;
  budgetsPresent: number;
  newThisMonth: number;
} {
  let count = 0;
  let value = 0;
  let budgetsPresent = 0;
  let newThisMonth = 0;
  for (const r of rows) {
    if (!isOpenLeadOpportunity({
      salesStage: r.sales_stage,
      canonicalStage: r.canonical_stage,
    })) continue;
    count += 1;
    if (r.estimated_budget != null && Number.isFinite(Number(r.estimated_budget))) {
      value += Number(r.estimated_budget);
      budgetsPresent += 1;
    }
    const created = (r.created_at ?? "").slice(0, 10);
    if (created && created >= monthStartIso) newThisMonth += 1;
  }
  return { count, value, budgetsPresent, newThisMonth };
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

function monthStartFromToday(todayIso: string): string {
  return `${todayIso.slice(0, 7)}-01`;
}

export function buildBusinessSnapshotCards(input: {
  openLeadCount: number;
  openLeadValue: number;
  openLeadBudgetsPresent: number;
  openLeadsNewThisMonth: number;
  bookedCount: number;
  bookedValue: number;
  cashCollected: number;
  outstandingBalance: number;
  outstandingClientCount: number;
}): SnapshotCardModel[] {
  const leadEmpty = input.openLeadCount === 0;
  const bookedEmpty = input.bookedCount === 0;
  const cashEmpty = input.cashCollected <= 0;
  const outstandingEmpty = input.outstandingBalance <= 0;

  return [
    {
      key: "lead_flow",
      label: "Lead Flow",
      primary: leadEmpty
        ? "No open leads"
        : formatCount(input.openLeadCount, "open lead", "open leads"),
      secondary: leadEmpty
        ? "No active opportunities right now."
        : input.openLeadBudgetsPresent > 0
          ? `${formatUsd(input.openLeadValue)} estimated value`
          : "No estimated value yet",
      tertiary: leadEmpty
        ? ""
        : input.openLeadsNewThisMonth > 0
          ? `${input.openLeadsNewThisMonth} new this month`
          : "No new leads this month",
      href: LEAD_FLOW_OPEN_HREF,
      actionLabel: "View open leads",
      empty: leadEmpty,
    },
    {
      key: "booked_business",
      label: "Booked Business",
      primary: bookedEmpty
        ? "No booked business yet"
        : formatCount(input.bookedCount, "booked event", "booked events"),
      secondary: bookedEmpty
        ? "Your first booked event will appear here."
        : `${formatUsd(input.bookedValue)} contracted`,
      tertiary: bookedEmpty ? "" : "Relationships you have marked Booked",
      href: clientListFilterHref("all"),
      actionLabel: "View booked business",
      empty: bookedEmpty,
    },
    {
      key: "cash_collected",
      label: "Cash Collected",
      primary: cashEmpty
        ? "No payments collected yet"
        : formatUsd(input.cashCollected),
      secondary: cashEmpty
        ? "Collected payments will show here."
        : "All-time collected",
      tertiary: cashEmpty ? "" : "Payments you've received",
      href: "/payments",
      actionLabel: "View payments",
      empty: cashEmpty,
    },
    {
      key: "outstanding",
      label: "Outstanding",
      primary: outstandingEmpty
        ? "Accounts current"
        : formatUsd(input.outstandingBalance),
      secondary: outstandingEmpty
        ? "Nothing left to collect on booked events"
        : formatCount(
          input.outstandingClientCount,
          "client account",
          "client accounts",
        ),
      tertiary: outstandingEmpty
        ? "Booked totals minus what you've collected"
        : "Still owed on booked business",
      href: "/payments",
      actionLabel: "View balances",
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
  const monthStart = monthStartFromToday(today);

  const [{ data: leadRows }, { data: stageRows }, bookedIds, bookedValue, cashCollected, outstandingBalance] =
    await Promise.all([
      supabase
        .from("leads")
        .select("sales_stage, estimated_budget, created_at, pipeline_stage_id")
        .eq("venue_id", venue.id),
      supabase
        .from("pipeline_stages")
        .select("id, canonical_stage")
        .eq("venue_id", venue.id),
      getCanonicallyBookedClientIds(),
      getGrossBookedRevenue(),
      getPaymentsCollected(),
      getOutstandingBalance(),
    ]);

  const canonicalByStageId = new Map(
    ((stageRows ?? []) as { id: string; canonical_stage: string }[]).map((s) => [
      s.id,
      s.canonical_stage,
    ]),
  );
  const openRows: OpenLeadRow[] = ((leadRows ?? []) as {
    sales_stage: string | null;
    estimated_budget: number | null;
    created_at: string | null;
    pipeline_stage_id: string | null;
  }[]).map((r) => ({
    sales_stage: r.sales_stage,
    estimated_budget: r.estimated_budget,
    created_at: r.created_at,
    canonical_stage: r.pipeline_stage_id
      ? (canonicalByStageId.get(r.pipeline_stage_id) ?? null)
      : null,
  }));
  const leadFlow = computeOpenLeadFlow(openRows, monthStart);

  let outstandingClientCount = 0;
  if ((outstandingBalance ?? 0) > 0 && bookedIds.size > 0) {
    const clientIds = [...bookedIds];
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
    openLeadCount: leadFlow.count,
    openLeadValue: leadFlow.value,
    openLeadBudgetsPresent: leadFlow.budgetsPresent,
    openLeadsNewThisMonth: leadFlow.newThisMonth,
    bookedCount: bookedIds.size,
    bookedValue: bookedValue ?? 0,
    cashCollected: Math.max(0, cashCollected ?? 0),
    outstandingBalance: Math.max(0, outstandingBalance ?? 0),
    outstandingClientCount,
  });

  return { cards };
}
