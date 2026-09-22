import type {
  BasisTitle,
  CapabilityDefinition,
  CapabilityKey,
} from "@/lib/authorization/types";
import { CAPABILITY_KEYS } from "@/lib/authorization/types";

const ALL_BASIS: readonly BasisTitle[] = [
  "administrator",
  "manager",
  "coordinator",
  "staff",
  "view_only",
];

const OPS_BASIS: readonly BasisTitle[] = [
  "administrator",
  "manager",
  "coordinator",
  "staff",
  "view_only",
];

function def(
  key: CapabilityKey,
  label: string,
  category: CapabilityDefinition["category"],
  opts: {
    customizable?: boolean;
    sensitive?: boolean;
    ownershipOnly?: boolean;
    grantableTo?: readonly BasisTitle[];
  } = {},
): CapabilityDefinition {
  const ownershipOnly = opts.ownershipOnly === true;
  return {
    key,
    label,
    category,
    customizable: ownershipOnly ? false : opts.customizable !== false,
    sensitive: opts.sensitive === true || ownershipOnly,
    ownershipOnly,
    grantableTo: ownershipOnly ? [] : (opts.grantableTo ?? OPS_BASIS),
  };
}

/**
 * Approved capability catalog (Architecture Brief §G / Implementation Plan §2).
 * Order matches CAPABILITY_KEYS.
 */
export const CAPABILITY_CATALOG: readonly CapabilityDefinition[] = [
  def("clients.view", "View clients and leads", "clients_leads"),
  def("clients.create", "Create clients and leads", "clients_leads", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("clients.edit", "Edit clients and leads", "clients_leads", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("clients.delete", "Delete eligible clients and leads", "clients_leads", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),

  def("events.view", "View events and planning", "events_planning"),
  def("events.create", "Create events", "events_planning", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("events.edit", "Edit event details", "events_planning", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("events.tasks", "Manage tasks", "events_planning", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("events.timelines", "Manage timelines", "events_planning", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("events.floor_plans", "Manage floor plans and seating", "events_planning", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("events.planning_artifacts", "Manage other planning artifacts", "events_planning", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("events.delete", "Delete eligible event/planning records", "events_planning", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),

  def("vendors.view", "View vendors", "vendors"),
  def("vendors.manage_relationships", "Manage vendor relationships", "vendors", {
    grantableTo: ["administrator", "manager"],
  }),
  def("vendors.assign", "Assign vendors to events", "vendors", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("vendors.portal_access", "Invite/manage vendor portal access", "vendors", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),

  def("messaging.view", "View conversations", "messaging"),
  def("messaging.send", "Send messages", "messaging", {
    grantableTo: ["administrator", "manager", "coordinator", "staff"],
  }),
  def("messaging.templates", "Manage message templates", "messaging", {
    grantableTo: ["administrator", "manager"],
  }),
  def("messaging.automation", "Manage automated messaging", "messaging", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),

  def("documents.view", "View contracts/documents", "contracts_documents"),
  def("documents.create_edit", "Create/edit draft contracts/documents", "contracts_documents", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("contracts.send", "Send contracts", "contracts_documents", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("contracts.venue_sign", "Sign contracts for the venue", "contracts_documents", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),
  def("documents.delete", "Delete eligible contracts/documents", "contracts_documents", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),

  def("payments.view", "View financial information", "payments_finances", {
    grantableTo: ["administrator", "manager", "coordinator", "view_only"],
  }),
  def("payments.create_edit", "Create/edit payment schedules/invoices", "payments_finances", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("payments.mark_paid", "Record/mark payments paid", "payments_finances", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("payments.cancel_unpaid", "Cancel eligible unpaid installments", "payments_finances", {
    grantableTo: ["administrator", "manager", "coordinator"],
  }),
  def("payments.void_invoice", "Void invoices", "payments_finances", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),
  def("payments.delete", "Delete eligible financial records", "payments_finances", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),
  def("payments.refund", "Issue refunds", "payments_finances", {
    sensitive: true,
    // Manager may be granted; Coordinator/Staff/View Only may not.
    grantableTo: ["administrator", "manager"],
  }),

  def("reports.view", "View reports", "reporting_data", {
    grantableTo: ["administrator", "manager", "view_only"],
  }),
  def("reports.schedule", "Schedule reports", "reporting_data", {
    grantableTo: ["administrator", "manager"],
  }),
  def("data.export", "Export venue data", "reporting_data", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),

  def("team.view", "View team members", "team"),
  def("team.invite", "Invite team members", "team", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),
  def("team.change_access", "Change team access", "team", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),
  def("team.remove", "Remove team members", "team", {
    sensitive: true,
    grantableTo: ["administrator", "manager"],
  }),

  def("settings.venue_profile", "Manage venue profile/operational settings", "venue_settings", {
    grantableTo: ["administrator", "manager"],
  }),
  def("settings.availability", "Manage availability settings", "venue_settings", {
    grantableTo: ["administrator", "manager"],
  }),
  def("settings.integrations", "Manage integrations", "venue_settings", {
    sensitive: true,
    grantableTo: ["administrator"],
  }),
  def("settings.texting", "Manage texting", "venue_settings", {
    sensitive: true,
    grantableTo: ["administrator"],
  }),

  def("ownership.add_owner", "Add Owners", "account_ownership", { ownershipOnly: true }),
  def("ownership.remove_owner", "Remove Owners", "account_ownership", { ownershipOnly: true }),
  def("ownership.transfer", "Transfer/change ownership", "account_ownership", { ownershipOnly: true }),
  // Billing is sensitive but delegable — not ownership-only (locked product decision).
  def("account.billing", "Manage billing/subscription", "account_ownership", {
    sensitive: true,
    customizable: true,
    grantableTo: ["administrator"],
  }),
  def("ownership.close_venue", "Close/delete venue", "account_ownership", { ownershipOnly: true }),
];

const BY_KEY: ReadonlyMap<CapabilityKey, CapabilityDefinition> = new Map(
  CAPABILITY_CATALOG.map((c) => [c.key, c]),
);

export function isCapabilityKey(value: string): value is CapabilityKey {
  return (CAPABILITY_KEYS as readonly string[]).includes(value);
}

export function getCapabilityDefinition(key: CapabilityKey): CapabilityDefinition {
  const d = BY_KEY.get(key);
  if (!d) {
    // Exhaustiveness: CAPABILITY_CATALOG must cover CAPABILITY_KEYS.
    throw new Error(`Missing capability definition: ${key}`);
  }
  return d;
}

export function ownershipOnlyCapabilityKeys(): readonly CapabilityKey[] {
  return CAPABILITY_CATALOG.filter((c) => c.ownershipOnly).map((c) => c.key);
}

export function customizableCapabilityKeys(): readonly CapabilityKey[] {
  return CAPABILITY_CATALOG.filter((c) => c.customizable).map((c) => c.key);
}

export function sensitiveCapabilityKeys(): readonly CapabilityKey[] {
  return CAPABILITY_CATALOG.filter((c) => c.sensitive).map((c) => c.key);
}

/** Denylist: never allowed in sparse overrides (ownership-only only). */
export function isOverrideDenied(key: string): boolean {
  if (!isCapabilityKey(key)) return true;
  return getCapabilityDefinition(key).ownershipOnly;
}

export function assertCatalogComplete(): void {
  if (CAPABILITY_CATALOG.length !== CAPABILITY_KEYS.length) {
    throw new Error("CAPABILITY_CATALOG length mismatch with CAPABILITY_KEYS");
  }
  for (const key of CAPABILITY_KEYS) {
    getCapabilityDefinition(key);
  }
  for (const key of ALL_BASIS) {
    void key;
  }
}
