/**
 * Batch Booking Journey stage keys for Inbox list filters.
 * Uses the same stage rules as buildBookingJourney — does not invent a second model.
 * Loads shared inputs in bulk to avoid per-row getContracts / N+1.
 */
import { createClient } from "@/integrations/supabase/server";
import {
  buildBookingJourney,
  type JourneyContract,
  type JourneyPaymentLine,
  type JourneyStageKey,
} from "@/lib/booking-journey/model";
import { pickContract } from "@/lib/clients/booking-handoff";
import type { ConversationSummary } from "@/lib/conversations/types";
import type { CommercialSelection } from "@/lib/commercial-selections/types";

type SelectionRow = {
  id: string;
  venue_id: string;
  lead_id: string | null;
  client_id: string | null;
  event_id: string | null;
  name: string;
  status: string;
  total_amount: number;
  deposit_amount: number;
  invoice_id: string | null;
};

function mapSelection(row: SelectionRow): CommercialSelection {
  return {
    id: row.id,
    venueId: row.venue_id,
    leadId: row.lead_id,
    clientId: row.client_id,
    eventId: row.event_id,
    sourcePackageId: null,
    name: row.name,
    totalAmount: Number(row.total_amount),
    depositAmount: Number(row.deposit_amount),
    includedItems: [],
    status: row.status as CommercialSelection["status"],
    version: 1,
    supersededById: null,
    offeredAt: null,
    acceptedAt: null,
    acceptToken: null,
    offerMessage: null,
    invoiceId: row.invoice_id,
    contractId: null,
    createdAt: "",
    updatedAt: "",
  };
}

export async function enrichInboxBookingStages(
  conversations: ConversationSummary[],
): Promise<ConversationSummary[]> {
  if (conversations.length === 0) return conversations;
  const client = await createClient();

  const leadIds = [...new Set(conversations.map((c) => c.leadId).filter(Boolean) as string[])];
  const clientIds = [...new Set(conversations.map((c) => c.clientId).filter(Boolean) as string[])];

  const [leadSelectionsRes, clientSelectionsRes, contractsRes, linesRes, invitationsRes, appsRes] = await Promise.all([
    leadIds.length
      ? client.from("commercial_selections")
          .select("id, venue_id, lead_id, client_id, event_id, name, status, total_amount, deposit_amount, invoice_id")
          .in("lead_id", leadIds)
          .neq("status", "superseded")
      : Promise.resolve({ data: [] as SelectionRow[] }),
    clientIds.length
      ? client.from("commercial_selections")
          .select("id, venue_id, lead_id, client_id, event_id, name, status, total_amount, deposit_amount, invoice_id")
          .in("client_id", clientIds)
          .neq("status", "superseded")
      : Promise.resolve({ data: [] as SelectionRow[] }),
    clientIds.length
      ? client.from("contracts").select("id, client_id, status").in("client_id", clientIds)
      : Promise.resolve({ data: [] as { id: string; client_id: string; status: string }[] }),
    clientIds.length
      ? client.from("payment_line_items")
          .select("obligation_kind, status, amount, payment_schedules!inner(client_id)")
          .in("payment_schedules.client_id", clientIds)
      : Promise.resolve({ data: [] as unknown[] }),
    clientIds.length
      ? client.from("client_invitations").select("client_id, status").in("client_id", clientIds)
      : Promise.resolve({ data: [] as { client_id: string; status: string }[] }),
    clientIds.length
      ? client.from("event_playbook_applications")
          .select("event_id, released_at, events!inner(client_id)")
          .in("events.client_id", clientIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const selectionByLead = new Map<string, CommercialSelection>();
  const selectionByClient = new Map<string, CommercialSelection>();
  for (const row of (leadSelectionsRes.data ?? []) as SelectionRow[]) {
    if (row.lead_id && !selectionByLead.has(row.lead_id)) selectionByLead.set(row.lead_id, mapSelection(row));
  }
  for (const row of (clientSelectionsRes.data ?? []) as SelectionRow[]) {
    if (row.client_id && !selectionByClient.has(row.client_id)) selectionByClient.set(row.client_id, mapSelection(row));
  }

  const contractsByClient = new Map<string, JourneyContract[]>();
  for (const row of (contractsRes.data ?? []) as { id: string; client_id: string; status: string }[]) {
    const list = contractsByClient.get(row.client_id) ?? [];
    list.push({ id: row.id, status: row.status as JourneyContract["status"] });
    contractsByClient.set(row.client_id, list);
  }

  const linesByClient = new Map<string, JourneyPaymentLine[]>();
  for (const row of (linesRes.data ?? []) as Array<{
    obligation_kind: string | null;
    status: string;
    amount: number | string;
    payment_schedules: { client_id: string } | { client_id: string }[];
  }>) {
    const sched = Array.isArray(row.payment_schedules) ? row.payment_schedules[0] : row.payment_schedules;
    const cid = sched?.client_id;
    if (!cid) continue;
    const list = linesByClient.get(cid) ?? [];
    list.push({
      obligationKind: (row.obligation_kind as JourneyPaymentLine["obligationKind"]) ?? null,
      status: row.status as JourneyPaymentLine["status"],
      amount: Number(row.amount),
    });
    linesByClient.set(cid, list);
  }

  const invited = new Set(
    ((invitationsRes.data ?? []) as { client_id: string; status: string }[])
      .filter((r) => r.status !== "revoked")
      .map((r) => r.client_id),
  );

  const planningByClient = new Set<string>();
  for (const row of (appsRes.data ?? []) as Array<{
    released_at: string | null;
    events: { client_id: string } | { client_id: string }[];
  }>) {
    if (!row.released_at) continue;
    const ev = Array.isArray(row.events) ? row.events[0] : row.events;
    if (ev?.client_id) planningByClient.add(ev.client_id);
  }

  return conversations.map((c) => {
    const selection = (c.clientId ? selectionByClient.get(c.clientId) : null)
      ?? (c.leadId ? selectionByLead.get(c.leadId) : null)
      ?? null;
    const clientId = c.clientId ?? selection?.clientId ?? null;
    const contracts = clientId ? (contractsByClient.get(clientId) ?? []) : [];
    const picked = pickContract(contracts.map((x) => ({ id: x.id, status: x.status })));
    const contract: JourneyContract | null = picked ? { id: picked.id, status: picked.status } : null;
    const journey = buildBookingJourney({
      leadId: c.leadId,
      clientId,
      eventId: selection?.eventId ?? (c.eventCount === 1 ? null : null),
      selection,
      contract,
      paymentLines: clientId ? (linesByClient.get(clientId) ?? []) : [],
      portalInvited: clientId ? invited.has(clientId) : false,
      planningStarted: clientId ? planningByClient.has(clientId) : false,
    });
    return { ...c, bookingStage: journey.currentKey as JourneyStageKey };
  });
}
