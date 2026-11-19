/**
 * Wave 3 — Focus correctness parity after lean loaders + candidate filter.
 * Uses the same Sandbox Fancy fixture baseline captured pre-change.
 * Read-only. No OpenAI / mutations / Production.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// Load source modules via absolute file URLs (tsx resolves @/ via tsconfig).
const candidateMod = await import(pathToFileURL(join(root, "lib/luv/focus-candidate-events.ts")).href);
const computeMod = await import(pathToFileURL(join(root, "lib/readiness/compute.ts")).href);
const linksMod = await import(pathToFileURL(join(root, "lib/luv/briefing-attention-links.ts")).href);
const identityMod = await import(pathToFileURL(join(root, "lib/dashboard-system/attention-identity.ts")).href);

type BaselineItem = Record<string, unknown>;

function byEventId<T extends { eventId?: string | null; event_id?: string | null }>(rows: T[]) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const id = (r as { eventId?: string | null }).eventId ?? (r as { event_id?: string | null }).event_id;
    if (!id) continue;
    const list = m.get(id) ?? [];
    list.push(r);
    m.set(id, list);
  }
  return m;
}

async function timed(label: string, fn: () => Promise<unknown>) {
  const t0 = performance.now();
  const data = await fn();
  const ms = Math.round(performance.now() - t0);
  const rows = Array.isArray(data) ? data.length : data == null ? 0 : 1;
  const bytes = data == null ? 0 : JSON.stringify(data).length;
  return { label, ms, rows, bytes };
}

async function main() {
  const baseline = JSON.parse(readFileSync(join(OUT, "profile-and-baseline.json"), "utf8")) as {
    baselineFocusItems: BaselineItem[];
    today: string;
  };

  // Warm connection
  await sb.from("events").select("id").eq("venue_id", FANCY).limit(1);

  const beforeBundle = [];
  for (const run of [1, 2]) {
    beforeBundle.push(await timed(`fat_parallel_r${run}`, async () => {
      const [events, contracts, invoices, schedules, lines, requests] = await Promise.all([
        sb.from("events").select("id, name, event_date, client_id, status").eq("venue_id", FANCY).neq("status", "cancelled"),
        sb.from("contracts").select("id, venue_id, client_id, event_id, template_id, title, status, execution_origin, sign_token, signer_name, signed_at, sent_at, expires_at, created_at, updated_at, amends_contract_id, branding_snapshot, clients(first_name, last_name, partner_first_name, partner_last_name, event_date), events(event_date)").eq("venue_id", FANCY),
        sb.from("invoices").select("*, clients(first_name, last_name, partner_first_name, partner_last_name, event_date), events(name, event_date, booked_at)").eq("venue_id", FANCY),
        sb.from("payment_schedules").select("*, clients(first_name, last_name, partner_first_name, partner_last_name, exclude_from_business_reporting), events(event_date, booked_at)").eq("venue_id", FANCY),
        sb.from("payment_line_items").select("*").eq("venue_id", FANCY),
        sb.from("requests").select("*").eq("venue_id", FANCY),
      ]);
      return {
        events: events.data,
        contracts: contracts.data,
        invoices: invoices.data,
        schedules: schedules.data,
        lines: lines.data,
        requests: requests.data,
      };
    }));
  }

  const afterBundle = [];
  for (const run of [1, 2]) {
    afterBundle.push(await timed(`lean_focus_path_r${run}`, async () => {
      const [contracts, invoices, schedules, lines, requests] = await Promise.all([
        sb.from("contracts").select("id, venue_id, client_id, event_id, template_id, title, status, execution_origin, sign_token, signer_name, signed_at, sent_at, expires_at, created_at, updated_at, amends_contract_id, branding_snapshot, clients(first_name, last_name, partner_first_name, partner_last_name, event_date), events(event_date)").eq("venue_id", FANCY),
        sb.from("invoices").select("id, venue_id, client_id, event_id, invoice_number, status, balance_due, due_date, issued_at, created_at, updated_at").eq("venue_id", FANCY),
        sb.from("payment_schedules").select("id, event_id").eq("venue_id", FANCY),
        sb.from("payment_line_items").select("id, schedule_id, status, due_date, amount").eq("venue_id", FANCY),
        sb.from("requests").select("id, venue_id, client_id, event_id, title, request_type, status, visibility, due_date, created_at, updated_at").eq("venue_id", FANCY),
      ]);
      const scheduleRows = (schedules.data ?? []) as Array<{ id: string; event_id: string | null }>;
      const lineRows = (lines.data ?? []) as Array<{ id: string; schedule_id: string; status: string; due_date: string | null; amount: number }>;
      const contractRows = (contracts.data ?? []) as Array<{ id: string; event_id: string | null; status: string; execution_origin?: string | null; client_id?: string | null }>;
      const invoiceRows = (invoices.data ?? []) as Array<{ id: string; event_id: string | null; status: string; balance_due: number; due_date: string | null; client_id?: string | null }>;
      const requestRows = (requests.data ?? []) as Array<{ id: string; event_id: string | null; client_id: string | null; status: string; due_date: string | null }>;

      // Candidate IDs via same readiness rules as production helper
      const linesBySchedule = new Map<string, typeof lineRows>();
      for (const l of lineRows) {
        const list = linesBySchedule.get(l.schedule_id) ?? [];
        list.push(l);
        linesBySchedule.set(l.schedule_id, list);
      }
      const scheduleLinesByEventId = new Map<string, Array<{ id: string; status: string; dueDate: string | null; amount: number }>>();
      for (const s of scheduleRows) {
        if (!s.event_id) continue;
        const mapped = (linesBySchedule.get(s.id) ?? []).map((l) => ({
          id: l.id, status: l.status, dueDate: l.due_date, amount: Number(l.amount),
        }));
        scheduleLinesByEventId.set(s.event_id, (scheduleLinesByEventId.get(s.event_id) ?? []).concat(mapped));
      }

      const contractsDomain = contractRows.map((c) => ({
        id: c.id, eventId: c.event_id, status: c.status, executionOrigin: (c.execution_origin ?? "htc") as "htc" | "external",
        venueId: FANCY, clientId: c.client_id ?? null, templateId: null, title: "", content: "",
        signToken: "tok", signerName: null, signedAt: null, sentAt: null, expiresAt: null,
        createdAt: "", updatedAt: "", amendsContractId: null, brandingSnapshot: null,
        clientName: null, clientEmail: null, eventDate: null,
      }));
      const invoicesDomain = invoiceRows.map((i) => ({
        id: i.id, eventId: i.event_id, status: i.status as never, balanceDue: Number(i.balance_due), dueDate: i.due_date,
        venueId: FANCY, clientId: i.client_id ?? null, invoiceNumber: "", displayName: null,
        subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0, notes: null, issuedAt: null,
        createdAt: "", updatedAt: "", clientName: null, eventDate: null, bookedAt: null, eventName: null,
        eventOrderId: null, eventOrderDismissedFingerprint: null, amendsInvoiceId: null,
        eventOrderRevisionAtFreeze: null, amendedByInvoiceId: null, amendedByInvoiceNumber: null,
        quickbooksSyncStatus: "not_synced" as const, brandingSnapshot: null,
      }));
      const requestsDomain = requestRows.map((r) => ({
        id: r.id, eventId: r.event_id, clientId: r.client_id ?? "c", status: r.status as never, dueDate: r.due_date,
        venueId: FANCY, title: "", description: null, requestType: "information" as never, visibility: "shared" as never,
        requestedByUserId: null, assignedToStaffId: null, sourceFeature: null, sourceId: null,
        responseText: null, responseFileUrl: null, clientActionEnabled: true,
        createdAt: "", updatedAt: "", completedAt: null, reviewedAt: null,
      }));

      const candidateIds = candidateMod.selectFocusCandidateEventIds({
        contracts: contractsDomain,
        invoices: invoicesDomain,
        requests: requestsDomain,
        scheduleLinesByEventId,
      }) as Set<string>;

      const eventsRes = candidateIds.size === 0
        ? { data: [] as Array<{ id: string; name: string; event_date: string | null; client_id: string | null; status: string }> }
        : await sb.from("events").select("id, name, event_date, client_id, status")
          .eq("venue_id", FANCY).neq("status", "cancelled").in("id", [...candidateIds]);

      return {
        contracts: contracts.data,
        invoices: invoices.data,
        schedules: schedules.data,
        lines: lines.data,
        requests: requests.data,
        events: eventsRes.data,
        candidateCount: candidateIds.size,
      };
    }));
  }

  // Authoritative after Focus items using production readiness + attention links
  const lean = afterBundle[afterBundle.length - 1] as {
    ms: number;
    rows: number;
    bytes: number;
  } & { label: string };
  void lean;

  const [contracts, invoices, schedules, lines, requests] = await Promise.all([
    sb.from("contracts").select("id, venue_id, client_id, event_id, template_id, title, status, execution_origin, sign_token, signer_name, signed_at, sent_at, expires_at, created_at, updated_at, amends_contract_id, branding_snapshot, clients(first_name, last_name, partner_first_name, partner_last_name, event_date), events(event_date)").eq("venue_id", FANCY),
    sb.from("invoices").select("id, venue_id, client_id, event_id, invoice_number, status, balance_due, due_date, issued_at, created_at, updated_at").eq("venue_id", FANCY),
    sb.from("payment_schedules").select("id, event_id").eq("venue_id", FANCY),
    sb.from("payment_line_items").select("id, schedule_id, status, due_date, amount").eq("venue_id", FANCY),
    sb.from("requests").select("id, venue_id, client_id, event_id, title, request_type, status, visibility, due_date, created_at, updated_at").eq("venue_id", FANCY),
  ]);

  const scheduleRows = (schedules.data ?? []) as Array<{ id: string; event_id: string | null }>;
  const lineRows = (lines.data ?? []) as Array<{ id: string; schedule_id: string; status: string; due_date: string | null; amount: number }>;
  const contractRows = (contracts.data ?? []) as Array<{
    id: string; event_id: string | null; status: string; execution_origin?: string | null; client_id?: string | null;
  }>;
  const invoiceRows = (invoices.data ?? []) as Array<{
    id: string; event_id: string | null; status: string; balance_due: number; due_date: string | null; client_id?: string | null; invoice_number?: string;
  }>;
  const requestRows = (requests.data ?? []) as Array<{
    id: string; event_id: string | null; client_id: string | null; status: string; due_date: string | null;
  }>;

  const linesBySchedule = new Map<string, typeof lineRows>();
  for (const l of lineRows) {
    const list = linesBySchedule.get(l.schedule_id) ?? [];
    list.push(l);
    linesBySchedule.set(l.schedule_id, list);
  }
  const scheduleLinesByEventId = new Map<string, Array<{ id: string; status: string; dueDate: string | null; amount: number }>>();
  for (const s of scheduleRows) {
    if (!s.event_id) continue;
    const mapped = (linesBySchedule.get(s.id) ?? []).map((l) => ({
      id: l.id, status: l.status, dueDate: l.due_date, amount: Number(l.amount),
    }));
    scheduleLinesByEventId.set(s.event_id, (scheduleLinesByEventId.get(s.event_id) ?? []).concat(mapped));
  }

  const contractsDomain = contractRows.map((c) => ({
    id: c.id, eventId: c.event_id, status: c.status as never, executionOrigin: (c.execution_origin ?? "htc") as "htc" | "external",
    venueId: FANCY, clientId: c.client_id ?? null, templateId: null, title: "", content: "",
    signToken: "tok", signerName: null, signedAt: null, sentAt: null, expiresAt: null,
    createdAt: "", updatedAt: "", amendsContractId: null, brandingSnapshot: null,
    clientName: null, clientEmail: null, eventDate: null,
  }));
  const invoicesDomain = invoiceRows.map((i) => ({
    id: i.id, eventId: i.event_id, status: i.status as never, balanceDue: Number(i.balance_due), dueDate: i.due_date,
    venueId: FANCY, clientId: i.client_id ?? null, invoiceNumber: i.invoice_number ?? "", displayName: null,
    subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0, notes: null, issuedAt: null,
    createdAt: "", updatedAt: "", clientName: null, eventDate: null, bookedAt: null, eventName: null,
    eventOrderId: null, eventOrderDismissedFingerprint: null, amendsInvoiceId: null,
    eventOrderRevisionAtFreeze: null, amendedByInvoiceId: null, amendedByInvoiceNumber: null,
    quickbooksSyncStatus: "not_synced" as const, brandingSnapshot: null,
  }));
  const requestsDomain = requestRows.map((r) => ({
    id: r.id, eventId: r.event_id, clientId: r.client_id ?? "c", status: r.status as never, dueDate: r.due_date,
    venueId: FANCY, title: "", description: null, requestType: "information" as never, visibility: "shared" as never,
    requestedByUserId: null, assignedToStaffId: null, sourceFeature: null, sourceId: null,
    responseText: null, responseFileUrl: null, clientActionEnabled: true,
    createdAt: "", updatedAt: "", completedAt: null, reviewedAt: null,
  }));

  const candidateIds = candidateMod.selectFocusCandidateEventIds({
    contracts: contractsDomain,
    invoices: invoicesDomain,
    requests: requestsDomain,
    scheduleLinesByEventId,
  }) as Set<string>;

  const eventsRes = await sb.from("events").select("id, name, event_date, client_id, status")
    .eq("venue_id", FANCY).neq("status", "cancelled").in("id", [...candidateIds]);
  const events = (eventsRes.data ?? []) as Array<{ id: string; name: string; event_date: string | null; client_id: string | null; status: string }>;

  const contractsByEvent = byEventId(contractsDomain);
  const invoicesByEvent = byEventId(invoicesDomain);
  const requestsByEvent = byEventId(requestsDomain);

  const afterItems: BaselineItem[] = [];
  for (const event of events) {
    if (!event.client_id) continue;
    const eventContracts = contractsByEvent.get(event.id) ?? [];
    const eventInvoices = invoicesByEvent.get(event.id) ?? [];
    const eventRequests = requestsByEvent.get(event.id) ?? [];
    const eventLines = scheduleLinesByEventId.get(event.id) ?? [];

    if (eventContracts.length > 0) {
      const section = computeMod.computeContractsReadiness(eventContracts);
      if (section.status === "needs_attention") {
        afterItems.push({
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
          contractIds: eventContracts.map((c: { id: string }) => c.id).sort(),
          contractStatuses: eventContracts.map((c: { status: string }) => c.status).sort(),
        });
      }
    }
    if (eventInvoices.length > 0 || eventLines.length > 0) {
      const section = computeMod.computePaymentsReadiness(eventInvoices, eventLines);
      if (section.status === "needs_attention") {
        afterItems.push({
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
          invoiceIds: eventInvoices.map((i: { id: string }) => i.id).sort(),
          overdueLineCount: eventLines.filter((l) => {
            const open = l.status === "pending" || l.status === "overdue" || l.status === "processing";
            return open && (l.status === "overdue" || (l.dueDate != null && l.dueDate < baseline.today));
          }).length,
          balanceDueSum: eventInvoices
            .filter((i: { status: string }) => i.status !== "void")
            .reduce((s: number, i: { balanceDue: number }) => s + Number(i.balanceDue), 0),
        });
      }
    }
    if (eventRequests.length > 0) {
      const section = computeMod.computeRequestsReadiness(eventRequests);
      if (section.status === "needs_attention") {
        afterItems.push({
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
          requestIds: eventRequests.map((r: { id: string }) => r.id).sort(),
          requestStatuses: eventRequests.map((r: { status: string }) => r.status).sort(),
        });
      }
    }
  }
  afterItems.sort((a, b) => String(a.eventDate ?? "9999").localeCompare(String(b.eventDate ?? "9999")));

  // Compare against baseline on identity + category + status + order + financials + links.
  // Only assert keys present on the baseline item (baseline capture may omit optional fields).
  const mismatches: Array<Record<string, unknown>> = [];
  const baselineItems = baseline.baselineFocusItems;
  if (baselineItems.length !== afterItems.length) {
    mismatches.push({
      reason: "count_mismatch",
      baseline: baselineItems.length,
      after: afterItems.length,
      baselineIds: baselineItems.map((i) => i.id),
      afterIds: afterItems.map((i) => i.id),
    });
  }
  for (let i = 0; i < Math.max(baselineItems.length, afterItems.length); i++) {
    const b = baselineItems[i];
    const a = afterItems[i];
    if (!b || !a) {
      mismatches.push({ reason: "missing_at_index", index: i, baseline: b ?? null, after: a ?? null });
      continue;
    }
    for (const key of Object.keys(b)) {
      if (JSON.stringify(b[key]) !== JSON.stringify(a[key])) {
        mismatches.push({ reason: "field_diff", index: i, id: b.id ?? a.id, key, baseline: b[key], after: a[key] });
      }
    }
  }

  const out = {
    measuredAt: new Date().toISOString(),
    venueId: FANCY,
    candidateEvents: candidateIds.size,
    eventsLoaded: events.length,
    beforeQueryBundle: beforeBundle,
    afterQueryBundle: afterBundle.map((r) => ({ label: r.label, ms: r.ms, rows: r.rows, bytes: r.bytes })),
    payloadBytes: {
      beforeMedian: median(beforeBundle.map((r) => r.bytes)),
      afterMedian: median(afterBundle.map((r) => r.bytes)),
      beforeMsMedian: median(beforeBundle.map((r) => r.ms)),
      afterMsMedian: median(afterBundle.map((r) => r.ms)),
    },
    parity: {
      baselineCount: baselineItems.length,
      afterCount: afterItems.length,
      mismatches: mismatches.length,
      details: mismatches.slice(0, 30),
    },
    afterFocusItems: afterItems,
  };

  writeFileSync(join(OUT, "parity-after.json"), JSON.stringify(out, null, 2));
  copyFileSync(join(OUT, "parity-after.json"), join(DESKTOP, "parity-after.json"));
  console.log(JSON.stringify({
    payloadBytes: out.payloadBytes,
    parity: out.parity,
    candidateEvents: out.candidateEvents,
    eventsLoaded: out.eventsLoaded,
    afterIds: afterItems.map((i) => i.id),
  }, null, 2));
  if (mismatches.length > 0) process.exit(2);
}

function median(nums: number[]) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

main().catch((e) => { console.error(e); process.exit(1); });
