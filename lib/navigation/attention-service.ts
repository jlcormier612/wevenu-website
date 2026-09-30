/**
 * Server fetch for navigation attention badge counts.
 *
 * Counts only — never load full contract bodies, full payment catalogs,
 * or unscoped task lists merely to compute badges.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  countPastDueStaffTasks,
  countUnseenLeads,
  emptyNavAttentionCounts,
  type NavAttentionCounts,
  type TaskAttentionRow,
} from "@/lib/navigation/attention";
import {
  countVenueActionRequiredContracts,
  rollupContractsToCurrentAgreements,
} from "@/lib/contracts/list-filters";
import type { Contract } from "@/lib/contracts/types";
import { getCurrentStaffMember } from "@/lib/team/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { venueToday } from "@/lib/venue/timezone";
import { TERMINAL_LEAD_LIFECYCLE_STATES } from "@/lib/leads/open-lifecycle";

const TERMINAL_SALES = [...TERMINAL_LEAD_LIFECYCLE_STATES].join(",");
const TOUR_INACTIVE = "cancelled,completed,no_show";

type SignerProgressRow = {
  contract_id: string;
  signer_type: string;
  signed_at: string | null;
  is_required: boolean;
};

type SlimContractRow = {
  id: string;
  status: Contract["status"];
  expires_at: string | null;
  created_at: string;
  amends_contract_id: string | null;
  title: string;
};

/**
 * Same action-required population as full contract list rollup + count, without
 * selecting contract.content or client/event joins.
 */
async function countActionRequiredContracts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, status, expires_at, created_at, amends_contract_id, title")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as SlimContractRow[];
  if (rows.length === 0) return 0;

  const { data: signerRows, error: sErr } = await supabase
    .from("contract_signers")
    .select("contract_id, signer_type, signed_at, is_required")
    .eq("venue_id", venueId)
    .in(
      "contract_id",
      rows.map((c) => c.id),
    );
  if (sErr) throw sErr;

  const byContract = new Map<string, SignerProgressRow[]>();
  for (const row of (signerRows ?? []) as SignerProgressRow[]) {
    const list = byContract.get(row.contract_id) ?? [];
    list.push(row);
    byContract.set(row.contract_id, list);
  }

  const contracts: Contract[] = rows.map((r) => {
    const signers = byContract.get(r.id) ?? [];
    const venueSigned = signers.some((s) => s.signer_type === "venue" && s.signed_at != null);
    const requiredClients = signers.filter((s) => s.signer_type === "client" && s.is_required);
    const requiredClientTotal =
      requiredClients.length || (r.status === "sent" || r.status === "signed" ? 1 : 0);
    const requiredClientSigned = requiredClients.filter((s) => s.signed_at != null).length;
    return {
      id: r.id,
      venueId,
      clientId: null,
      eventId: null,
      templateId: null,
      title: r.title,
      content: "",
      status: r.status,
      executionOrigin: "htc",
      signToken: "",
      signerName: null,
      signedAt: null,
      sentAt: null,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      updatedAt: r.created_at,
      amendsContractId: r.amends_contract_id,
      brandingSnapshot: null,
      clientName: null,
      clientEmail: null,
      eventDate: null,
      venueSigned,
      requiredClientTotal,
      requiredClientSigned,
    };
  });

  return countVenueActionRequiredContracts(rollupContractsToCurrentAgreements(contracts));
}

/**
 * Same attention schedules as the prior getSchedules+all-line-items path:
 * schedules with any overdue/refunded/partially_refunded line, excluding
 * exclude_from_business_reporting clients.
 */
async function countPaymentAttentionSchedules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
): Promise<number> {
  const [{ data: items, error: iErr }, { data: excluded, error: eErr }] = await Promise.all([
    supabase
      .from("payment_line_items")
      .select("schedule_id")
      .eq("venue_id", venueId)
      .in("status", ["overdue", "refunded", "partially_refunded"]),
    supabase
      .from("payment_schedules")
      .select("id, clients!inner(exclude_from_business_reporting)")
      .eq("venue_id", venueId)
      .eq("clients.exclude_from_business_reporting", true),
  ]);
  if (iErr) throw iErr;
  if (eErr) throw eErr;

  const excludedIds = new Set(
    ((excluded ?? []) as { id: string }[]).map((s) => s.id),
  );
  const scheduleIds = new Set<string>();
  for (const row of (items ?? []) as { schedule_id: string }[]) {
    if (excludedIds.has(row.schedule_id)) continue;
    scheduleIds.add(row.schedule_id);
  }
  return scheduleIds.size;
}

export async function getNavAttentionCounts(): Promise<NavAttentionCounts> {
  if (!isSupabaseConfigured) return emptyNavAttentionCounts();
  const venue = await getCurrentVenue();
  if (!venue) return emptyNavAttentionCounts();

  const supabase = await createClient();
  const staff = await getCurrentStaffMember(venue.id);
  const staffId = staff?.id ?? null;
  const today = venueToday(venue.timezone);

  const taskQueries = staffId
    ? ([
        supabase
          .from("event_tasks")
          .select("status, due_date, assigned_to_staff_id")
          .eq("venue_id", venue.id)
          .eq("assigned_to_staff_id", staffId)
          .in("status", ["pending", "overdue", "blocked"])
          .or(`due_date.lt.${today},status.eq.overdue`),
        supabase
          .from("lead_tasks")
          .select("due_date, completed, assigned_to_staff_id, leads!inner(id)")
          .eq("venue_id", venue.id)
          .eq("assigned_to_staff_id", staffId)
          .eq("completed", false)
          .lt("due_date", today),
      ] as const)
    : null;

  const [
    unreadRes,
    leadsRes,
    toursRes,
    protectionRes,
    payments,
    contractsCount,
    eventTasksRes,
    leadTasksRes,
  ] = await Promise.all([
    supabase.rpc("get_conversation_unread_count"),
    // Slim columns only — same unseen-open semantics as countUnseenLeads.
    supabase
      .from("leads")
      .select("venue_seen_at, sales_stage")
      .eq("venue_id", venue.id)
      .is("venue_seen_at", null)
      .or(`sales_stage.is.null,sales_stage.not.in.(${TERMINAL_SALES})`),
    supabase
      .from("tour_appointments")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id)
      .is("venue_seen_at", null)
      .not("status", "in", `(${TOUR_INACTIVE})`),
    supabase
      .from("tour_protection_requests")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venue.id)
      .eq("status", "paid_unbooked"),
    countPaymentAttentionSchedules(supabase, venue.id),
    countActionRequiredContracts(supabase, venue.id),
    taskQueries ? taskQueries[0] : Promise.resolve({ data: [] as unknown[], error: null }),
    taskQueries ? taskQueries[1] : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);

  const unreadPayload = unreadRes.data as { count?: number } | null;
  const inbox = Number(unreadPayload?.count ?? 0) || 0;

  const leads = countUnseenLeads(
    ((leadsRes.data ?? []) as { venue_seen_at: string | null; sales_stage: string | null }[]).map(
      (r) => ({ venueSeenAt: r.venue_seen_at, salesStage: r.sales_stage }),
    ),
  );

  const tours = (toursRes.count ?? 0) + (protectionRes.count ?? 0);

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

  // Filters already scoped to staff + past-due at query time; keep pure helper
  // as the semantic authority (handles overdue status / completed edge cases).
  const tasks = countPastDueStaffTasks([...eventTaskRows, ...leadTaskRows], staffId, today);

  return { leads, tours, inbox, tasks, payments, contracts: contractsCount };
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
