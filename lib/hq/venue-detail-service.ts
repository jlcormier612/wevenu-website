/**
 * Wevenu HQ — Venue Detail ("the internal customer record"). Server-only,
 * HQ-admin-only (every underlying table read here relies on the
 * `*_hq_select` RLS policies added in the Sprint 108.5 migration).
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getBetaOverview } from "@/lib/hq/beta-service";
import type {
  HqCouple,
  HqCrmState,
  HqNote,
  HqTask,
  HqTeamMember,
  HqTimelineEntry,
  HqVendorInvite,
  HqVenueDetail,
} from "@/lib/hq/venue-detail-types";

const EVENT_LABELS: Record<string, string> = {
  "couple.portal_invite_sent": "Sent a couple a portal invite",
  "couple.portal_opened": "Couple opened their portal",
  "couple.portal_returned": "Couple returned to their portal",
  "couple.guest_list_updated": "Couple updated their guest list",
  "couple.todo_completed": "Couple completed a to-do",
  "vendor.invitation_sent": "Sent a vendor invitation",
  "vendor.invitation_accepted": "Vendor accepted their invitation",
  "vendor.portal_opened": "Vendor opened their portal",
  "vendor.task_completed": "Vendor completed a task",
  "vendor.document_uploaded": "Vendor uploaded a document",
  "contract.sent": "Sent a contract",
  "contract.signed": "Contract signed",
  "invoice.sent": "Sent an invoice",
  "invoice.paid": "Invoice paid",
  "timeline.entry_created": "Created a timeline entry",
  "timeline.vendor_assigned": "Assigned a vendor to the timeline",
  "team.member_invited": "Invited a team member",
  "team.member_accepted": "Team member accepted their invitation",
  "team.member_first_login": "Team member logged in for the first time",
  "team.task_completed": "Team member completed a task",
  "luv.recommendation_viewed": "Viewed a Luv recommendation",
  "luv.recommendation_acted_on": "Acted on a Luv recommendation",
  "luv.draft_generated": "Luv generated a draft",
  "hq.view_as": "Wevenu support viewed this venue (read-only)",
};

const MILESTONE_LABELS: Record<string, string> = {
  first_couple_portal_open: "Milestone: first couple portal opened",
  first_vendor_accepted: "Milestone: first vendor accepted",
  first_contract_signed: "Milestone: first contract signed",
  first_payment_received: "Milestone: first payment received",
  first_team_member_joined: "Milestone: first team member joined",
  activation_70: "Milestone: reached 70% activation",
  fully_connected: "Milestone: fully connected (90%+)",
};

function humanizeEventType(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.replace(/[._]/g, " ");
}

type ClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  event_date: string | null;
  status: string;
  created_at: string;
};

type TeamRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  is_owner: boolean;
  is_active: boolean;
  invited_at: string | null;
  accepted_at: string | null;
  last_active_at: string | null;
};

type VendorInviteRow = {
  id: string;
  email: string;
  status: string;
  created_at: string;
  accepted_at: string | null;
  vendors: { name: string } | { name: string }[] | null;
};

export async function getVenueHqDetail(venueId: string): Promise<HqVenueDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();

  const [venueRes, overview, teamRes, vendorRes, clientsRes, portalRes, eventsRes, milestonesRes, notesRes, tasksRes] =
    await Promise.all([
      supabase.from("venues").select("id, name, email, phone, timezone, created_at").eq("id", venueId).maybeSingle(),
      getBetaOverview(),
      supabase
        .from("venue_staff")
        .select("id, full_name, email, role, is_owner, is_active, invited_at, accepted_at, last_active_at")
        .eq("venue_id", venueId)
        .order("is_owner", { ascending: false }),
      supabase
        .from("vendor_invitations")
        .select("id, email, status, created_at, accepted_at, vendors(name)")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, first_name, last_name, partner_first_name, partner_last_name, event_date, status, created_at")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false }),
      supabase.from("client_portal_sessions").select("client_id, last_accessed_at").eq("venue_id", venueId),
      supabase
        .from("engagement_events")
        .select("event_type, actor_type, occurred_at")
        .eq("venue_id", venueId)
        .order("occurred_at", { ascending: false })
        .limit(150),
      supabase.from("venue_milestones").select("milestone_id, fired_at").eq("venue_id", venueId),
      supabase
        .from("venue_hq_notes")
        .select("id, author_name, body, created_at")
        .eq("venue_id", venueId)
        .order("created_at", { ascending: false }),
      supabase
        .from("venue_hq_tasks")
        .select("id, assigned_name, title, due_date, completed_at, created_at")
        .eq("venue_id", venueId)
        .order("completed_at", { ascending: true, nullsFirst: true })
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);

  if (venueRes.error || !venueRes.data) return null;
  const summary = overview?.venues.find((v) => v.venueId === venueId);
  if (!summary) return null;

  const v = venueRes.data as { id: string; name: string; email: string | null; phone: string | null; timezone: string; created_at: string };

  const portalByClient = new Map<string, string>();
  for (const r of (portalRes.data ?? []) as { client_id: string; last_accessed_at: string | null }[]) {
    if (!r.last_accessed_at) continue;
    const existing = portalByClient.get(r.client_id);
    if (!existing || r.last_accessed_at > existing) portalByClient.set(r.client_id, r.last_accessed_at);
  }

  const couples: HqCouple[] = ((clientsRes.data ?? []) as ClientRow[]).map((c) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(" ") +
      (c.partner_first_name ? ` & ${[c.partner_first_name, c.partner_last_name].filter(Boolean).join(" ")}` : ""),
    eventDate: c.event_date,
    status: c.status,
    createdAt: c.created_at,
    portalLastAccess: portalByClient.get(c.id) ?? null,
  }));

  const team: HqTeamMember[] = ((teamRes.data ?? []) as TeamRow[]).map((t) => ({
    id: t.id,
    name: t.full_name,
    email: t.email,
    role: t.role,
    isOwner: t.is_owner,
    isActive: t.is_active,
    invitedAt: t.invited_at,
    acceptedAt: t.accepted_at,
    lastActiveAt: t.last_active_at,
  }));

  const vendors: HqVendorInvite[] = ((vendorRes.data ?? []) as VendorInviteRow[]).map((r) => {
    const vendorRel = Array.isArray(r.vendors) ? r.vendors[0] : r.vendors;
    return {
      id: r.id,
      vendorName: vendorRel?.name ?? null,
      email: r.email,
      status: r.status,
      createdAt: r.created_at,
      acceptedAt: r.accepted_at,
    };
  });

  const timeline: HqTimelineEntry[] = [
    ...((eventsRes.data ?? []) as { event_type: string; actor_type: string; occurred_at: string }[]).map((e) => ({
      kind: "event" as const,
      occurredAt: e.occurred_at,
      label: humanizeEventType(e.event_type),
      actorType: e.actor_type,
    })),
    ...((milestonesRes.data ?? []) as { milestone_id: string; fired_at: string }[]).map((m) => ({
      kind: "milestone" as const,
      occurredAt: m.fired_at,
      label: MILESTONE_LABELS[m.milestone_id] ?? `Milestone: ${m.milestone_id}`,
      actorType: null,
    })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const notes: HqNote[] = ((notesRes.data ?? []) as { id: string; author_name: string; body: string; created_at: string }[]).map((n) => ({
    id: n.id,
    authorName: n.author_name,
    body: n.body,
    createdAt: n.created_at,
  }));

  const tasks: HqTask[] = ((tasksRes.data ?? []) as { id: string; assigned_name: string | null; title: string; due_date: string | null; completed_at: string | null; created_at: string }[]).map((t) => ({
    id: t.id,
    assignedName: t.assigned_name,
    title: t.title,
    dueDate: t.due_date,
    completedAt: t.completed_at,
    createdAt: t.created_at,
  }));

  const crmState: HqCrmState = {
    lastContactedAt: summary.lastContactedAt,
    nextContactAt: summary.nextContactAt,
  };

  return {
    venue: { id: v.id, name: v.name, email: v.email, phone: v.phone, timezone: v.timezone, createdAt: v.created_at },
    activation: {
      score: summary.score,
      previousScore: summary.previousScore,
      score7dAgo: summary.score7dAgo,
      phaseLabel: summary.phaseLabel,
      dimensionScores: summary.dimensionScores,
      gaps: summary.gaps,
      healthStatus: summary.healthStatus,
      trend: summary.trend,
      riskSignals: summary.riskSignals,
    },
    team,
    vendors,
    couples,
    timeline,
    notes,
    tasks,
    crmState,
  };
}
