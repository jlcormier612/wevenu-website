/**
 * Operational Readiness Model — computation.
 *
 * Every domain below reads real product state directly (a row count, a
 * connection flag, a configured/verified timestamp) — never a Setup Hub
 * click-through acknowledgment. This is deliberately a read model, not a
 * gate: a venue can use the product regardless of what this reports.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import type { OperationalReadiness, OperationalReadinessDomain, OperationalReadinessDomainKey } from "@/lib/operational-readiness/types";

function domain(
  key: OperationalReadinessDomainKey, label: string, ready: boolean, detail: string, href: string, notApplicable = false,
): OperationalReadinessDomain {
  return { key, label, ready, detail, href, notApplicable };
}

export async function computeOperationalReadiness(venueId?: string): Promise<OperationalReadiness | null> {
  if (!isSupabaseConfigured) return null;
  const venue = venueId ? { id: venueId } : await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();

  const [
    { data: channels },
    { data: venueRow },
    windowsResult,
    packagesResult,
    templatesResult,
    playbooksResult,
    messageTemplatesResult,
    { data: staff },
  ] = await Promise.all([
    supabase.from("venue_lead_capture_channels").select("channel, configured_at").eq("venue_id", venue.id),
    supabase.from("venues").select("tour_scheduling_enabled, stripe_account_id").eq("id", venue.id).maybeSingle<{ tour_scheduling_enabled: boolean | null; stripe_account_id: string | null }>(),
    supabase.from("tour_availability_windows").select("id", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("packages").select("id", { count: "exact", head: true }).eq("venue_id", venue.id).eq("is_active", true),
    supabase.from("contract_templates").select("id", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("playbook_templates").select("id", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("message_templates").select("id", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("venue_staff").select("id, is_owner, is_active, accepted_at").eq("venue_id", venue.id),
  ]);

  const anyChannelConfigured = ((channels ?? []) as { channel: string; configured_at: string | null }[])
    .some((c) => !!c.configured_at);

  const tourEnabled = venueRow?.tour_scheduling_enabled ?? false;
  const windowCount = windowsResult.count ?? 0;
  const packages = { count: packagesResult.count ?? 0 };
  const templates = { count: templatesResult.count ?? 0 };
  const playbooks = { count: playbooksResult.count ?? 0 };
  const messageTemplates = { count: messageTemplatesResult.count ?? 0 };

  const domains: OperationalReadinessDomain[] = [
    domain(
      "lead_capture", "Lead Capture",
      anyChannelConfigured,
      anyChannelConfigured ? "At least one way for a couple to reach you is set up." : "No lead-capture channel is configured yet — couples have no way to reach you.",
      "/setup-hub/lead-capture",
    ),
    domain(
      "tour_availability", "Tour Availability",
      !tourEnabled || windowCount > 0,
      !tourEnabled ? "Tour scheduling isn't turned on for this venue." : windowCount > 0 ? "Weekly tour hours are set." : "Tour scheduling is on, but no weekly hours are set yet — no one can actually book a tour.",
      "/settings/availability",
      !tourEnabled,
    ),
    domain(
      "pricing", "Packages & Pricing",
      countOf(packages) > 0,
      countOf(packages) > 0 ? `${countOf(packages)} package${countOf(packages) === 1 ? "" : "s"} ready to quote.` : "No packages exist yet — there's nothing to offer a new inquiry.",
      "/library/packages",
    ),
    domain(
      "contracts", "Proposal & Contract",
      countOf(templates) > 0,
      countOf(templates) > 0 ? "A contract template is ready to send." : "No contract template exists yet.",
      "/library/contracts",
    ),
    domain(
      "payments", "Payment Capability",
      !!venueRow?.stripe_account_id,
      venueRow?.stripe_account_id ? "Online payments are connected." : "Online payments aren't connected yet — you can still invoice manually.",
      "/settings/integrations",
    ),
    domain(
      "planning", "Planning & Playbooks",
      countOf(playbooks) > 0,
      countOf(playbooks) > 0 ? "A planning template exists for your events." : "No planning template exists yet.",
      "/library/playbooks",
    ),
    domain(
      "communications", "Communication Templates",
      countOf(messageTemplates) > 0,
      countOf(messageTemplates) > 0 ? "Message templates are ready to send." : "No message templates exist yet.",
      "/communication/templates",
    ),
    domain(
      "team", "Team & Permissions",
      teamReady(staff),
      teamReady(staff) ? "Your team access is set up." : "No accepted team member besides the owner — fine if you're solo, worth a look if not.",
      "/settings/team",
    ),
  ];

  const applicable = domains.filter((d) => !d.notApplicable);
  return {
    domains,
    readyCount: applicable.filter((d) => d.ready).length,
    applicableCount: applicable.length,
  };
}

function countOf(result: { count: number }): number {
  return result.count;
}

function teamReady(staff: unknown): boolean {
  const rows = (staff ?? []) as { is_owner: boolean; is_active: boolean; accepted_at: string | null }[];
  // Ready once a real accepted, active, non-owner team member exists —
  // deliberately not "the owner row alone counts," since that's true for
  // every venue and would make this domain meaningless. A solo venue is a
  // legitimate, common case; this domain is informational, not a gate, so
  // it staying "not ready" for a genuinely solo operator is fine — it's
  // simply "worth a look," not a blocker (see the copy above).
  return rows.some((r) => !r.is_owner && r.is_active && !!r.accepted_at);
}
