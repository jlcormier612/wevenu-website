/**
 * Focus briefing candidate-event selection — pure readiness rules only.
 * No event-date cutoff: historical events with outstanding obligations remain.
 */
import { computeContractsReadiness, computePaymentsReadiness, computeRequestsReadiness } from "@/lib/readiness/compute";
import type { Contract } from "@/lib/contracts/types";
import type { Invoice } from "@/lib/invoices/types";
import type { Request as PortalRequest } from "@/lib/requests/types";

export type FocusScheduleLine = {
  id: string;
  status: string;
  dueDate: string | null;
  amount: number;
};

function byEventId<T extends { eventId: string | null }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.eventId) continue;
    const list = map.get(row.eventId) ?? [];
    list.push(row);
    map.set(row.eventId, list);
  }
  return map;
}

/**
 * Events that can produce needs_attention Focus items — derived from the same
 * compute*Readiness functions buildNeedsAttentionNow uses.
 */
export function selectFocusCandidateEventIds(input: {
  contracts: Contract[];
  invoices: Invoice[];
  requests: PortalRequest[];
  scheduleLinesByEventId: Map<string, FocusScheduleLine[]>;
}): Set<string> {
  const contractsByEvent = byEventId(input.contracts as (Contract & { eventId: string | null })[]);
  const invoicesByEvent = byEventId(input.invoices as (Invoice & { eventId: string | null })[]);
  const requestsByEvent = byEventId(input.requests as (PortalRequest & { eventId: string | null })[]);
  const eventIds = new Set<string>([
    ...contractsByEvent.keys(),
    ...invoicesByEvent.keys(),
    ...requestsByEvent.keys(),
    ...input.scheduleLinesByEventId.keys(),
  ]);
  const candidates = new Set<string>();
  for (const eventId of eventIds) {
    const eventContracts = contractsByEvent.get(eventId) ?? [];
    const eventInvoices = invoicesByEvent.get(eventId) ?? [];
    const eventRequests = requestsByEvent.get(eventId) ?? [];
    const eventScheduleLines = input.scheduleLinesByEventId.get(eventId) ?? [];
    if (eventContracts.length > 0
      && computeContractsReadiness(eventContracts).status === "needs_attention") {
      candidates.add(eventId);
    }
    if ((eventInvoices.length > 0 || eventScheduleLines.length > 0)
      && computePaymentsReadiness(eventInvoices, eventScheduleLines).status === "needs_attention") {
      candidates.add(eventId);
    }
    if (eventRequests.length > 0
      && computeRequestsReadiness(eventRequests).status === "needs_attention") {
      candidates.add(eventId);
    }
  }
  return candidates;
}
