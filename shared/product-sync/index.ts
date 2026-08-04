/**
 * Shared Product Sync (Project 10).
 *
 * Relationship (subscribed) → Venue → Workspace → Website → Subscription →
 * Owner Account → Onboarding → Launch.
 *
 * Import as `@shared/product-sync` from marketing / workspace.
 */

export type * from "./types";
export {
  PRODUCT_SYNC_STEPS,
  PRODUCT_SYNC_STEP_LABELS,
  emptyProductSyncState,
  emptyProductSyncSteps,
} from "./types";
export { getProductSyncDataDir } from "./paths";
export {
  getProductSyncAdapter,
  localProductSyncAdapter,
  httpProductSyncAdapter,
} from "./adapters";
export {
  syncRelationshipToProduct,
  enqueueProductSync,
  type SyncRelationshipResult,
} from "./pipeline";
export { recordOwnerActivationCredential } from "./owner-activation";
export {
  applyProductAccessLock,
  applyProductAccessLockFromRelationship,
  isRealVenueUuid,
  type ProductAccessLockInput,
  type ProductAccessLockResult,
} from "./access-lock";
export {
  syncVenueProfileFromProduct,
  type ProductVenueProfileFields,
  type SyncVenueProfileFromProductInput,
  type SyncVenueProfileFromProductResult,
  type SyncVenueProfileReason,
} from "./writeback";
