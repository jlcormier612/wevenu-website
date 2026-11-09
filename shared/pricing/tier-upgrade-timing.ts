/**
 * Advance-notice + eligible renewal timing for Phase 3 upgrades.
 *
 * Uses authoritative Stripe period anchors only.
 * Never guesses a 30-day cycle for a billing increase effective date.
 */

export const DEFAULT_TIER_UPGRADE_NOTICE_DAYS = 7;

export type EligibleRenewalDecision = {
  /** Unix seconds when the higher tier should become effective */
  effectiveUnix: number;
  /** ISO timestamp */
  effectiveAt: string;
  /** The Stripe period end that was considered for the imminent renewal */
  imminentPeriodEndUnix: number;
  /** True when the next renewal is too soon for the full notice window */
  skippedImminentRenewal: boolean;
  /** When notice should be considered due (effective − noticeWindow) */
  noticeDueAt: string;
  /** Actual Stripe billing interval used (seconds), when known */
  billingIntervalSeconds: number | null;
  explanation: string;
};

export type EligibleRenewalFailure = {
  ok: false;
  reason: string;
  code:
    | "missing_period_end"
    | "missing_period_interval"
    | "period_end_not_after_start"
    | "period_end_not_in_future";
};

export type EligibleRenewalResult =
  | ({ ok: true } & EligibleRenewalDecision)
  | EligibleRenewalFailure;

function toIso(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

/** Civil YYYY-MM-DD in UTC from unix seconds. */
export function civilUtcDateFromUnix(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** Whole calendar days from civil date A to civil date B (B − A). */
export function calendarDaysBetween(fromCivil: string, toCivil: string): number {
  const a = Date.parse(`${fromCivil}T00:00:00.000Z`);
  const b = Date.parse(`${toCivil}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/**
 * True when the effective renewal civil date is at least `noticeWindowDays`
 * full calendar days after the notice civil date.
 */
export function noticeWindowSatisfied(input: {
  noticeSentAtIso: string;
  effectiveAtIso: string;
  noticeWindowDays?: number;
}): boolean {
  const days = input.noticeWindowDays ?? DEFAULT_TIER_UPGRADE_NOTICE_DAYS;
  const noticeCivil = input.noticeSentAtIso.slice(0, 10);
  const effectiveCivil = input.effectiveAtIso.slice(0, 10);
  const delta = calendarDaysBetween(noticeCivil, effectiveCivil);
  return Number.isFinite(delta) && delta >= days;
}

/**
 * Derive the actual Stripe billing-interval length from period anchors.
 * Returns null when anchors are missing — callers must fail closed.
 */
export function billingIntervalSecondsFromPeriod(input: {
  currentPeriodStartUnix?: number | null;
  currentPeriodEndUnix?: number | null;
}): number | null {
  if (
    input.currentPeriodStartUnix == null ||
    input.currentPeriodStartUnix <= 0 ||
    input.currentPeriodEndUnix == null ||
    input.currentPeriodEndUnix <= 0
  ) {
    return null;
  }
  if (input.currentPeriodEndUnix <= input.currentPeriodStartUnix) {
    return null;
  }
  return input.currentPeriodEndUnix - input.currentPeriodStartUnix;
}

/**
 * Choose the first renewal that allows a full notice window.
 *
 * Requires authoritative Stripe `current_period_end`.
 * When the imminent renewal is inside the notice window, requires either:
 * - an explicit Stripe-derived `nextPeriodEndUnix`, or
 * - authoritative period start+end so this subscription's actual interval
 *   can be used (not a hardcoded 30-day guess).
 *
 * If subsequent-renewal data cannot be obtained, fails closed.
 */
export function chooseEligibleRenewal(input: {
  nowUnix: number;
  currentPeriodEndUnix: number | null | undefined;
  currentPeriodStartUnix?: number | null;
  /** Explicit next renewal from Stripe schedule / future period when known */
  nextPeriodEndUnix?: number | null;
  noticeWindowDays?: number;
}): EligibleRenewalResult {
  const noticeDays = input.noticeWindowDays ?? DEFAULT_TIER_UPGRADE_NOTICE_DAYS;
  const noticeSeconds = noticeDays * 24 * 60 * 60;
  const imminent = input.currentPeriodEndUnix;

  if (imminent == null || !Number.isFinite(imminent) || imminent <= 0) {
    return {
      ok: false,
      code: "missing_period_end",
      reason:
        "Missing authoritative Stripe current_period_end — refuse to schedule a billing increase.",
    };
  }

  if (imminent <= input.nowUnix) {
    return {
      ok: false,
      code: "period_end_not_in_future",
      reason:
        "Stripe current_period_end is not in the future — refuse to guess the next renewal; re-fetch subscription from Stripe.",
    };
  }

  const secondsUntilRenewal = imminent - input.nowUnix;
  if (secondsUntilRenewal >= noticeSeconds) {
    return {
      ok: true,
      effectiveUnix: imminent,
      effectiveAt: toIso(imminent),
      imminentPeriodEndUnix: imminent,
      skippedImminentRenewal: false,
      noticeDueAt: toIso(imminent - noticeSeconds),
      billingIntervalSeconds: billingIntervalSecondsFromPeriod({
        currentPeriodStartUnix: input.currentPeriodStartUnix,
        currentPeriodEndUnix: imminent,
      }),
      explanation: `Imminent renewal allows a full ${noticeDays}-day notice window.`,
    };
  }

  // Need a subsequent renewal — never invent a 30-day cycle.
  let subsequent: number | null = null;
  let interval: number | null = null;

  if (
    input.nextPeriodEndUnix != null &&
    Number.isFinite(input.nextPeriodEndUnix) &&
    input.nextPeriodEndUnix > imminent
  ) {
    subsequent = input.nextPeriodEndUnix;
    interval = subsequent - imminent;
  } else {
    interval = billingIntervalSecondsFromPeriod({
      currentPeriodStartUnix: input.currentPeriodStartUnix,
      currentPeriodEndUnix: imminent,
    });
    if (interval == null) {
      return {
        ok: false,
        code: "missing_period_interval",
        reason:
          "Imminent renewal is inside the notice window and Stripe period start (or next period end) is unavailable — refuse to estimate a 30-day cycle.",
      };
    }
    subsequent = imminent + interval;
  }

  if (subsequent - input.nowUnix < noticeSeconds) {
    return {
      ok: false,
      code: "missing_period_interval",
      reason:
        "Even the subsequent renewal does not allow a full notice window with available Stripe period data — flag for founder review.",
    };
  }

  return {
    ok: true,
    effectiveUnix: subsequent,
    effectiveAt: toIso(subsequent),
    imminentPeriodEndUnix: imminent,
    skippedImminentRenewal: true,
    noticeDueAt: toIso(subsequent - noticeSeconds),
    billingIntervalSeconds: interval,
    explanation: `Imminent renewal is within ${noticeDays} days; retaining current rate at that renewal and scheduling the upgrade for the subsequent Stripe-derived renewal.`,
  };
}
