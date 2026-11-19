/**
 * Guest RSVP invite persistence helpers (RESEND-SCALE Phase D).
 *
 * Provider acceptance and DB invitation logging are distinct steps.
 *
 * log_invitations_sent SQL contract (20260826000000):
 *   - invalid/expired token → { ok: false, error: 'invalid_token' }
 *   - otherwise → { ok: true, sent: <matched guest count> }
 *   - guests outside session venue/client are skipped (not an error)
 *   - { ok: true, sent: 0 } is a valid RPC payload and must NOT be treated
 *     as success when the route expected N > 0 persistences
 *
 * Durable recovery reuses invitation_emails.provider_id (existing column)
 * so a later retry can sync guest status without calling Resend again —
 * including after the ~24h Idempotency-Key window expires.
 */

export const GUEST_RSVP_IDEMPOTENCY_HOURS = 24;

/**
 * Invitation keys stay stable so a same-day persistence retry can reuse
 * Resend's Idempotency-Key when no durable provider_id receipt exists yet.
 *
 * Reminder/update keys are day-bucketed so a legitimate next-day reminder
 * is not suppressed by yesterday's key (invitation vs reminder remain distinct).
 */
export function guestRsvpIdempotencyKey(
  guestId: string,
  emailType: string,
  now: Date = new Date(),
): string {
  const normalized = (emailType || "invitation").toLowerCase();
  if (normalized === "invitation") {
    return `guest-rsvp/${guestId}/invitation`;
  }
  const day = now.toISOString().slice(0, 10); // UTC day bucket
  return `guest-rsvp/${guestId}/${normalized}/${day}`;
}

export type InviteTallies = {
  sent: number;
  deferred: number;
  failed: number;
  errors: string[];
  deferredGuestIds: string[];
  sentGuestIds: string[];
};

export type LogInvitationsResult = {
  ok?: boolean;
  sent?: number;
  error?: string;
} | null;

export type LogConfirmResult =
  | { confirmed: true; sent: number }
  | { confirmed: false; detail: string };

/**
 * Success only when the RPC durably reports ok:true and sent >= expected.
 * null / unexpected shapes / ok:false / undersized sent → not confirmed.
 */
export function confirmInvitationLog(
  rpcError: { message?: string } | null | undefined,
  rpcData: LogInvitationsResult,
  expectedCount: number,
): LogConfirmResult {
  if (rpcError) {
    return { confirmed: false, detail: rpcError.message ?? "rpc_error" };
  }
  if (rpcData == null || typeof rpcData !== "object" || Array.isArray(rpcData)) {
    return { confirmed: false, detail: "null_or_unexpected_result" };
  }
  if (rpcData.ok !== true) {
    return { confirmed: false, detail: rpcData.error ?? "log_not_ok" };
  }
  if (typeof rpcData.sent !== "number" || !Number.isFinite(rpcData.sent)) {
    return { confirmed: false, detail: "missing_sent_count" };
  }
  if (expectedCount > 0 && rpcData.sent < expectedCount) {
    return {
      confirmed: false,
      detail: `persisted_${rpcData.sent}_of_${expectedCount}`,
    };
  }
  return { confirmed: true, sent: rpcData.sent };
}

export type AcceptedDelivery = {
  guestId: string;
  email: string;
  providerId?: string | null;
};

export type PersistenceFailureBody = {
  ok: false;
  code: "persistence_failed";
  error: string;
  message: string;
  /** Confirmed DB-logged sends — always 0 on persistence failure. */
  sent: 0;
  sentGuestIds: [];
  /** Provider accepted these; DB status may still be ready. */
  accepted: number;
  acceptedGuestIds: string[];
  deferred: number;
  deferredGuestIds: string[];
  failed: number;
  errors: string[];
  /** Unconditional retry is NOT safe after the provider idempotency window. */
  retrySafe: false;
  /** True when a durable provider_id receipt exists for no-resend recovery. */
  retrySafeWithoutResend: boolean;
  providerIdempotencyWindowHours: typeof GUEST_RSVP_IDEMPOTENCY_HOURS;
  retryMayDuplicateAfterIdempotencyWindow: true;
  durableRecoveryAttempted: boolean;
};

export function buildPersistenceFailureResponse(
  tallies: InviteTallies,
  detail: string,
  opts?: {
    durableRecoveryAttempted?: boolean;
    retrySafeWithoutResend?: boolean;
  },
): PersistenceFailureBody {
  const acceptedGuestIds = [...tallies.sentGuestIds];
  const durableRecoveryAttempted = opts?.durableRecoveryAttempted ?? false;
  const retrySafeWithoutResend = opts?.retrySafeWithoutResend ?? false;
  const errors = [
    ...tallies.errors,
    `Send accepted but invitation log failed: ${detail}`,
  ];
  const message = retrySafeWithoutResend
    ? `${acceptedGuestIds.length} invitation(s) were accepted by the email provider and a delivery receipt exists. Retry will sync invitation status without sending again.`
    : `${acceptedGuestIds.length} invitation(s) accepted by the email provider, ` +
      `but invitation status could not be saved. Retry within ${GUEST_RSVP_IDEMPOTENCY_HOURS} hours may avoid a duplicate send via Resend idempotency; ` +
      `after that window a retry can deliver a second email unless a durable provider receipt is present.`;

  return {
    ok: false,
    code: "persistence_failed",
    error: message,
    message,
    sent: 0,
    sentGuestIds: [],
    accepted: acceptedGuestIds.length,
    acceptedGuestIds,
    deferred: tallies.deferred,
    deferredGuestIds: [...tallies.deferredGuestIds],
    failed: tallies.failed,
    errors,
    retrySafe: false,
    retrySafeWithoutResend,
    providerIdempotencyWindowHours: GUEST_RSVP_IDEMPOTENCY_HOURS,
    retryMayDuplicateAfterIdempotencyWindow: true,
    durableRecoveryAttempted,
  };
}

export function buildInviteSuccessMessage(tallies: InviteTallies): string | undefined {
  if (tallies.deferred > 0) {
    return `${tallies.sent} sent, ${tallies.deferred} deferred (delivery capacity full — retry those guests), ${tallies.failed} failed.`;
  }
  return undefined;
}

/** Minimal Supabase surface used by durable recovery (keeps helpers testable). */
export type InvitePersistenceAdmin = {
  from: (table: string) => any;
};

/**
 * Look up an existing provider receipt so retries skip Resend entirely.
 */
export async function findProviderReceipt(
  admin: InvitePersistenceAdmin,
  opts: { guestId: string; emailType: string; venueId: string; clientId: string },
): Promise<{ id: string; providerId: string } | null> {
  const { data, error } = await admin
    .from("invitation_emails")
    .select("id, provider_id")
    .eq("guest_id", opts.guestId)
    .eq("email_type", opts.emailType)
    .eq("venue_id", opts.venueId)
    .eq("client_id", opts.clientId)
    .not("provider_id", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.provider_id) return null;
  return { id: data.id as string, providerId: data.provider_id as string };
}

/**
 * Direct persistence mirroring log_invitations_sent guest/email writes,
 * additionally storing provider_id for durable no-resend recovery.
 * Recovery path only — happy path still uses the SECURITY DEFINER RPC.
 */
export async function persistAcceptedInvitationsDirectly(
  admin: InvitePersistenceAdmin,
  opts: {
    venueId: string;
    clientId: string;
    emailType: string;
    coupleFirstName: string | null | undefined;
    accepted: AcceptedDelivery[];
  },
): Promise<{ ok: true; persisted: number } | { ok: false; detail: string; persisted: number }> {
  let persisted = 0;
  const subjectPrefix =
    opts.emailType === "reminder"
      ? "Reminder: RSVP for "
      : opts.emailType === "update"
        ? "An update from "
        : "You're invited! ";
  const subject = `${subjectPrefix}${opts.coupleFirstName ?? "Our"}'s Wedding`;

  for (const row of opts.accepted) {
    // Match RPC CASE: do not downgrade responded/declined.
    const { data: existing, error: readErr } = await admin
      .from("couple_guests")
      .select("id, invitation_status, rsvp_sent_at")
      .eq("id", row.guestId)
      .eq("venue_id", opts.venueId)
      .eq("client_id", opts.clientId)
      .maybeSingle();
    if (readErr || !existing) {
      return {
        ok: false,
        detail: readErr?.message ?? `guest_not_found:${row.guestId}`,
        persisted,
      };
    }

    const nextStatus =
      existing.invitation_status === "responded" || existing.invitation_status === "declined"
        ? existing.invitation_status
        : "sent";

    const { error: updErr } = await admin
      .from("couple_guests")
      .update({
        rsvp_sent_at: existing.rsvp_sent_at ?? new Date().toISOString(),
        invitation_status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.guestId)
      .eq("venue_id", opts.venueId)
      .eq("client_id", opts.clientId);
    if (updErr) {
      return { ok: false, detail: updErr.message, persisted };
    }

    // If a provider receipt already exists, do not insert a duplicate history row.
    const prior = await findProviderReceipt(admin, {
      guestId: row.guestId,
      emailType: opts.emailType,
      venueId: opts.venueId,
      clientId: opts.clientId,
    });
    if (!prior) {
      const { error: insErr } = await admin.from("invitation_emails").insert({
        venue_id: opts.venueId,
        client_id: opts.clientId,
        guest_id: row.guestId,
        email_type: opts.emailType,
        recipient: row.email,
        subject,
        status: "sent",
        provider_id: row.providerId ?? null,
      });
      if (insErr) {
        return { ok: false, detail: insErr.message, persisted };
      }
    } else if (row.providerId && prior.providerId !== row.providerId) {
      // Keep the original receipt; status sync above is enough.
    }

    persisted += 1;
  }

  if (persisted < opts.accepted.length) {
    return {
      ok: false,
      detail: `persisted_${persisted}_of_${opts.accepted.length}`,
      persisted,
    };
  }
  return { ok: true, persisted };
}

/**
 * After a confirmed RPC log, backfill provider_id onto the newest matching
 * invitation_emails rows that lack one — durable receipt for future retries.
 */
export async function backfillProviderIds(
  admin: InvitePersistenceAdmin,
  opts: {
    venueId: string;
    clientId: string;
    emailType: string;
    accepted: AcceptedDelivery[];
  },
): Promise<void> {
  for (const row of opts.accepted) {
    if (!row.providerId) continue;
    const prior = await findProviderReceipt(admin, {
      guestId: row.guestId,
      emailType: opts.emailType,
      venueId: opts.venueId,
      clientId: opts.clientId,
    });
    if (prior) continue;
    await admin
      .from("invitation_emails")
      .update({ provider_id: row.providerId })
      .eq("guest_id", row.guestId)
      .eq("email_type", opts.emailType)
      .eq("venue_id", opts.venueId)
      .eq("client_id", opts.clientId)
      .is("provider_id", null);
  }
}
