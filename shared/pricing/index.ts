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
  groupAmountCents,
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
  isPricingGroupV1FlagEnabled,
  isPricingGroupV1Ready,
  getPricingGroupV1Readiness,
  resolveGroupPercentCouponId,
  type PricingLaunchReadiness,
  type PricingLaunchMode,
  type PricingWevenReadiness,
  type PricingWevenMode,
  type PricingGroupReadiness,
  type PricingGroupMode,
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

export type * from "./group-types";

export {
  GROUP_QUALIFYING_SUBSCRIPTION_STATUSES,
} from "./group-types";

export {
  isGroupQualifyingSubscriptionStatus,
  venueCountsTowardGroupEligibility,
  evaluateGroupEligibility,
  shouldRequireMembershipReview,
  membershipIsBillableOrgLink,
  type GroupEligibilityEvaluation,
} from "./group-eligibility";

export {
  decideGroupBillingAdjustment,
  grantsWithGroupEligibility,
  previewGroupRecurringAmountCents,
  amountAfterGroupOnly,
  couponIdForOfferType,
  type GroupReconcileVenueInput,
  type GroupReconcileDecision,
} from "./group-billing-reconcile";

export {
  createMemoryGroupOrgStore,
  preferPostgresGroupOrgStore,
  setGroupOrgStoreForTests,
  resetGroupOrgStoreForTests,
  type GroupOrgStore,
} from "./group-org-store";

// Server routes: import getGroupOrgStore / requireDurableGroupOrgStore from
// `@shared/pricing/group-org-store-access` (server-only + Postgres).
// Do not re-export Postgres or the server accessor from this barrel —
// marketing Client Components import readiness helpers from here.

export {
  resolveReservationGroupEligibility,
  fulfillOrganizationVenueActivation,
  type VenueBillingSnapshot,
} from "./group-fulfillment";

export {
  executeGroupCouponChange,
  type GroupStripeExecutor,
} from "./group-stripe-execute";

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

export { resolveSaasStripeSecretKey } from "./tier-upgrade-stripe-client";

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
  assertPhase3RehearsalFixture,
  isPhase3RehearsalMetadata,
  isPhase3RehearsalExecutionEnabled,
  maySendTierUpgradeNotice,
  mayApplyTierUpgradeStripe,
} from "./tier-upgrade-rehearsal-guard";

export {
  approvedInternalNoticeInboxes,
  assertRehearsalNoticeRecipient,
  rehearsalNoticeAllowlist,
  resolveTierUpgradeNoticeRecipient,
} from "./tier-upgrade-notice-recipients";

export {
  evaluateVenueTierUpgrade,
  sendNoticeForUpgrade,
  applyScheduleForUpgrade,
  type VenueTierUpgradeSource,
  type EvaluateVenueOutcome,
  type NoticeVenueOutcome,
  type ApplyVenueOutcome,
} from "./tier-upgrade-cycle";

export {
  buildTierUpgradeNoticeDraft,
  renderTierUpgradeNoticeBody,
} from "./tier-upgrade-notice";

export {
  sendTierUpgradeNotice,
  type SendTierUpgradeNoticeResult,
} from "./tier-upgrade-notice-send";

export {
  applyTierUpgradeSchedule,
  type ApplyTierUpgradeResult,
} from "./tier-upgrade-apply";

export {
  reconcileTierUpgradeFromInvoice,
  type TierUpgradeReconcileResult,
} from "./tier-upgrade-reconcile";

export { releaseScheduledTierUpgrade } from "./tier-upgrade-release";

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
