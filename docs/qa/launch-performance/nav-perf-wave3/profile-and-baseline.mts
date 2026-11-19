/**
 * Wave 3 — profile Focus briefing queries + capture authoritative Focus baseline.
 * Read-only Sandbox Fancy. No mutations / OpenAI / Production.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("non-sandbox");
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = resolve("docs/qa/launch-performance/nav-perf-wave3");
const DESKTOP = join(homedir(), "Desktop/HTC-NAV-PERF-WAVE3");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const LEAN_CONTRACT =
  "id, venue_id, client_id, event_id, template_id, title, status, execution_origin, sign_token, signer_name, signed_at, sent_at, expires_at, created_at, updated_at, amends_contract_id, branding_snapshot, clients(first_name, last_name, partner_first_name, partner_last_name, event_date), events(event_date)";
const LEAN_INVOICE =
  "id, venue_id, client_id, event_id, status, balance_due, due_date, invoice_number, issued_at";
const LEAN_SCHEDULE = "id, venue_id, client_id, event_id, title";
const LEAN_LINE = "id, schedule_id, venue_id, status, due_date, amount";
const LEAN_REQUEST = "id, venue_id, event_id, client_id, status, due_date";
const FAT_INVOICE = "*, clients(first_name, last_name, partner_first_name, partner_last_name, event_date), events(name, event_date, booked_at)";
const FAT_SCHEDULE = "*, clients(first_name, last_name, partner_first_name, partner_last_name, exclude_from_business_reporting), events(event_date, booked_at)";

async function timed(label: string, fn: () => Promise<{ data: unknown; error: { message?: string } | null }>) {
  const t0 = performance.now();
  const { data, error } = await fn();
  const ms = Math.round(performance.now() - t0);
  const rows = Array.isArray(data) ? data.length : data == null ? 0 : 1;
  const bytes = data == null ? 0 : JSON.stringify(data).length;
  return { label, ms, rows, bytes, err: error?.message ?? null };
}

function byEventId<T extends { event_id?: string | null; eventId?: string | null }>(rows: T[]) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const id = (r as { event_id?: string | null }).event_id ?? (r as { eventId?: string | null }).eventId;
    if (!id) continue;
    const list = m.get(id) ?? [];
    list.push(r);
    m.set(id, list);
  }
  return m;
}

function contractStatus(contracts: { status: string; execution_origin?: string | null }[]) {
  const signed = contracts.filter((c) => c.status === "signed").length;
  const sent = contracts.filter((c) => c.status === "sent").length;
  if (contracts.length === 0) return "not_started";
  if (signed === contracts.length) return "complete";
  if (sent > 0) return "waiting";
  return "needs_attention";
}

function paymentsStatus(
  invoices: { status: string; balance_due: number; due_date: string | null }[],
  lines: { status: string; due_date: string | null; amount: number }[],
  today: string,
) {
  const active = invoices.filter((i) => i.status !== "void");
  const totalBalanceDue = active.reduce((s, i) => s + Number(i.balance_due), 0);
  const open = lines.filter((l) => l.status === "pending" || l.status === "overdue" || l.status === "processing");
  const overdueLines = open.filter((l) => l.status === "overdue" || (l.due_date != null && l.due_date < today));
  if (active.length === 0 && lines.length === 0) return "not_started";
  if (overdueLines.length > 0) return "needs_attention";
  if (open.length === 0 && totalBalanceDue === 0) return "complete";
  return "waiting";
}

function requestsStatus(requests: { status: string; due_date: string | null }[], today: string) {
  const waitingOnClient = requests.filter((r) => ["sent", "viewed", "in_progress"].includes(r.status)).length;
  const waitingOnVenue = requests.filter((r) => ["submitted", "reviewed"].includes(r.status)).length;
  const overdue = requests.filter((r) => r.due_date != null && r.due_date < today && !["completed", "cancelled"].includes(r.status)).length;
  if (requests.length === 0) return "not_started";
  if (overdue > 0 || waitingOnVenue > 0) return "needs_attention";
  if (waitingOnClient > 0) return "waiting";
  return "complete";
}

function buildFocusItems(input: {
  events: { id: string; name: string; event_date: string | null; client_id: string | null; status: string }[];
  contracts: { id: string; event_id: string | null; status: string; execution_origin?: string | null; client_id?: string | null }[];
  invoices: { id: string; event_id: string | null; status: string; balance_due: number; due_date: string | null; client_id?: string | null }[];
  requests: { id: string; event_id: string | null; client_id: string | null; status: string; due_date: string | null }[];
  schedules: { id: string; event_id: string | null }[];
  lines: { id: string; schedule_id: string; status: string; due_date: string | null; amount: number }[];
  today: string;
}) {
  const contractsByEvent = byEventId(input.contracts);
  const invoicesByEvent = byEventId(input.invoices);
  const requestsByEvent = byEventId(input.requests);
  const linesBySchedule = new Map<string, typeof input.lines>();
  for (const l of input.lines) {
    const list = linesBySchedule.get(l.schedule_id) ?? [];
    list.push(l);
    linesBySchedule.set(l.schedule_id, list);
  }
  const linesByEvent = new Map<string, typeof input.lines>();
  for (const s of input.schedules) {
    if (!s.event_id) continue;
    const lines = linesBySchedule.get(s.id) ?? [];
    const existing = linesByEvent.get(s.event_id) ?? [];
    linesByEvent.set(s.event_id, existing.concat(lines));
  }

  const items: Array<Record<string, unknown>> = [];
  for (const event of input.events) {
    if (!event.client_id) continue;
    const eventContracts = contractsByEvent.get(event.id) ?? [];
    const eventInvoices = invoicesByEvent.get(event.id) ?? [];
    const eventRequests = requestsByEvent.get(event.id) ?? [];
    const eventLines = linesByEvent.get(event.id) ?? [];

    const cStatus = contractStatus(eventContracts);
    if (eventContracts.length > 0 && cStatus === "needs_attention") {
      const actionable = eventContracts.find((c) => c.status === "draft")
        ?? eventContracts.find((c) => c.status !== "signed" && c.status !== "cancelled");
      items.push({
        id: `briefing-contract-${event.id}`,
        category: "contracts",
        status: cStatus,
        eventId: event.id,
        eventName: event.name,
        eventDate: event.event_date,
        label: "Contract",
        detail: "Drafted — not yet sent.",
        link: actionable ? `/contracts/${actionable.id}` : `/clients/${event.client_id}#documents`,
        contractIds: eventContracts.map((c) => c.id).sort(),
        contractStatuses: eventContracts.map((c) => c.status).sort(),
      });
    }

    const pStatus = paymentsStatus(eventInvoices, eventLines, input.today);
    if ((eventInvoices.length > 0 || eventLines.length > 0) && pStatus === "needs_attention") {
      const overdueCount = eventLines.filter((l) => {
        const open = l.status === "pending" || l.status === "overdue" || l.status === "processing";
        return open && (l.status === "overdue" || (l.due_date != null && l.due_date < input.today));
      }).length;
      const inv = eventInvoices.find((i) => Number(i.balance_due) > 0 && i.due_date != null && i.due_date < input.today)
        ?? eventInvoices.find((i) => Number(i.balance_due) > 0)
        ?? eventInvoices[0];
      items.push({
        id: `briefing-payments-${event.id}`,
        category: "payments",
        status: pStatus,
        eventId: event.id,
        eventName: event.name,
        eventDate: event.event_date,
        label: "Payments",
        detail: `${overdueCount} payment${overdueCount === 1 ? "" : "s"} overdue.`,
        link: inv ? `/invoices/${inv.id}` : `/clients/${event.client_id}#invoice`,
        invoiceIds: eventInvoices.map((i) => i.id).sort(),
        overdueLineCount: overdueCount,
        balanceDueSum: eventInvoices.filter((i) => i.status !== "void").reduce((s, i) => s + Number(i.balance_due), 0),
      });
    }

    const rStatus = requestsStatus(eventRequests, input.today);
    if (eventRequests.length > 0 && rStatus === "needs_attention") {
      const outstanding = eventRequests.find((r) => r.status !== "draft" && r.status !== "completed" && r.status !== "cancelled");
      items.push({
        id: `briefing-requests-${event.id}`,
        category: "requests",
        status: rStatus,
        eventId: event.id,
        eventName: event.name,
        eventDate: event.event_date,
        label: "Requests",
        link: outstanding ? `/requests/${outstanding.id}` : `/clients/${event.client_id}#requests-summary-card`,
        requestIds: eventRequests.map((r) => r.id).sort(),
        requestStatuses: eventRequests.map((r) => r.status).sort(),
      });
    }
  }
  items.sort((a, b) => String(a.eventDate ?? "9999").localeCompare(String(b.eventDate ?? "9999")));
  return items;
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  // warm
  await sb.from("events").select("id").eq("venue_id", FANCY).limit(1);

  const profile = [];
  for (const run of [1, 2]) {
    profile.push(await timed(`events_all_r${run}`, () =>
      sb.from("events").select("id, name, event_date, client_id, status").eq("venue_id", FANCY).neq("status", "cancelled")));
    profile.push(await timed(`contracts_lean_r${run}`, () =>
      sb.from("contracts").select(LEAN_CONTRACT).eq("venue_id", FANCY)));
    profile.push(await timed(`invoices_fat_r${run}`, () =>
      sb.from("invoices").select(FAT_INVOICE).eq("venue_id", FANCY)));
    profile.push(await timed(`invoices_lean_r${run}`, () =>
      sb.from("invoices").select(LEAN_INVOICE).eq("venue_id", FANCY)));
    profile.push(await timed(`schedules_fat_r${run}`, () =>
      sb.from("payment_schedules").select(FAT_SCHEDULE).eq("venue_id", FANCY)));
    profile.push(await timed(`schedules_lean_r${run}`, () =>
      sb.from("payment_schedules").select(LEAN_SCHEDULE).eq("venue_id", FANCY)));
    profile.push(await timed(`lines_fat_r${run}`, () =>
      sb.from("payment_line_items").select("*").eq("venue_id", FANCY)));
    profile.push(await timed(`lines_lean_r${run}`, () =>
      sb.from("payment_line_items").select(LEAN_LINE).eq("venue_id", FANCY)));
    profile.push(await timed(`requests_fat_r${run}`, () =>
      sb.from("requests").select("*").eq("venue_id", FANCY)));
    profile.push(await timed(`requests_lean_r${run}`, () =>
      sb.from("requests").select(LEAN_REQUEST).eq("venue_id", FANCY)));
  }

  // Load authoritative datasets (lean fields that preserve readiness)
  const [eventsRes, contractsRes, invoicesRes, schedulesRes, linesRes, requestsRes] = await Promise.all([
    sb.from("events").select("id, name, event_date, client_id, status").eq("venue_id", FANCY).neq("status", "cancelled"),
    sb.from("contracts").select("id, event_id, client_id, status, execution_origin").eq("venue_id", FANCY),
    sb.from("invoices").select(LEAN_INVOICE).eq("venue_id", FANCY),
    sb.from("payment_schedules").select(LEAN_SCHEDULE).eq("venue_id", FANCY),
    sb.from("payment_line_items").select(LEAN_LINE).eq("venue_id", FANCY),
    sb.from("requests").select(LEAN_REQUEST).eq("venue_id", FANCY),
  ]);

  const events = (eventsRes.data ?? []) as { id: string; name: string; event_date: string | null; client_id: string | null; status: string }[];
  const contracts = (contractsRes.data ?? []) as { id: string; event_id: string | null; client_id: string | null; status: string; execution_origin: string | null }[];
  const invoices = (invoicesRes.data ?? []) as { id: string; event_id: string | null; status: string; balance_due: number; due_date: string | null; client_id: string | null }[];
  const schedules = (schedulesRes.data ?? []) as { id: string; event_id: string | null }[];
  const lines = (linesRes.data ?? []) as { id: string; schedule_id: string; status: string; due_date: string | null; amount: number }[];
  const requests = (requestsRes.data ?? []) as { id: string; event_id: string | null; client_id: string | null; status: string; due_date: string | null }[];

  const baselineFull = buildFocusItems({ events, contracts, invoices, requests, schedules, lines, today });

  // Candidate event filter (no date cutoff): events that can produce needs_attention
  const candidateIds = new Set<string>();
  for (const c of contracts) {
    if (!c.event_id) continue;
    // any non-signed contract can contribute (draft => needs_attention if no sent)
    if (c.status !== "signed" && c.status !== "cancelled" && c.status !== "void") candidateIds.add(c.event_id);
  }
  for (const l of lines) {
    const open = l.status === "pending" || l.status === "overdue" || l.status === "processing";
    if (open && (l.status === "overdue" || (l.due_date != null && l.due_date < today))) {
      const sched = schedules.find((s) => s.id === l.schedule_id);
      if (sched?.event_id) candidateIds.add(sched.event_id);
    }
  }
  for (const r of requests) {
    if (!r.event_id) continue;
    const waitingOnVenue = ["submitted", "reviewed"].includes(r.status);
    const overdue = r.due_date != null && r.due_date < today && !["completed", "cancelled"].includes(r.status);
    if (waitingOnVenue || overdue) candidateIds.add(r.event_id);
  }
  // Also include events with ANY contract that isn't fully signed set - need all contracts for event when evaluating.
  // For contract path: if event has contracts and none signed and none sent => needs_attention.
  // Candidate above already includes non-signed non-cancelled.

  const candidateEvents = events.filter((e) => candidateIds.has(e.id));
  // When evaluating candidates, still need ALL related rows for those events (not filtered rows)
  const baselineCandidates = buildFocusItems({
    events: candidateEvents,
    contracts,
    invoices,
    requests,
    schedules,
    lines,
    today,
  });

  const mismatch = [];
  const fullIds = baselineFull.map((i) => i.id);
  const candIds = baselineCandidates.map((i) => i.id);
  for (const item of baselineFull) {
    const other = baselineCandidates.find((x) => x.id === item.id);
    if (!other) mismatch.push({ id: item.id, reason: "missing_in_candidates" });
    else if (JSON.stringify(item) !== JSON.stringify(other)) mismatch.push({ id: item.id, reason: "field_diff", full: item, cand: other });
  }
  for (const item of baselineCandidates) {
    if (!baselineFull.find((x) => x.id === item.id)) mismatch.push({ id: item.id, reason: "extra_in_candidates" });
  }

  // Related-record event filter (broader, still no date cutoff)
  const relatedIds = new Set<string>();
  for (const c of contracts) if (c.event_id) relatedIds.add(c.event_id);
  for (const i of invoices) if (i.event_id) relatedIds.add(i.event_id);
  for (const s of schedules) if (s.event_id) relatedIds.add(s.event_id);
  for (const r of requests) if (r.event_id) relatedIds.add(r.event_id);
  const relatedEvents = events.filter((e) => relatedIds.has(e.id));
  const baselineRelated = buildFocusItems({ events: relatedEvents, contracts, invoices, requests, schedules, lines, today });
  const relatedMismatch = baselineFull.length !== baselineRelated.length
    || baselineFull.some((item, idx) => JSON.stringify(item) !== JSON.stringify(baselineRelated[idx]));

  const out = {
    measuredAt: new Date().toISOString(),
    venueId: FANCY,
    today,
    counts: {
      events: events.length,
      contracts: contracts.length,
      invoices: invoices.length,
      schedules: schedules.length,
      lines: lines.length,
      requests: requests.length,
      candidateEvents: candidateEvents.length,
      relatedEvents: relatedEvents.length,
      focusItems: baselineFull.length,
    },
    profile: profile.sort((a, b) => b.bytes - a.bytes),
    payloadCompare: {
      invoices: {
        fat: profile.find((p) => p.label === "invoices_fat_r2"),
        lean: profile.find((p) => p.label === "invoices_lean_r2"),
      },
      schedules: {
        fat: profile.find((p) => p.label === "schedules_fat_r2"),
        lean: profile.find((p) => p.label === "schedules_lean_r2"),
      },
      lines: {
        fat: profile.find((p) => p.label === "lines_fat_r2"),
        lean: profile.find((p) => p.label === "lines_lean_r2"),
      },
      requests: {
        fat: profile.find((p) => p.label === "requests_fat_r2"),
        lean: profile.find((p) => p.label === "requests_lean_r2"),
      },
    },
    candidateFilterParity: { mismatches: mismatch.length, details: mismatch.slice(0, 20) },
    relatedFilterParity: { mismatch: relatedMismatch },
    baselineFocusItems: baselineFull,
  };

  writeFileSync(join(OUT, "profile-and-baseline.json"), JSON.stringify(out, null, 2));
  copyFileSync(join(OUT, "profile-and-baseline.json"), join(DESKTOP, "profile-and-baseline.json"));
  console.log(JSON.stringify({
    counts: out.counts,
    payloadCompare: out.payloadCompare,
    candidateFilterParity: out.candidateFilterParity,
    relatedFilterParity: out.relatedFilterParity,
    sampleIds: baselineFull.map((i) => i.id),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
