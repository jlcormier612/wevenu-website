import type { BasisTitle, CapabilityKey } from "@/lib/authorization/types";
import { CAPABILITY_KEYS } from "@/lib/authorization/types";

type PresetRow = Record<CapabilityKey, boolean>;

function row(enabled: readonly CapabilityKey[]): PresetRow {
  const set = new Set<CapabilityKey>(enabled);
  const out = {} as PresetRow;
  for (const key of CAPABILITY_KEYS) {
    out[key] = set.has(key);
  }
  return out;
}

const ADMINISTRATOR = row([
  "clients.view", "clients.create", "clients.edit", "clients.delete",
  "events.view", "events.create", "events.edit", "events.tasks", "events.timelines",
  "events.floor_plans", "events.planning_artifacts", "events.delete",
  "vendors.view", "vendors.manage_relationships", "vendors.assign", "vendors.portal_access",
  "messaging.view", "messaging.send", "messaging.templates", "messaging.automation",
  "documents.view", "documents.create_edit", "contracts.send", "contracts.venue_sign", "documents.delete",
  "payments.view", "payments.create_edit", "payments.mark_paid", "payments.cancel_unpaid",
  "payments.void_invoice", "payments.delete", "payments.refund",
  "reports.view", "reports.schedule", "data.export",
  "team.view", "team.invite", "team.change_access", "team.remove",
  "settings.venue_profile", "settings.availability", "settings.integrations", "settings.texting",
  // ownership-only excluded from title presets
]);

const MANAGER = row([
  "clients.view", "clients.create", "clients.edit", "clients.delete",
  "events.view", "events.create", "events.edit", "events.tasks", "events.timelines",
  "events.floor_plans", "events.planning_artifacts", "events.delete",
  "vendors.view", "vendors.manage_relationships", "vendors.assign", "vendors.portal_access",
  "messaging.view", "messaging.send", "messaging.templates", "messaging.automation",
  "documents.view", "documents.create_edit", "contracts.send", "contracts.venue_sign", "documents.delete",
  "payments.view", "payments.create_edit", "payments.mark_paid", "payments.cancel_unpaid",
  "payments.void_invoice", "payments.delete",
  // payments.refund OFF by default
  "reports.view", "reports.schedule",
  // data.export OFF by default
  "team.view", "team.invite", "team.change_access", "team.remove",
  // settings.venue_profile / availability OFF by default (grantable)
  // settings.integrations / texting OFF
]);

const COORDINATOR = row([
  "clients.view", "clients.create", "clients.edit",
  "events.view", "events.create", "events.edit", "events.tasks", "events.timelines",
  "events.floor_plans", "events.planning_artifacts",
  "vendors.view", "vendors.assign",
  "messaging.view", "messaging.send",
  "documents.view", "documents.create_edit", "contracts.send",
  "payments.view", "payments.create_edit", "payments.mark_paid", "payments.cancel_unpaid",
  "team.view",
]);

/**
 * Staff: operational support. Messaging view/send. View surfaces.
 * No full events.tasks / floor_plans (those are Coordinator+ authoring).
 * Staff limited day-of ops are constrained domain functions in later waves —
 * not encoded as full manage caps here.
 */
const STAFF = row([
  "clients.view",
  "events.view",
  "vendors.view",
  "messaging.view", "messaging.send",
  "documents.view",
  "team.view",
]);

const VIEW_ONLY = row([
  "clients.view",
  "events.view",
  "vendors.view",
  "messaging.view",
  "documents.view",
  "team.view",
  // payments.view / reports.view OFF by default; grantable
]);

export const TITLE_PRESETS: Readonly<Record<BasisTitle, Readonly<PresetRow>>> = {
  administrator: ADMINISTRATOR,
  manager: MANAGER,
  coordinator: COORDINATOR,
  staff: STAFF,
  view_only: VIEW_ONLY,
};

export function presetCapabilities(basis: BasisTitle): ReadonlySet<CapabilityKey> {
  const preset = TITLE_PRESETS[basis];
  const enabled = new Set<CapabilityKey>();
  for (const key of CAPABILITY_KEYS) {
    if (preset[key]) enabled.add(key);
  }
  return enabled;
}

export function presetHas(basis: BasisTitle, key: CapabilityKey): boolean {
  return TITLE_PRESETS[basis][key] === true;
}
