/**
 * computeEventReadiness — Luv's Planning Progress engine.
 *
 * Derives the readiness of a client's event entirely from existing data.
 * No AI. No new infrastructure. Just thoughtful orchestration of records
 * that already exist in the platform.
 *
 * "Luv doesn't create work. She reveals work that already exists."
 */

import { createClient } from "@/integrations/supabase/server";

type ReadinessStatus = "complete" | "incomplete" | "warning";

export type ReadinessItem = {
  key: string;
  label: string;
  status: ReadinessStatus;
  detail: string | null;
  actionLabel: string | null;
  actionLink: string | null;
};

export type EventReadiness = {
  eventId: string;
  eventName: string;
  eventDate: string;
  daysUntil: number;
  score: number;          // 0–100, computed from item statuses
  completedCount: number;
  totalCount: number;
  items: ReadinessItem[];
};

type DbClient = Awaited<ReturnType<typeof createClient>>;

function daysUntilDate(iso: string): number {
  const d = new Date(iso + "T12:00:00");
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function expiryStatus(iso: string): "ok" | "soon" | "expired" {
  const days = daysUntilDate(iso);
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "ok";
}

export async function computeEventReadiness(
  supabase: DbClient,
  venueId: string,
  clientId: string,
): Promise<EventReadiness | null> {
  // Find the client's upcoming (non-cancelled) event
  const { data: events } = await supabase.from("events")
    .select("id, name, event_date, status")
    .eq("venue_id", venueId)
    .eq("client_id", clientId)
    .not("status", "in", "(cancelled,complete)")
    .order("event_date", { ascending: true })
    .limit(1);

  const event = events?.[0] as { id: string; name: string; event_date: string; status: string } | undefined;
  if (!event) return null;

  const daysUntil = daysUntilDate(event.event_date);

  // Run all readiness checks in parallel
  const [
    contractRes,
    timelineRes,
    floorPlanRes,
    vendorsRes,
    paymentSchedulesRes,
    docsRes,
    questionnaireRes,
  ] = await Promise.all([
    // Contract: is there a signed contract for this client?
    supabase.from("contracts").select("id, status")
      .eq("venue_id", venueId).eq("client_id", clientId)
      .limit(1),

    // Timeline: does the event have timeline entries?
    supabase.from("timeline_entries").select("id")
      .eq("venue_id", venueId).eq("event_id", event.id)
      .limit(1),

    // Floor plan: does the event have a floor plan?
    supabase.from("floor_plans").select("id")
      .eq("venue_id", venueId).eq("event_id", event.id)
      .limit(1),

    // Vendors: are vendors assigned to this event?
    supabase.from("event_vendor_assignments").select("id")
      .eq("venue_id", venueId).eq("event_id", event.id)
      .limit(1),

    // Payment schedules: for overdue check
    supabase.from("payment_schedules").select("id")
      .eq("venue_id", venueId).eq("client_id", clientId),

    // Documents: any expiring docs for this client or event?
    supabase.from("documents").select("id, name, expires_at")
      .eq("venue_id", venueId)
      .or(`client_id.eq.${clientId},event_id.eq.${event.id}`)
      .not("expires_at", "is", null)
      .lte("expires_at", new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)),

    // Questionnaire: has the final details form been submitted?
    supabase.from("event_questionnaires").select("status")
      .eq("venue_id", venueId).eq("event_id", event.id).maybeSingle<{ status: string }>(),
  ]);

  // Payment line items (overdue check) — needs schedule IDs from above
  const scheduleIds = (paymentSchedulesRes.data ?? []).map((s: { id: string }) => s.id);
  let overdueCount = 0;
  let pendingCount = 0;
  if (scheduleIds.length > 0) {
    const { data: lineItems } = await supabase.from("payment_line_items")
      .select("status").in("schedule_id", scheduleIds);
    overdueCount = (lineItems ?? []).filter((i: { status: string }) => i.status === "overdue").length;
    pendingCount = (lineItems ?? []).filter((i: { status: string }) => i.status === "pending").length;
  }

  const contract = contractRes.data?.[0] as { id: string; status: string } | undefined;
  const questionnaireStatus = questionnaireRes.data?.status ?? null;
  const hasTimeline = (timelineRes.data?.length ?? 0) > 0;
  const hasFloorPlan = (floorPlanRes.data?.length ?? 0) > 0;
  const hasVendors = (vendorsRes.data?.length ?? 0) > 0;
  const expiringDocs = (docsRes.data ?? []) as { id: string; name: string; expires_at: string }[];

  // Build the checklist
  const items: ReadinessItem[] = [
    {
      key: "contract",
      label: "Contract signed",
      status: contract?.status === "signed" ? "complete"
              : contract ? "warning"   // exists but not signed
              : "incomplete",
      detail: contract?.status === "sent" ? "Awaiting signature" : null,
      actionLabel: !contract || contract.status !== "signed" ? "Review contract" : null,
      actionLink: "/contracts",
    },
    {
      key: "deposit",
      label: "Deposit received",
      status: scheduleIds.length === 0 ? "incomplete"
              : pendingCount + overdueCount === 0 ? "complete"
              : overdueCount > 0 ? "warning"
              : "incomplete",
      detail: overdueCount > 0 ? `${overdueCount} overdue payment${overdueCount !== 1 ? "s" : ""}` : null,
      actionLabel: overdueCount > 0 || pendingCount > 0 ? "View payment schedule" : null,
      actionLink: scheduleIds.length > 0 ? `/payments/${scheduleIds[0]}` : "/payments",
    },
    {
      key: "timeline",
      label: "Day-of timeline created",
      status: hasTimeline ? "complete" : "incomplete",
      detail: null,
      actionLabel: !hasTimeline ? "Build the timeline" : null,
      actionLink: `/events/${event.id}`,
    },
    {
      key: "floor_plan",
      label: "Floor plan created",
      status: hasFloorPlan ? "complete" : "incomplete",
      detail: null,
      actionLabel: !hasFloorPlan ? "Create a floor plan" : null,
      actionLink: `/events/${event.id}#floorplan`,
    },
    {
      key: "vendors",
      label: "Vendor roster assigned",
      status: hasVendors ? "complete" : "incomplete",
      detail: null,
      actionLabel: !hasVendors ? "Assign vendors" : null,
      actionLink: `/events/${event.id}`,
    },
    {
      key: "payments",
      label: "Payments current",
      status: overdueCount > 0 ? "warning"
              : pendingCount > 0 ? "incomplete"
              : scheduleIds.length === 0 ? "incomplete"
              : "complete",
      detail: overdueCount > 0 ? `${overdueCount} overdue` : pendingCount > 0 ? `${pendingCount} upcoming` : null,
      actionLabel: overdueCount > 0 ? "Send payment reminder" : null,
      actionLink: scheduleIds.length > 0 ? `/payments/${scheduleIds[0]}` : "/payments",
    },
    {
      key: "questionnaire",
      label: "Final details submitted",
      status: questionnaireStatus === "submitted" || questionnaireStatus === "reviewed" ? "complete" : "incomplete",
      detail: null,
      actionLabel: !questionnaireStatus ? "Fill out final details" : null,
      actionLink: `/events/${event.id}`,
    },
    {
      key: "documents",
      label: "Documents current",
      status: expiringDocs.some((d) => expiryStatus(d.expires_at) === "expired") ? "warning"
              : expiringDocs.some((d) => expiryStatus(d.expires_at) === "soon") ? "warning"
              : "complete",
      detail: expiringDocs.length > 0
        ? expiringDocs[0].expires_at < new Date().toISOString().slice(0, 10)
          ? `${expiringDocs[0].name} has expired`
          : `${expiringDocs[0].name} expires soon`
        : null,
      actionLabel: expiringDocs.length > 0 ? "Review documents" : null,
      actionLink: `/clients/${clientId}`,
    },
  ];

  // Score: complete = 1 point, warning = 0.5 points, incomplete = 0
  const totalCount = items.length;  // now 8 items
  const rawScore = items.reduce((sum, item) => {
    if (item.status === "complete") return sum + 1;
    if (item.status === "warning") return sum + 0.5;
    return sum;
  }, 0);
  const completedCount = items.filter((i) => i.status === "complete").length;
  const score = Math.round((rawScore / totalCount) * 100);

  return {
    eventId: event.id,
    eventName: event.name,
    eventDate: event.event_date,
    daysUntil,
    score,
    completedCount,
    totalCount,
    items,
  };
}
