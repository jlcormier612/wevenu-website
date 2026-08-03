/**
 * Shared Relationship Operations — used by marketing (writes) and workspace (reads).
 *
 * Data path: RELATIONSHIPS_DATA_PATH or <repo>/shared/relationships/.data/
 * Format: JSONL files with a process-safe lock file.
 */

export type * from "./types";
export {
  normalizeEmail,
  normalizeVenueName,
  splitPersonName,
  mapPlanId,
  planDisplayName,
} from "./normalize";
export {
  getFounderProgramCapacity,
  computeFounderRemaining,
  resolveFounderSpotsRemaining,
} from "./founder-program";
export { getRelationshipsDataDir, STORE_FILES } from "./paths";
export { promoteStatus, stageLabelForStatus, toPipelineStatus, normalizeLifecycleStatus, isCustomerLifecycleStatus } from "./status";
export {
  type SalesStage,
  type CustomerSuccessStage,
  type CustomerHealthBadge,
  type AdoptionCheckpoint,
  type RiskTone,
  SALES_STAGE_COLUMNS,
  CS_STAGE_COLUMNS,
  SALES_STAGE_LABELS,
  CS_STAGE_LABELS,
  HEALTH_BADGE_LABELS,
  isSalesStage,
  isCustomerSuccessStage,
  isInCustomerSuccessView,
  isInSalesView,
  deriveSalesStage,
  deriveCustomerSuccessStage,
  salesStageFromLifecycleStatus,
  promoteSalesStage,
  toCustomerHealthBadge,
  computeAdoptionCheckpoints,
  computeRiskSection,
  applySubscribeViewTransition,
} from "./sales-cs";
export {
  computeRelationshipHealth,
  applyHealthSnapshot,
  type RelationshipHealthSnapshot,
} from "./health";
export {
  enterOnboardingAfterPurchase,
  createManualSubscription,
  launchWhiteGloveWorkspace,
  whiteGloveLaunchReady,
  suspendRelationshipAccount,
  reactivateRelationshipAccount,
  recordPaymentFailed,
  markDunningReminderSent,
  tickPaymentDunning,
  refreshRelationshipHealth,
  recordSubscriptionLinkSent,
  whiteGloveTimelineLabel,
  DEFAULT_WHITE_GLOVE_TIMELINE_DAYS,
  type WhiteGloveTimelineSettings,
} from "./lifecycle";
export {
  loadLiveStore,
  loadLiveStoreSync,
  hasLiveRelationships,
  hasLiveRelationshipsSync,
  saveLiveStore,
  withLiveStore,
  emptyLiveStore,
} from "./store";
export {
  findOrCreateRelationship,
  updateRelationshipFields,
  setRelationshipStatus,
  appendTimelineEvent,
  appendCommunication,
  upsertWalkthrough,
  upsertSubscription,
  appendNotification,
  mutateRelationship,
  resolveWelcomeBackVerification,
  completeRelationshipTask,
  setWalkthroughStatus,
  personFromFields,
  type FindOrCreateResult,
  type WelcomeBackAction,
  type WelcomeBackResolveResult,
  type WalkthroughStatusUpdateResult,
} from "./service";
export {
  ingestContactForm,
  ingestWalkthroughRequest,
  ingestWalkthroughCanceled,
  ingestManualRelationship,
  ingestCheckoutStarted,
  ingestSubscriptionPurchased,
  ingestSubscriptionLifecycle,
  ingestWelcomeBackRequest,
  ingestNewsletterSignup,
  ingestSupportRequest,
} from "./ingest";
export {
  WHITE_GLOVE_CHECKLIST_TITLES,
  WHITE_GLOVE_CHECKLIST_OWNER_ID,
  WHITE_GLOVE_CHECKLIST_MARKER,
  ensureWhiteGloveChecklist,
  ensureWhiteGloveChecklistInStore,
  ensureWhiteGloveChecklistsForLiveStore,
  isWhiteGloveChecklistTitle,
} from "./white-glove-checklist";
