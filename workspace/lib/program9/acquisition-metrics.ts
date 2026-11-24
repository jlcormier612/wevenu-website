/**
 * Scoped acquisition reporting for the Business dashboard.
 * Uses Relationship.meta first-touch + referralSource + subscription records.
 * No fictional rows — empty/zero states are valid for a new business.
 */

import { normalizeRelationshipStatus, toPipelineStatus } from "@/lib/pipeline";
import type {
  Relationship,
  Subscription,
  TimelineEvent,
  Walkthrough,
  WorkspaceData,
} from "@/lib/types";
import { toOperationalWorkspaceData } from "@/lib/data/operational";

export type AcquisitionPeriodKey = "30d" | "90d" | "ytd" | "all";

export const ACQUISITION_PERIODS: Array<{
  key: AcquisitionPeriodKey;
  label: string;
}> = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "ytd", label: "Year to date" },
  { key: "all", label: "All time" },
];

export type AcquisitionRow = {
  key: string;
  source: string;
  campaign: string;
  leads: number;
  walkthroughBookings: number;
  newPayingVenues: number;
  leadToCustomerRate: number | null;
  newMrrCents: number;
};

export type AcquisitionReport = {
  period: AcquisitionPeriodKey;
  periodLabel: string;
  rangeStartIso: string | null;
  rangeEndIso: string;
  rows: AcquisitionRow[];
  totals: Omit<AcquisitionRow, "key" | "source" | "campaign">;
  empty: boolean;
  note: string;
};

const SUBSCRIBED_PLUS = new Set([
  "subscribed",
  "onboarding",
  "white_glove_implementation",
  "live",
  "active",
  "reactivated",
  "at_risk",
  "expansion",
  "referral",
  "renewal",
]);

const ACQ_FIRST_TOUCH_META = "acq_first_touch";

type Touch = {
  utm_source?: string;
  utm_campaign?: string;
};

function parsePeriodStart(
  period: AcquisitionPeriodKey,
  now: Date,
): Date | null {
  if (period === "all") return null;
  if (period === "ytd") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const days = period === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 86_400_000);
}

function parseTouch(relationship: Relationship): Touch {
  const raw = relationship.meta?.[ACQ_FIRST_TOUCH_META];
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      utm_source:
        typeof parsed.utm_source === "string" ? parsed.utm_source.trim() : undefined,
      utm_campaign:
        typeof parsed.utm_campaign === "string"
          ? parsed.utm_campaign.trim()
          : undefined,
    };
  } catch {
    return {};
  }
}

function sourceLabel(relationship: Relationship): { source: string; campaign: string } {
  const touch = parseTouch(relationship);
  const source =
    touch.utm_source ||
    relationship.referralSource?.trim() ||
    "Unattributed";
  const campaign = touch.utm_campaign || "(none)";
  return { source, campaign };
}

function rowKey(source: string, campaign: string): string {
  return `${source.toLowerCase()}::${campaign.toLowerCase()}`;
}

function inRange(iso: string | null | undefined, start: Date | null, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (t > end.getTime()) return false;
  if (start && t < start.getTime()) return false;
  return true;
}

function isPaying(r: Relationship): boolean {
  return SUBSCRIBED_PLUS.has(
    toPipelineStatus(normalizeRelationshipStatus(r.status)),
  );
}

function firstSubscribeAt(
  relationshipId: string,
  subscriptions: Subscription[],
  timeline: TimelineEvent[],
): string | null {
  const sub = subscriptions.find((s) => s.relationshipId === relationshipId);
  if (sub?.startedAt) return sub.startedAt;
  const purchased = timeline
    .filter(
      (e) =>
        e.relationshipId === relationshipId && e.type === "subscription_purchased",
    )
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return purchased[0]?.occurredAt ?? null;
}

function walkthroughBookedAt(
  relationshipId: string,
  walkthroughs: Walkthrough[],
  timeline: TimelineEvent[],
): string | null {
  const scheduled = walkthroughs
    .filter((w) => w.relationshipId === relationshipId && w.scheduledAt)
    .sort((a, b) => (a.scheduledAt || "").localeCompare(b.scheduledAt || ""));
  if (scheduled[0]?.scheduledAt) return scheduled[0].scheduledAt;

  const evt = timeline
    .filter(
      (e) =>
        e.relationshipId === relationshipId &&
        (e.type === "walkthrough_scheduled" || e.type === "walkthrough_requested"),
    )
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return evt[0]?.occurredAt ?? null;
}

function emptyRow(source: string, campaign: string): AcquisitionRow {
  return {
    key: rowKey(source, campaign),
    source,
    campaign,
    leads: 0,
    walkthroughBookings: 0,
    newPayingVenues: 0,
    leadToCustomerRate: null,
    newMrrCents: 0,
  };
}

/**
 * Acquisition performance by first-touch source + campaign for a reporting period.
 */
export function computeAcquisitionReport(
  data: WorkspaceData,
  period: AcquisitionPeriodKey = "30d",
  now = new Date(),
): AcquisitionReport {
  const ops = toOperationalWorkspaceData(data);
  const relationships = ops.relationships;
  const subscriptions = ops.subscriptions;
  const walkthroughs = ops.walkthroughs;
  const timeline = ops.timelineEvents;

  const start = parsePeriodStart(period, now);
  const periodMeta =
    ACQUISITION_PERIODS.find((p) => p.key === period) || ACQUISITION_PERIODS[0]!;

  const byKey = new Map<string, AcquisitionRow>();

  function bucket(r: Relationship): AcquisitionRow {
    const { source, campaign } = sourceLabel(r);
    const key = rowKey(source, campaign);
    let row = byKey.get(key);
    if (!row) {
      row = emptyRow(source, campaign);
      byKey.set(key, row);
    }
    return row;
  }

  for (const r of relationships) {
    if (inRange(r.createdAt, start, now)) {
      bucket(r).leads += 1;
    }

    const bookedAt = walkthroughBookedAt(r.id, walkthroughs, timeline);
    if (inRange(bookedAt, start, now)) {
      bucket(r).walkthroughBookings += 1;
    }

    if (isPaying(r)) {
      const subAt = firstSubscribeAt(r.id, subscriptions, timeline);
      if (inRange(subAt, start, now)) {
        const row = bucket(r);
        row.newPayingVenues += 1;
        const sub = subscriptions.find((s) => s.relationshipId === r.id);
        const mrr =
          typeof sub?.mrrCents === "number" && sub.mrrCents > 0
            ? sub.mrrCents
            : 0;
        row.newMrrCents += mrr;
      }
    }
  }

  const rows = [...byKey.values()]
    .map((row) => ({
      ...row,
      leadToCustomerRate:
        row.leads > 0
          ? Math.round((row.newPayingVenues / row.leads) * 1000) / 10
          : null,
    }))
    .sort((a, b) => {
      if (b.newMrrCents !== a.newMrrCents) return b.newMrrCents - a.newMrrCents;
      if (b.leads !== a.leads) return b.leads - a.leads;
      return a.source.localeCompare(b.source);
    });

  const totals = {
    leads: rows.reduce((s, r) => s + r.leads, 0),
    walkthroughBookings: rows.reduce((s, r) => s + r.walkthroughBookings, 0),
    newPayingVenues: rows.reduce((s, r) => s + r.newPayingVenues, 0),
    leadToCustomerRate: null as number | null,
    newMrrCents: rows.reduce((s, r) => s + r.newMrrCents, 0),
  };
  totals.leadToCustomerRate =
    totals.leads > 0
      ? Math.round((totals.newPayingVenues / totals.leads) * 1000) / 10
      : null;

  const empty = rows.length === 0;

  return {
    period,
    periodLabel: periodMeta.label,
    rangeStartIso: start ? start.toISOString() : null,
    rangeEndIso: now.toISOString(),
    rows,
    totals,
    empty,
    note: empty
      ? "No acquisition activity in this period yet. Rows appear when marketing leads, walkthroughs, or new subscriptions include first-touch attribution or a referral source."
      : "First-touch UTM source/campaign when present; otherwise referral source. New MRR uses subscription records for first conversion in period.",
  };
}

export function parseAcquisitionPeriod(
  raw: string | null | undefined,
): AcquisitionPeriodKey {
  if (raw === "30d" || raw === "90d" || raw === "ytd" || raw === "all") return raw;
  return "30d";
}
