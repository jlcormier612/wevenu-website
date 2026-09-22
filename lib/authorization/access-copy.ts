/**
 * Customer-facing copy for access titles and capability summaries.
 * No authorization jargon.
 */
import { hasCapability, type CapabilityKey, type MembershipAccessInput } from "@/lib/authorization";
import type { AccessTitle, BasisTitle } from "@/lib/authorization/types";

export const ACCESS_TITLE_LABELS: Record<AccessTitle, string> = {
  administrator: "Administrator",
  manager: "Manager",
  coordinator: "Coordinator",
  staff: "Staff",
  view_only: "View Only",
  custom: "Custom",
};

export const ACCESS_TITLE_DESCRIPTIONS: Record<AccessTitle, string> = {
  administrator:
    "Broad access to manage venue operations, team access, settings, integrations, billing, and day-to-day work.",
  manager:
    "Broad operational access for managing clients, events, vendors, messaging, and your team.",
  coordinator:
    "Day-to-day client and event coordination with access to the work needed to manage bookings and events.",
  staff:
    "Access to the day-to-day work they need, with more limited editing, financial, team, and settings access.",
  view_only: "Can view the areas you allow, but cannot make changes.",
  custom: "Start with an access level and customize what this person can see and do.",
};

export const BASIS_TITLE_LABELS: Record<BasisTitle, string> = {
  administrator: "Administrator",
  manager: "Manager",
  coordinator: "Coordinator",
  staff: "Staff",
  view_only: "View Only",
};

/** Plain-English summary lines driven by effective capabilities. */
const SUMMARY_RULES: ReadonlyArray<{
  label: string;
  anyOf: readonly CapabilityKey[];
}> = [
  { label: "Manage clients", anyOf: ["clients.create", "clients.edit", "clients.delete"] },
  { label: "View clients", anyOf: ["clients.view"] },
  { label: "Manage events and planning", anyOf: ["events.create", "events.edit", "events.tasks", "events.timelines", "events.floor_plans"] },
  { label: "View events", anyOf: ["events.view"] },
  { label: "Communicate with clients", anyOf: ["messaging.send"] },
  { label: "Manage vendors", anyOf: ["vendors.manage_relationships", "vendors.assign", "vendors.portal_access"] },
  { label: "Send contracts", anyOf: ["contracts.send"] },
  { label: "Manage payments", anyOf: ["payments.create_edit", "payments.mark_paid", "payments.void_invoice"] },
  { label: "Issue refunds", anyOf: ["payments.refund"] },
  { label: "Manage team members", anyOf: ["team.invite", "team.change_access", "team.remove"] },
  { label: "Manage billing", anyOf: ["account.billing"] },
  { label: "Manage integrations", anyOf: ["settings.integrations"] },
  { label: "Manage texting", anyOf: ["settings.texting"] },
  { label: "View reports", anyOf: ["reports.view"] },
  { label: "Export data", anyOf: ["data.export"] },
];

export function summarizeWhatPersonCan(input: MembershipAccessInput): string[] {
  const lines: string[] = [];
  const claimed = new Set<string>();
  for (const rule of SUMMARY_RULES) {
    if (!rule.anyOf.some((k) => hasCapability(input, k))) continue;
    // Prefer "Manage X" over "View X" when both would apply
    if (rule.label.startsWith("View ") && lines.some((l) => l.startsWith("Manage " + rule.label.slice(5)))) {
      continue;
    }
    if (rule.label.startsWith("Manage ")) {
      const viewTwin = "View " + rule.label.slice("Manage ".length);
      const idx = lines.indexOf(viewTwin);
      if (idx >= 0) lines.splice(idx, 1);
    }
    if (claimed.has(rule.label)) continue;
    claimed.add(rule.label);
    lines.push(rule.label);
  }
  if (input.isOwner) {
    lines.push("Control ownership and Owners");
  }
  return lines;
}

export function formatAccessBadge(accessTitle: AccessTitle | string, isOwner: boolean): string {
  const label =
    accessTitle in ACCESS_TITLE_LABELS
      ? ACCESS_TITLE_LABELS[accessTitle as AccessTitle]
      : String(accessTitle);
  return isOwner ? `${label} · Owner` : label;
}
