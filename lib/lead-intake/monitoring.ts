/**
 * Lead Intake — health summary (Work Stream E).
 *
 * Reads lead_intake_attempts directly — the same durable log every source
 * writes to — to answer "is my form actually working" without a separate
 * analytics subsystem. Deliberately small: submission volume, a rejection
 * breakdown, and whether the most recent attempts succeeded.
 */
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";

export type IntakeHealthSummary = {
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

const EMPTY: IntakeHealthSummary = {
  totalLast7Days: 0, acceptedLast7Days: 0, rejectedRateLimited: 0,
  rejectedInvalid: 0, rejectedDuplicateBatch: 0, errored: 0, recentAttempts: [],
};

export async function getIntakeHealthSummary(): Promise<IntakeHealthSummary> {
  const venue = await getCurrentVenue();
  if (!venue) return EMPTY;
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const { data } = await supabase
    .from("lead_intake_attempts")
    .select("id, source, status, error_message, created_at")
    .eq("venue_id", venue.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as { id: string; source: string | null; status: string; error_message: string | null; created_at: string }[];
  if (!rows.length) return EMPTY;

  const summary: IntakeHealthSummary = { ...EMPTY, recentAttempts: [] };
  summary.totalLast7Days = rows.length;
  for (const r of rows) {
    if (r.status === "accepted") summary.acceptedLast7Days++;
    else if (r.status === "rejected_rate_limited") summary.rejectedRateLimited++;
    else if (r.status === "rejected_invalid") summary.rejectedInvalid++;
    else if (r.status === "rejected_duplicate_batch") summary.rejectedDuplicateBatch++;
    else if (r.status === "error") summary.errored++;
  }
  summary.recentAttempts = rows.slice(0, 10).map((r) => ({
    id: r.id, source: r.source ?? "unknown", status: r.status,
    createdAt: r.created_at, errorMessage: r.error_message,
  }));
  return summary;
}
