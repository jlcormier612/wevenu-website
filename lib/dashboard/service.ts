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
import { getLuvSettings } from "@/lib/luv/settings";
import { refreshAllLeadScores, generateMomentumLanguage, getMomentumTier } from "@/lib/leads/scores";
import { LEAD_STATUSES } from "@/lib/leads/constants";
import type { Lead } from "@/lib/leads/types";
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
  tour_date: string | null; tour_time: string | null;
  tour_completed: boolean; tour_notes: string | null;
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

function mapLead(r: LeadRow): Lead {
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
    tourDate: r.tour_date, tourTime: r.tour_time,
    tourCompleted: r.tour_completed, tourNotes: r.tour_notes,
    commitmentScore: 0, responsivenessScore: 0, interestScore: 0, scoresUpdatedAt: null, sourceData: null,
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
  if (!venue?.setupCompleted) return null;
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);
  const twoDaysAgoMs = Date.now() - 48 * 60 * 60 * 1000;
  const twoWeeksOut = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const sixtyDaysOut = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

  // Auto-mark overdue payments for this venue before the dashboard loads
  // Auto-mark overdue (non-fatal — don't block dashboard load on failure)
  void supabase.rpc("mark_overdue_payments", { p_venue_id: venue.id });

  const [leadsRes, tasksRes, activityRes, clientsRes, keyDatesRes, eventsRes, paymentsRes, staffRes, guideRes, vendorRes, playbookRes] = await Promise.all([
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

    // Onboarding signals — non-fatal; any error = not complete
    supabase.from("venue_operational_info").select("venue_id").eq("venue_id", venue.id).maybeSingle<{ venue_id: string }>(),
    supabase.from("vendors").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
    supabase.from("playbook_templates").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
  ]);

  if (leadsRes.error) throw leadsRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (activityRes.error) throw activityRes.error;
  if (clientsRes.error) throw clientsRes.error;
  if (keyDatesRes.error) throw keyDatesRes.error;
  if (eventsRes.error) throw eventsRes.error;
  // payments error is non-fatal for the dashboard

  const leads = (leadsRes.data as LeadRow[]).map(mapLead);

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

  // Luv observations — run after primary data (non-blocking; returns [] on error)
  const luvSettings = await getLuvSettings().catch(() => null);
  const luvObservations = await getLuvObservations(supabase, venue.id, today, luvSettings ?? undefined).catch(() => []);

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
    onboarding: computeOnboarding(venue, leads, {
      hasGuideContent: !!(guideRes.data),
      vendorCount: vendorRes.count ?? 0,
      playbookCount: playbookRes.count ?? 0,
      weeklyInquiries: leads.filter((l) => l.createdAt >= new Date(Date.now() - 7 * 86400000).toISOString()).length,
      upcomingTourCount: upcomingTours.length,
      openTaskCount: openTasks.length,
    }),
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
    momentumSegments: { heatingUp, coolingOff },
  };
}

// ---- Getting Started onboarding ---------------------------------------------

type OnboardingSignals = {
  hasGuideContent: boolean;
  vendorCount: number;
  playbookCount: number;
  weeklyInquiries: number;
  upcomingTourCount: number;
  openTaskCount: number;
};

const NUDGE_TEXT: Record<string, string> = {
  profile_complete:  "Fill in your venue address, phone, and email. Couples and coordinators need this before anything else.",
  tour_scheduling:   "Enabling tour scheduling turns your venue page into a 24/7 booking engine — couples book themselves while you sleep.",
  venue_guide:       "Your Venue Guide is the #1 resource couples share with their families. Ten minutes here saves fifty future emails.",
  preferred_vendors: "Add your preferred vendors. Couples ask about photographers and caterers before almost anything else.",
  task_playbook:     "Create your first Task Playbook to automate your event workflow — it saves hours on every booking you make.",
  first_inquiry:     "Add your first lead to start building your pipeline and tracking inquiries.",
};

/** Derives onboarding state from existing venue, leads, and lightweight counts — no separate progress table. */
function computeOnboarding(venue: Venue, leads: Lead[], signals: OnboardingSignals): OnboardingStatus {
  const profileFilled = !!(venue.addressLine1?.trim() && venue.phone?.trim() && venue.email?.trim());

  const steps: OnboardingStep[] = [
    {
      id: "setup_complete",
      title: "Create your venue",
      description: "Your venue workspace is live.",
      completed: true,
    },
    {
      id: "profile_complete",
      title: "Fill in your venue profile",
      description: "Add your address, phone, and email so couples can reach you.",
      completed: profileFilled,
      timeEstimate: "1 min",
      ctaLabel: "Complete Profile",
      ctaHref: "/settings",
    },
    {
      id: "tour_scheduling",
      title: "Enable tour scheduling",
      description: "Let couples book a venue tour directly from your website — 24/7, no back-and-forth.",
      completed: venue.tourSchedulingEnabled,
      timeEstimate: "2 min",
      ctaLabel: "Set Up Tours",
      ctaHref: "/settings",
    },
    {
      id: "venue_guide",
      title: "Start your Venue Guide",
      description: "Parking, hotels, policies, FAQs — the questions couples will ask you a hundred times.",
      completed: signals.hasGuideContent,
      timeEstimate: "10 min",
      ctaLabel: "Open Guide",
      ctaHref: "/guide",
    },
    {
      id: "preferred_vendors",
      title: "Add preferred vendors",
      description: "Share your trusted caterers, photographers, and florists so couples have a starting point.",
      completed: signals.vendorCount > 0,
      timeEstimate: "5 min",
      ctaLabel: "Add Vendors",
      ctaHref: "/vendors",
    },
    {
      id: "task_playbook",
      title: "Create a Task Playbook",
      description: "Build a reusable workflow template that auto-assigns tasks to every new event.",
      completed: signals.playbookCount > 0,
      timeEstimate: "5 min",
      ctaLabel: "Create Playbook",
      ctaHref: "/library/playbooks",
    },
    {
      id: "first_inquiry",
      title: "Receive your first inquiry",
      description: "Add a lead to start building your pipeline.",
      completed: leads.length > 0,
      ctaLabel: "New Inquiry",
      ctaHref: "/leads/new",
    },
    {
      id: "first_booking",
      title: "Book your first couple",
      description: "Mark a lead as Won to record your first confirmed booking.",
      completed: leads.some((l) => l.status === "won"),
      ctaLabel: "View Leads",
      ctaHref: "/leads",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;

  // Priority order: get the profile right first, then open the revenue engine
  const NUDGE_PRIORITY = ["profile_complete", "tour_scheduling", "venue_guide", "preferred_vendors", "task_playbook", "first_inquiry"];
  const nudgeId = NUDGE_PRIORITY.find((id) => steps.find((s) => s.id === id && !s.completed));
  const luvNudge = nudgeId ? (NUDGE_TEXT[nudgeId] ?? null) : null;

  return {
    // Show the checklist while not dismissed; always show the graduation card when complete
    show: allComplete || !venue.onboardingDismissed,
    steps,
    completedCount,
    totalSteps: steps.length,
    allComplete,
    luvNudge,
    summary: allComplete
      ? { weeklyInquiries: signals.weeklyInquiries, upcomingTourCount: signals.upcomingTourCount, openTaskCount: signals.openTaskCount }
      : null,
  };
}
