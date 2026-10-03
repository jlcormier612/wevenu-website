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

import {
  normalizeCustomScheduleTemplate,
  type CustomScheduleTemplate,
} from "@/lib/payments/custom-default-schedule";

export type AgreementMethod = "offer" | "contract" | "either";
/** @deprecated Always agreement_first. Kept for backcompat reads only. */
export type ProcessOrder = "agreement_first" | "deposit_first";
export type PaymentCollection = "online" | "external" | "either";
export type RemainingBalanceMode = "final" | "plan" | "varies";
/** Venue-accepted payment methods shown to clients / used when recording offline payment. */
export type VenueAcceptedPaymentMethod =
  | "online"
  | "check"
  | "cash"
  | "ach"
  | "other";

export const VENUE_ACCEPTED_PAYMENT_METHODS: {
  value: VenueAcceptedPaymentMethod;
  label: string;
}[] = [
  { value: "online", label: "Online payment" },
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" },
  { value: "ach", label: "ACH / bank transfer" },
  { value: "other", label: "Other / manual" },
];

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
  /**
   * Venue Payment Collection Preferences — which methods this venue accepts.
   * Source of truth for client-facing payment instructions + offline recording.
   */
  acceptedPaymentMethods: VenueAcceptedPaymentMethod[];
  /**
   * Client-facing instructions for how to pay (check address, ACH details, etc.).
   * Shown on invoices / payment obligations; not an ad hoc per-invoice workaround.
   */
  clientPaymentInstructions: string | null;
  /** 0–100; used to suggest deposit when package/total is known. */
  defaultDepositPercent: number;
  remainingBalanceMode: RemainingBalanceMode;
  /**
   * Optional SCHEDULE_PRESETS id applied as default remaining structure.
   * Use `"custom"` with a valid `defaultCustomSchedule` for venue-built defaults.
   */
  defaultSchedulePresetId: string | null;
  /**
   * Venue-built Custom schedule DEFAULT (percentage or dollar).
   * Applied when creating payment obligations for a booking with a known total.
   * Per-booking schedules remain editable — this is not an immutable rule.
   */
  defaultCustomSchedule: CustomScheduleTemplate | null;
  /** Venue wants tax lines on invoices. Amounts are entered; no rate is assumed. */
  useTaxes: boolean;
  /** Venue wants discount lines on invoices. */
  useDiscounts: boolean;
};

export const DEFAULT_COMMERCIAL_BOOKING_PREFS: VenueCommercialBookingPrefs = {
  agreementMethod: "either",
  processOrder: "agreement_first",
  collectInitialPayment: true,
  initialPaymentRequired: true,
  paymentCollection: "either",
  acceptedPaymentMethods: ["online", "check", "cash", "ach", "other"],
  clientPaymentInstructions: null,
  defaultDepositPercent: 25,
  remainingBalanceMode: "final",
  defaultSchedulePresetId: null,
  defaultCustomSchedule: null,
  useTaxes: false,
  useDiscounts: false,
};

function normalizeAcceptedPaymentMethods(
  raw: unknown,
  paymentCollection: PaymentCollection,
): VenueAcceptedPaymentMethod[] {
  const allowed = new Set(VENUE_ACCEPTED_PAYMENT_METHODS.map((m) => m.value));
  if (Array.isArray(raw)) {
    const picked = raw.filter(
      (v): v is VenueAcceptedPaymentMethod =>
        typeof v === "string" && allowed.has(v as VenueAcceptedPaymentMethod),
    );
    if (picked.length > 0) return [...new Set(picked)];
  }
  // Backcompat from high-level paymentCollection radio.
  if (paymentCollection === "online") return ["online"];
  if (paymentCollection === "external") return ["check", "cash", "ach", "other"];
  return [...DEFAULT_COMMERCIAL_BOOKING_PREFS.acceptedPaymentMethods];
}

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

  const custom = normalizeCustomScheduleTemplate(src.defaultCustomSchedule);
  // "custom" is only valid with a validated schedule template.
  let defaultSchedulePresetId: string | null = null;
  let defaultCustomSchedule: CustomScheduleTemplate | null = null;
  if (preset === "custom" && custom) {
    defaultSchedulePresetId = "custom";
    defaultCustomSchedule = custom;
  } else if (preset && preset !== "custom") {
    defaultSchedulePresetId = preset;
    defaultCustomSchedule = null;
  } else if (custom && remaining === "plan") {
    // Recover Custom when template is present even if id was stripped historically.
    defaultSchedulePresetId = "custom";
    defaultCustomSchedule = custom;
  }

  const resolvedCollection: PaymentCollection =
    paymentCollection === "online"
    || paymentCollection === "external"
    || paymentCollection === "either"
      ? paymentCollection
      : DEFAULT_COMMERCIAL_BOOKING_PREFS.paymentCollection;

  const instructionsRaw = asString(src.clientPaymentInstructions);
  const clientPaymentInstructions =
    instructionsRaw && instructionsRaw.trim() ? instructionsRaw.trim() : null;

  return {
    agreementMethod:
      agreementMethod === "offer" || agreementMethod === "contract" || agreementMethod === "either"
        ? agreementMethod
        : DEFAULT_COMMERCIAL_BOOKING_PREFS.agreementMethod,
    // processOrder is inert — always agreement_first (deterministic workflow).
    processOrder: "agreement_first",
    collectInitialPayment,
    initialPaymentRequired: collectInitialPayment,
    paymentCollection: resolvedCollection,
    acceptedPaymentMethods: normalizeAcceptedPaymentMethods(
      src.acceptedPaymentMethods,
      resolvedCollection,
    ),
    clientPaymentInstructions,
    defaultDepositPercent,
    remainingBalanceMode: remaining,
    defaultSchedulePresetId,
    defaultCustomSchedule,
    useTaxes: asBool(src.useTaxes, DEFAULT_COMMERCIAL_BOOKING_PREFS.useTaxes),
    useDiscounts: asBool(src.useDiscounts, DEFAULT_COMMERCIAL_BOOKING_PREFS.useDiscounts),
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
