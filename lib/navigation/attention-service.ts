/**
 * Server fetch for navigation attention badge counts.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  countPastDueStaffTasks,
  countPaymentAttention,
  countUnseenLeads,
  countUnseenTours,
  emptyNavAttentionCounts,
  type NavAttentionCounts,
  type PaymentAttentionSchedule,
  type TaskAttentionRow,
} from "@/lib/navigation/attention";
import { getAllLineItems, getSchedules } from "@/lib/payments/repository";
import { getCurrentStaffMember } from "@/lib/team/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { venueToday } from "@/lib/venue/timezone";

export async function getNavAttentionCounts(): Promise<NavAttentionCounts> {
  if (!isSupabaseConfigured) return emptyNavAttentionCounts();
  const venue = await getCurrentVenue();
  if (!venue) return emptyNavAttentionCounts();

  const supabase = await createClient();
  const staff = await getCurrentStaffMember(venue.id);
  const staffId = staff?.id ?? null;
  const today = venueToday(venue.timezone);

  const [
    unreadRes,
    leadsRes,
    toursRes,
    protectionRes,
    eventTasksRes,
    leadTasksRes,
    schedules,
    lineItems,
  ] = await Promise.all([
    supabase.rpc("get_conversation_unread_count"),
    supabase
      .from("leads")
      .select("venue_seen_at, sales_stage")
      .eq("venue_id", venue.id),
    supabase
      .from("tour_appointments")
      .select("venue_seen_at, status")
      .eq("venue_id", venue.id),
    supabase
      .from("tour_protection_requests")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id)
      .eq("status", "paid_unbooked"),
    supabase
      .from("event_tasks")
      .select("status, due_date, assigned_to_staff_id")
      .eq("venue_id", venue.id)
      .in("status", ["pending", "overdue", "blocked"]),
    supabase
      .from("lead_tasks")
      .select("due_date, completed, assigned_to_staff_id")
      .eq("venue_id", venue.id)
      .eq("completed", false),
    getSchedules(supabase, venue.id),
    getAllLineItems(supabase, venue.id),
  ]);

  const unreadPayload = unreadRes.data as { count?: number } | null;
  const inbox = Number(unreadPayload?.count ?? 0) || 0;

  const leads = countUnseenLeads(
    ((leadsRes.data ?? []) as { venue_seen_at: string | null; sales_stage: string | null }[]).map(
      (r) => ({ venueSeenAt: r.venue_seen_at, salesStage: r.sales_stage }),
    ),
  );

  const tours = countUnseenTours(
    ((toursRes.data ?? []) as { venue_seen_at: string | null; status: string }[]).map((r) => ({
      venueSeenAt: r.venue_seen_at,
      status: r.status,
    })),
    protectionRes.count ?? 0,
  );

  const eventTaskRows: TaskAttentionRow[] = (
    (eventTasksRes.data ?? []) as {
      status: string;
      due_date: string | null;
      assigned_to_staff_id: string | null;
    }[]
  ).map((r) => ({
    status: r.status,
    dueDate: r.due_date,
    assignedToStaffId: r.assigned_to_staff_id,
  }));

  const leadTaskRows: TaskAttentionRow[] = (
    (leadTasksRes.data ?? []) as {
      due_date: string | null;
      completed: boolean;
      assigned_to_staff_id: string | null;
    }[]
  ).map((r) => ({
    status: "pending",
    dueDate: r.due_date,
    assignedToStaffId: r.assigned_to_staff_id,
    completed: r.completed,
  }));

  const tasks = countPastDueStaffTasks([...eventTaskRows, ...leadTaskRows], staffId, today);

  const paymentSchedules: PaymentAttentionSchedule[] = schedules.map((s) => ({
    excludeFromBusinessReporting: s.excludeFromBusinessReporting,
    lineItems: lineItems.filter((i) => i.scheduleId === s.id),
  }));
  const payments = countPaymentAttention(paymentSchedules);

  return { leads, tours, inbox, tasks, payments };
}

export async function markLeadVenueSeen(leadId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({ venue_seen_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("venue_id", venue.id)
    .is("venue_seen_at", null);
}

export async function markVenueToursSeen(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase
    .from("tour_appointments")
    .update({ venue_seen_at: now })
    .eq("venue_id", venue.id)
    .is("venue_seen_at", null);
}
