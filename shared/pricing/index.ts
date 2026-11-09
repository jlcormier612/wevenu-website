/**
 * Shared SaaS pricing — catalog, Launch V1 readiness, Founding soft milestone,
 * Checkout offer store, best-offer selection, event-volume foundation.
 */

export type * from "./types";

export {
  PRICING_VERSION_V1,
  FOUNDING_PERCENT_OFF,
  WHITE_GLOVE_AMOUNT_CENTS,
  WEVEN_WHITE_GLOVE_AMOUNT_CENTS,
  WEVEN_PERCENT_OFF,
  GROUP_PERCENT_OFF,
  SAAS_PRICE_CATALOG_V1,
  isSaasPlanKey,
  getCatalogEntry,
  listAmountCents,
  amountAfterPercentOff,
  foundingAmountCents,
  wevenAmountCents,
  planWevenDisplayAmounts,
  formatUsdFromCents,
  planDisplayAmounts,
} from "./catalog";

export {
  isPricingLaunchV1FlagEnabled,
  isPricingLaunchV1Ready,
  isPricingLaunchV1Misconfigured,
  getPricingLaunchMode,
  getPricingLaunchV1Readiness,
  getPricingLaunchOperationalSignal,
  requirePricingLaunchV1Ready,
  resolveLaunchGatherPriceId,
  resolveLaunchCelebratePriceId,
  resolveLaunchFlourishPriceId,
  resolveLaunchFoundingPercentCouponId,
  resolveLaunchWhiteGlovePriceId,
  isPricingWevenV1FlagEnabled,
  isPricingWevenV1Ready,
  isPricingWevenV1Misconfigured,
  getPricingWevenV1Readiness,
  getPricingWevenOperationalSignal,
  resolveWevenPercentCouponId,
  resolveWevenWhiteGlovePriceId,
  type PricingLaunchReadiness,
  type PricingLaunchMode,
  type PricingWevenReadiness,
  type PricingWevenMode,
} from "./readiness";

export {
  decideFoundingIssuance,
  foundingSpotsRemainingForDisplay,
  shouldHonorIssuedFoundingOffer,
  expectedFoundingInvoiceCents,
  type FoundingIssuanceDecision,
} from "./founding";

export {
  selectBestOffer,
  type EligibleGrant,
  type BestOfferSelection,
} from "./best-offer";

export {
  resolveLaunchCheckoutPricing,
  type LaunchCheckoutPricing,
} from "./resolve-checkout";

export {
  createMemoryPricingOfferStore,
  getPricingOfferStore,
  requireDurablePricingOfferStore,
  preferPostgresPricingOfferStore,
  setPricingOfferStoreForTests,
  resetPricingOfferStoreForTests,
  abandonIssuedOfferOnStripeFailure,
  type PricingOfferStore,
  type IssueCheckoutOfferInput,
  type UpsertWevenClaimInput,
} from "./offer-store";

export { createPostgresPricingOfferStore } from "./offer-store-postgres";

export {
  evaluateEventVolume,
  isQualifyingVolumeEvent,
  calendarYearFromEventDate,
  planForPeakCount,
  recommendedUpgrade,
  type EventVolumeInputEvent,
  type EventVolumeEvaluation,
  type EventVolumeStatus,
} from "./event-volume";

export {
  mapEventRowsToVolumeInputs,
  evaluateVenueEventVolume,
  type EventVolumeRow,
} from "./event-volume-repository";
