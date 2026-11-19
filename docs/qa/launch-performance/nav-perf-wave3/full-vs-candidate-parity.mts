/**
 * Final Wave 3 safety check: full-event Focus vs candidate-only Focus on Fancy.
 * Uses production readiness + attention link helpers. Read-only Sandbox.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("non-sandbox");
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = resolve("docs/qa/launch-performance/nav-perf-wave3");
const DESKTOP = join(homedir(), "Desktop/HTC-NAV-PERF-WAVE3");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const candidateMod = await import(pathToFileURL(join(root, "lib/luv/focus-candidate-events.ts")).href);
const computeMod = await import(pathToFileURL(join(root, "lib/readiness/compute.ts")).href);
const linksMod = await import(pathToFileURL(join(root, "lib/luv/briefing-attention-links.ts")).href);
const identityMod = await import(pathToFileURL(join(root, "lib/dashboard-system/attention-identity.ts")).href);

function byEventId<T extends { eventId: string | null }>(rows: T[]) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.eventId) continue;
    const list = m.get(r.eventId) ?? [];
    list.push(r);
    m.set(r.eventId, list);
  }
  return m;
}

function buildItems(input: {
  events: Array<{ id: string; name: string; event_date: string | null; client_id: string | null; status: string }>;
  contracts: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  requests: Array<Record<string, unknown>>;
  scheduleLinesByEventId: Map<string, Array<{ id: string; status: string; dueDate: string | null; amount: number }>>;
}) {
  const contractsByEvent = byEventId(input.contracts as Array<{ eventId: string | null }>);
  const invoicesByEvent = byEventId(input.invoices as Array<{ eventId: string | null }>);
  const requestsByEvent = byEventId(input.requests as Array<{ eventId: string | null }>);
  const items: Array<Record<string, unknown>> = [];
  for (const event of input.events) {
    if (!event.client_id || event.status === "cancelled") continue;
    const eventContracts = (contractsByEvent.get(event.id) ?? []) as never[];
    const eventInvoices = (invoicesByEvent.get(event.id) ?? []) as never[];
    const eventRequests = (requestsByEvent.get(event.id) ?? []) as never[];
    const eventLines = input.scheduleLinesByEventId.get(event.id) ?? [];
    if (eventContracts.length > 0) {
      const section = computeMod.computeContractsReadiness(eventContracts);
      if (section.status === "needs_attention") {
        items.push({
          id: `briefing-contract-${event.id}`,
          category: "contracts",
          status: section.status,
          eventId: event.id,
          eventName: event.name,
          eventDate: event.event_date,
          label: section.label,
          detail: section.detail,
          link: linksMod.contractAttentionHref(eventContracts, event.client_id),
          conditionKey: identityMod.contractsAttentionDismissalKey(
            event.id,
            eventContracts.map((c: { id: string; status: string }) => ({ id: c.id, status: c.status })),
          ),
        });
      }
    }
    if (eventInvoices.length > 0 || eventLines.length > 0) {
      const section = computeMod.computePaymentsReadiness(eventInvoices, eventLines);
      if (section.status === "needs_attention") {
        items.push({
          id: `briefing-payments-${event.id}`,
          category: "payments",
          status: section.status,
          eventId: event.id,
          eventName: event.name,
          eventDate: event.event_date,
          label: section.label,
          detail: section.detail,
          link: linksMod.paymentsAttentionHref(eventInvoices, event.client_id),
          conditionKey: identityMod.paymentsAttentionDismissalKey(event.id, eventLines),
          balanceDueSum: eventInvoices
            .filter((i: { status: string }) => i.status !== "void")
            .reduce((s: number, i: { balanceDue: number }) => s + Number(i.balanceDue), 0),
        });
      }
    }
    if (eventRequests.length > 0) {
      const section = computeMod.computeRequestsReadiness(eventRequests);
      if (section.status === "needs_attention") {
        items.push({
          id: `briefing-requests-${event.id}`,
          category: "requests",
          status: section.status,
          eventId: event.id,
          eventName: event.name,
          eventDate: event.event_date,
          label: section.label,
          detail: section.detail,
          link: linksMod.requestsAttentionHref(eventRequests, event.client_id),
          conditionKey: identityMod.requestsAttentionDismissalKey(
            event.id,
            eventRequests.map((r: { id: string; status: string; dueDate: string | null }) => ({
              id: r.id, status: r.status, dueDate: r.dueDate ?? null,
            })),
          ),
        });
      }
    }
  }
  items.sort((a, b) => String(a.eventDate ?? "9999").localeCompare(String(b.eventDate ?? "9999")));
  return items;
}

async function main() {
  const [eventsRes, contractsRes, invoicesRes, schedulesRes, linesRes, requestsRes] = await Promise.all([
    sb.from("events").select("id, name, event_date, client_id, status").eq("venue_id", FANCY),
    sb.from("contracts").select("id, venue_id, client_id, event_id, status, execution_origin").eq("venue_id", FANCY),
    sb.from("invoices").select("id, venue_id, client_id, event_id, status, balance_due, due_date, invoice_number").eq("venue_id", FANCY),
    sb.from("payment_schedules").select("id, event_id").eq("venue_id", FANCY),
    sb.from("payment_line_items").select("id, schedule_id, status, due_date, amount").eq("venue_id", FANCY),
    sb.from("requests").select("id, venue_id, client_id, event_id, status, due_date").eq("venue_id", FANCY),
  ]);

  const allEvents = (eventsRes.data ?? []) as Array<{ id: string; name: string; event_date: string | null; client_id: string | null; status: string }>;
  const activeEvents = allEvents.filter((e) => e.status !== "cancelled");
  const cancelledWithRelated = allEvents.filter((e) => e.status === "cancelled");

  const contracts = ((contractsRes.data ?? []) as Array<Record<string, unknown>>).map((c) => ({
    id: c.id as string,
    eventId: (c.event_id as string | null) ?? null,
    status: c.status as never,
    executionOrigin: ((c.execution_origin as string | null) ?? "htc") as "htc" | "external",
    venueId: FANCY, clientId: (c.client_id as string | null) ?? null, templateId: null, title: "", content: "",
    signToken: "tok", signerName: null, signedAt: null, sentAt: null, expiresAt: null,
    createdAt: "", updatedAt: "", amendsContractId: null, brandingSnapshot: null,
    clientName: null, clientEmail: null, eventDate: null,
  }));
  const invoices = ((invoicesRes.data ?? []) as Array<Record<string, unknown>>).map((i) => ({
    id: i.id as string,
    eventId: (i.event_id as string | null) ?? null,
    status: i.status as never,
    balanceDue: Number(i.balance_due),
    dueDate: (i.due_date as string | null) ?? null,
    venueId: FANCY, clientId: (i.client_id as string | null) ?? null, invoiceNumber: String(i.invoice_number ?? ""),
    displayName: null, subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0, notes: null, issuedAt: null,
    createdAt: "", updatedAt: "", clientName: null, eventDate: null, bookedAt: null, eventName: null,
    eventOrderId: null, eventOrderDismissedFingerprint: null, amendsInvoiceId: null,
    eventOrderRevisionAtFreeze: null, amendedByInvoiceId: null, amendedByInvoiceNumber: null,
    quickbooksSyncStatus: "not_synced" as const, brandingSnapshot: null,
  }));
  const requests = ((requestsRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    eventId: (r.event_id as string | null) ?? null,
    clientId: (r.client_id as string | null) ?? "c",
    status: r.status as never,
    dueDate: (r.due_date as string | null) ?? null,
    venueId: FANCY, title: "", description: null, requestType: "information" as never, visibility: "shared" as never,
    requestedByUserId: null, assignedToStaffId: null, sourceFeature: null, sourceId: null,
    responseText: null, responseFileUrl: null, clientActionEnabled: true,
    createdAt: "", updatedAt: "", completedAt: null, reviewedAt: null,
  }));
  const schedules = (schedulesRes.data ?? []) as Array<{ id: string; event_id: string | null }>;
  const lines = (linesRes.data ?? []) as Array<{ id: string; schedule_id: string; status: string; due_date: string | null; amount: number }>;
  const linesBySchedule = new Map<string, typeof lines>();
  for (const l of lines) {
    const list = linesBySchedule.get(l.schedule_id) ?? [];
    list.push(l);
    linesBySchedule.set(l.schedule_id, list);
  }
  const scheduleLinesByEventId = new Map<string, Array<{ id: string; status: string; dueDate: string | null; amount: number }>>();
  for (const s of schedules) {
    if (!s.event_id) continue;
    const mapped = (linesBySchedule.get(s.id) ?? []).map((l) => ({
      id: l.id, status: l.status, dueDate: l.due_date, amount: Number(l.amount),
    }));
    scheduleLinesByEventId.set(s.event_id, (scheduleLinesByEventId.get(s.event_id) ?? []).concat(mapped));
  }

  const data = { contracts, invoices, requests, scheduleLinesByEventId };
  const full = buildItems({ events: activeEvents, ...data });
  const candidateIds = candidateMod.selectFocusCandidateEventIds(data) as Set<string>;
  const candidateEvents = activeEvents.filter((e) => candidateIds.has(e.id));
  const filtered = buildItems({ events: candidateEvents, ...data });

  const mismatches: Array<Record<string, unknown>> = [];
  if (full.length !== filtered.length) {
    mismatches.push({ reason: "count", full: full.length, filtered: filtered.length });
  }
  for (let i = 0; i < Math.max(full.length, filtered.length); i++) {
    if (JSON.stringify(full[i]) !== JSON.stringify(filtered[i])) {
      mismatches.push({ reason: "item_diff", index: i, full: full[i] ?? null, filtered: filtered[i] ?? null });
    }
  }

  // Cancelled events must never emit Focus items under either path
  const cancelledLeak = buildItems({ events: cancelledWithRelated, ...data });

  const out = {
    measuredAt: new Date().toISOString(),
    venueId: FANCY,
    counts: {
      allEvents: allEvents.length,
      activeEvents: activeEvents.length,
      cancelledEvents: cancelledWithRelated.length,
      candidateEvents: candidateIds.size,
      fullItems: full.length,
      candidateItems: filtered.length,
      cancelledLeakItems: cancelledLeak.length,
    },
    parity: { mismatches: mismatches.length, details: mismatches.slice(0, 20) },
    fullIds: full.map((i) => i.id),
    candidateIds: filtered.map((i) => i.id),
  };
  writeFileSync(join(OUT, "full-vs-candidate-parity.json"), JSON.stringify(out, null, 2));
  copyFileSync(join(OUT, "full-vs-candidate-parity.json"), join(DESKTOP, "full-vs-candidate-parity.json"));
  console.log(JSON.stringify(out, null, 2));
  if (mismatches.length > 0 || cancelledLeak.length > 0) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
