/**
 * Focused QuickBooks acceptance: tax+discount HTC fidelity + partial/full refunds.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { syncCustomer } from "../../lib/quickbooks/sync/customer.ts";
import { syncInvoice } from "../../lib/quickbooks/sync/invoice.ts";
import { syncPayment } from "../../lib/quickbooks/sync/payment.ts";
import { syncRefund } from "../../lib/quickbooks/sync/refund.ts";
import { quickBooksFetch } from "../../lib/quickbooks/client.ts";

const venueId = "5c84e74e-355d-4ce1-9e6b-913a9267f543";
const stamp = Date.now().toString(36).slice(-6);
const outDir = `${process.env.HOME}/Desktop/HTC-WS3-INTEGRATIONS/INTUIT-PRODUCTION-COMPLIANCE/sandbox-acceptance`;
mkdirSync(outDir, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const results: Record<string, unknown>[] = [];
function record(name: string, data: Record<string, unknown>) {
  results.push({ name, ...data });
  console.log(JSON.stringify({ name, ...data }));
}

async function qboGet(path: string) {
  const res = await quickBooksFetch(venueId, path);
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, json: await res.response.json(), tid: res.response.headers.get("intuit_tid") };
}

async function main() {
  const { data: client, error: cErr } = await admin.from("clients").insert({
    venue_id: venueId,
    first_name: "HTC",
    last_name: `RefTax${stamp}`,
    email: `htc-reftax-${stamp}@example.invalid`,
    status: "confirmed",
  }).select("id").single();
  if (cErr || !client) throw new Error(cErr?.message ?? "client");
  const cust = await syncCustomer(venueId, client.id);
  if (!cust.ok) throw new Error(cust.error);
  await admin.from("clients").update({
    quickbooks_customer_id: cust.quickbooksId,
    quickbooks_sync_status: "synced",
  }).eq("id", client.id);

  // --- Tax + discount with HTC-intended amounts (tax after discount) ---
  const bothNumber = `HA-TD-${stamp}`.slice(0, 21);
  const { data: bothInv, error: bErr } = await admin.from("invoices").insert({
    venue_id: venueId,
    client_id: client.id,
    invoice_number: bothNumber,
    status: "sent",
    subtotal: 1000,
    discount_amount: 100,
    tax_amount: 72,
    total: 972,
    balance_due: 972,
    issued_at: new Date().toISOString(),
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  }).select("id").single();
  if (bErr || !bothInv) throw new Error(bErr?.message ?? "both inv");
  for (const [i, line] of [
    { type: "package", description: "Venue package", quantity: 1, unit_price: 1000, amount: 1000 },
    { type: "discount", description: "Discount", quantity: 1, unit_price: 100, amount: 100 },
    { type: "tax", description: "Tax", quantity: 1, unit_price: 72, amount: 72 },
  ].entries()) {
    const { error } = await admin.from("invoice_line_items").insert({
      invoice_id: bothInv.id, venue_id: venueId, sort_order: i + 1, ...line,
    });
    if (error) throw new Error(error.message);
  }
  const bothSync = await syncInvoice(venueId, bothInv.id);
  record("tax_discount_sync", bothSync);
  if (!bothSync.ok) throw new Error(`tax+discount sync failed: ${bothSync.error}`);
  await admin.from("invoices").update({
    quickbooks_invoice_id: bothSync.quickbooksId,
    quickbooks_sync_status: "synced",
  }).eq("id", bothInv.id);
  const bothRemote = await qboGet(`/invoice/${bothSync.quickbooksId}`);
  if (!bothRemote.ok) throw new Error(bothRemote.error);
  const bi = bothRemote.json.Invoice;
  const taxAmt = Number(bi.TxnTaxDetail?.TotalTax ?? 0);
  const totalAmt = Number(bi.TotalAmt);
  const lines = (bi.Line ?? []).map((l: { DetailType: string; Amount: number; Description?: string; SalesItemLineDetail?: { TaxCodeRef?: { value?: string } } }) => ({
    DetailType: l.DetailType,
    Amount: l.Amount,
    Description: l.Description,
    TaxCodeRef: l.SalesItemLineDetail?.TaxCodeRef?.value ?? null,
  }));
  const sales = lines.filter((l: { DetailType: string }) => l.DetailType === "SalesItemLineDetail");
  const salesSum = sales.reduce((s: number, l: { Amount: number }) => s + Number(l.Amount), 0);
  record("tax_discount_remote", {
    Id: bi.Id,
    DocNumber: bi.DocNumber,
    TotalAmt: totalAmt,
    TotalTax: taxAmt,
    LineSummary: lines,
    htc: { subtotal: 1000, discount: 100, tax: 72, total: 972 },
    salesNet: salesSum,
    totalMatch: Math.abs(totalAmt - 972) <= 0.01,
    taxMatch: Math.abs(taxAmt - 72) <= 0.01,
    salesNetMatch: Math.abs(salesSum - 900) <= 0.01,
    noDiscountLineDetail: !lines.some((l: { DetailType: string }) => l.DetailType === "DiscountLineDetail"),
    intuit_tid: bothRemote.tid,
  });

  // Idempotent
  const bothAgain = await syncInvoice(venueId, bothInv.id);
  record("tax_discount_idempotent", {
    ok: bothAgain.ok,
    sameId: bothAgain.ok && bothAgain.quickbooksId === bothSync.quickbooksId,
  });

  // --- Refunds on a separate non-tax invoice ---
  const payNumber = `HA-RF-${stamp}`.slice(0, 21);
  const { data: payInv, error: pInvErr } = await admin.from("invoices").insert({
    venue_id: venueId,
    client_id: client.id,
    invoice_number: payNumber,
    status: "sent",
    subtotal: 400,
    discount_amount: 0,
    tax_amount: 0,
    total: 400,
    balance_due: 400,
    issued_at: new Date().toISOString(),
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  }).select("id").single();
  if (pInvErr || !payInv) throw new Error(pInvErr?.message ?? "pay inv");
  await admin.from("invoice_line_items").insert({
    invoice_id: payInv.id, venue_id: venueId, type: "package",
    description: "Refund package", quantity: 1, unit_price: 400, amount: 400, sort_order: 1,
  });
  const invSync = await syncInvoice(venueId, payInv.id);
  if (!invSync.ok) throw new Error(invSync.error);
  await admin.from("invoices").update({
    quickbooks_invoice_id: invSync.quickbooksId,
    quickbooks_sync_status: "synced",
  }).eq("id", payInv.id);

  const { data: sch, error: sErr } = await admin.from("payment_schedules").insert({
    venue_id: venueId, invoice_id: payInv.id, client_id: client.id,
    title: `HTC-RF-${stamp}`, total_amount: 400, currency: "USD",
  }).select("id").single();
  if (sErr || !sch) throw new Error(sErr?.message ?? "sch");
  const { data: pli, error: pliErr } = await admin.from("payment_line_items").insert({
    venue_id: venueId, schedule_id: sch.id, amount: 400, paid_amount: 400,
    refunded_amount: 0, status: "paid", paid_at: new Date().toISOString(),
    label: `HTC-RF-PAY-${stamp}`, payment_method: "stripe", sort_order: 1,
  }).select("id").single();
  if (pliErr || !pli) throw new Error(pliErr?.message ?? "pli");
  const paySync = await syncPayment(venueId, pli.id);
  record("payment_full_sync", paySync);
  if (!paySync.ok) throw new Error(paySync.error);
  await admin.from("payment_line_items").update({
    quickbooks_payment_id: paySync.quickbooksId,
    quickbooks_sync_status: "synced",
  }).eq("id", pli.id);

  const beforePay = await qboGet(`/payment/${paySync.quickbooksId}`);
  const beforeInv = await qboGet(`/invoice/${invSync.quickbooksId}`);
  record("before_refund", {
    paymentTotal: beforePay.ok ? beforePay.json.Payment?.TotalAmt : null,
    invoiceBalance: beforeInv.ok ? beforeInv.json.Invoice?.Balance : null,
    invoiceTotal: beforeInv.ok ? beforeInv.json.Invoice?.TotalAmt : null,
  });

  // Partial refund $150 → net retained $250
  await admin.from("payment_line_items").update({ refunded_amount: 150 }).eq("id", pli.id);
  const partial = await syncRefund(venueId, pli.id);
  record("refund_partial_sync", partial);
  if (!partial.ok) throw new Error(partial.error);
  await admin.from("payment_line_items").update({
    quickbooks_refund_net_synced: partial.ok ? partial.refundNetSynced : null,
  }).eq("id", pli.id);
  const afterPartialPay = await qboGet(`/payment/${paySync.quickbooksId}`);
  const afterPartialInv = await qboGet(`/invoice/${invSync.quickbooksId}`);
  const partialPayTotal = afterPartialPay.ok ? Number(afterPartialPay.json.Payment?.TotalAmt) : null;
  const partialInvBal = afterPartialInv.ok ? Number(afterPartialInv.json.Invoice?.Balance) : null;
  const partialApplied = afterPartialPay.ok
    ? (afterPartialPay.json.Payment?.Line ?? []).reduce(
      (s: number, l: { Amount?: number }) => s + Number(l.Amount ?? 0), 0,
    )
    : null;
  record("refund_partial_remote", {
    paymentTotal: partialPayTotal,
    paymentApplied: partialApplied,
    invoiceBalance: partialInvBal,
    expectedPaymentTotal: 250,
    expectedInvoiceBalance: 150, // 400 - 250 retained
    paymentMatch: partialPayTotal != null && Math.abs(partialPayTotal - 250) <= 0.01,
    balanceMatch: partialInvBal != null && Math.abs(partialInvBal - 150) <= 0.01,
    treatment: "Payment update (not void) — TotalAmt reduced to net retained",
    intuit_tid: afterPartialPay.ok ? afterPartialPay.tid : null,
  });

  // Idempotent partial
  const partialAgain = await syncRefund(venueId, pli.id);
  record("refund_partial_idempotent", {
    ok: partialAgain.ok,
    sameNet: partialAgain.ok && partialAgain.refundNetSynced === 250,
  });

  // Full refund of remainder → void (net 0)
  await admin.from("payment_line_items").update({ refunded_amount: 400 }).eq("id", pli.id);
  const full = await syncRefund(venueId, pli.id);
  record("refund_full_sync", full);
  if (!full.ok) throw new Error(full.error);
  await admin.from("payment_line_items").update({
    quickbooks_refund_net_synced: full.ok ? full.refundNetSynced : null,
  }).eq("id", pli.id);
  const afterFullPay = await qboGet(`/payment/${paySync.quickbooksId}`);
  const afterFullInv = await qboGet(`/invoice/${invSync.quickbooksId}`);
  const fullPayTotal = afterFullPay.ok ? Number(afterFullPay.json.Payment?.TotalAmt) : null;
  const fullInvBal = afterFullInv.ok ? Number(afterFullInv.json.Invoice?.Balance) : null;
  const privateNote = afterFullPay.ok ? afterFullPay.json.Payment?.PrivateNote : null;
  record("refund_full_remote", {
    paymentTotal: fullPayTotal,
    invoiceBalance: fullInvBal,
    PrivateNote: privateNote,
    expectedPaymentTotal: 0,
    expectedInvoiceBalance: 400,
    paymentMatch: fullPayTotal != null && Math.abs(fullPayTotal - 0) <= 0.01,
    balanceMatch: fullInvBal != null && Math.abs(fullInvBal - 400) <= 0.01,
    voidedNote: typeof privateNote === "string" && /voided/i.test(privateNote),
    treatment: "Full refund voids Payment after deposit check; invoice balance restored",
    intuit_tid: afterFullPay.ok ? afterFullPay.tid : null,
  });

  const fullAgain = await syncRefund(venueId, pli.id);
  record("refund_full_idempotent", {
    ok: fullAgain.ok,
    sameNet: fullAgain.ok && fullAgain.refundNetSynced === 0,
  });

  const path = `${outDir}/FOCUSED-REFUND-TAX-${stamp}.json`;
  writeFileSync(path, JSON.stringify({ stamp, venueId, results }, null, 2));
  console.log("WROTE", path);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
