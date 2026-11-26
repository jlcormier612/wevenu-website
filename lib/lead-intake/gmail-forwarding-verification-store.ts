import type { AnyDbClient } from "@/lib/lead-intake/types";
import {
  defaultGmailVerificationExpiry,
  toCustomerView,
  type ClassifiedGmailForwardingVerification,
  type GmailVerificationCustomerView,
} from "@/lib/lead-intake/gmail-forwarding-verification";

type VerificationRow = {
  id: string;
  venue_id: string;
  state: string;
  confirmation_url: string | null;
  confirmation_code: string | null;
  expires_at: string | null;
  received_at: string;
};

export async function persistGmailForwardingVerification(
  supabase: AnyDbClient,
  params: {
    venueId: string;
    classified: ClassifiedGmailForwardingVerification;
    emailId: string | null;
    intakeAttemptId: string | null;
  },
): Promise<{ id: string } | { error: string }> {
  // Supersede prior active rows for this venue.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("gmail_forwarding_verifications") as any)
    .update({
      state: "superseded",
      superseded_at: new Date().toISOString(),
    })
    .eq("venue_id", params.venueId)
    .in("state", ["pending", "opened"]);

  const expiresAt = defaultGmailVerificationExpiry().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("gmail_forwarding_verifications") as any)
    .insert({
      venue_id: params.venueId,
      state: "pending",
      from_address: params.classified.fromAddress,
      subject: params.classified.subject,
      confirmation_url: params.classified.confirmationUrl,
      confirmation_code: params.classified.confirmationCode,
      confirmation_host: params.classified.confirmationHost,
      email_id: params.emailId,
      intake_attempt_id: params.intakeAttemptId,
      sender_auth_summary: {
        summary: params.classified.senderAuth.summary,
        fromAllowlisted: params.classified.senderAuth.fromAllowlisted,
        spfPass: params.classified.senderAuth.spfPass,
        dkimPass: params.classified.senderAuth.dkimPass,
        dmarcPass: params.classified.senderAuth.dmarcPass,
        authenticationResultsPresent: params.classified.senderAuth.authenticationResultsPresent,
      },
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Never log confirmation URL or code.
    console.error("persistGmailForwardingVerification failed:", error?.code ?? error?.message ?? "unknown");
    return { error: "persist_failed" };
  }
  return { id: data.id as string };
}

export async function getActiveGmailVerificationForVenue(
  supabase: AnyDbClient,
  venueId: string,
): Promise<GmailVerificationCustomerView | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("gmail_forwarding_verifications") as any)
    .select("id, venue_id, state, confirmation_url, confirmation_code, expires_at, received_at")
    .eq("venue_id", venueId)
    .in("state", ["pending", "opened", "expired"])
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as VerificationRow;
  // Soft-expire when past expires_at while still pending/opened.
  if (
    (row.state === "pending" || row.state === "opened") &&
    row.expires_at &&
    new Date(row.expires_at).getTime() < Date.now()
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("gmail_forwarding_verifications") as any)
      .update({ state: "expired" })
      .eq("id", row.id)
      .eq("venue_id", venueId);
    return toCustomerView({ ...row, state: "expired", expiry_known: true });
  }
  return toCustomerView({
    ...row,
    state: row.state as never,
    expiry_known: row.state === "expired",
  });
}

export async function markGmailVerificationOpened(
  supabase: AnyDbClient,
  venueId: string,
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("gmail_forwarding_verifications") as any)
    .select("id, state, confirmation_url, expires_at")
    .eq("id", id)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error || !data) return { ok: false, reason: "not_found" };
  if (!data.confirmation_url) return { ok: false, reason: "no_link" };
  if (data.state !== "pending" && data.state !== "opened") return { ok: false, reason: "not_active" };
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("gmail_forwarding_verifications") as any)
      .update({ state: "expired" })
      .eq("id", id)
      .eq("venue_id", venueId);
    return { ok: false, reason: "expired" };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("gmail_forwarding_verifications") as any)
    .update({
      state: "opened",
      opened_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("venue_id", venueId);
  return { ok: true, url: data.confirmation_url as string };
}

export async function acknowledgeGmailVerification(
  supabase: AnyDbClient,
  venueId: string,
  id: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("gmail_forwarding_verifications") as any)
    .update({
      state: "acknowledged",
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("venue_id", venueId)
    .in("state", ["pending", "opened"]);
  return !error;
}

export async function dismissGmailVerification(
  supabase: AnyDbClient,
  venueId: string,
  id: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("gmail_forwarding_verifications") as any)
    .update({
      state: "dismissed",
      dismissed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("venue_id", venueId)
    .in("state", ["expired", "pending", "opened"]);
  return !error;
}
