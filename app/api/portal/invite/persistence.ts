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
 * Delivery-attempt identity (no schema change):
 *   - invitation: one stable attempt per guest (lifetime receipt)
 *   - reminder/update: UTC-day attempt bucket (matches idempotency keys)
 *
 * Durable recovery reuses invitation_emails.provider_id on the attempt's
 * history row so retries can sync status without Resend — including after
 * the ~24h Idempotency-Key window.
 */

export const GUEST_RSVP_IDEMPOTENCY_HOURS = 24;

export function normalizeInviteEmailType(emailType: string): string {
  return (emailType || "invitation").toLowerCase();
}

/** Reminder/update attempts are day-scoped; invitation is a single stable attempt. */
export function isDayScopedEmailType(emailType: string): boolean {
  const normalized = normalizeInviteEmailType(emailType);
  return normalized === "reminder" || normalized === "update";
}

/** UTC day bounds for the current delivery attempt (reminder/update). */
export function deliveryAttemptDayBounds(now: Date = new Date()): {
  day: string;
  startIso: string;
  endExclusiveIso: string;
} {
  const day = now.toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 86_400_000);
  return {
    day,
    startIso: start.toISOString(),
    endExclusiveIso: end.toISOString(),
  };
}

/**
 * Invitation keys stay stable so a persistence retry can reuse Resend's
 * Idempotency-Key when no durable provider_id receipt exists yet.
 *
 * Reminder/update keys are day-bucketed so a legitimate next-day reminder
 * is not suppressed by yesterday's key.
 */
export function guestRsvpIdempotencyKey(
  guestId: string,
  emailType: string,
  now: Date = new Date(),
): string {
  const normalized = normalizeInviteEmailType(emailType);
  if (normalized === "invitation") {
    return `guest-rsvp/${guestId}/invitation`;
  }
  const { day } = deliveryAttemptDayBounds(now);
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
  /** When set, backfill targets this invitation_emails row id only. */
  historyRowId?: string | null;
};

export type PersistenceFailureBody = {
  ok: false;
  code: "persistence_failed";
  error: string;
  message: string;
  sent: 0;
  sentGuestIds: [];
  accepted: number;
  acceptedGuestIds: string[];
  deferred: number;
  deferredGuestIds: string[];
  failed: number;
  errors: string[];
  retrySafe: false;
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

export type ProviderReceiptLookup =
  | { status: "found"; id: string; providerId: string }
  | { status: "absent" }
  | { status: "error"; detail: string };

type ReceiptQueryOpts = {
  guestId: string;
  emailType: string;
  venueId: string;
  clientId: string;
  now?: Date;
  /** When true, only rows with null provider_id (for targeting backfill). */
  providerIdNull?: boolean;
};

/**
 * Build the attempt-scoped invitation_emails query.
 * Invitation: lifetime. Reminder/update: current UTC day only.
 */
export function applyAttemptScopeToReceiptQuery(
  query: any,
  emailType: string,
  now: Date = new Date(),
): any {
  if (!isDayScopedEmailType(emailType)) return query;
  const { startIso, endExclusiveIso } = deliveryAttemptDayBounds(now);
  return query.gte("sent_at", startIso).lt("sent_at", endExclusiveIso);
}

/**
 * Look up a provider receipt for THIS delivery attempt only.
 * Fail-closed: DB errors return status "error" (callers must not send).
 */
export async function findProviderReceipt(
  admin: InvitePersistenceAdmin,
  opts: {
    guestId: string;
    emailType: string;
    venueId: string;
    clientId: string;
    now?: Date;
  },
): Promise<ProviderReceiptLookup> {
  const now = opts.now ?? new Date();
  let query = admin
    .from("invitation_emails")
    .select("id, provider_id, sent_at")
    .eq("guest_id", opts.guestId)
    .eq("email_type", normalizeInviteEmailType(opts.emailType))
    .eq("venue_id", opts.venueId)
    .eq("client_id", opts.clientId)
    .not("provider_id", "is", null);

  query = applyAttemptScopeToReceiptQuery(query, opts.emailType, now);

  const { data, error } = await query.order("sent_at", { ascending: false }).limit(1).maybeSingle();

  if (error) return { status: "error", detail: error.message };
  if (!data?.provider_id) return { status: "absent" };
  return {
    status: "found",
    id: data.id as string,
    providerId: data.provider_id as string,
  };
}

/**
 * Resolve the single invitation_emails row that should receive provider_id
 * for this attempt (newest null-provider row in attempt scope).
 */
export async function findAttemptHistoryRowForBackfill(
  admin: InvitePersistenceAdmin,
  opts: ReceiptQueryOpts,
): Promise<ProviderReceiptLookup | { status: "found_null"; id: string }> {
  const now = opts.now ?? new Date();
  let query = admin
    .from("invitation_emails")
    .select("id, provider_id, sent_at")
    .eq("guest_id", opts.guestId)
    .eq("email_type", normalizeInviteEmailType(opts.emailType))
    .eq("venue_id", opts.venueId)
    .eq("client_id", opts.clientId)
    .is("provider_id", null);

  query = applyAttemptScopeToReceiptQuery(query, opts.emailType, now);

  const { data, error } = await query.order("sent_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return { status: "error", detail: error.message };
  if (!data?.id) return { status: "absent" };
  return { status: "found_null", id: data.id as string };
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
    now?: Date;
  },
): Promise<{ ok: true; persisted: number } | { ok: false; detail: string; persisted: number }> {
  let persisted = 0;
  const now = opts.now ?? new Date();
  const emailType = normalizeInviteEmailType(opts.emailType);
  const subjectPrefix =
    emailType === "reminder"
      ? "Reminder: RSVP for "
      : emailType === "update"
        ? "An update from "
        : "You're invited! ";
  const subject = `${subjectPrefix}${opts.coupleFirstName ?? "Our"}'s Wedding`;

  for (const row of opts.accepted) {
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
        rsvp_sent_at: existing.rsvp_sent_at ?? now.toISOString(),
        invitation_status: nextStatus,
        updated_at: now.toISOString(),
      })
      .eq("id", row.guestId)
      .eq("venue_id", opts.venueId)
      .eq("client_id", opts.clientId);
    if (updErr) {
      return { ok: false, detail: updErr.message, persisted };
    }

    const prior = await findProviderReceipt(admin, {
      guestId: row.guestId,
      emailType,
      venueId: opts.venueId,
      clientId: opts.clientId,
      now,
    });
    if (prior.status === "error") {
      return { ok: false, detail: prior.detail, persisted };
    }
    if (prior.status === "absent") {
      const { error: insErr } = await admin.from("invitation_emails").insert({
        venue_id: opts.venueId,
        client_id: opts.clientId,
        guest_id: row.guestId,
        email_type: emailType,
        recipient: row.email,
        subject,
        status: "sent",
        provider_id: row.providerId ?? null,
        sent_at: now.toISOString(),
      });
      if (insErr) {
        return { ok: false, detail: insErr.message, persisted };
      }
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
 * After a confirmed RPC log, set provider_id on exactly one attempt-scoped
 * history row (by id). Never bulk-updates unrelated historical rows.
 */
export async function backfillProviderIds(
  admin: InvitePersistenceAdmin,
  opts: {
    venueId: string;
    clientId: string;
    emailType: string;
    accepted: AcceptedDelivery[];
    now?: Date;
  },
): Promise<void> {
  const now = opts.now ?? new Date();
  const emailType = normalizeInviteEmailType(opts.emailType);

  for (const row of opts.accepted) {
    if (!row.providerId) continue;

    // Prefer an explicit row id from this request when available.
    let targetId = row.historyRowId ?? null;

    if (!targetId) {
      const existing = await findProviderReceipt(admin, {
        guestId: row.guestId,
        emailType,
        venueId: opts.venueId,
        clientId: opts.clientId,
        now,
      });
      if (existing.status === "found") continue; // this attempt already has a receipt
      if (existing.status === "error") continue; // fail soft on backfill only

      const candidate = await findAttemptHistoryRowForBackfill(admin, {
        guestId: row.guestId,
        emailType,
        venueId: opts.venueId,
        clientId: opts.clientId,
        now,
      });
      if (candidate.status !== "found_null") continue;
      targetId = candidate.id;
    }

    await admin
      .from("invitation_emails")
      .update({ provider_id: row.providerId })
      .eq("id", targetId)
      .eq("venue_id", opts.venueId)
      .eq("client_id", opts.clientId)
      .eq("guest_id", row.guestId)
      .is("provider_id", null);
  }
}
