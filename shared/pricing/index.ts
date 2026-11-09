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

export {
  DEFAULT_TIER_UPGRADE_NOTICE_DAYS,
  chooseEligibleRenewal,
  billingIntervalSecondsFromPeriod,
  noticeWindowSatisfied,
  calendarDaysBetween,
  civilUtcDateFromUnix,
  type EligibleRenewalDecision,
  type EligibleRenewalResult,
} from "./tier-upgrade-timing";

export {
  previewUpgradeAmounts,
  knownLaunchV1PriceIds,
  planKeyFromLaunchPriceId,
  resolveRequiredLaunchPriceId,
  isLegacyOrUnmappedSubscriptionPrice,
  expectedCouponIdForOffer,
  expectedAmountForPlanAndPercent,
  type TierUpgradeAmountPreview,
} from "./tier-upgrade-pricing";

export {
  decideTierUpgrade,
  shouldSupersedePending,
  buildEvaluationIdempotencyKey,
  buildNoticeIdempotencyKey,
  type TierUpgradeEvaluationDecision,
} from "./tier-upgrade-evaluate";

export {
  evaluateTierUpgradeApplyGate,
  isNoticeDeliverySufficientForBilling,
  resolveNoticeDeliveryStatus,
  type TierUpgradeNoticeDeliveryStatus,
  type TierUpgradeApplyGateResult,
} from "./tier-upgrade-apply-gate";

export {
  buildStripeScheduleUpgradeIntent,
  buildStripeScheduleReleaseIntent,
  assessExistingSubscriptionSchedule,
  confirmUpgradeAppliedFromStripe,
  classifyUpgradeWebhookEvidence,
  type ExistingScheduleAssessment,
} from "./tier-upgrade-stripe-plan";

export {
  billingSnapshotFromStripeSubscription,
  type StripeSubscriptionLike,
} from "./tier-upgrade-stripe-snapshot";

export {
  resolveSaasStripeSecretKey,
  createSaasStripeClient,
} from "./tier-upgrade-stripe-client";

export {
  htcOwnsSchedule,
  scheduleContainsFuturePriceIncrease,
  confirmScheduleReleasedClean,
  executeStripeScheduleUpgrade,
  executeStripeScheduleRelease,
  cancellationPersistenceDecision,
} from "./tier-upgrade-stripe-execute";

export { assertVenueSubscriptionIsolation } from "./tier-upgrade-venue-guard";

export {
  buildTierUpgradeNoticeDraft,
  renderTierUpgradeNoticeBody,
} from "./tier-upgrade-notice";

export {
  createMemoryTierUpgradeStore,
  getTierUpgradeStore,
  preferPostgresTierUpgradeStore,
  setTierUpgradeStoreForTests,
  resetTierUpgradeStoreForTests,
  type TierUpgradeStore,
  type UpsertTierUpgradeInput,
} from "./tier-upgrade-store";

export { createPostgresTierUpgradeStore } from "./tier-upgrade-store-postgres";

export {
  evaluateAndPersistTierUpgrade,
  type TierUpgradeOrchestrationResult,
} from "./tier-upgrade-orchestrator";

export type {
  TierUpgradeStatus,
  TierUpgradeRecord,
  TierUpgradeHoldRecord,
  TierUpgradeAuditEntry,
  TierUpgradeErrorEntry,
  TierUpgradeNoticeDraft,
  StripeSubscriptionBillingSnapshot,
  StripeScheduleUpgradeIntent,
  StripeScheduleReleaseIntent,
} from "./tier-upgrade-types";

export {
  ACTIVE_TIER_UPGRADE_STATUSES,
  TERMINAL_TIER_UPGRADE_STATUSES,
} from "./tier-upgrade-types";
