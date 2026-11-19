/**
 * Guest RSVP invite persistence helpers (RESEND-SCALE Phase D).
 *
 * Provider acceptance and DB invitation logging are distinct steps.
 * When Resend accepts but log_invitations_sent fails, the API must not
 * report a clean success. Retry reuses the same Idempotency-Key
 * (`guest-rsvp/{guestId}/{emailType}`) so Resend suppresses duplicate
 * delivery for ~24 hours while logging can be re-attempted.
 */

export const GUEST_RSVP_IDEMPOTENCY_HOURS = 24;

export function guestRsvpIdempotencyKey(guestId: string, emailType: string): string {
  return `guest-rsvp/${guestId}/${emailType}`;
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

/** True when the SECURITY DEFINER RPC did not confirm persistence. */
export function invitationLogFailed(
  rpcError: { message?: string } | null | undefined,
  rpcData: LogInvitationsResult,
): boolean {
  if (rpcError) return true;
  if (rpcData && rpcData.ok === false) return true;
  return false;
}

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
  /** Manual retry is the recovery path; Resend idempotency covers ~24h. */
  retrySafe: true;
  idempotencyWindowHours: typeof GUEST_RSVP_IDEMPOTENCY_HOURS;
};

export function buildPersistenceFailureResponse(
  tallies: InviteTallies,
  detail: string,
): PersistenceFailureBody {
  const acceptedGuestIds = [...tallies.sentGuestIds];
  const errors = [
    ...tallies.errors,
    `Send accepted but invitation log failed: ${detail}`,
  ];
  const message =
    `${acceptedGuestIds.length} invitation(s) accepted by the email provider, ` +
    `but invitation status could not be saved. Retry to sync status — ` +
    `duplicate delivery is suppressed for ${GUEST_RSVP_IDEMPOTENCY_HOURS} hours via idempotency.`;

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
    retrySafe: true,
    idempotencyWindowHours: GUEST_RSVP_IDEMPOTENCY_HOURS,
  };
}

export function buildInviteSuccessMessage(tallies: InviteTallies): string | undefined {
  if (tallies.deferred > 0) {
    return `${tallies.sent} sent, ${tallies.deferred} deferred (delivery capacity full — retry those guests), ${tallies.failed} failed.`;
  }
  return undefined;
}
