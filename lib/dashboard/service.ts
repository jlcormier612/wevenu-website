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
import { refreshLeadScores } from "@/lib/leads/scores";
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
    commitmentScore: 0, scoresUpdatedAt: null, sourceData: null,
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

  // Refresh lead commitment scores (non-blocking — runs in background)
  void refreshLeadScores(supabase, venue.id).catch(() => {});

  // Luv observations — run after primary data (non-blocking; returns [] on error)
  const luvSettings = await getLuvSettings().catch(() => null);
  const luvObservations = await getLuvObservations(supabase, venue.id, today, luvSettings ?? undefined).catch(() => []);

  return {
    venueName: venue.name,
    ownerFirstName,
    todayIso: today,
    onboarding: computeOnboarding(venue, leads),
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
  };
}

// ---- Getting Started onboarding ---------------------------------------------

/**
 * Derives the onboarding checklist state entirely from existing venue + lead
 * data. No separate progress table — the DB is always the source of truth.
 */
function computeOnboarding(venue: Venue, leads: Lead[]): OnboardingStatus {
  const steps: OnboardingStep[] = [
    {
      id: "venue_setup",
      title: "Set up your venue",
      description: "Your venue profile is live and ready.",
      completed: true, // Always true — they're past Setup
    },
    {
      id: "first_inquiry",
      title: "Create your first inquiry",
      description:
        "Add a lead to start building your pipeline and tracking inquiries.",
      completed: leads.length > 0,
      ctaLabel: "New Inquiry",
      ctaHref: "/leads/new",
    },
    {
      id: "work_lead",
      title: "Set a next action on a lead",
      description:
        "Open a lead and add a follow-up date or next action to keep momentum.",
      completed: leads.some(
        (l) =>
          l.followUpDate != null ||
          l.nextActionText != null ||
          l.status !== "new",
      ),
      ctaLabel: "View Leads",
      ctaHref: "/leads",
    },
    {
      id: "schedule_tour",
      title: "Schedule a venue tour",
      description:
        "Tours are the key step between an initial inquiry and a confirmed booking.",
      completed: leads.some((l) => l.tourDate != null),
      ctaLabel: "View Leads",
      ctaHref: "/leads",
    },
    {
      id: "first_booking",
      title: "Book your first couple",
      description:
        "Mark a lead as Won to record your first confirmed booking.",
      completed: leads.some((l) => l.status === "won"),
      ctaLabel: "View Leads",
      ctaHref: "/leads",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;

  return {
    show: !venue.onboardingDismissed && !allComplete,
    steps,
    completedCount,
    totalSteps: steps.length,
    allComplete,
  };
}
