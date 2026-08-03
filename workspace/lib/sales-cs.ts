/**
 * Sales + Customer Success board helpers for the Relationship Workspace.
 *
 * Imports the pure shared sales-cs module only — never the shared relationships
 * barrel (which pulls in paths/store and Node `fs`, unsafe for client bundles).
 */

export {
  type SalesStage,
  type CustomerSuccessStage,
  type CustomerHealthBadge,
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
} from "@shared/relationships/sales-cs";

export {
  PIPELINE_COLUMNS,
  toPipelineStatus,
  isPipelineStatus,
  normalizeRelationshipStatus,
} from "./pipeline";
