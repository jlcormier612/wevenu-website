/**
 * Lead Capture — venue-facing summary helpers.
 *
 * Reads lead_intake_attempts for volume / sources / recent received inquiries.
 * Does not expose rejection/error/confidence telemetry to the venue UI.
 * Low-confidence accepted leads surface as "needs review" actions only.
 */
import { createClient } from "@/integrations/supabase/server";
import { sourceLabel } from "@/lib/leads/constants";
import { getCurrentVenue } from "@/lib/venue/service";

export type LeadCaptureSourceCount = {
  source: string;
  label: string;
  count: number;
};

export type LeadCaptureNeedsReview = {
  leadId: string;
  displayName: string;
  createdAt: string;
};

export type LeadCaptureRecentInquiry = {
  id: string;
  source: string;
  sourceLabel: string;
  createdAt: string;
  leadId: string | null;
};

export type LeadCaptureSummary = {
  receivedLast7Days: number;
  sourceBreakdown: LeadCaptureSourceCount[];
  needsReview: LeadCaptureNeedsReview[];
  recentInquiries: LeadCaptureRecentInquiry[];
};

/** @deprecated Prefer LeadCaptureSummary — kept for existing imports during rename. */
export type IntakeHealthSummary = LeadCaptureSummary & {
  totalLast7Days: number;
  acceptedLast7Days: number;
  rejectedRateLimited: number;
  rejectedInvalid: number;
  rejectedDuplicateBatch: number;
  errored: number;
  recentAttempts: {
    id: string;
    source: string;
    status: string;
    createdAt: string;
    errorMessage: string | null;
  }[];
};

const EMPTY: LeadCaptureSummary = {
  receivedLast7Days: 0,
  sourceBreakdown: [],
  needsReview: [],
  recentInquiries: [],
};

function collapseSourceBreakdown(
  counts: Map<string, number>,
): LeadCaptureSourceCount[] {
  const rows: LeadCaptureSourceCount[] = [];
  let otherCount = 0;
  for (const [source, count] of counts) {
    const label = sourceLabel(source) || "Other";
    if (label === "Other" || source === "other" || source === "unknown") {
      otherCount += count;
      continue;
    }
    rows.push({ source, label, count });
  }
  rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (otherCount > 0) {
    rows.push({ source: "other", label: "Other", count: otherCount });
  }
  return rows;
}

/** Exported for unit tests — collapses repeated "Other"/unknown into one row. */
export function buildLeadCaptureSourceBreakdown(
  entries: Array<{ source: string; count: number }>,
): LeadCaptureSourceCount[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    map.set(e.source, (map.get(e.source) ?? 0) + e.count);
  }
  return collapseSourceBreakdown(map);
}

export async function getLeadCaptureSummary(): Promise<LeadCaptureSummary> {
  const venue = await getCurrentVenue();
  if (!venue) return EMPTY;
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const [{ data: attempts }, { data: reviewLeads }] = await Promise.all([
    supabase
      .from("lead_intake_attempts")
      .select("id, source, status, lead_id, created_at")
      .eq("venue_id", venue.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("leads")
      .select("id, first_name, last_name, created_at, intake_confidence")
      .eq("venue_id", venue.id)
      .gte("created_at", since)
      .not("intake_confidence", "is", null)
      .lt("intake_confidence", 80)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const rows = (attempts ?? []) as {
    id: string;
    source: string | null;
    status: string;
    lead_id: string | null;
    created_at: string;
  }[];

  const accepted = rows.filter((r) => r.status === "accepted");
  const sourceCounts = new Map<string, number>();
  for (const r of accepted) {
    const key = r.source ?? "unknown";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }

  const needsReview: LeadCaptureNeedsReview[] = ((reviewLeads ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    created_at: string;
  }[]).map((l) => ({
    leadId: l.id,
    displayName: [l.first_name, l.last_name].filter(Boolean).join(" ") || "Inquiry",
    createdAt: l.created_at,
  }));

  return {
    receivedLast7Days: accepted.length,
    sourceBreakdown: collapseSourceBreakdown(sourceCounts),
    needsReview,
    recentInquiries: accepted.slice(0, 10).map((r) => ({
      id: r.id,
      source: r.source ?? "unknown",
      sourceLabel: sourceLabel(r.source) || "Other",
      createdAt: r.created_at,
      leadId: r.lead_id,
    })),
  };
}

/**
 * Back-compat wrapper — same data, plus inert telemetry fields for any
 * remaining callers. Prefer getLeadCaptureSummary in new code.
 */
export async function getIntakeHealthSummary(): Promise<IntakeHealthSummary> {
  const summary = await getLeadCaptureSummary();
  return {
    ...summary,
    totalLast7Days: summary.receivedLast7Days,
    acceptedLast7Days: summary.receivedLast7Days,
    rejectedRateLimited: 0,
    rejectedInvalid: 0,
    rejectedDuplicateBatch: 0,
    errored: 0,
    recentAttempts: summary.recentInquiries.map((r) => ({
      id: r.id,
      source: r.source,
      status: "accepted",
      createdAt: r.createdAt,
      errorMessage: null,
    })),
  };
}
