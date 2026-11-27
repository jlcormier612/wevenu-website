/**
 * Genuine QuickBooks Sandbox acceptance for Sweet Daisy / Sandbox Company US 1ff4.
 * Disposable records only. Requires env: NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, SENSITIVE_FIELD_ENCRYPTION_KEY,
 * QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET, QUICKBOOKS_ENVIRONMENT=sandbox.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { syncCustomer } from "../../lib/quickbooks/sync/customer.ts";
import { syncInvoice } from "../../lib/quickbooks/sync/invoice.ts";
import { syncPayment } from "../../lib/quickbooks/sync/payment.ts";
import { syncRefund } from "../../lib/quickbooks/sync/refund.ts";
import { quickBooksFetch } from "../../lib/quickbooks/client.ts";
import { openQuickBooksToken } from "../../lib/quickbooks/token-crypto.ts";

const venueId = "5c84e74e-355d-4ce1-9e6b-913a9267f543";
/** Compact stamp — QuickBooks DocNumber max length is 21 chars. */
const stamp = Date.now().toString(36).slice(-6);
const outDir = `${process.env.HOME}/Desktop/HTC-WS3-INTEGRATIONS/INTUIT-PRODUCTION-COMPLIANCE/sandbox-acceptance`;
mkdirSync(outDir, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Row = Record<string, unknown>;
const results: Row[] = [];

function record(name: string, data: Row) {
  results.push({ name, at: new Date().toISOString(), ...data });
  console.log(JSON.stringify({ name, ...data }));
}

async function qboGet(path: string) {
  const res = await quickBooksFetch(venueId, path);
  if (!res.ok) return { ok: false as const, error: res.error };
  const json = await res.response.json();
  const tid = res.response.headers.get("intuit_tid");
  return { ok: true as const, json, intuit_tid: tid };
}

async function main() {
  const { data: conn } = await admin.from("quickbooks_connections").select("*").eq("venue_id", venueId).single();
  if (!conn || conn.status !== "connected") throw new Error("Sweet Daisy not connected");
  const realm = openQuickBooksToken(conn.realm_id);
  record("connection", {
    company: conn.company_name,
    realm,
    income_account: conn.default_income_account_name,
    item_id: conn.default_item_quickbooks_id,
  });

  // --- Customer ---
  const displayLast = `Accept${stamp}`;
  const { data: client, error: cErr } = await admin.from("clients").insert({
    venue_id: venueId,
    first_name: "HTC",
    last_name: displayLast,
    email: `htc-accept-${stamp}@example.invalid`,
    phone: null,
    partner_first_name: null,
    partner_last_name: null,
    status: "confirmed",
  }).select("id,first_name,last_name,quickbooks_customer_id").single();
  if (cErr || !client) throw new Error(`client insert: ${cErr?.message}`);
  const custSync = await syncCustomer(venueId, client.id);
  record("customer_sync", { ...custSync, clientId: client.id });
  if (!custSync.ok) throw new Error(`customer sync failed: ${custSync.error}`);
  await admin.from("clients").update({
    quickbooks_customer_id: custSync.quickbooksId,
    quickbooks_sync_status: "synced",
    quickbooks_synced_at: new Date().toISOString(),
  }).eq("id", client.id);

  // Idempotent rematch
  const custAgain = await syncCustomer(venueId, client.id);
  record("customer_idempotent", {
    ok: custAgain.ok,
    sameId: custAgain.ok && custAgain.quickbooksId === custSync.quickbooksId,
    quickbooksId: custAgain.ok ? custAgain.quickbooksId : null,
    error: custAgain.ok ? null : custAgain.error,
  });

  async function createInvoice(opts: {
    tag: string;
    lines: Array<{ type: string; description: string; quantity: number; unit_price: number; amount: number }>;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total: number;
  }) {
    // DocNumber ≤21: e.g. HA-NT-abc123 (≤14) — never use long ISO stamps
    const number = `HA-${opts.tag.slice(0, 4)}-${stamp}`.slice(0, 21);
    const { data: inv, error } = await admin.from("invoices").insert({
      venue_id: venueId,
      client_id: client.id,
      invoice_number: number,
      status: "sent",
      subtotal: opts.subtotal,
      discount_amount: opts.discount_amount,
      tax_amount: opts.tax_amount,
      total: opts.total,
      balance_due: opts.total,
      issued_at: new Date().toISOString(),
      due_date: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
    }).select("id,invoice_number").single();
    if (error || !inv) throw new Error(`invoice ${opts.tag}: ${error?.message}`);
    let sort = 1;
    for (const line of opts.lines) {
      const { error: lerr } = await admin.from("invoice_line_items").insert({
        invoice_id: inv.id,
        venue_id: venueId,
        type: line.type,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount: line.amount,
        sort_order: sort++,
      });
      if (lerr) throw new Error(`line ${opts.tag}: ${lerr.message}`);
    }
    const sync = await syncInvoice(venueId, inv.id);
    record(`invoice_${opts.tag}_sync`, { invoiceId: inv.id, number, ...sync });
    if (sync.ok) {
      await admin.from("invoices").update({
        quickbooks_invoice_id: sync.quickbooksId,
        quickbooks_sync_status: "synced",
        quickbooks_synced_at: new Date().toISOString(),
      }).eq("id", inv.id);
      const remote = await qboGet(`/invoice/${sync.quickbooksId}`);
      if (remote.ok) {
        const invoice = remote.json.Invoice;
        record(`invoice_${opts.tag}_remote`, {
          Id: invoice?.Id,
          DocNumber: invoice?.DocNumber,
          TotalAmt: invoice?.TotalAmt,
          Balance: invoice?.Balance,
          TxnTaxDetail: invoice?.TxnTaxDetail ?? null,
          GlobalTaxCalculation: invoice?.GlobalTaxCalculation ?? null,
          LineSummary: (invoice?.Line ?? []).map((l: Row) => ({
            DetailType: l.DetailType,
            Amount: l.Amount,
            Description: l.Description,
            TaxCodeRef: (l.SalesItemLineDetail as Row | undefined)?.TaxCodeRef ?? null,
          })),
          htc: {
            subtotal: opts.subtotal,
            discount: opts.discount_amount,
            tax: opts.tax_amount,
            total: opts.total,
          },
          totalMatch: Math.abs(Number(invoice?.TotalAmt) - opts.total) <= 0.01,
          intuit_tid: remote.intuit_tid,
        });
      } else {
        record(`invoice_${opts.tag}_remote`, { ok: false, error: remote.error });
      }
    }
    // Idempotent retry
    const again = await syncInvoice(venueId, inv.id);
    record(`invoice_${opts.tag}_idempotent`, {
      ok: again.ok,
      sameId: again.ok && sync.ok && again.quickbooksId === sync.quickbooksId,
      quickbooksId: again.ok ? again.quickbooksId : null,
      error: again.ok ? null : again.error,
    });
    return { inv, sync };
  }

  const nontax = await createInvoice({
    tag: "NONTAX",
    lines: [{ type: "package", description: "Venue package nontax", quantity: 1, unit_price: 500, amount: 500 }],
    subtotal: 500,
    discount_amount: 0,
    tax_amount: 0,
    total: 500,
  });

  const tax = await createInvoice({
    tag: "TAX",
    lines: [
      { type: "package", description: "Venue package taxable", quantity: 1, unit_price: 1000, amount: 1000 },
      { type: "tax", description: "Tax", quantity: 1, unit_price: 80, amount: 80 },
    ],
    subtotal: 1000,
    discount_amount: 0,
    tax_amount: 80,
    total: 1080,
  });

  const disc = await createInvoice({
    tag: "DISC",
    lines: [
      { type: "package", description: "Venue package", quantity: 1, unit_price: 1000, amount: 1000 },
      { type: "discount", description: "Discount", quantity: 1, unit_price: 100, amount: 100 },
    ],
    subtotal: 1000,
    discount_amount: 100,
    tax_amount: 0,
    total: 900,
  });

  // HTC exclusive tax is on (charges − discounts): 1000 − 100 → tax 72 → total 972.
  // Taxable discounts sync as negative TAX sales lines so QBO matches (not DiscountLineDetail).
  const both = await createInvoice({
    tag: "BOTH",
    lines: [
      { type: "package", description: "Venue package", quantity: 1, unit_price: 1000, amount: 1000 },
      { type: "discount", description: "Discount", quantity: 1, unit_price: 100, amount: 100 },
      { type: "tax", description: "Tax", quantity: 1, unit_price: 72, amount: 72 },
    ],
    subtotal: 1000,
    discount_amount: 100,
    tax_amount: 72,
    total: 972,
  });

  // --- Payments on nontax invoice (500) ---
  async function createPayment(invoiceId: string, amount: number, tag: string) {
    const { data: sch, error: sErr } = await admin.from("payment_schedules").insert({
      venue_id: venueId,
      invoice_id: invoiceId,
      client_id: client.id,
      title: `HTC-ACC-${tag}`,
      total_amount: amount,
      currency: "USD",
    }).select("id").single();
    if (sErr || !sch) throw new Error(`schedule ${tag}: ${sErr?.message}`);
    const { data: pli, error: pErr } = await admin.from("payment_line_items").insert({
      venue_id: venueId,
      schedule_id: sch.id,
      amount,
      paid_amount: amount,
      refunded_amount: 0,
      status: "paid",
      paid_at: new Date().toISOString(),
      label: `HTC-ACC-PAY-${tag}`,
      payment_method: "stripe",
      sort_order: 1,
    }).select("id,paid_amount,quickbooks_payment_id").single();
    if (pErr || !pli) throw new Error(`pli ${tag}: ${pErr?.message}`);
    const sync = await syncPayment(venueId, pli.id);
    record(`payment_${tag}_sync`, { paymentId: pli.id, ...sync });
    if (sync.ok) {
      await admin.from("payment_line_items").update({
        quickbooks_payment_id: sync.quickbooksId,
        quickbooks_sync_status: "synced",
        quickbooks_synced_at: new Date().toISOString(),
      }).eq("id", pli.id);
      const remote = await qboGet(`/payment/${sync.quickbooksId}`);
      if (remote.ok) {
        const payment = remote.json.Payment;
        record(`payment_${tag}_remote`, {
          Id: payment?.Id,
          TotalAmt: payment?.TotalAmt,
          UnappliedAmt: payment?.UnappliedAmt,
          Line: payment?.Line,
          amountMatch: Math.abs(Number(payment?.TotalAmt) - amount) <= 0.01,
          intuit_tid: remote.intuit_tid,
        });
      }
    }
    const again = await syncPayment(venueId, pli.id);
    record(`payment_${tag}_idempotent`, {
      ok: again.ok,
      sameId: again.ok && sync.ok && again.quickbooksId === sync.quickbooksId,
    });
    return { pli, sync };
  }

  if (nontax.sync.ok) {
    // Partial then remainder as second payment for "full" coverage via two steps,
    // and a separate full-payment invoice.
    await createPayment(nontax.inv.id, 200, "PARTIAL");
    await createPayment(nontax.inv.id, 300, "REMAINDER");

    const fullInv = await createInvoice({
      tag: "FULLPAY",
      lines: [{ type: "package", description: "Full pay package", quantity: 1, unit_price: 250, amount: 250 }],
      subtotal: 250,
      discount_amount: 0,
      tax_amount: 0,
      total: 250,
    });
    if (fullInv.sync.ok) {
      const fullPay = await createPayment(fullInv.inv.id, 250, "FULL");
      // Refund full payment to $0 (void path)
      if (fullPay.sync.ok) {
        await admin.from("payment_line_items").update({
          refunded_amount: 250,
        }).eq("id", fullPay.pli.id);
        const refund = await syncRefund(venueId, fullPay.pli.id);
        record("refund_full_sync", { paymentId: fullPay.pli.id, ...refund });
        if (refund.ok) {
          await admin.from("payment_line_items").update({
            quickbooks_refund_net_synced: 0,
            quickbooks_sync_status: "synced",
            quickbooks_synced_at: new Date().toISOString(),
          }).eq("id", fullPay.pli.id);
          const remote = await qboGet(`/payment/${fullPay.sync.quickbooksId}`);
          if (remote.ok) {
            const payment = remote.json.Payment;
            record("refund_full_remote", {
              Id: payment?.Id,
              TotalAmt: payment?.TotalAmt,
              PrivateNote: payment?.PrivateNote,
              intuit_tid: remote.intuit_tid,
            });
          }
        }
      }
    }
  }

  // Controlled validation fault for intuit_tid evidence
  const bad = await quickBooksFetch(venueId, "/invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      CustomerRef: { value: custSync.ok ? custSync.quickbooksId : "1" },
      Line: [], // invalid — triggers validation
    }),
  });
  record("validation_fault_empty_lines", {
    ok: bad.ok,
    error: bad.ok ? null : bad.error,
    has_intuit_tid: bad.ok ? false : /intuit_tid=/.test(bad.error),
    has_status: bad.ok ? false : /API error \d+/.test(bad.error),
  });

  // Income account / item check
  if (conn.default_item_quickbooks_id) {
    const item = await qboGet(`/item/${conn.default_item_quickbooks_id}`);
    if (item.ok) {
      record("income_item", {
        Id: item.json.Item?.Id,
        Name: item.json.Item?.Name,
        IncomeAccountRef: item.json.Item?.IncomeAccountRef,
        intuit_tid: item.intuit_tid,
      });
    }
  }

  // Baseline mapped customers still present (reconnect continuity)
  const { data: mapped } = await admin.from("clients")
    .select("id,quickbooks_customer_id")
    .eq("venue_id", venueId)
    .not("quickbooks_customer_id", "is", null);
  record("mapping_continuity", {
    mappedCustomerCount: mapped?.length ?? 0,
    includesNew: mapped?.some((m) => m.id === client.id) ?? false,
  });

  const path = `${outDir}/ACCOUNTING-ACCEPTANCE-${stamp}.json`;
  writeFileSync(path, JSON.stringify({ stamp, venueId, realm, results }, null, 2) + "\n");
  console.log("WROTE", path);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
