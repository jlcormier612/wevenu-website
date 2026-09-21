/**
 * Venue Team & Permissions — Wave 1 pure authorization model.
 * Catalog, presets, resolution, target-scope. No DB/UI/RLS.
 */

export {
  CAPABILITY_CATALOG,
  assertCatalogComplete,
  customizableCapabilityKeys,
  getCapabilityDefinition,
  isCapabilityKey,
  isOverrideDenied,
  ownershipOnlyCapabilityKeys,
  sensitiveCapabilityKeys,
} from "@/lib/authorization/catalog";

export {
  TITLE_PRESETS,
  presetCapabilities,
  presetHas,
} from "@/lib/authorization/presets";

export {
  displayAccessTitle,
  hasCapability,
  hasOwnershipOnlyCapability,
  isAccessTitle,
  isBasisTitle,
  listOwnershipOnlyCapabilities,
  overridesAfterTitleChange,
  resolveEffectiveAccess,
} from "@/lib/authorization/resolve";

export {
  assertCanManageMember,
  mayManageExistingTitle,
  titlesActorMayManage,
  type TargetScopeResult,
} from "@/lib/authorization/target-scope";

export {
  ACCESS_TITLES,
  BASIS_TITLES,
  CAPABILITY_KEYS,
  type AccessTitle,
  type BasisTitle,
  type CapabilityCategory,
  type CapabilityDefinition,
  type CapabilityKey,
  type CapabilityOverrides,
  type EffectiveAccess,
  type MembershipAccessInput,
  type TeamActor,
  type TeamTargetDraft,
} from "@/lib/authorization/types";
