/**
 * Incremental EO invoicing — Sandbox browser + persist acceptance.
 * EXPECTED_SHA=<sha> npx tsx docs/qa/incremental-eo-invoicing/verify-browser.mts
 *
 * Uses Fancy B2P event. Seeds a sent EO invoice with one frozen billable line,
 * adds a second billable EO line, exercises Invoice new charges, sends the
 * incremental draft, and verifies original invoice / plan / portal balances.
 * Production untouched. Does not rotate credentials.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  isBillableEventOrderLineForInvoice,
  unbilledBillableEventOrderLines,
  unbilledSelectionsTotal,
} from "../../../lib/client-choices/unbilled-delta.ts";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const CLIENT_ID = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const OUT = "docs/qa/incremental-eo-invoicing";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1200) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

async function servingImage(): Promise<string> {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  await admin.from("venue_staff_active_context").upsert({
    user_id: otp.session.user.id,
    active_venue_id: FANCY,
  });
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: FANCY,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function loadEo() {
  const { data: eo } = await admin.from("event_orders").select("id,status").eq("event_id", EVENT).maybeSingle();
  if (!eo) throw new Error("missing event order");
  const { data: lines } = await admin.from("event_order_lines")
    .select("id,description,is_included,unit_price,amount,provenance,package_id,quantity,sort_order")
    .eq("event_order_id", eo.id)
    .order("sort_order");
  return { eoId: eo.id as string, lines: lines ?? [] };
}

async function eoInvoices(eoId: string) {
  const { data } = await admin.from("invoices")
    .select("id,status,total,balance_due,subtotal,event_order_id,display_name,invoice_number,amends_invoice_id,created_at")
    .eq("event_order_id", eoId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function invoiceLines(invoiceId: string) {
  const { data } = await admin.from("invoice_line_items")
    .select("id,description,amount,unit_price,event_order_line_id,type")
    .eq("invoice_id", invoiceId);
  return data ?? [];
}

async function schedulesForInvoice(invoiceId: string) {
  const { data } = await admin.from("payment_schedules")
    .select("id,invoice_id,total_amount,title,created_at")
    .eq("invoice_id", invoiceId);
  return data ?? [];
}

async function main() {
  let serving = "";
  const runTag = `incr-${Date.now().toString(36)}`;
  let originalInvoiceId: string | null = null;
  let incrementalInvoiceId: string | null = null;
  let originalSnapshot: { total: number; balance_due: number; status: string } | null = null;
  let originalPlanIds: string[] = [];
  let newLineId: string | null = null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  try {
    serving = await servingImage();
    record("serving_sha", serving.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${serving}`);
    if (!serving.includes(EXPECTED.slice(0, 12))) throw new Error("serving mismatch — abort before mutating");

    let { eoId, lines } = await loadEo();

    // Ensure at least one billable frozen line on a sent EO invoice.
    let billable = lines.filter((l) => isBillableEventOrderLineForInvoice({
      amount: Number(l.amount),
      unitPrice: l.unit_price == null ? null : Number(l.unit_price),
      isIncluded: !!l.is_included,
    }));

    if (billable.length === 0) {
      const { data: seeded, error } = await admin.from("event_order_lines").insert({
        event_order_id: eoId,
        venue_id: FANCY,
        provenance: "custom",
        description: `Incremental seed bar ${runTag}`,
        quantity: 1,
        unit_price: 750,
        amount: 750,
        is_included: false,
        sort_order: 9000,
      }).select("id,description,is_included,unit_price,amount,provenance,package_id,quantity,sort_order").single();
      if (error) throw error;
      lines = [...lines, seeded];
      billable = [seeded];
    }

    const invoices = await eoInvoices(eoId);
    let sent = invoices.find((i) => i.status === "sent" || i.status === "paid" || i.status === "partially_paid");
    const drafts = invoices.filter((i) => i.status === "draft");

    // Void leftover incremental drafts from prior runs so CTA is clean.
    for (const d of drafts) {
      await admin.from("invoice_line_items").update({ event_order_line_id: null }).eq("invoice_id", d.id).not("event_order_line_id", "is", null);
      await admin.from("invoices").update({ status: "void" }).eq("id", d.id);
    }
    // Also clear event_order_line_id on voided rows (unique index / eligibility hygiene).
    const voided = (await eoInvoices(eoId)).filter((i) => i.status === "void");
    for (const v of voided) {
      await admin.from("invoice_line_items").update({ event_order_line_id: null }).eq("invoice_id", v.id).not("event_order_line_id", "is", null);
    }

    if (!sent) {
      // Create + freeze an original invoice for the first billable line only.
      const first = billable[0]!;
      const { data: inv, error: invErr } = await admin.from("invoices").insert({
        venue_id: FANCY,
        client_id: CLIENT_ID,
        event_id: EVENT,
        event_order_id: eoId,
        status: "draft",
        display_name: "Event & Inventory Selections",
        invoice_number: "PENDING",
        subtotal: 0,
        discount_amount: 0,
        tax_amount: 0,
        total: 0,
        balance_due: 0,
      }).select("id").single();
      if (invErr) throw invErr;
      originalInvoiceId = inv.id;
      await admin.from("invoices").update({
        invoice_number: `INV-${inv.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
      }).eq("id", inv.id);
      await page.goto(`${APP}/invoices/${originalInvoiceId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2000);
      const sendBtn = page.getByRole("button", { name: /^Send$/i }).first();
      if (await sendBtn.count()) {
        await sendBtn.click();
        await page.waitForTimeout(2500);
      } else {
        // Fallback: freeze first line via admin then mark sent (documents fallback).
        await admin.from("invoice_line_items").insert({
          invoice_id: originalInvoiceId,
          venue_id: FANCY,
          type: "item",
          description: first.description,
          quantity: 1,
          unit_price: Number(first.unit_price),
          amount: Number(first.amount),
          event_order_line_id: first.id,
          sort_order: 0,
        });
        await admin.from("invoices").update({
          status: "sent",
          issued_at: new Date().toISOString(),
          is_couple_visible: true,
          subtotal: Number(first.amount),
          total: Number(first.amount),
          balance_due: Number(first.amount),
        }).eq("id", originalInvoiceId);
        record("original_send_fallback_admin", true, "Send button missing — admin freeze used");
      }
      const refreshed = await eoInvoices(eoId);
      sent = refreshed.find((i) => i.id === originalInvoiceId) ?? refreshed.find((i) => i.status === "sent");
    }

    originalInvoiceId = sent!.id;
    const origLinesBefore = await invoiceLines(originalInvoiceId);
    originalSnapshot = {
      total: Number(sent!.total),
      balance_due: Number(sent!.balance_due),
      status: sent!.status,
    };
    originalPlanIds = (await schedulesForInvoice(originalInvoiceId)).map((s) => s.id);
    record("original_invoice_baseline",
      !!originalInvoiceId && origLinesBefore.some((l) => l.event_order_line_id),
      JSON.stringify({ originalInvoiceId, originalSnapshot, frozen: origLinesBefore.filter((l) => l.event_order_line_id).length, plans: originalPlanIds.length }));

    // Add a new standalone billable upgrade not yet frozen.
    // Finalized EO lines are immutable — reopen for the disposable seed only.
    const { error: reopenErr } = await admin.from("event_orders").update({
      status: "open",
      finalized_at: null,
    }).eq("id", eoId).eq("venue_id", FANCY);
    if (reopenErr) throw reopenErr;
    record("event_order_reopened_for_seed", true, `eoId=${eoId}`);

    const frozenIds = new Set(
      (await Promise.all((await eoInvoices(eoId)).filter((i) => i.status !== "void").map((i) => invoiceLines(i.id))))
        .flat()
        .map((l) => l.event_order_line_id)
        .filter((id): id is string => !!id),
    );
    const { data: newLine, error: newErr } = await admin.from("event_order_lines").insert({
      event_order_id: eoId,
      venue_id: FANCY,
      provenance: "custom",
      description: `Standalone upgrade ${runTag}`,
      quantity: 1,
      unit_price: 200,
      amount: 200,
      is_included: false,
      sort_order: 9100,
    }).select("id,description,is_included,unit_price,amount").single();
    if (newErr) throw newErr;
    newLineId = newLine.id;
    record("new_charge_seeded",
      !!newLineId && !frozenIds.has(newLineId) && isBillableEventOrderLineForInvoice({
        amount: 200, unitPrice: 200, isIncluded: false,
      }),
      JSON.stringify(newLine));

    const afterSeed = await loadEo();
    const unbilledLines = unbilledBillableEventOrderLines(
      afterSeed.lines.map((l) => ({
        id: l.id,
        amount: Number(l.amount),
        unitPrice: l.unit_price == null ? null : Number(l.unit_price),
        isIncluded: !!l.is_included,
      })),
      frozenIds,
    );
    const unbilledAmt = unbilledSelectionsTotal(
      afterSeed.lines.map((l) => ({
        id: l.id,
        amount: Number(l.amount),
        unitPrice: l.unit_price == null ? null : Number(l.unit_price),
        isIncluded: !!l.is_included,
      })),
      frozenIds,
    );
    record("unbilled_includes_new_upgrade",
      unbilledLines.some((l) => l.id === newLineId) && unbilledAmt >= 200,
      `unbilledAmt=${unbilledAmt} ids=${unbilledLines.map((l) => l.id).join(",")}`);

    // Included package-fee style line must stay non-billable.
    const includedPkg = afterSeed.lines.find((l) => l.is_included && Number(l.unit_price) > 0);
    record("included_priced_not_unbilled",
      !includedPkg || !unbilledLines.some((l) => l.id === includedPkg.id),
      includedPkg ? `included=${includedPkg.description}` : "no included-priced line on EO");

    // Browser: open event order → Invoice new charges (shown when unbilled > 0)
    await page.goto(`${APP}/events/${EVENT}?tab=event-order`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    const choicesAnchor = page.locator("#event-order-choices");
    if (await choicesAnchor.count()) await choicesAnchor.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/shots/01-event-order-before-1280.png`, fullPage: true });

    const cta = page.getByRole("button", { name: /Invoice new charges/i }).first();
    let ctaUsed = false;
    let ctaSurface = "missing";
    if (await cta.count()) {
      await cta.click();
      ctaUsed = true;
      ctaSurface = "event-order-financial-impact";
      await page.waitForTimeout(3000);
    } else {
      // Drift banner on tip of amendment chain (parent with a live child hides CTA).
      const live = (await eoInvoices(eoId)).filter((i) => i.status !== "void");
      const parentsWithChild = new Set(
        live.map((i) => i.amends_invoice_id).filter((id): id is string => !!id),
      );
      const tip = [...live].reverse().find(
        (i) =>
          (i.status === "sent" || i.status === "paid" || i.status === "partially_paid")
          && !parentsWithChild.has(i.id),
      );
      const tipId = tip?.id ?? originalInvoiceId!;
      await page.goto(`${APP}/invoices/${tipId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2000);
      const driftCta = page.getByRole("button", { name: /Invoice new charges/i }).first();
      if (await driftCta.count()) {
        await driftCta.click();
        ctaUsed = true;
        ctaSurface = `invoice-drift:${tipId}`;
        await page.waitForTimeout(3000);
      }
    }
    record("invoice_new_charges_cta", ctaUsed, ctaUsed ? `clicked via ${ctaSurface}` : "CTA missing — will seed incremental draft for send-path verify");

    let afterCta = await eoInvoices(eoId);
    let incrementalDraft = afterCta.find((i) => i.status === "draft" && i.id !== originalInvoiceId);
    if (!incrementalDraft) {
      // Still exercise freeze-on-send on an EO-linked draft that amends the original.
      const { data: draftRow, error: draftErr } = await admin.from("invoices").insert({
        venue_id: FANCY,
        client_id: CLIENT_ID,
        event_id: EVENT,
        event_order_id: eoId,
        amends_invoice_id: originalInvoiceId,
        status: "draft",
        display_name: "Event & Inventory Selections",
        invoice_number: "PENDING",
        subtotal: 0,
        discount_amount: 0,
        tax_amount: 0,
        total: 0,
        balance_due: 0,
      }).select("id,status,total,balance_due,subtotal,event_order_id,display_name,invoice_number,amends_invoice_id,created_at").single();
      if (draftErr) throw draftErr;
      await admin.from("invoices").update({
        invoice_number: `INV-${draftRow.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
      }).eq("id", draftRow.id);
      incrementalDraft = draftRow;
      afterCta = await eoInvoices(eoId);
    }
    incrementalInvoiceId = incrementalDraft?.id ?? null;
    record("incremental_draft_created",
      !!incrementalInvoiceId,
      JSON.stringify(incrementalDraft));

    if (incrementalInvoiceId) {
      await page.goto(`${APP}/invoices/${incrementalInvoiceId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2500);
      const body = await page.locator("body").innerText();
      record("draft_ui_shows_new_upgrade",
        body.includes(`Standalone upgrade ${runTag}`) || body.includes("Standalone upgrade"),
        body.slice(0, 500));
      // Draft stores no EO freeze rows until send — stored lines must not re-freeze originals.
      const draftStored = await invoiceLines(incrementalInvoiceId);
      const draftStoredEo = draftStored.map((l) => l.event_order_line_id).filter(Boolean);
      const origEo = new Set(origLinesBefore.map((l) => l.event_order_line_id).filter(Boolean));
      record("draft_ui_excludes_already_frozen",
        draftStoredEo.every((id) => !origEo.has(id as string))
          && (body.includes(`Standalone upgrade ${runTag}`) || body.includes("Standalone upgrade")),
        `storedEo=${draftStoredEo.join(",")} bodyHasUpgrade=${body.includes("Standalone upgrade")}`);
      await page.screenshot({ path: `${OUT}/shots/02-incremental-draft-1280.png`, fullPage: true });

      // Issue without auto-creating a payment plan: "Mark as issued" (draft→sent).
      // "Send" only appears when a linked schedule already exists.
      const markIssued = page.getByRole("button", { name: /Mark as issued/i }).first();
      const sendInc = page.getByRole("button", { name: /^Send$/i }).first();
      if (await markIssued.count()) {
        await markIssued.click();
        await page.waitForTimeout(3500);
        record("incremental_send_button", true, "Mark as issued");
      } else if (await sendInc.count()) {
        await sendInc.click();
        await page.waitForTimeout(2000);
        const confirmSend = page.getByRole("button", { name: /^Send$/i }).last();
        if (await confirmSend.count()) await confirmSend.click();
        await page.waitForTimeout(3000);
        record("incremental_send_button", true, "Send (+ schedule path)");
      } else {
        record("incremental_send_button", false, "Mark as issued / Send missing on incremental draft");
      }

      const { data: incAfter } = await admin.from("invoices")
        .select("id,status,total,balance_due")
        .eq("id", incrementalInvoiceId)
        .maybeSingle();
      const incFrozen = await invoiceLines(incrementalInvoiceId);
      const incEoIds = incFrozen.map((l) => l.event_order_line_id).filter(Boolean);
      record("incremental_sent",
        incAfter?.status === "sent" || incAfter?.status === "partially_paid",
        JSON.stringify(incAfter));
      record("incremental_frozen_only_new",
        incEoIds.includes(newLineId!) && !origLinesBefore.some((l) => l.event_order_line_id && incEoIds.includes(l.event_order_line_id)),
        `incEoIds=${incEoIds.join(",")} new=${newLineId}`);
      record("no_duplicate_freeze_across_invoices",
        (() => {
          const a = new Set(origLinesBefore.map((l) => l.event_order_line_id).filter(Boolean));
          return incEoIds.every((id) => !a.has(id as string));
        })(),
        "original ∩ incremental event_order_line_id empty");

      // Original unchanged
      const { data: origAfter } = await admin.from("invoices")
        .select("id,status,total,balance_due")
        .eq("id", originalInvoiceId)
        .maybeSingle();
      const origLinesAfter = await invoiceLines(originalInvoiceId);
      record("original_total_unchanged",
        Number(origAfter?.total) === originalSnapshot!.total
          && Number(origAfter?.balance_due) === originalSnapshot!.balance_due
          && origAfter?.status === originalSnapshot!.status,
        JSON.stringify({ before: originalSnapshot, after: origAfter }));
      record("original_frozen_lines_unchanged",
        origLinesAfter.filter((l) => l.event_order_line_id).length === origLinesBefore.filter((l) => l.event_order_line_id).length,
        `before=${origLinesBefore.length} after=${origLinesAfter.length}`);

      const plansAfter = await schedulesForInvoice(originalInvoiceId);
      record("original_payment_plan_untouched",
        plansAfter.map((p) => p.id).join(",") === originalPlanIds.join(","),
        `before=${originalPlanIds.join(",")} after=${plansAfter.map((p) => p.id).join(",")}`);
      const incPlans = await schedulesForInvoice(incrementalInvoiceId);
      record("incremental_did_not_auto_create_plan",
        incPlans.length === 0,
        `incPlans=${incPlans.length}`);

      // Portal: couple-visible invoices remain separate
      const { data: visible } = await admin.from("invoices")
        .select("id,status,total,balance_due,display_name,is_couple_visible")
        .eq("event_id", EVENT)
        .eq("is_couple_visible", true)
        .neq("status", "void");
      const portalIds = new Set((visible ?? []).map((v) => v.id));
      record("portal_multiple_invoices_independent",
        portalIds.has(originalInvoiceId) && portalIds.has(incrementalInvoiceId)
          && (visible ?? []).find((v) => v.id === originalInvoiceId)?.balance_due === originalSnapshot!.balance_due,
        JSON.stringify(visible));

      // QuickBooks: each invoice has its own sync identity fields (no merge)
      const { data: qbo } = await admin.from("invoices")
        .select("id,quickbooks_invoice_id,quickbooks_sync_status,total")
        .in("id", [originalInvoiceId, incrementalInvoiceId]);
      record("qbo_invoice_identity_separate",
        (qbo ?? []).length === 2
          && (qbo ?? [])[0]!.id !== (qbo ?? [])[1]!.id
          && Number((qbo ?? []).find((r) => r.id === originalInvoiceId)?.total) === originalSnapshot!.total,
        JSON.stringify(qbo));

      await page.screenshot({ path: `${OUT}/shots/03-after-send-1280.png`, fullPage: true });
    }

    // Retry send on incremental should not duplicate (already sent)
    if (incrementalInvoiceId) {
      const beforeRetry = await invoiceLines(incrementalInvoiceId);
      await page.goto(`${APP}/invoices/${incrementalInvoiceId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1500);
      const sendAgain = page.getByRole("button", { name: /^Send$/i });
      record("retry_send_not_available_or_noop",
        (await sendAgain.count()) === 0 || (await invoiceLines(incrementalInvoiceId)).length === beforeRetry.length,
        `sendButtons=${await sendAgain.count()} lines=${beforeRetry.length}`);
    }

    // Price change on frozen original line does not create unbilled duplicate id
    const frozenOrig = origLinesBefore.find((l) => l.event_order_line_id);
    if (frozenOrig?.event_order_line_id) {
      await admin.from("event_order_lines").update({ unit_price: 999, amount: 999 }).eq("id", frozenOrig.event_order_line_id);
      const latest = await loadEo();
      const frozenNow = new Set(
        (await Promise.all((await eoInvoices(eoId)).filter((i) => i.status !== "void").map((i) => invoiceLines(i.id))))
          .flat()
          .map((l) => l.event_order_line_id)
          .filter((id): id is string => !!id),
      );
      const stillUnbilled = unbilledBillableEventOrderLines(
        latest.lines.map((l) => ({
          id: l.id,
          amount: Number(l.amount),
          unitPrice: l.unit_price == null ? null : Number(l.unit_price),
          isIncluded: !!l.is_included,
        })),
        frozenNow,
      );
      record("price_change_no_silent_rebill",
        !stillUnbilled.some((l) => l.id === frozenOrig.event_order_line_id),
        `repriced=${frozenOrig.event_order_line_id} unbilled=${stillUnbilled.map((l) => l.id).join(",")}`);
      // restore price for fixture hygiene
      await admin.from("event_order_lines").update({
        unit_price: Number(frozenOrig.unit_price),
        amount: Number(frozenOrig.amount),
      }).eq("id", frozenOrig.event_order_line_id);
    } else {
      record("price_change_no_silent_rebill", false, "no frozen original line");
    }

  } finally {
    await browser.close();
    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.filter((c) => !c.pass).length;
    // Full acceptance must exercise incremental send + original preservation — not just deploy SHA.
    const required = [
      "serving_sha",
      "original_invoice_baseline",
      "new_charge_seeded",
      "incremental_draft_created",
      "incremental_frozen_only_new",
      "no_duplicate_freeze_across_invoices",
      "original_total_unchanged",
      "original_payment_plan_untouched",
      "incremental_did_not_auto_create_plan",
      "portal_multiple_invoices_independent",
      "price_change_no_silent_rebill",
    ];
    const missingRequired = required.filter((name) => !checks.some((c) => c.name === name && c.pass));
    const incomplete = missingRequired.length > 0;
    if (incomplete) {
      record(
        "acceptance_complete",
        false,
        `missing_or_failed_required=${missingRequired.join(",")}`,
      );
    }
    const passedFinal = checks.filter((c) => c.pass).length;
    const failedFinal = checks.filter((c) => !c.pass).length;
    const green = failedFinal === 0 && !incomplete;
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
      expectedSha: EXPECTED,
      serving,
      eventId: EVENT,
      originalInvoiceId,
      incrementalInvoiceId,
      newLineId,
      originalSnapshot,
      passed: passedFinal,
      failed: failedFinal,
      green,
      checks,
      productionUntouched: true,
    }, null, 2));
    console.log(`\nRESULT ${green ? "GREEN" : "NOT GREEN"} ${passedFinal}/${passedFinal + failedFinal}`);
    if (!green) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
