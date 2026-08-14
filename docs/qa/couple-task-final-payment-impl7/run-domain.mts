/**
 * Live QA — Impl 7 domain-side effects (bind + mark-paid path).
 * Mirrors lib/payments/service.ts markLineItemPaid / Stripe webhook side effects
 * via createAdminClient (same helpers: completeFinalPaymentTasksBoundToLine,
 * celebrateFinalPaymentObligationIfNeeded, triggerAutoComplete, reconcile).
 *
 * Run: npx tsx --env-file=.env.local docs/qa/couple-task-final-payment-impl7/run-domain.mts <step>
 *   steps: snapshot | bind | mark-first | mark-final | remake-final | snapshot
 */
import { createAdminClient } from "../../../integrations/supabase/admin";
import * as paymentsRepo from "../../../lib/payments/repository";
import {
  bindFinalPaymentTaskToLine,
  celebrateFinalPaymentObligationIfNeeded,
  completeFinalPaymentTasksBoundToLine,
} from "../../../lib/payments/final-payment-obligation";
import { triggerAutoComplete } from "../../../lib/playbooks/service";
import { computePaymentsReadiness } from "../../../lib/readiness/compute";
import type { Invoice } from "../../../lib/invoices/types";
import type { PaymentObligationKind } from "../../../lib/payments/types";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;

const VENUE_ID = "69cfd906-0d15-4e5c-8bab-ed106b411c34";
const CLIENT_ID = "dbfa69d6-47ad-4f9d-892d-4f06cb7f1844";
const EVENT_ID = "d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11";
const SCHEDULE_ID = "2a7d77db-5e6a-4714-8168-ae2230ac2e2d";
const FIRST_ID = "ca5b437f-2098-4ad7-890a-b1c98702a73e";
const SECOND_ID = "ad6d4268-bae1-478a-9694-a9248aa51d4d";
const FINAL_ID = "dbb97688-f9d5-477a-9f6e-ae46df67465c";
const FINAL_TASK_ID = "d315e9d6-cbf2-4161-baeb-979abbebb74d";

type Db = ReturnType<typeof createAdminClient>;

async function snapshot(admin: Db, label: string) {
  const { data: lines } = await admin
    .from("payment_line_items")
    .select("id,label,status,obligation_kind,paid_amount,sort_order")
    .eq("schedule_id", SCHEDULE_ID)
    .order("sort_order");

  const { data: task } = await admin
    .from("event_tasks")
    .select("id,title,status,auto_complete_trigger,payment_line_item_id,completed_at")
    .eq("id", FINAL_TASK_ID)
    .maybeSingle();

  const { data: luv } = await admin
    .from("luv_celebrations")
    .select("celebration_type,entity_id,fired_at")
    .eq("client_id", CLIENT_ID)
    .in("celebration_type", ["final_payment_obligation_paid", "final_payment_received"])
    .order("fired_at");

  const { data: inv } = await admin
    .from("invoices")
    .select("id,status,total,balance_due")
    .eq("client_id", CLIENT_ID);

  const obligationCount = (luv ?? []).filter((r) => r.celebration_type === "final_payment_obligation_paid").length;
  const paidInFullCount = (luv ?? []).filter((r) => r.celebration_type === "final_payment_received").length;

  const snap = {
    label,
    at: new Date().toISOString(),
    lines,
    finalTask: task,
    celebrationCounts: {
      final_payment_obligation_paid: obligationCount,
      final_payment_received: paidInFullCount,
    },
    celebrations: luv,
    invoices: inv,
  };
  console.log(JSON.stringify(snap, null, 2));
  const file = path.join(OUT, `domain-${label}.json`);
  writeFileSync(file, JSON.stringify(snap, null, 2));
  console.log("wrote", file);
  return snap;
}

/** Same side-effect list as markLineItemPaid (minus session/engagement). */
async function markPaidDomain(
  admin: Db,
  itemId: string,
  paidAmount: string,
  ref: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marked = await paymentsRepo.markItemPaid(admin as any, VENUE_ID, itemId, {
    paidAmount,
    paidDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "check",
    referenceNumber: ref,
    notes: "Impl7 live QA",
  });
  if (!marked.ok) {
    throw new Error(`markItemPaid failed: ${"message" in marked ? marked.message : "unknown"}`);
  }
  const amount = parseFloat(paidAmount.replace(/[$,]/g, ""));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await paymentsRepo.insertPaymentActivity(
    admin as any,
    VENUE_ID,
    SCHEDULE_ID,
    "payment_received",
    `Payment received: $${amount.toLocaleString()}`,
    "Via check (Impl7 live QA)",
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sch } = await (admin as any)
    .from("payment_schedules")
    .select("invoice_id, event_id")
    .eq("id", SCHEDULE_ID)
    .maybeSingle();

  if (sch?.invoice_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await paymentsRepo.reconcileInvoiceBalance(admin as any, VENUE_ID, sch.invoice_id);
  }

  let obligationCelebrated = false;
  let celebrated = false;
  if (sch?.event_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await triggerAutoComplete(
      admin as any,
      VENUE_ID,
      sch.event_id,
      "payment_received",
      "payment",
      itemId,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await completeFinalPaymentTasksBoundToLine(admin as any, VENUE_ID, itemId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: paidLine } = await (admin as any)
      .from("payment_line_items")
      .select("obligation_kind")
      .eq("id", itemId)
      .eq("venue_id", VENUE_ID)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    obligationCelebrated = await celebrateFinalPaymentObligationIfNeeded(
      admin as any,
      VENUE_ID,
      sch.event_id,
      itemId,
      (paidLine?.obligation_kind as PaymentObligationKind | null) ?? null,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: eventInvoices } = await (admin as any)
      .from("invoices")
      .select("*")
      .eq("venue_id", VENUE_ID)
      .eq("event_id", sch.event_id);
    const invoices = (eventInvoices ?? []) as unknown as Invoice[];
    if (invoices.length > 0 && computePaymentsReadiness(invoices).status === "complete") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ev } = await (admin as any)
        .from("events")
        .select("client_id")
        .eq("id", sch.event_id)
        .maybeSingle();
      if (ev?.client_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (admin as any).from("luv_celebrations").insert({
          venue_id: VENUE_ID,
          client_id: ev.client_id,
          event_id: sch.event_id,
          celebration_type: "final_payment_received",
          entity_id: sch.invoice_id,
        });
        if (!error) celebrated = true;
      }
    }
  }

  return { obligationCelebrated, celebrated };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const step = process.argv[2] ?? "snapshot";
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  if (step === "snapshot" || step === "snapshot-before") {
    await snapshot(admin, process.argv[3] ?? "snapshot");
    return;
  }

  if (step === "bind") {
    const bound = await bindFinalPaymentTaskToLine(
      db,
      VENUE_ID,
      EVENT_ID,
      FINAL_ID,
      "final",
    );
    console.log("bindFinalPaymentTaskToLine =>", bound);
    await snapshot(admin, "after-bind");
    return;
  }

  if (step === "mark-first") {
    const result = await markPaidDomain(admin, FIRST_ID, "4319.57", "QA-IMPL7-FIRST");
    console.log("mark-first result", result);
    await snapshot(admin, "after-first");
    return;
  }

  if (step === "mark-second") {
    const result = await markPaidDomain(admin, SECOND_ID, "4319.57", "QA-IMPL7-SECOND");
    console.log("mark-second result", result);
    await snapshot(admin, "after-second");
    return;
  }

  if (step === "mark-final") {
    const result = await markPaidDomain(admin, FINAL_ID, "4320.86", "QA-IMPL7-FINAL");
    console.log("mark-final result", result);
    await snapshot(admin, "after-final");
    return;
  }

  if (step === "remake-final") {
    // Attempt duplicate mark-paid path (should fail already-paid; also re-celebrate helpers are one-shot)
    try {
      const result = await markPaidDomain(admin, FINAL_ID, "4320.86", "QA-IMPL7-FINAL-RETRY");
      console.log("remake-final unexpected ok", result);
    } catch (e) {
      console.log("remake-final expected failure:", String(e));
    }
    // Re-run celebrate + complete helpers alone (refresh/side-effect safety)
    await completeFinalPaymentTasksBoundToLine(db, VENUE_ID, FINAL_ID);
    await celebrateFinalPaymentObligationIfNeeded(db, VENUE_ID, EVENT_ID, FINAL_ID, "final");
    await snapshot(admin, "after-remake");
    return;
  }

  console.error("Unknown step", step);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
