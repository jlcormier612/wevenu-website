/**
 * Sales + Customer Success board helpers for the Relationship Workspace.
 *
 * Imports the pure shared sales-cs module only — never the shared relationships
 * barrel (which pulls in paths/store and Node `fs`, unsafe for client bundles).
 */

export {
  type SalesStage,
  type CustomerSuccessStage,
  type CustomerSuccessFlag,
  type CustomerHealthBadge,
  type AutoArrivalBoard,
  type LastAutoArrival,
  SALES_STAGE_COLUMNS,
  CS_STAGE_COLUMNS,
  CS_FLAG_FILTERS,
  SALES_STAGE_LABELS,
  CS_STAGE_LABELS,
  CS_FLAG_LABELS,
  HEALTH_BADGE_LABELS,
  SALES_AUTO_ARRIVAL_STAGES,
  CS_AUTO_ARRIVAL_STAGES,
  isSalesStage,
  isCustomerSuccessStage,
  isCustomerSuccessFlag,
  resolveCustomerSuccessFlag,
  matchesCustomerSuccessFlag,
  isSalesAutoArrivalStage,
  isCsAutoArrivalStage,
  isInCustomerSuccessView,
  isInSalesView,
  normalizeSalesStage,
  normalizeCustomerSuccessStage,
  deriveSalesStage,
  deriveCustomerSuccessStage,
  salesStageFromLifecycleStatus,
  promoteSalesStage,
  promoteCustomerSuccessStage,
  promoteToNeedsSupport,
  restoreFromNeedsSupport,
  markAutoArrival,
  clearAutoArrival,
  hasUnackedAutoArrival,
  countAutoArrivalsForStage,
  toCustomerHealthBadge,
  computeAdoptionCheckpoints,
  computeRiskSection,
} from "@shared/relationships/sales-cs";

export {
  PIPELINE_COLUMNS,
  toPipelineStatus,
  isPipelineStatus,
  normalizeRelationshipStatus,
} from "./pipeline";
