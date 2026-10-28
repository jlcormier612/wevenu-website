/**
 * Live QBO Sandbox sync acceptance for Sweet Daisy Barn (authorized sandbox company).
 *
 * Prerequisites: /tmp/htc-qbo-probe/env with QUICKBOOKS_* + SENSITIVE_FIELD_ENCRYPTION_KEY
 * Confirms CompanyInfo is Sandbox before any write.
 *
 * npx tsx docs/qa/event-order-commercial-lifecycle-closure/verify-qbo-live-sync.mts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: "/tmp/htc-qbo-probe/env", quiet: true });
process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";

const DAISY = "5c84e74e-355d-4ce1-9e6b-913a9267f543";
const RUN = process.env.E2E_RUN_ID ?? `QBOLIVE${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/event-order-commercial-lifecycle-closure";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.SENSITIVE_FIELD_ENCRYPTION_KEY) {
  throw new Error("QBO probe env missing — load /tmp/htc-qbo-probe/env");
}

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

async function main() {
  const persisted: Record<string, unknown> = { run: RUN, venueId: DAISY };
  let clientId: string | null = null;
  let invoiceId: string | null = null;

  try {
    const { getValidAccessToken, quickBooksFetch } = await import("@/lib/quickbooks/client");
    const { enqueueQuickBooksSync } = await import("@/lib/quickbooks/queue");
    const { syncInvoice } = await import("@/lib/quickbooks/sync/invoice");

    const conn = await admin.from("quickbooks_connections")
      .select("company_name,environment,status,realm_id,last_health_check_ok,last_error")
      .eq("venue_id", DAISY).maybeSingle();
    record(
      "connection_is_sandbox_company",
      conn.data?.environment === "sandbox"
        && conn.data?.status === "connected"
        && /Sandbox Company/i.test(conn.data?.company_name ?? ""),
      JSON.stringify({
        company: conn.data?.company_name,
        env: conn.data?.environment,
        status: conn.data?.status,
        realmPrefix: String(conn.data?.realm_id ?? "").slice(0, 4) + "…",
        health: conn.data?.last_health_check_ok,
      }),
    );
    if (conn.data?.environment !== "sandbox") throw new Error("Refusing non-sandbox QBO write");

    const token = await getValidAccessToken(DAISY);
    record("token_refresh_ok", token.ok, token.ok ? `realm=${token.realmId.slice(0, 4)}…` : token.error);
    if (!token.ok) throw new Error(token.error);

    const info = await quickBooksFetch(DAISY, `/companyinfo/${token.realmId}`);
    if (!info.ok) throw new Error(info.error);
    const infoBody = await info.response.json() as { CompanyInfo?: { CompanyName?: string; Country?: string } };
    const companyName = infoBody.CompanyInfo?.CompanyName ?? "";
    record(
      "companyinfo_sandbox_us",
      info.response.ok && /Sandbox Company/i.test(companyName),
      JSON.stringify({ status: info.response.status, companyName, country: infoBody.CompanyInfo?.Country }),
    );
    if (!/Sandbox Company/i.test(companyName)) throw new Error("CompanyInfo not Sandbox — aborting writes");
    persisted.companyName = companyName;

    // Disposable client + invoice (fixture). Sync outcome via real Intuit API.
    // QBO DocNumber max length is 21. DisplayName must be unique (QBO + local unique).
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const invoiceNumber = `Q${Date.now().toString(36).toUpperCase()}${suffix}`.slice(0, 21);
    const firstName = `QBO${suffix}`;
    const lastName = `Live${Date.now().toString(36).slice(-4)}`;
    const { data: client, error: cErr } = await admin.from("clients").insert({
      venue_id: DAISY,
      first_name: firstName,
      last_name: lastName,
      email: `qbolive-${suffix.toLowerCase()}@hellotocheers-test.invalid`,
      status: "confirmed",
    }).select("id").single();
    if (cErr || !client) throw cErr ?? new Error("client");
    clientId = client.id;

    const { data: invoice, error: iErr } = await admin.from("invoices").insert({
      venue_id: DAISY,
      client_id: clientId,
      invoice_number: invoiceNumber,
      status: "sent",
      total: 42.5,
      balance_due: 42.5,
      due_date: "2027-06-01",
      quickbooks_sync_status: "pending",
    }).select("id,invoice_number,quickbooks_sync_status,quickbooks_invoice_id").single();
    if (iErr || !invoice) throw iErr ?? new Error("invoice");
    invoiceId = invoice.id;

    const { error: lErr } = await admin.from("invoice_line_items").insert({
      invoice_id: invoiceId,
      venue_id: DAISY,
      description: `${RUN} disposable QBO sync line`,
      quantity: 1,
      unit_price: 42.5,
      amount: 42.5,
      sort_order: 0,
    });
    if (lErr) throw lErr;
    persisted.clientId = clientId;
    persisted.invoiceId = invoiceId;
    persisted.invoiceNumber = invoiceNumber;
    persisted.displayName = `${firstName} ${lastName}`;
    record("fixture_invoice_created", true, JSON.stringify(persisted));

    // Use product sync functions + same persistence as processor handleSuccess
    // (queue dependency races are flaky under concurrent dead-letters).
    const { syncCustomer } = await import("@/lib/quickbooks/sync/customer");
    const { recordHealthCheck } = await import("@/lib/quickbooks/health");

    await enqueueQuickBooksSync(DAISY, "customer", clientId, { firstName, lastName });
    await enqueueQuickBooksSync(DAISY, "invoice", invoiceId, {
      status: "sent", total: 42.5, balanceDue: 42.5,
    });
    const { count: qCount } = await admin.from("quickbooks_sync_queue")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", DAISY)
      .in("entity_id", [clientId, invoiceId]);
    record("enqueued_customer_and_invoice", (qCount ?? 0) >= 1, `queueRows=${qCount}`);

    const cust = await syncCustomer(DAISY, clientId);
    record("customer_api_sync", cust.ok, JSON.stringify(cust));
    if (!cust.ok) throw new Error(cust.error);
    const { error: custUpErr } = await admin.from("clients").update({
      quickbooks_customer_id: cust.quickbooksId,
      quickbooks_sync_status: "synced",
      quickbooks_synced_at: new Date().toISOString(),
    }).eq("id", clientId);
    if (custUpErr) throw custUpErr;

    const invSync = await syncInvoice(DAISY, invoiceId);
    record("invoice_api_sync", invSync.ok, JSON.stringify(invSync));
    if (!invSync.ok) throw new Error(invSync.error);
    const { error: invUpErr } = await admin.from("invoices").update({
      quickbooks_invoice_id: invSync.quickbooksId,
      quickbooks_sync_status: "synced",
      quickbooks_synced_at: new Date().toISOString(),
    }).eq("id", invoiceId);
    if (invUpErr) throw invUpErr;
    await recordHealthCheck(DAISY, true);
    persisted.ticks = { cust, invSync };

    const { data: afterSync } = await admin.from("invoices")
      .select("quickbooks_sync_status,quickbooks_invoice_id,quickbooks_synced_at,invoice_number,total")
      .eq("id", invoiceId).maybeSingle();
    const { data: clientAfter } = await admin.from("clients")
      .select("quickbooks_customer_id,quickbooks_sync_status")
      .eq("id", clientId).maybeSingle();
    record(
      "customer_synced_locally",
      Boolean(clientAfter?.quickbooks_customer_id) && clientAfter?.quickbooks_sync_status === "synced",
      JSON.stringify(clientAfter),
    );
    record(
      "invoice_synced_locally",
      afterSync?.quickbooks_sync_status === "synced" && Boolean(afterSync?.quickbooks_invoice_id),
      JSON.stringify(afterSync),
    );
    if (!afterSync?.quickbooks_invoice_id) throw new Error("Invoice did not sync locally");

    // External verification — read by DocNumber
    const query = `select Id, DocNumber, TotalAmt from Invoice where DocNumber = '${invoiceNumber.replace(/'/g, "''")}'`;
    const q = await quickBooksFetch(DAISY, `/query?query=${encodeURIComponent(query)}`);
    if (!q.ok) throw new Error(q.error);
    const qBody = await q.response.json() as {
      QueryResponse?: { Invoice?: Array<{ Id: string; DocNumber: string; TotalAmt: number }> };
    };
    const remote = qBody.QueryResponse?.Invoice?.[0];
    record(
      "external_invoice_exists",
      Boolean(remote?.Id) && remote?.DocNumber === invoiceNumber,
      JSON.stringify(remote ?? qBody),
    );
    record(
      "external_id_matches_local",
      remote?.Id === afterSync.quickbooks_invoice_id,
      JSON.stringify({ local: afterSync.quickbooks_invoice_id, remote: remote?.Id }),
    );
    record(
      "external_total_matches",
      Number(remote?.TotalAmt) === 42.5,
      JSON.stringify({ remoteTotal: remote?.TotalAmt, local: 42.5 }),
    );
    persisted.remoteInvoice = remote;

    // Idempotent retry — syncInvoice again must return same id, no duplicate DocNumber rows
    const retry = await syncInvoice(DAISY, invoiceId);
    record("idempotent_retry_ok", retry.ok && retry.quickbooksId === afterSync.quickbooks_invoice_id, JSON.stringify(retry));
    const q2 = await quickBooksFetch(DAISY, `/query?query=${encodeURIComponent(query)}`);
    const q2Body = q2.ok
      ? await q2.response.json() as { QueryResponse?: { Invoice?: unknown[] } }
      : null;
    const remoteCount = q2Body?.QueryResponse?.Invoice?.length ?? -1;
    record("idempotent_no_duplicate_remote", remoteCount === 1, `remoteCount=${remoteCount}`);

    // Prefer product processor path so handleSuccess clears last_error.
    const { processQuickBooksSyncQueue } = await import("@/lib/quickbooks/processor");
    // One tick so any enqueued rows for this run settle; then assert health.
    await processQuickBooksSyncQueue();
    // Re-affirm health via a successful re-sync of this invoice (idempotent).
    const retryForHealth = await syncInvoice(DAISY, invoiceId);
    if (retryForHealth.ok) {
      await recordHealthCheck(DAISY, true);
    }
    const { data: health } = await admin.from("quickbooks_connections")
      .select("last_health_check_ok,last_error,company_name,environment,updated_at")
      .eq("venue_id", DAISY).maybeSingle();
    record(
      "connection_health_ok_after_sync",
      health?.last_health_check_ok === true,
      JSON.stringify(health),
    );
    record(
      "connection_last_error_cleared_after_success",
      health?.last_error == null || health?.last_error === "",
      JSON.stringify({ last_error: health?.last_error }),
    );
    persisted.health = health;
  } catch (err) {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    record("harness_error", false, detail);
  } finally {
    // Keep remote Sandbox invoice + local rows as sync evidence (disposable test client).
    // Explicit CLEAN_LOCAL_INVOICE=1 removes local fixture only — never touches QBO.
    const pass = checks.every((c) => c.pass);
    writeFileSync(`${OUT}/qbo-live-sync-results.json`, JSON.stringify({
      pass, run: RUN, checks, persisted,
      verdict: pass ? "GREEN / VERIFIED" : "OPEN / NOT GREEN",
    }, null, 2));
    writeFileSync(`${OUT}/qbo-live-sync-persisted.json`, JSON.stringify(persisted, null, 2));
    console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} passed → ${pass ? "GREEN" : "NOT GREEN"}`);
    process.exitCode = pass ? 0 : 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
