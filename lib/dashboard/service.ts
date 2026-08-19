/**
 * Dashboard application service (Sprint 7 — Today Dashboard).
 *
 * Fetches all widget data in three parallel queries (one for all leads,
 * one for open tasks with lead names, one for recent activities with lead
 * names) then filters and shapes client-side. No new DB tables needed.
 * Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getLuvObservations } from "@/lib/luv/observations";
import { getCommunicationObservations } from "@/lib/luv/communication-observations";
import { getLuvSettings } from "@/lib/luv/settings";
import { getVenueTrends, computeTrendObservations, computeStoryMode } from "@/lib/luv/trends-service";
import { getVenueMemories, computeMemoryObservations } from "@/lib/luv/memory-service";
import { getVenueInsights, computeInsightObservations } from "@/lib/luv/insights-service";
import { getVenueHealthScore } from "@/lib/luv/health-service";
import { getVenueRecommendations } from "@/lib/luv/recommendation-service";
import { getLuvActionObservations, getPendingLuvActions, getLuvPerformanceObservations } from "@/lib/luv/action-service";
import { getActivationScore, getNextPendingMilestone } from "@/lib/activation/service";
import type { ActivationScore } from "@/lib/activation/types";
import { GAP_COPY } from "@/lib/dashboard/gap-copy";
import { computeSetupGapObservations } from "@/lib/luv/setup-observations";
import { getDailyBriefing } from "@/lib/luv/briefing-service";
import { getArticlesForGapKeys } from "@/lib/success-library/service";
import { getNotificationPreferences } from "@/lib/notifications/preferences";
import { isVenueReadyToInviteCouples } from "@/lib/setup-hub/service";
import { refreshAllLeadScores, generateMomentumLanguage, getMomentumTier } from "@/lib/leads/scores";
import { LEAD_STATUSES } from "@/lib/leads/constants";
import type { Lead } from "@/lib/leads/types";
import { getCurrentToursForLeads, EMPTY_TOUR, type LeadTourInfo } from "@/lib/leads/repository";
import { getCurrentVenue } from "@/lib/venue/service";
import type {
  ActivityItem,
  AttentionLead,
  DashboardClient,
  DashboardData,
  DashboardEvent,
  DashboardKeyDate,
  DashboardPayment,
  OnboardingStatus,
  OnboardingStep,
  PipelineStage,
  TaskItem,
} from "@/lib/dashboard/types";
import type { Venue } from "@/lib/venue/types";

// ---- row types for embedded selects -----------------------------------------

type LeadRow = Record<string, unknown> & {
  id: string; venue_id: string; status: string; source: string | null;
  first_name: string; last_name: string; email: string | null; phone: string | null;
  partner_first_name: string | null; partner_last_name: string | null;
  partner_email: string | null; event_type: string | null;
  event_date: string | null; end_date: string | null;
  guest_count: number | null; estimated_budget: number | null;
  inquiry_message: string | null; inquiry_date: string;
  next_action_text: string | null; next_action_due: string | null;
  follow_up_date: string | null; last_contacted_at: string | null;
  created_at: string; updated_at: string;
};

type EmbeddedLeadName = {
  first_name: string;
  last_name: string;
} | null;

type DashTaskRow = {
  id: string; lead_id: string; title: string;
  due_date: string | null; created_at: string;
  leads: EmbeddedLeadName;
};

type DashActivityRow = {
  id: string; lead_id: string; type: string;
  title: string; description: string | null; created_at: string;
  leads: EmbeddedLeadName;
};

function mapLead(r: LeadRow, tour: LeadTourInfo = EMPTY_TOUR): Lead {
  return {
    id: r.id, venueId: r.venue_id, status: r.status as Lead["status"],
    source: r.source, firstName: r.first_name, lastName: r.last_name,
    email: r.email, phone: r.phone,
    partnerFirstName: r.partner_first_name, partnerLastName: r.partner_last_name,
    partnerEmail: r.partner_email, eventType: r.event_type,
    eventDate: r.event_date, endDate: r.end_date,
    guestCount: r.guest_count, estimatedBudget: r.estimated_budget,
    inquiryMessage: r.inquiry_message, inquiryDate: r.inquiry_date,
    nextActionText: r.next_action_text, nextActionDue: r.next_action_due,
    followUpDate: r.follow_up_date, lastContactedAt: r.last_contacted_at,
    tourDate: tour.tourDate, tourTime: tour.tourTime,
    tourCompleted: tour.tourCompleted, tourNotes: tour.tourNotes,
    commitmentScore: 0, responsivenessScore: 0, interestScore: 0, scoresUpdatedAt: null, sourceData: null,
    relationshipId: (r.relationship_id as string | null) ?? null,
    intakeConfidence: null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function embeddedName(row: EmbeddedLeadName): string {
  if (!row) return "Unknown lead";
  return [row.first_name, row.last_name].filter(Boolean).join(" ");
}

// ---- Client row types (dashboard queries) -----------------------------------

type DashClientRow = {
  id: string;
  first_name: string;
  last_name: string;
  partner_first_name: string | null;
  partner_last_name: string | null;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  status: string;
  created_at: string;
};

type DashKDRow = {
  id: string;
  client_id: string;
  label: string;
  date: string;
  clients: { first_name: string; last_name: string } | null;
};

function mapDashClient(r: DashClientRow): DashboardClient {
  return {
    id: r.id, firstName: r.first_name, lastName: r.last_name,
    partnerFirstName: r.partner_first_name, partnerLastName: r.partner_last_name,
    eventType: r.event_type, eventDate: r.event_date, guestCount: r.guest_count,
    status: r.status, createdAt: r.created_at,
  };
}

const CLOSED = new Set(["won", "lost", "cancelled"]);

function attentionReason(lead: Lead, today: string): string {
  if (lead.followUpDate && lead.followUpDate < today) {
    const days = Math.floor(
      (Date.now() - new Date(lead.followUpDate).getTime()) / 86_400_000,
    );
    return `Follow-up overdue by ${days} day${days === 1 ? "" : "s"}`;
  }
  const ageMs = Date.now() - new Date(lead.createdAt).getTime();
  const ageDays = Math.floor(ageMs / 86_400_000);
  return `New inquiry ${ageDays} day${ageDays === 1 ? "" : "s"} old — no follow-up scheduled`;
}

// ---- main service function --------------------------------------------------

export async function getDashboardData(): Promise<DashboardData | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  // A venue graduates into the normal product either via the legacy wizard
  // (setupCompleted) or via Setup Hub's readyToInviteCouples (Continuous
  // Setup Experience, Phase 6) — see app/(app)/layout.tsx's gate for the
  // full reasoning. Without this second check, a Setup-Hub-graduated venue
  // would pass the layout gate but still see a blank "Dashboard unavailable"
  // here, since setup_completed is never set on that path.
  const readyToInviteCouples = venue.setupCompleted ? false : await isVenueReadyToInviteCouples(venue.id);
  if (!venue.setupCompleted && !readyToInviteCouples) return null;
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const twoDaysAgoMs = Date.now() - 48 * 60 * 60 * 1000;
  const twoWeeksOut = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const sixtyDaysOut = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

  // Auto-mark overdue payments for this venue before the dashboard loads
  // Auto-mark overdue (non-fatal — don't block dashboard load on failure)
  void supabase.rpc("mark_overdue_payments", { p_venue_id: venue.id });

  const [leadsRes, tasksRes, activityRes, clientsRes, keyDatesRes, eventsRes, paymentsRes, staffRes] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .eq("venue_id", venue.id)
      .order("inquiry_date", { ascending: false }),

    supabase
      .from("lead_tasks")
      .select("*, leads(first_name, last_name)")
      .eq("venue_id", venue.id)
      .eq("completed", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(15),

    supabase
      .from("lead_activities")
      .select("*, leads(first_name, last_name)")
      .eq("venue_id", venue.id)
      .order("created_at", { ascending: false })
      .limit(15),

    // Booked clients — still needed for recentBookings (booking date) and totalClients
    supabase
      .from("clients")
      .select("id, first_name, last_name, partner_first_name, partner_last_name, event_type, event_date, guest_count, status, created_at")
      .eq("venue_id", venue.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),

    // Key dates in the next 14 days with embedded client names
    supabase
      .from("client_key_dates")
      .select("id, client_id, label, date, clients(first_name, last_name)")
      .eq("venue_id", venue.id)
      .gte("date", today)
      .lte("date", twoWeeksOut)
      .order("date", { ascending: true })
      .limit(10),

    // Upcoming events (canonical source) — replaces client-based event dates
    supabase
      .from("events")
      .select("id, name, event_date, start_time, status, guest_count, client_id, clients(first_name, last_name, partner_first_name, partner_last_name)")
      .eq("venue_id", venue.id)
      .neq("status", "cancelled")
      .gte("event_date", today)
      .lte("event_date", sixtyDaysOut)
      .order("event_date", { ascending: true })
      .limit(8),

    // Payment line items with schedule title + client name (for dashboard widgets)
    supabase
      .from("payment_line_items")
      .select("id, schedule_id, label, amount, due_date, status, payment_schedules(title, client_id, clients(first_name, last_name))")
      .eq("venue_id", venue.id)
      .in("status", ["pending", "overdue"])
      .not("due_date", "is", null)
      .order("due_date", { ascending: true })
      .limit(15),

    // Owner's name for the dashboard greeting
    supabase
      .from("venue_staff")
      .select("full_name")
      .eq("venue_id", venue.id)
      .eq("is_owner", true)
      .maybeSingle<{ full_name: string }>(),
  ]);

  if (leadsRes.error) throw leadsRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (activityRes.error) throw activityRes.error;
  if (clientsRes.error) throw clientsRes.error;
  if (keyDatesRes.error) throw keyDatesRes.error;
  if (eventsRes.error) throw eventsRes.error;
  // payments error is non-fatal for the dashboard

  const leadRows = leadsRes.data as LeadRow[];
  const leadTours = await getCurrentToursForLeads(supabase, venue.id, leadRows.map((r) => r.id));
  const leads = leadRows.map((r) => mapLead(r, leadTours.get(r.id) ?? EMPTY_TOUR));

  // ---- Needs Attention -------------------------------------------------------
  // Leads that are slipping: overdue follow-up OR stale "new" inquiry (>48h, no follow-up set)
  const needsAttentionLeads = leads.filter((l) => {
    if (CLOSED.has(l.status)) return false;
    if (l.followUpDate && l.followUpDate < today) return true; // overdue follow-up
    if (
      l.status === "new" &&
      !l.followUpDate &&
      new Date(l.createdAt).getTime() < twoDaysAgoMs
    )
      return true;
    return false;
  });

  const needsAttention: AttentionLead[] = needsAttentionLeads
    .slice(0, 8)
    .map((l) => ({ ...l, reason: attentionReason(l, today) }));

  // ---- Follow-ups Due --------------------------------------------------------
  // Leads with follow_up_date = today (not overdue — that goes in Needs Attention)
  const followupsDue = leads
    .filter((l) => l.followUpDate === today && !CLOSED.has(l.status))
    .slice(0, 8);

  // ---- Upcoming Tours --------------------------------------------------------
  const upcomingTours = leads
    .filter(
      (l) =>
        l.tourDate &&
        l.tourDate >= today &&
        l.tourDate <= twoWeeksOut &&
        !l.tourCompleted,
    )
    .sort((a, b) => (a.tourDate ?? "").localeCompare(b.tourDate ?? ""))
    .slice(0, 8);

  // ---- Pipeline Snapshot -----------------------------------------------------
  const pipelineStages: PipelineStage[] = LEAD_STATUSES.map((s) => ({
    status: s.value,
    label: s.label,
    count: leads.filter((l) => l.status === s.value).length,
  }));

  // ---- Tasks -----------------------------------------------------------------
  const openTasks: TaskItem[] = (tasksRes.data as DashTaskRow[]).map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    title: r.title,
    dueDate: r.due_date,
    leadName: embeddedName(r.leads),
  }));

  // ---- Recent Activity -------------------------------------------------------
  const recentActivity: ActivityItem[] = (
    activityRes.data as DashActivityRow[]
  ).map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    type: r.type,
    title: r.title,
    description: r.description,
    createdAt: r.created_at,
    leadName: embeddedName(r.leads),
  }));

  // ---- Client data ----------------------------------------------------------
  const clients = (clientsRes.data as DashClientRow[]).map(mapDashClient);

  // recentBookings: ordered by when the couple booked (clients.created_at)
  const recentBookings = clients.slice(0, 5);

  // ---- Upcoming events (from events table — canonical source) ---------------
  type DashEventRow = {
    id: string; name: string; event_date: string; start_time: string | null;
    status: string; guest_count: number | null; client_id: string | null;
    clients: { first_name: string; last_name: string; partner_first_name: string | null; partner_last_name: string | null } | null;
  };
  const upcomingEvents: DashboardEvent[] = (eventsRes.data as unknown as DashEventRow[]).map((r) => {
    const cn = r.clients
      ? [r.clients.first_name, r.clients.last_name].filter(Boolean).join(" ") +
        (r.clients.partner_first_name
          ? ` & ${[r.clients.partner_first_name, r.clients.partner_last_name].filter(Boolean).join(" ")}`
          : "")
      : null;
    return {
      id: r.id, name: r.name, eventDate: r.event_date,
      startTime: r.start_time?.slice(0, 5) ?? null, status: r.status,
      guestCount: r.guest_count, clientId: r.client_id, clientName: cn,
    };
  });

  const upcomingKeyDates: DashboardKeyDate[] = (keyDatesRes.data as unknown as DashKDRow[]).map(
    (r) => ({
      id: r.id,
      clientId: r.client_id,
      label: r.label,
      date: r.date,
      clientName: r.clients
        ? [r.clients.first_name, r.clients.last_name].filter(Boolean).join(" ")
        : "Unknown client",
    }),
  );

  // ---- Payment dashboard data -----------------------------------------------
  type PaymentItemDash = {
    id: string; schedule_id: string; label: string; amount: number;
    due_date: string; status: string;
    payment_schedules: { title: string; client_id: string | null; clients: { first_name: string; last_name: string } | null } | null;
  };
  const allPaymentItems = (paymentsRes.data ?? []) as unknown as PaymentItemDash[];
  const mapDashPayment = (r: PaymentItemDash): DashboardPayment => ({
    id: r.id, scheduleId: r.schedule_id, label: r.label,
    amount: Number(r.amount), dueDate: r.due_date,
    isOverdue: r.status === "overdue" || (r.due_date < today && r.status === "pending"),
    clientName: r.payment_schedules?.clients
      ? `${r.payment_schedules.clients.first_name} ${r.payment_schedules.clients.last_name}`.trim()
      : r.payment_schedules?.title ?? null,
  });
  const overduePayments = allPaymentItems.filter((r) => r.status === "overdue" || (r.due_date < today && r.status === "pending")).map(mapDashPayment);
  const upcomingPayments = allPaymentItems.filter((r) => r.due_date >= today && r.status === "pending").slice(0, 8).map(mapDashPayment);

  // Extract first name from "Jordan Rivera" → "Jordan"
  const ownerFullName = staffRes.data?.full_name ?? null;
  const ownerFirstName = ownerFullName ? ownerFullName.split(" ")[0] : null;

  // Refresh all three lead scores (commitment, responsiveness, interest) — non-blocking
  void refreshAllLeadScores(supabase, venue.id).catch(() => {});

  // Luv observations + trend intelligence — non-blocking; return [] on error
  const luvSettings = await getLuvSettings().catch(() => null);
  const emptyBriefing = { needsAttentionNow: [], comingUpThisWeek: [], resolvedSinceLastLooked: [], informational: [], generatedAt: new Date().toISOString() };
  const [luvObservationsRaw, communicationObservations, rawTrends, rawMemories, rawInsights, healthScore, recommendations, actionObservations, pendingActionObservations, performanceObservations, activationScore, nextPendingMilestone, notificationPrefs, briefing] = await Promise.all([
    getLuvObservations(supabase, venue.id, today, luvSettings ?? undefined).catch(() => []),
    getCommunicationObservations(supabase, venue.id).catch(() => []),
    getVenueTrends().catch(() => null),
    getVenueMemories().catch(() => null),
    getVenueInsights().catch(() => null),
    getVenueHealthScore().catch(() => null),
    getVenueRecommendations().catch(() => []),
    getLuvActionObservations().catch(() => []),
    getPendingLuvActions().catch(() => []),
    getLuvPerformanceObservations().catch(() => []),
    getActivationScore(venue.id).catch(() => null),
    getNextPendingMilestone(venue.id).catch(() => null),
    getNotificationPreferences().catch(() => null),
    getDailyBriefing(venue.id).catch(() => emptyBriefing),
  ]);
  // Communication and setup-gap observations respect the same
  // observationsEnabled setting as every other Luv observation — Luv is
  // one voice, not two.
  const setupGapObservations = activationScore ? computeSetupGapObservations(activationScore.checklist) : [];
  const luvObservations = luvSettings?.observationsEnabled === false
    ? luvObservationsRaw
    : [...luvObservationsRaw, ...communicationObservations, ...setupGapObservations];
  const showDigestCallout = !!notificationPrefs && notificationPrefs.dailyDigestEnabled && !notificationPrefs.digestIntroDismissed;
  const trendObservations  = rawTrends   ? computeTrendObservations(rawTrends) : [];
  const storyObservation   = rawTrends   ? computeStoryMode(rawTrends) : null;
  const memoryObservations = rawMemories
    ? computeMemoryObservations(rawMemories, new Date().getMonth() + 1)
    : [];
  const insightObservations = rawInsights ? computeInsightObservations(rawInsights) : [];

  // Compute momentum segments from lead scores (post-refresh)
  const { data: scoredLeads } = await supabase.from("leads")
    .select("id, first_name, last_name, status, commitment_score, responsiveness_score, interest_score, last_contacted_at")
    .eq("venue_id", venue.id)
    .not("status", "in", "(won,lost,cancelled)")
    .order("commitment_score", { ascending: false })
    .limit(30);

  const heatingUp: { leadId: string; name: string; reason: string }[] = [];
  const coolingOff: { leadId: string; name: string; reason: string }[] = [];

  for (const l of (scoredLeads ?? []) as { id: string; first_name: string; last_name: string; status: string; commitment_score: number; responsiveness_score: number; interest_score: number; last_contacted_at: string | null }[]) {
    const name = [l.first_name, l.last_name].filter(Boolean).join(" ");
    const daysAgo = l.last_contacted_at
      ? Math.floor((Date.now() - new Date(l.last_contacted_at).getTime()) / 86_400_000)
      : null;
    const tier = getMomentumTier(l.commitment_score, l.responsiveness_score, l.interest_score, daysAgo, l.status);
    const lang = generateMomentumLanguage(l.first_name, l.commitment_score, l.responsiveness_score, l.interest_score, daysAgo);
    if (tier === "heating_up" && heatingUp.length < 4) heatingUp.push({ leadId: l.id, name, reason: lang ?? "Showing recent engagement." });
    if (tier === "cooling_off" && coolingOff.length < 4) coolingOff.push({ leadId: l.id, name, reason: lang ?? "May need a follow-up." });
  }

  return {
    venueName: venue.name,
    ownerFirstName,
    todayIso: today,
    onboarding: await buildGuidedSetupChecklist(venue, activationScore, readyToInviteCouples),
    briefing,
    needsAttention,
    followupsDue,
    upcomingTours,
    pipelineStages,
    totalLeads: leads.length,
    newLeadCount: leads.filter((l) => l.status === "new").length,
    openTasks,
    openTaskCount: (tasksRes.data as DashTaskRow[]).length,
    recentActivity,
    overduePayments,
    upcomingPayments,
    upcomingEvents,
    recentBookings,
    upcomingKeyDates,
    totalClients: clients.length,
    luvObservations,
    trendObservations,
    storyObservation,
    memoryObservations,
    insightObservations,
    healthScore,
    recommendations,
    actionObservations,
    pendingActionObservations,
    performanceObservations,
    momentumSegments: { heatingUp, coolingOff },
    activationScore,
    nextPendingMilestone,
    showDigestCallout,
    // Luv Experience Completion, Work Stream 5 — the one-time intro card.
    // Guided Setup §1.1 (2026-07-22): the permanent luvIntroSeenAt flag is
    // still the gate (never show it twice), but it's no longer sufficient
    // on its own — a venue that's long past setup and simply never
    // dismissed the card shouldn't have it resurface. Requires the venue
    // to actually look new: still in the Activation Engine's "setup"
    // phase, or created within the last two weeks (matches this file's
    // own `twoWeeksOut` window elsewhere).
    showLuvIntro: !venue.luvIntroSeenAt && (
      activationScore?.phase === "setup" ||
      Date.now() - new Date(venue.createdAt).getTime() < 14 * 86_400_000
    ),
  };
}

// ---- Getting Started onboarding ---------------------------------------------
// Hospitality Success Platform, Guided Setup §1.1 (decided 2026-07-22): this
// used to be a second, independent computation of "what's done, what's
// missing" — its own ad hoc field/count checks, disagreeing in places with
// the Activation Engine's own scoring. It's now a presentation layer over
// Activation's own checklist (lib/activation/service.ts's getActivationScore,
// backed by compute_venue_activation_score() in Postgres) — one computation,
// with journey-voiced copy attached per item here. Companion voice, not
// documentation: every line names the actual consequence of the gap, not
// just the feature it's missing — "Luv says 'I'll walk through it with
// you,' not 'here's an article.'"

/**
 * Presentation layer over the Activation Engine's own checklist — see the
 * note above. No independent computation of "what's done" happens here.
 *
 * Continuous Setup Experience, Phase 6 (docs/continuous-setup-experience-
 * implementation-plan.md): this card is product-usage/engagement nudging,
 * not foundational setup — Setup Hub owns setup now. For a venue on the
 * legacy wizard path (setupCompleted), nothing changes here — this card
 * has always been their only "getting started" surface. For a venue on the
 * Setup Hub path, it stays hidden until readyToInviteCouples, so it can
 * never compete with Setup Hub as "the setup experience" — it only appears
 * once setup is actually done, as the plan's own "swap what gates the
 * dashboard's Activation card... to the new readiness field" describes.
 */
async function buildGuidedSetupChecklist(venue: Venue, activationScore: ActivationScore | null, readyToInviteCouples: boolean): Promise<OnboardingStatus> {
  const items = activationScore?.checklist ?? [];

  // Luv's Success Library §4.2 (2026-07-22) — a published article tagged
  // for an incomplete gap becomes a secondary "read more" link. Looked up
  // once, in bulk, not per step.
  const incompleteKeys = items.filter((i) => !i.completed).map((i) => i.key);
  const articlesByGapKey = await getArticlesForGapKeys(incompleteKeys).catch(() => new Map());

  const steps: OnboardingStep[] = [
    {
      id: "setup_complete",
      title: "Your venue is open",
      description: `${venue.name} is live and ready to take leads.`,
      completed: true,
    },
    ...items.map((item): OnboardingStep => {
      const copy = GAP_COPY[item.key];
      const article = articlesByGapKey.get(item.key);
      return {
        id: item.key,
        title: copy?.title ?? item.label,
        description: copy?.description ?? item.label,
        completed: item.completed,
        timeEstimate: copy?.timeEstimate,
        ctaLabel: copy?.ctaLabel ?? "Take me there",
        ctaHref: item.href,
        articleTitle: article?.title,
        articleHref: article ? `/help/${article.slug}` : undefined,
      };
    }),
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;

  // Luv's single highest-priority nudge — the top (highest-points) unresolved
  // item in the checklist itself (which carries a stable `key` GAP_COPY is
  // keyed by; the separate `gaps` array only carries display label text).
  const topGapItem = [...items].filter((i) => !i.completed).sort((a, b) => b.points - a.points)[0];
  const luvNudge = topGapItem ? (GAP_COPY[topGapItem.key]?.description ?? topGapItem.label) : null;

  return {
    // Disappears entirely once every step is done — no lingering graduation
    // card, so the dashboard reclaims that space rather than keeping a
    // permanent "you're done" card on screen. Also stays hidden for a
    // Setup-Hub-path venue until it has actually graduated (see the
    // function's own doc comment) — setupCompleted true means the legacy
    // wizard path, unaffected by this addition.
    show: !allComplete && !venue.onboardingDismissed && (venue.setupCompleted || readyToInviteCouples),
    steps,
    completedCount,
    totalSteps: steps.length,
    luvNudge,
  };
}
