/**
 * Email Intake self-service status — Sprint 3, Item 2.
 *
 * Everything here is derived from lead_intake_attempts (source =
 * 'email_parsed_generic'), filtered to this one channel — no new
 * tracking table needed, per the assessment: "last email received,"
 * "last lead imported," and a confidence signal are all queries away.
 */
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";

const SOURCE = "email_parsed_generic";

export type EmailIntakeStatus = {
  leadEmailKey: string;
  /** Pure UX gate — a key always works once it exists; this only controls the "Not Connected -> Connect" screen. */
  connectedAt: string | null;
  lastEmailReceivedAt: string | null;
  lastLeadImportedAt: string | null;
  /** Rolling average confidence over the most recent attempts that produced a score, not just the last one. */
  confidencePercent: number | null;
  recentTotalCount: number;
  recentAcceptedCount: number;
};

export async function getEmailIntakeStatus(): Promise<EmailIntakeStatus | null> {
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();

  const [{ data: venueRow }, { data: attempts }] = await Promise.all([
    supabase.from("venues").select("lead_email_key, email_intake_connected_at").eq("id", venue.id).maybeSingle<{ lead_email_key: string; email_intake_connected_at: string | null }>(),
    supabase.from("lead_intake_attempts")
      .select("status, confidence_score, lead_id, created_at")
      .eq("venue_id", venue.id).eq("source", SOURCE)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!venueRow) return null;

  const rows = (attempts ?? []) as { status: string; confidence_score: number | null; lead_id: string | null; created_at: string }[];
  const lastEmailReceivedAt = rows[0]?.created_at ?? null;
  const lastLeadImportedAt = rows.find((r) => r.status === "accepted")?.created_at ?? null;
  const scored = rows.filter((r) => r.confidence_score != null).map((r) => r.confidence_score as number);
  const confidencePercent = scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  return {
    leadEmailKey: venueRow.lead_email_key,
    connectedAt: venueRow.email_intake_connected_at,
    lastEmailReceivedAt,
    lastLeadImportedAt,
    confidencePercent,
    recentTotalCount: rows.length,
    recentAcceptedCount: rows.filter((r) => r.status === "accepted").length,
  };
}

/** Idempotent — clicking "Connect Email Intake" more than once is a no-op after the first time. */
export async function connectEmailIntake(): Promise<{ ok: boolean }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("venues")
    .update({ email_intake_connected_at: new Date().toISOString() })
    .eq("id", venue.id)
    .is("email_intake_connected_at", null);
  return { ok: !error };
}
