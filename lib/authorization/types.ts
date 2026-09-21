/**
 * Venue Team & Permissions — Wave 1 pure authorization model.
 *
 * No DB, RLS, UI, or runtime role behavior. Catalog + resolution only.
 */

export const ACCESS_TITLES = [
  "administrator",
  "manager",
  "coordinator",
  "staff",
  "view_only",
  "custom",
] as const;

export type AccessTitle = (typeof ACCESS_TITLES)[number];

/** Preset titles that may be used as Custom basis (not `custom` itself). */
export const BASIS_TITLES = [
  "administrator",
  "manager",
  "coordinator",
  "staff",
  "view_only",
] as const;

export type BasisTitle = (typeof BASIS_TITLES)[number];

export const CAPABILITY_KEYS = [
  // Clients & Leads
  "clients.view",
  "clients.create",
  "clients.edit",
  "clients.delete",
  // Events & Planning
  "events.view",
  "events.create",
  "events.edit",
  "events.tasks",
  "events.timelines",
  "events.floor_plans",
  "events.planning_artifacts",
  "events.delete",
  // Vendors
  "vendors.view",
  "vendors.manage_relationships",
  "vendors.assign",
  "vendors.portal_access",
  // Messaging
  "messaging.view",
  "messaging.send",
  "messaging.templates",
  "messaging.automation",
  // Contracts & Documents
  "documents.view",
  "documents.create_edit",
  "contracts.send",
  "contracts.venue_sign",
  "documents.delete",
  // Payments & Finances
  "payments.view",
  "payments.create_edit",
  "payments.mark_paid",
  "payments.cancel_unpaid",
  "payments.void_invoice",
  "payments.delete",
  "payments.refund",
  // Reporting & Data
  "reports.view",
  "reports.schedule",
  "data.export",
  // Team
  "team.view",
  "team.invite",
  "team.change_access",
  "team.remove",
  // Venue Settings
  "settings.venue_profile",
  "settings.availability",
  "settings.integrations",
  "settings.texting",
  // Account & Ownership (not ordinary customizable permissions)
  "ownership.add_owner",
  "ownership.remove_owner",
  "ownership.transfer",
  "account.billing",
  "ownership.close_venue",
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export type CapabilityCategory =
  | "clients_leads"
  | "events_planning"
  | "vendors"
  | "messaging"
  | "contracts_documents"
  | "payments_finances"
  | "reporting_data"
  | "team"
  | "venue_settings"
  | "account_ownership";

export type CapabilityDefinition = {
  key: CapabilityKey;
  label: string;
  category: CapabilityCategory;
  /** May appear in sparse overrides for non-owners. */
  customizable: boolean;
  sensitive: boolean;
  /** Never grantable via overrides; requires membership.is_owner. */
  ownershipOnly: boolean;
  /**
   * When customizable, which basis titles may receive an explicit true override
   * that is not already in their preset (grant-up). False overrides that remove
   * a preset default are always allowed for customizable caps.
   */
  grantableTo: readonly BasisTitle[];
};

export type CapabilityOverrides = Readonly<Partial<Record<CapabilityKey, boolean>>>;

export type MembershipAccessInput = {
  /** Soft-removed / not accepted → never authorized. */
  isActive: boolean;
  isOwner: boolean;
  accessTitle: AccessTitle | string;
  /** Required when accessTitle is custom; ignored otherwise if equal to title. */
  titleBasis?: BasisTitle | string | null;
  overrides?: CapabilityOverrides | null;
};

export type EffectiveAccess = {
  ok: true;
  accessTitle: AccessTitle;
  titleBasis: BasisTitle;
  isOwner: boolean;
  capabilities: ReadonlySet<CapabilityKey>;
} | {
  ok: false;
  reason:
    | "inactive_membership"
    | "unknown_title"
    | "unknown_basis"
    | "unknown_capability_override"
    | "ownership_only_override"
    | "billing_override"
    | "ungrantable_override";
  message: string;
};

/** Who is acting when assigning/editing another member's access. */
export type TeamActor = {
  isOwner: boolean;
  accessTitle: AccessTitle | string;
  /** Actor's already-resolved operational capabilities (non-ownership). */
  effectiveCapabilities: ReadonlySet<CapabilityKey>;
};

export type TeamTargetDraft = {
  isOwner: boolean;
  accessTitle: AccessTitle | string;
  titleBasis?: BasisTitle | string | null;
  overrides?: CapabilityOverrides | null;
};
