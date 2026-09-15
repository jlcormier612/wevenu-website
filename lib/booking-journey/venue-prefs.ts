/**
 * Venue commercial booking preferences — defaults for the booking spine.
 * Per-booking deposit/schedule may still override these.
 */

export type AgreementMethod = "offer" | "contract" | "either";
export type ProcessOrder = "agreement_first" | "deposit_first";
export type PaymentCollection = "online" | "external" | "either";
export type RemainingBalanceMode = "final" | "plan" | "varies";

export type VenueCommercialBookingPrefs = {
  agreementMethod: AgreementMethod;
  processOrder: ProcessOrder;
  /** When false, agreement alone satisfies commercial Booked. */
  initialPaymentRequired: boolean;
  paymentCollection: PaymentCollection;
  /** 0–100; used to suggest deposit when selecting a package. */
  defaultDepositPercent: number;
  remainingBalanceMode: RemainingBalanceMode;
  /** Optional SCHEDULE_PRESETS id applied as default remaining structure. */
  defaultSchedulePresetId: string | null;
};

export const DEFAULT_COMMERCIAL_BOOKING_PREFS: VenueCommercialBookingPrefs = {
  agreementMethod: "either",
  processOrder: "agreement_first",
  initialPaymentRequired: true,
  paymentCollection: "either",
  defaultDepositPercent: 25,
  remainingBalanceMode: "varies",
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
  const processOrder = asString(src.processOrder);
  const paymentCollection = asString(src.paymentCollection);
  const remainingBalanceMode = asString(src.remainingBalanceMode);
  const preset = asString(src.defaultSchedulePresetId);

  let defaultDepositPercent = asNumber(
    src.defaultDepositPercent,
    DEFAULT_COMMERCIAL_BOOKING_PREFS.defaultDepositPercent,
  );
  if (defaultDepositPercent < 0) defaultDepositPercent = 0;
  if (defaultDepositPercent > 100) defaultDepositPercent = 100;

  return {
    agreementMethod:
      agreementMethod === "offer" || agreementMethod === "contract" || agreementMethod === "either"
        ? agreementMethod
        : DEFAULT_COMMERCIAL_BOOKING_PREFS.agreementMethod,
    processOrder:
      processOrder === "deposit_first" || processOrder === "agreement_first"
        ? processOrder
        : DEFAULT_COMMERCIAL_BOOKING_PREFS.processOrder,
    initialPaymentRequired: asBool(
      src.initialPaymentRequired,
      DEFAULT_COMMERCIAL_BOOKING_PREFS.initialPaymentRequired,
    ),
    paymentCollection:
      paymentCollection === "online"
      || paymentCollection === "external"
      || paymentCollection === "either"
        ? paymentCollection
        : DEFAULT_COMMERCIAL_BOOKING_PREFS.paymentCollection,
    defaultDepositPercent,
    remainingBalanceMode:
      remainingBalanceMode === "final"
      || remainingBalanceMode === "plan"
      || remainingBalanceMode === "varies"
        ? remainingBalanceMode
        : DEFAULT_COMMERCIAL_BOOKING_PREFS.remainingBalanceMode,
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
