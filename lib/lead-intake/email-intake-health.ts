/**
 * Venue-facing email-intake activity.
 *
 * Reads only this session's venue, and only the columns needed for a
 * status line. raw_payload, normalized_payload, headers, and sender
 * addresses are never selected or returned.
 */
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";

export type EmailIntakeHealthIssue = {
  id: string;
  occurredAt: string;
  statusLabel: string;
  detail: string;
  /** Short reference from the provider message id, when one was stored. */
  reference: string | null;
};

export type EmailIntakeHealthView = {
  /** True when this venue has at least one recorded email-intake attempt. */
  hasActivity: boolean;
  latestSuccessAt: string | null;
  latestIssueAt: string | null;
  issues: EmailIntakeHealthIssue[];
};

export const EMPTY_EMAIL_INTAKE_HEALTH: EmailIntakeHealthView = {
  hasActivity: false,
  latestSuccessAt: null,
  latestIssueAt: null,
  issues: [],
};

type AttemptRow = {
  id: string;
  status: string;
  created_at: string;
  external_ref: string | null;
  error_message: string | null;
};

const ISSUE_STATUSES = new Set(["rejected_invalid", "error", "rejected_rate_limited"]);

const SAFE_DETAILS: Record<string, string> = {
  "No readable text in this email.":
    "The message had no readable text. Forward the inquiry again as a normal email.",
  "Could not find inquiry details in this email.":
    "Inquiry details could not be found. Forward only that inquiry, then check Leads.",
  "Could not identify who this inquiry is from.":
    "A name could not be read. Forward the inquiry again, or add the lead yourself.",
  "Could not process this email.":
    "This message could not be read. Forward the inquiry again, or add the lead yourself.",
  "Email intake isn't configured for this venue yet.":
    "Email intake was not ready for this message. Connect it, then forward the inquiry again.",
  "First and last name are required.":
    "A first and last name could not be read. Add the lead yourself if you still have the inquiry.",
  "Email address is not valid.":
    "The email address in the message could not be used. Add the lead yourself if you still have the inquiry.",
  "Could not create lead from this email.":
    "The message was received, but a lead was not created. Forward it again, or add the lead yourself.",
};

function statusLabel(status: string): string {
  if (status === "rejected_invalid") return "Could not read this message";
  if (status === "error") return "Did not become a lead";
  if (status === "rejected_rate_limited") return "Too many messages at once";
  return "Needs a look";
}

function safeDetail(status: string, errorMessage: string | null): string {
  if (status === "rejected_rate_limited") {
    return "Too many messages arrived at once. Wait a few minutes, then forward the inquiry again.";
  }
  const known = errorMessage ? SAFE_DETAILS[errorMessage] : undefined;
  if (known) return known;
  if (status === "error") {
    return "This message did not become a lead. Forward the inquiry again, or add the lead yourself.";
  }
  return "This message could not be turned into a lead. Forward the inquiry again, or add the lead yourself.";
}

function safeReference(externalRef: string | null): string | null {
  if (!externalRef) return null;
  const compact = externalRef.replace(/-/g, "");
  if (!/^[a-f0-9]{8,}$/i.test(compact)) return null;
  return compact.slice(-8).toLowerCase();
}

/** Pure mapping so tests can prove what the venue is allowed to see. */
export function buildEmailIntakeHealthView(rows: AttemptRow[]): EmailIntakeHealthView {
  const ordered = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const latestSuccessAt = ordered.find((row) => row.status === "accepted")?.created_at ?? null;
  const issues = ordered
    .filter((row) => ISSUE_STATUSES.has(row.status))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      occurredAt: row.created_at,
      statusLabel: statusLabel(row.status),
      detail: safeDetail(row.status, row.error_message),
      reference: safeReference(row.external_ref),
    }));
  return {
    hasActivity: ordered.length > 0,
    latestSuccessAt,
    latestIssueAt: issues[0]?.occurredAt ?? null,
    issues,
  };
}

export async function getEmailIntakeHealth(): Promise<EmailIntakeHealthView> {
  const venue = await getCurrentVenue();
  if (!venue) return EMPTY_EMAIL_INTAKE_HEALTH;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_intake_attempts")
    .select("id, status, created_at, external_ref, error_message")
    .eq("venue_id", venue.id)
    .eq("trust_tier", "email_parsed")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error || !data) return EMPTY_EMAIL_INTAKE_HEALTH;
  return buildEmailIntakeHealthView(data as AttemptRow[]);
}
