/**
 * Dashboard application service (Sprint 7 — Today Dashboard).
 *
 * Phase 3A/3B: Dashboard GET is a read/assembly operation for Focus, Coming Up,
 * Business Snapshot inputs, and live L1 sources. It must not manufacture
 * venue-wide intelligence, run the broad observation engine, compute venue
 * insights, or read/sync persisted recommendations on the critical path.
 * Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCommunicationObservations } from "@/lib/luv/communication-observations";
import { getLuvSettings } from "@/lib/luv/settings";
import { getDismissedObservationIds } from "@/lib/luv/recommendation-service";
import { filterVisibleObservations } from "@/lib/luv/observation-dismiss";
import { getActivationScore, getNextPendingMilestone } from "@/lib/activation/service";
import type { ActivationScore } from "@/lib/activation/types";
import { GAP_COPY } from "@/lib/dashboard/gap-copy";
import { computeSetupGapObservations } from "@/lib/luv/setup-observations";
import { loadVenueReadiness } from "@/lib/luv/venue-readiness-load";
import { readinessDashboardObservations } from "@/lib/luv/venue-readiness";
import { getFocusNeedsAttentionBriefing } from "@/lib/luv/briefing-service";
import { isVenueReadyToInviteCouples } from "@/lib/setup-hub/service";
import { isOpenLeadLifecycle, TERMINAL_LEAD_LIFECYCLE_STATES } from "@/lib/leads/open-lifecycle";
import type { Lead } from "@/lib/leads/types";
import { getCurrentToursForLeads, EMPTY_TOUR, type LeadTourInfo } from "@/lib/leads/repository";
import { getCurrentVenue } from "@/lib/venue/service";
import { venueLocalToUtcIso, venueToday } from "@/lib/venue/timezone";
import { comingUpHorizonEnd } from "@/lib/clients/list-filters";
import { resolveDashboardOwnerFirstName } from "@/lib/dashboard/owner-greeting";
import {
  leadBelongsInFocusPopulation,
  leadMatchesFocusTourRules,
} from "@/lib/dashboard/focus-lead-membership";
import {
  forensicCount,
  forensicSetVenue,
  forensicTime,
} from "@/lib/dashboard/forensic-timing";
import type {
  AttentionLead,
  DashboardData,
  DashboardEvent,
  DashboardPayment,
  OnboardingStatus,
  OnboardingStep,
  TaskItem,
} from "@/lib/dashboard/types";
import type { Venue } from "@/lib/venue/types";
import type { ClientListFilterKey } from "@/lib/clients/list-filters";

// ---- row types for embedded selects -----------------------------------------

type LeadRow = Record<string, unknown> & {
  id: string; venue_id: string; sales_stage: string; status: string | null; source: string | null;
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

const LEAD_FOCUS_SELECT =
  "id, venue_id, sales_stage, status, source, first_name, last_name, email, phone, partner_first_name, partner_last_name, partner_email, event_type, event_date, end_date, guest_count, estimated_budget, inquiry_message, inquiry_date, next_action_text, next_action_due, follow_up_date, last_contacted_at, created_at, updated_at, exclude_from_business_reporting";

const EMPTY_CLIENT_COUNTS = {
  all: 0,
  coming_up: 0,
  needs_attention: 0,
  cancelled: 0,
  past: 0,
} as Record<ClientListFilterKey, number>;

function mapLead(r: LeadRow, tour: LeadTourInfo = EMPTY_TOUR): Lead {
  const salesStage = (r.sales_stage ?? r.status) as Lead["salesStage"];
  return {
    id: r.id, venueId: r.venue_id, salesStage, status: salesStage,
    pipelineStageId: null,
    source: r.source, firstName: r.first_name, lastName: r.last_name,
    email: r.email, phone: r.phone,
    preferredCommunicationChannels: [],
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
    excludeFromBusinessReporting: Boolean(r.exclude_from_business_reporting),
    intakeConfidence: null,
    lostReason: null,
    lostReasonDetail: null,
    lostAt: null,
    venueSeenAt: null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function embeddedName(row: EmbeddedLeadName): string {
  if (!row) return "Unknown lead";
  return [row.first_name, row.last_name].filter(Boolean).join(" ");
}

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

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

const TERMINAL_IN = `(${[...TERMINAL_LEAD_LIFECYCLE_STATES].join(",")})`;

/**
 * Load the smallest authoritative lead set for Focus membership.
 * Follow-up rules via filtered open-lifecycle query; tour window via
 * tour_appointments lead_ids — then union and re-apply exact membership.
 */
export async function loadFocusPopulationLeads(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  venueId: string,
  timezone: string | null,
  today: string,
  twoDaysAgoMs: number,
  twoWeeksOut: string,
): Promise<Lead[]> {
  const cutoffIso = new Date(twoDaysAgoMs).toISOString();
  const tourWindowStart = venueLocalToUtcIso(today, "00:00", timezone);
  const tourWindowEnd = venueLocalToUtcIso(addDaysIso(twoWeeksOut, 1), "00:00", timezone);

  const followUpOr = [
    `follow_up_date.lt.${today}`,
    `follow_up_date.eq.${today}`,
    `and(sales_stage.eq.new_inquiry,follow_up_date.is.null,created_at.lt.${cutoffIso})`,
  ].join(",");

  const [followUpRes, tourRes] = await Promise.all([
    supabase
      .from("leads")
      .select(LEAD_FOCUS_SELECT)
      .eq("venue_id", venueId)
      .not("sales_stage", "in", TERMINAL_IN)
      .or(followUpOr),
    supabase
      .from("tour_appointments")
      .select("lead_id")
      .eq("venue_id", venueId)
      .neq("status", "cancelled")
      .not("lead_id", "is", null)
      .gte("scheduled_at", tourWindowStart)
      .lt("scheduled_at", tourWindowEnd),
  ]);

  if (followUpRes.error) throw followUpRes.error;
  if (tourRes.error) throw tourRes.error;

  const byId = new Map<string, LeadRow>();
  for (const row of (followUpRes.data ?? []) as LeadRow[]) {
    byId.set(row.id, row);
  }

  const tourLeadIds = [
    ...new Set(
      ((tourRes.data ?? []) as { lead_id: string | null }[])
        .map((r) => r.lead_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ].filter((id) => !byId.has(id));

  if (tourLeadIds.length > 0) {
    const { data: tourLeads, error: tourLeadsError } = await supabase
      .from("leads")
      .select(LEAD_FOCUS_SELECT)
      .eq("venue_id", venueId)
      .in("id", tourLeadIds)
      .not("sales_stage", "in", TERMINAL_IN);
    if (tourLeadsError) throw tourLeadsError;
    for (const row of (tourLeads ?? []) as LeadRow[]) {
      byId.set(row.id, row);
    }
  }

  const rows = [...byId.values()];
  const leadTours = await getCurrentToursForLeads(
    supabase,
    venueId,
    rows.map((r) => r.id),
  );
  const leads = rows.map((r) => mapLead(r, leadTours.get(r.id) ?? EMPTY_TOUR));
  return leads.filter((l) =>
    leadBelongsInFocusPopulation(l, today, twoDaysAgoMs, twoWeeksOut),
  );
}

// ---- main service function --------------------------------------------------

export async function getDashboardData(): Promise<DashboardData | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await forensicTime("auth_venue_resolution", () => getCurrentVenue());
  if (!venue) return null;
  forensicSetVenue(venue.id);

  // Ready-gate and client creation are independent — run together.
  const [readyToInviteCouples, supabase] = await forensicTime("ready_gate_and_client", () =>
    Promise.all([
      isVenueReadyToInviteCouples(venue.id),
      createClient(),
    ]),
  );
  if (!readyToInviteCouples) return null;

  // Venue-local calendar day, not UTC. Today's Focus vs Upcoming partitions
  // on this string, so an Eastern venue checking the dashboard after 8pm
  // must still see "today" as today — not tomorrow, which is what a UTC
  // slice of Date.now() would report.
  const today = venueToday(venue.timezone);
  const twoDaysAgoMs = Date.now() - 48 * 60 * 60 * 1000;
  const twoWeeksOut = addDaysIso(today, 14);
  const comingUpOut = comingUpHorizonEnd(today);

  // Auto-mark overdue (non-fatal — must not block first paint)
  void supabase.rpc("mark_overdue_payments", { p_venue_id: venue.id });

  const emptyBriefing = {
    needsAttentionNow: [],
    comingUpThisWeek: [],
    resolvedSinceLastLooked: [],
    informational: [],
    generatedAt: new Date().toISOString(),
  };

  const [
    focusLeads,
    tasksRes,
    eventsRes,
    paymentsRes,
    staffRes,
    luvSettings,
    briefing,
  ] = await forensicTime("wave1_parallel_wall", () =>
    Promise.all([
      forensicTime("focus_population", () =>
        loadFocusPopulationLeads(supabase, venue.id, venue.timezone, today, twoDaysAgoMs, twoWeeksOut),
      ),
      forensicTime("tasks_query", () =>
        supabase
          .from("lead_tasks")
          .select("*, leads!inner(first_name, last_name)")
          .eq("venue_id", venue.id)
          .eq("completed", false)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true })
          .limit(15),
      ),
      // Coming up source: events table only — real event_date, next 30 days.
      forensicTime("events_query", () =>
        supabase
          .from("events")
          .select("id, name, event_date, start_time, status, guest_count, client_id, exclude_from_business_reporting, clients(first_name, last_name, partner_first_name, partner_last_name)")
          .eq("venue_id", venue.id)
          .neq("status", "cancelled")
          .gte("event_date", today)
          .lte("event_date", comingUpOut)
          .order("event_date", { ascending: true })
          .limit(8),
      ),
      // Payment line items for today's dated Focus — not Coming up.
      forensicTime("payments_query", () =>
        supabase
          .from("payment_line_items")
          .select("id, schedule_id, label, amount, due_date, status, payment_schedules(title, client_id, clients(first_name, last_name))")
          .eq("venue_id", venue.id)
          .in("status", ["pending", "overdue"])
          .not("due_date", "is", null)
          .order("due_date", { ascending: true })
          .limit(15),
      ),
      forensicTime("staff_query", () =>
        supabase
          .from("venue_staff")
          .select("full_name, title, accepted_at, owner_invite_pending, user_id")
          .eq("venue_id", venue.id)
          .eq("is_owner", true),
      ),
      forensicTime("luv_settings", () => getLuvSettings().catch(() => null)),
      forensicTime("get_focus_briefing", () =>
        getFocusNeedsAttentionBriefing(venue.id).catch(() => emptyBriefing),
      ),
    ]),
  );

  if (tasksRes.error) throw tasksRes.error;
  if (eventsRes.error) throw eventsRes.error;

  forensicCount("focus_leads", focusLeads.length);
  forensicCount("tasks_rows", (tasksRes.data ?? []).length);
  forensicCount("events_rows", (eventsRes.data ?? []).length);
  forensicCount("payments_rows", (paymentsRes.data ?? []).length);
  forensicCount("briefing_needs_attention", briefing.needsAttentionNow.length);

  const leads = focusLeads;

  // ---- Needs Attention -------------------------------------------------------
  const businessLeads = leads.filter((l) => !l.excludeFromBusinessReporting);
  const needsAttentionLeads = businessLeads.filter((l) => {
    const stage = l.salesStage ?? l.status;
    if (!isOpenLeadLifecycle(stage)) return false;
    if (l.followUpDate && l.followUpDate < today) return true;
    if (
      stage === "new_inquiry" &&
      !l.followUpDate &&
      new Date(l.createdAt).getTime() < twoDaysAgoMs
    ) {
      return true;
    }
    return false;
  });

  const needsAttention: AttentionLead[] = needsAttentionLeads
    .slice(0, 8)
    .map((l) => ({ ...l, reason: attentionReason(l, today) }));

  // ---- Follow-ups Due --------------------------------------------------------
  const followupsDueAll = businessLeads.filter(
    (l) => l.followUpDate === today && isOpenLeadLifecycle(l.salesStage ?? l.status),
  );
  const followupsDue = followupsDueAll.slice(0, 8);

  // ---- Upcoming Tours --------------------------------------------------------
  const upcomingTours = businessLeads
    .filter(
      (l) =>
        isOpenLeadLifecycle(l.salesStage ?? l.status) &&
        leadMatchesFocusTourRules(l, today, twoWeeksOut),
    )
    .sort((a, b) => (a.tourDate ?? "").localeCompare(b.tourDate ?? ""))
    .slice(0, 8);

  // ---- Tasks -----------------------------------------------------------------
  const openTasks: TaskItem[] = (tasksRes.data as DashTaskRow[]).map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    title: r.title,
    dueDate: r.due_date,
    leadName: embeddedName(r.leads),
  }));

  // ---- Upcoming events (from events table — canonical source) ---------------
  type DashEventRow = {
    id: string; name: string; event_date: string; start_time: string | null;
    status: string; guest_count: number | null; client_id: string | null;
    exclude_from_business_reporting?: boolean;
    clients: { first_name: string; last_name: string; partner_first_name: string | null; partner_last_name: string | null } | null;
  };
  const upcomingEvents: DashboardEvent[] = (eventsRes.data as unknown as DashEventRow[])
    .filter((r) => !r.exclude_from_business_reporting)
    .map((r) => {
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

  const ownerFirstName = resolveDashboardOwnerFirstName(
    (staffRes.data ?? []) as {
      full_name: string | null;
      title: string | null;
      accepted_at: string | null;
      owner_invite_pending: boolean | null;
      user_id: string | null;
    }[],
  );

  // Live L1 sources only — no broad observation engine, no insights compute,
  // no persisted-recommendation read. Contract/document families have no other
  // current-GET source after that removal and are therefore omitted (not
  // recreated). Setup-gap and readiness reuse the live calculations already
  // required for guided setup / readiness. Communication reuses its existing
  // observation calculation for the authorized L1 families.
  const [
    communicationObservationsRaw,
    dismissedObservationIds,
    activationScore,
    venueReadiness,
    nextPendingMilestone,
  ] = await forensicTime("wave2_parallel_wall", () =>
    Promise.all([
      forensicTime("get_communication_observations", () =>
        getCommunicationObservations(supabase, venue.id).catch(() => []),
      ),
      forensicTime("dismissed_observation_ids", () =>
        getDismissedObservationIds().catch(() => new Set<string>()),
      ),
      forensicTime("activation_score", () => getActivationScore(venue.id).catch(() => null)),
      forensicTime("load_venue_readiness", () => loadVenueReadiness().catch(() => null)),
      forensicTime("next_pending_milestone", () =>
        getNextPendingMilestone(venue.id).catch(() => null),
      ),
    ]),
  );

  const communicationObservations = communicationObservationsRaw.filter((obs) =>
    obs.id === "comm-all-delivered" ||
    obs.id === "comm-recent-failures" ||
    obs.id.startsWith("comm-stale-unopened-"),
  );
  forensicCount("communication_observations", communicationObservations.length);
  forensicCount("dismissed_ids", dismissedObservationIds.size);

  const setupGapObservations = activationScore ? computeSetupGapObservations(activationScore.checklist) : [];
  const readinessObservations = venueReadiness ? readinessDashboardObservations(venueReadiness) : [];
  const observationsOn = luvSettings?.observationsEnabled !== false;
  // Preserve existing remaining-source order: communication, then setup-gap,
  // then readiness. First eligible live L1 candidate still wins.
  const luvObservations = observationsOn
    ? filterVisibleObservations(
        [...communicationObservations, ...setupGapObservations, ...readinessObservations],
        dismissedObservationIds,
      )
    : [];
  const insightObservations: typeof luvObservations = [];
  const recommendations: import("@/lib/luv/recommendation-types").VenueRecommendation[] = [];

  forensicCount("setup_gap_observations", setupGapObservations.length);
  forensicCount("readiness_observations", readinessObservations.length);
  forensicCount("luv_observations_visible", luvObservations.length);
  forensicCount("insight_observations_visible", insightObservations.length);

  return {
    venueName: venue.name,
    ownerFirstName,
    todayIso: today,
    onboarding: await forensicTime("guided_setup_checklist", () =>
      buildGuidedSetupChecklist(venue, activationScore, readyToInviteCouples),
    ),
    briefing,
    needsAttention,
    followupsDue,
    upcomingTours,
    // Unused by current Dashboard page — keep type shape without venue-wide work.
    pipelineStages: [],
    totalLeads: 0,
    activeLeadCount: 0,
    newLeadCount: 0,
    openTasks,
    openTaskCount: (tasksRes.data as DashTaskRow[]).length,
    recentActivity: [],
    overduePayments,
    upcomingPayments,
    upcomingEvents,
    upcomingEventCount: upcomingEvents.length,
    clientListCounts: EMPTY_CLIENT_COUNTS,
    luvObservations,
    trendObservations: [],
    storyObservation: null,
    memoryObservations: [],
    insightObservations,
    healthScore: null,
    recommendations,
    actionObservations: [],
    pendingActionObservations: [],
    performanceObservations: [],
    momentumSegments: { heatingUp: [], coolingOff: [] },
    activationScore,
    nextPendingMilestone,
    luvObservationsEnabled: observationsOn,
    showLuvIntro: !venue.luvIntroSeenAt && (
      activationScore?.phase === "setup" ||
      Date.now() - new Date(venue.createdAt).getTime() < 14 * 86_400_000
    ),
  };
}

/**
 * Presentation layer over the Activation Engine's own checklist.
 * Articles are loaded only when the checklist card would actually show.
 */
async function buildGuidedSetupChecklist(venue: Venue, activationScore: ActivationScore | null, readyToInviteCouples: boolean): Promise<OnboardingStatus> {
  void readyToInviteCouples;
  const items = activationScore?.checklist ?? [];

  // Continuous Setup Experience: this card stays hidden (show: false).
  // Skip Success Library I/O when the UI will not render the checklist.
  const show = false;
  const incompleteKeys = items.filter((i) => !i.completed).map((i) => i.key);
  let articlesByGapKey = new Map<string, { title: string; slug: string }>();
  if (show && incompleteKeys.length > 0) {
    const { getArticlesForGapKeys } = await import("@/lib/success-library/service");
    articlesByGapKey = await getArticlesForGapKeys(incompleteKeys).catch(() => new Map());
  }

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
  const topGapItem = [...items].filter((i) => !i.completed).sort((a, b) => b.points - a.points)[0];
  const luvNudge = topGapItem ? (GAP_COPY[topGapItem.key]?.description ?? topGapItem.label) : null;

  return {
    show,
    steps,
    completedCount,
    totalSteps: steps.length,
    luvNudge,
  };
}

/** Exported for Focus membership loaders / tests. */
export { leadBelongsInFocusPopulation, leadMatchesFocusTourRules };
