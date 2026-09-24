/**
 * Venue commercial booking preferences — payment/agreement defaults.
 *
 * These do NOT control HTC Booked. Booked is only via bookClient /
 * events.booked_at (venue lifecycle decision).
 *
 * Legacy fields kept in stored JSON for backcompat:
 * - `initialPaymentRequired` — same meaning as collectInitialPayment (payment
 *   default only; never a Booked gate). Prefer `collectInitialPayment` in new code.
 * - `processOrder` — always normalized to `agreement_first`; ignored by workflow.
 * - `remainingBalanceMode: "varies"` — treated as `final` in the simplified UI.
 */

export type AgreementMethod = "offer" | "contract" | "either";
/** @deprecated Always agreement_first. Kept for backcompat reads only. */
export type ProcessOrder = "agreement_first" | "deposit_first";
export type PaymentCollection = "online" | "external" | "either";
export type RemainingBalanceMode = "final" | "plan" | "varies";

export type VenueCommercialBookingPrefs = {
  /** How the venue normally sells: Proposal (offer) / Contract / Either. */
  agreementMethod: AgreementMethod;
  /**
   * Legacy — always `agreement_first` after normalize. Do not expose in UI.
   * Workflow is deterministic: package/proposal → agreement → deposit (if collecting).
   */
  processOrder: ProcessOrder;
  /**
   * Collect an initial payment (payment default).
   * Same stored key historically used as `initialPaymentRequired`.
   * NEVER a prerequisite for Booked.
   */
  collectInitialPayment: boolean;
  /**
   * @deprecated Alias of collectInitialPayment for callers not yet migrated.
   * Kept in-memory in sync with collectInitialPayment.
   */
  initialPaymentRequired: boolean;
  paymentCollection: PaymentCollection;
  /** 0–100; used to suggest deposit when package/total is known. */
  defaultDepositPercent: number;
  remainingBalanceMode: RemainingBalanceMode;
  /** Optional SCHEDULE_PRESETS id applied as default remaining structure. */
  defaultSchedulePresetId: string | null;
};

export const DEFAULT_COMMERCIAL_BOOKING_PREFS: VenueCommercialBookingPrefs = {
  agreementMethod: "either",
  processOrder: "agreement_first",
  collectInitialPayment: true,
  initialPaymentRequired: true,
  paymentCollection: "either",
  defaultDepositPercent: 25,
  remainingBalanceMode: "final",
  defaultSchedulePresetId: null,
};

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function normalizeCommercialBookingPrefs(
  raw: unknown,
): VenueCommercialBookingPrefs {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const agreementMethod = asString(src.agreementMethod);
  const paymentCollection = asString(src.paymentCollection);
  const remainingBalanceMode = asString(src.remainingBalanceMode);
  const preset = asString(src.defaultSchedulePresetId);

  let defaultDepositPercent = asNumber(
    src.defaultDepositPercent,
    DEFAULT_COMMERCIAL_BOOKING_PREFS.defaultDepositPercent,
  );
  if (defaultDepositPercent < 0) defaultDepositPercent = 0;
  if (defaultDepositPercent > 100) defaultDepositPercent = 100;

  // New key wins; fall back to legacy initialPaymentRequired.
  const collectInitialPayment = asBool(
    src.collectInitialPayment !== undefined ? src.collectInitialPayment : src.initialPaymentRequired,
    DEFAULT_COMMERCIAL_BOOKING_PREFS.collectInitialPayment,
  );

  // Simplified product: only final | plan. Legacy "varies" → final.
  let remaining: RemainingBalanceMode =
    remainingBalanceMode === "final"
    || remainingBalanceMode === "plan"
    || remainingBalanceMode === "varies"
      ? remainingBalanceMode
      : DEFAULT_COMMERCIAL_BOOKING_PREFS.remainingBalanceMode;
  if (remaining === "varies") remaining = "final";

  return {
    agreementMethod:
      agreementMethod === "offer" || agreementMethod === "contract" || agreementMethod === "either"
        ? agreementMethod
        : DEFAULT_COMMERCIAL_BOOKING_PREFS.agreementMethod,
    // processOrder is inert — always agreement_first (deterministic workflow).
    processOrder: "agreement_first",
    collectInitialPayment,
    initialPaymentRequired: collectInitialPayment,
    paymentCollection:
      paymentCollection === "online"
      || paymentCollection === "external"
      || paymentCollection === "either"
        ? paymentCollection
        : DEFAULT_COMMERCIAL_BOOKING_PREFS.paymentCollection,
    defaultDepositPercent,
    remainingBalanceMode: remaining,
    defaultSchedulePresetId: preset && preset !== "custom" ? preset : null,
  };
}

/** Absolute deposit dollars from venue percent + package total. */
export function depositFromVenuePercent(
  totalAmount: number,
  prefs: Pick<VenueCommercialBookingPrefs, "defaultDepositPercent">,
): number {
  if (!(totalAmount >= 0) || Number.isNaN(totalAmount)) return 0;
  const pct = prefs.defaultDepositPercent / 100;
  return Math.round((totalAmount * pct + Number.EPSILON) * 100) / 100;
}

/** Whether this venue's defaults collect an initial payment. */
export function collectsInitialPayment(
  prefs: Pick<VenueCommercialBookingPrefs, "collectInitialPayment" | "initialPaymentRequired">,
): boolean {
  return prefs.collectInitialPayment ?? prefs.initialPaymentRequired ?? true;
}
