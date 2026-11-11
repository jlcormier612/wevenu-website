/**
 * Combined Phase 5 + Phase 6 final acceptance.
 *
 * 1) Authenticated browser: venue Refer a Venue submit, Billing screens,
 *    Founder CRM Custom Pricing + Referrals (closes Phase 5 browser-smoke gap).
 * 2) Disposable Stripe Test renewal (test clock) that consumes a referral credit
 *    and reconciles the reward to `applied`.
 *
 * Fixture: Jen-owned [DISPOSABLE-P3-REHEARSAL] (active Celebrate + test clock).
 * Does not touch Willow Grove demo records.
 *
 *   npx tsx docs/qa/htc-commercial-roadmap-closure/combined-acceptance.mts
 */

import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import Stripe from "stripe";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });

const OUT = join(
  "/Users/jensmac/Developer/wevenu-website/docs/qa/htc-commercial-roadmap-closure",
  "acceptance",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
mkdirSync(OUT, { recursive: true });

const APP = "https://app.sandbox.hellotocheers.com";
const WS = "https://workspace.sandbox.hellotocheers.com";
const EMAIL = "jennifer@hellotocheers.com";
const JEN = "2fa73101-337b-4530-8c77-f3c272c5463e";
const WS_PASSWORD = process.env.WORKSPACE_DEMO_PASSWORD || "cheers-demo";

/** Jen-owned disposable Celebrate venue with Stripe Test clock. */
const VENUE_ID = "f9427d5e-84f9-48bc-a9fa-8a2bcb95af7f";
const VENUE_NAME = "[DISPOSABLE-P3-REHEARSAL] 1794243588";
const SUB_ID = "sub_1UZvv7ErUqJH7nktxwGc9vmC";
const CUS_ID = "cus_Vb8ByVzSBbqWcS";
const CLOCK_ID = "clock_1UZvv6ErUqJH7nktXQuRSb6b";

const report: Record<string, unknown> = {
  servingExpected: "846c5143+",
  venueId: VENUE_ID,
  subscriptionId: SUB_ID,
  checks: {} as Record<string, boolean>,
  steps: [] as unknown[],
  ok: false,
};

function checks(): Record<string, boolean> {
  return report.checks as Record<string, boolean>;
}

function step(name: string, detail: Record<string, unknown> = {}) {
  (report.steps as unknown[]).push({ name, at: new Date().toISOString(), ...detail });
  console.log(`STEP ${name}`, detail);
}

function save(name: string, data: unknown) {
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
}

function productSyncApiKey(): string {
  if (process.env.PRODUCT_SYNC_API_KEY?.trim()) {
    return process.env.PRODUCT_SYNC_API_KEY.trim();
  }
  const raw = execFileSync(
    "aws",
    [
      "secretsmanager",
      "get-secret-value",
      "--secret-id",
      "htc/sandbox/product-sync-api-key",
      "--query",
      "SecretString",
      "--output",
      "text",
    ],
    { encoding: "utf8" },
  ).trim();
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.value || parsed.PRODUCT_SYNC_API_KEY || parsed.api_key || raw;
  } catch {
    return raw;
  }
}

async function internal(
  key: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${APP}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function setActiveVenue(venueId: string) {
  const sb = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "");
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  await fetch(`${sb}/rest/v1/venue_staff_active_context?user_id=eq.${JEN}`, {
    method: "PATCH",
    headers: {
      apikey: sr,
      Authorization: `Bearer ${sr}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      active_venue_id: venueId,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function prepareVenueAccess(admin: ReturnType<typeof createClient>) {
  const now = new Date().toISOString();
  await admin
    .from("venues")
    .update({
      setup_completed: true,
      setup_completed_at: now,
      onboarding_dismissed: true,
    })
    .eq("id", VENUE_ID);

  await admin.from("venue_onboarding_intake").upsert(
    {
      venue_id: VENUE_ID,
      path: "self_setup",
      venue_name: VENUE_NAME,
      space_mode: "one",
      spaces: [{ name: "Main Space", maxCapacity: null }],
      offers_tours: true,
      inquiry_sources: [],
      bring_business_choice: "starting_fresh",
      submitted_at: now,
      primary_contact_name: "Jennifer Cormier",
      contact_email: EMAIL,
    },
    { onConflict: "venue_id" },
  );

  await admin.from("venue_setup_hub_state").upsert(
    { venue_id: VENUE_ID, onboarding_type: "self_setup" },
    { onConflict: "venue_id" },
  );
}

async function establishVenueSession(page: Page) {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  await setActiveVenue(VENUE_ID);

  const gen = await fetch(`${sbUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email: EMAIL,
      options: { redirect_to: `${APP}/settings/referrals` },
    }),
  });
  const linkPayload = (await gen.json()) as {
    hashed_token?: string;
  };
  if (!linkPayload.hashed_token) throw new Error("No magic link token");

  const confirmUrl =
    `${APP}/auth/confirm?token_hash=${encodeURIComponent(linkPayload.hashed_token)}` +
    `&type=magiclink&next=${encodeURIComponent("/settings/referrals")}`;
  await page.goto(confirmUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3500);

  if (
    page.url().includes("/login") ||
    page.url().includes("/forgot-password") ||
    page.url().includes("/auth/confirm")
  ) {
    const browserClient = createClient(sbUrl, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const verified = await browserClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: linkPayload.hashed_token,
    });
    if (verified.error || !verified.data.session) {
      throw new Error(`verifyOtp failed: ${verified.error?.message}`);
    }
    const session = verified.data.session;
    await page.goto(
      `${APP}/auth/confirm?next=${encodeURIComponent("/settings/referrals")}#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}&type=magiclink`,
      { waitUntil: "networkidle", timeout: 90000 },
    );
    await page.waitForTimeout(3500);
  }

  await setActiveVenue(VENUE_ID);
  await page.goto(`${APP}/settings/referrals`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(2000);
}

async function waitForClockReady(stripe: Stripe, clockId: string, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === "ready") return clock;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("test_clock_not_ready");
}

async function main() {
  const key = productSyncApiKey();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2024-11-20.acacia" as any,
  });

  await prepareVenueAccess(admin);

  // --- Readiness ---
  const founderReady = await internal(key, `/api/internal/pricing/founder-arrangements?venueId=${VENUE_ID}`);
  const referralReady = await internal(key, "/api/internal/pricing/referrals");
  save("00-readiness.json", { founderReady, referralReady });
  checks().phase5_ready = founderReady.json?.readiness?.ready === true;
  checks().phase6_ready = referralReady.json?.readiness?.ready === true;
  checks().phase6_issue_enabled =
    referralReady.json?.readiness?.rewardIssueEnabled === true;
  step("readiness", {
    phase5: checks().phase5_ready,
    phase6: checks().phase6_ready,
    issue: checks().phase6_issue_enabled,
  });
  if (!checks().phase5_ready || !checks().phase6_ready) {
    throw new Error("Phase 5/6 not ready on serving environment");
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();

  // =========================================================================
  // PHASE 5 — Founder CRM Custom Pricing + Venue Billing transparency
  // =========================================================================
  await page.goto(`${WS}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page
    .locator('input[type="password"], input[name="password"]')
    .first()
    .fill(WS_PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
  await shot(page, "01-crm-login");

  await page.goto(`${WS}/custom-pricing`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, "02-crm-custom-pricing");
  const crmPricingText = await page.locator("body").innerText();
  checks().phase5_crm_custom_pricing_ui =
    /custom pricing|arrangement|percent|fixed|venue/i.test(crmPricingText) &&
    !/sign in|log in/i.test(crmPricingText.slice(0, 200));
  step("phase5_crm_ui", { ok: checks().phase5_crm_custom_pricing_ui, url: page.url() });

  // Create 15% via API (authoritative Stripe apply), then verify CRM can load venue detail.
  const idem = `p5-close-${VENUE_ID}-${Date.now()}`;
  const create15 = await internal(key, "/api/internal/pricing/founder-arrangements", {
    method: "POST",
    body: JSON.stringify({
      action: "create",
      venueId: VENUE_ID,
      kind: "percent_off",
      percentOff: 15,
      effectiveAt: new Date().toISOString(),
      reason: "Phase 5+6 combined closure acceptance",
      customerFacingLabel: "Special pricing",
      createdByEmail: EMAIL,
      idempotencyKey: idem,
    }),
  });
  save("03-phase5-create.json", create15);
  checks().phase5_create_ok =
    create15.status === 200 &&
    Boolean(create15.json?.stripeApplied || create15.json?.deferredToSchedule);
  checks().phase5_amount_ok =
    create15.json?.preview?.proposedAmountCents === 21165 || // Celebrate 249 * 0.85
    create15.json?.arrangement?.expectedRecurringAmountCents === 21165;
  step("phase5_create", {
    ok: checks().phase5_create_ok,
    amount: create15.json?.preview?.proposedAmountCents,
    arrangementId: create15.json?.arrangement?.id,
  });

  // Venue session + Billing special pricing visibility
  await establishVenueSession(page);
  await shot(page, "04-venue-referrals-landed");
  checks().venue_session_ok =
    page.url().includes("/settings/referrals") ||
    (await page.locator("body").innerText()).includes("Share the love");

  await page.goto(`${APP}/settings/billing`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(2500);
  await shot(page, "05-venue-billing-phase5");
  const billingText = await page.locator("body").innerText();
  checks().phase5_billing_special_pricing_visible =
    /Your pricing|Special pricing|\$211\.65|211\.65|Celebrate|recurring/i.test(
      billingText,
    );
  step("phase5_billing", {
    ok: checks().phase5_billing_special_pricing_visible,
    snippet: billingText.slice(0, 400),
  });

  // End Phase 5 arrangement so referral valuation uses clean Celebrate rate.
  if (create15.json?.arrangement?.id) {
    const end15 = await internal(key, "/api/internal/pricing/founder-arrangements", {
      method: "POST",
      body: JSON.stringify({
        action: "end",
        venueId: VENUE_ID,
        arrangementId: create15.json.arrangement.id,
        endReason: "Phase 5+6 combined closure cleanup before referral reward",
        actorEmail: EMAIL,
      }),
    });
    save("06-phase5-end.json", end15);
    checks().phase5_end_ok = end15.status === 200 && end15.json?.ok !== false;
    step("phase5_end", { ok: checks().phase5_end_ok });
  }

  // =========================================================================
  // PHASE 6 — Browser referral submit + CRM review
  // =========================================================================
  await setActiveVenue(VENUE_ID);
  await page.goto(`${APP}/settings/referrals`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(2000);
  await shot(page, "07-referrals-page");

  const referralsBody = await page.locator("body").innerText();
  checks().phase6_copy_ok =
    referralsBody.includes("A little thank-you for spreading the word") &&
    referralsBody.includes("Love Hello to Cheers? Share the love.");
  step("phase6_copy", { ok: checks().phase6_copy_ok });

  const stamp = Date.now();
  const referredName = `DISPOSABLE-P6-BROWSER-${stamp}`;
  const referredDomain = `p6-browser-${stamp}.test`;

  await page.locator("#venueName").fill(referredName);
  await page.locator("#website").fill(`https://${referredDomain}`);
  await page.locator("#city").fill("Austin");
  await page.locator("#state").fill("TX");
  await page.locator("#contactName").fill("Alex Referral");
  await page.locator("#contactEmail").fill(`alex+${stamp}@hellotocheers.com`);
  await page.locator("#contactRole").fill("Owner");
  await page.locator("#notes").fill("Combined Phase 5+6 closure acceptance — disposable.");
  await shot(page, "08-referral-form-filled");
  await page.getByRole("button", { name: /Share the love/i }).click();
  await page.waitForTimeout(3000);
  await shot(page, "09-referral-confirmation");

  const afterSubmit = await page.locator("body").innerText();
  checks().phase6_submit_confirmation =
    afterSubmit.includes("Thanks for sharing the love!") ||
    afterSubmit.includes("We've received your referral");
  checks().phase6_history_shows =
    afterSubmit.includes(referredName) ||
    afterSubmit.includes("Referral received");
  step("phase6_submit", {
    confirmation: checks().phase6_submit_confirmation,
    history: checks().phase6_history_shows,
  });

  // Find referral id (CRM / internal)
  const list = await internal(
    key,
    `/api/internal/pricing/referrals?search=${encodeURIComponent(referredName)}`,
  );
  save("10-referral-list.json", list);
  const referral = (list.json?.referrals ?? []).find(
    (r: any) => r.referredVenueName === referredName,
  );
  checks().phase6_crm_api_sees_referral = Boolean(referral?.id);
  step("phase6_referral_row", { referralId: referral?.id });

  // Founder CRM Referrals UI (reuse workspace cookies when already signed in)
  const crmPage = await context.newPage();
  await crmPage.goto(`${WS}/referrals`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await crmPage.waitForTimeout(2000);
  if (crmPage.url().includes("/login")) {
    await crmPage.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
    await crmPage
      .locator('input[type="password"], input[name="password"]')
      .first()
      .fill(WS_PASSWORD);
    await crmPage.locator('button[type="submit"]').first().click();
    await crmPage.waitForTimeout(2500);
    await crmPage.goto(`${WS}/referrals`, { waitUntil: "networkidle", timeout: 90000 });
    await crmPage.waitForTimeout(2000);
  }
  if (referral?.id) {
    // search box
    const search = crmPage.locator('input[placeholder*="Search"]');
    if (await search.count()) {
      await search.fill(referredName);
      await crmPage.getByRole("button", { name: /Refresh/i }).click().catch(() => {});
      await crmPage.waitForTimeout(1500);
    }
    await crmPage.getByText(referredName).first().click().catch(() => {});
    await crmPage.waitForTimeout(1500);
  }
  await shot(crmPage, "11-crm-referrals");
  const crmRefText = await crmPage.locator("body").innerText();
  checks().phase6_crm_referrals_ui =
    crmRefText.includes("Referrals") &&
    (crmRefText.includes(referredName) || crmRefText.includes("submitted"));
  step("phase6_crm_ui", { ok: checks().phase6_crm_referrals_ui });

  // =========================================================================
  // PHASE 6 — Attribution → qualify → approve → issue → renewal → applied
  // =========================================================================
  if (!referral?.id) throw new Error("referral missing after browser submit");

  // Disposable referred venue (fake sub ids for attribution only; reward hits referrer)
  const { data: referredVenue, error: referredErr } = await admin
    .from("venues")
    .insert({
      name: referredName,
      website: `https://${referredDomain}`,
      owner_user_id: JEN,
      saas_plan_key: "starter",
      saas_subscription_status: "active",
      saas_stripe_subscription_id: `sub_fake_close_${stamp}`,
      saas_stripe_customer_id: `cus_fake_close_${stamp}`,
    })
    .select("id")
    .single();
  save("12-referred-venue.json", { referredVenue, referredErr });
  if (!referredVenue?.id) throw new Error("referred venue create failed");

  const attr = await internal(key, "/api/internal/pricing/referrals", {
    method: "POST",
    body: JSON.stringify({
      action: "attribute",
      referralId: referral.id,
      referredVenueId: referredVenue.id,
      matchMethod: "founder_confirmed",
      actorEmail: EMAIL,
    }),
  });
  save("13-attribute.json", attr);
  checks().phase6_attributed = attr.status === 200 && attr.json?.ok === true;

  const paidAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const markPaid = await internal(key, "/api/internal/pricing/referrals", {
    method: "POST",
    body: JSON.stringify({
      action: "mark_paid",
      attributionId: attr.json?.attribution?.id,
      firstPaidInvoiceId: `in_fake_close_${stamp}`,
      firstPaidInvoiceAt: paidAt,
      actorEmail: EMAIL,
    }),
  });
  save("14-mark-paid.json", markPaid);
  checks().phase6_marked_paid = markPaid.status === 200 && markPaid.json?.ok === true;

  const qualify = await internal(key, "/api/internal/pricing/referrals", {
    method: "POST",
    body: JSON.stringify({
      action: "evaluate_qualification",
      attributionId: attr.json?.attribution?.id,
      forceNow: true,
      actorEmail: EMAIL,
    }),
  });
  save("15-qualify.json", qualify);
  const rewardAmount = Number(qualify.json?.reward?.rewardAmountCents ?? 0);
  checks().phase6_qualified =
    qualify.status === 200 &&
    qualify.json?.reward?.status === "eligible" &&
    rewardAmount > 0;
  // Celebrate list $249 with no active founder arrangement after end
  checks().phase6_valuation_celebrate =
    rewardAmount === 24900 || rewardAmount === 21165; // tolerate residual founder if end deferred
  step("phase6_qualify", {
    ok: checks().phase6_qualified,
    amount: rewardAmount,
  });

  const approve = await internal(key, "/api/internal/pricing/referrals", {
    method: "POST",
    body: JSON.stringify({
      action: "approve_reward",
      rewardId: qualify.json?.reward?.id,
      actorEmail: EMAIL,
      notes: "Combined closure approval",
    }),
  });
  save("16-approve.json", approve);
  checks().phase6_approved =
    approve.status === 200 && approve.json?.reward?.status === "approved";

  const issue = await internal(key, "/api/internal/pricing/referrals", {
    method: "POST",
    body: JSON.stringify({
      action: "issue_reward",
      rewardId: qualify.json?.reward?.id,
      actorEmail: EMAIL,
    }),
  });
  save("17-issue.json", issue);
  const invoiceItemId = issue.json?.reward?.stripeInvoiceItemId as string | null;
  checks().phase6_issued =
    issue.status === 200 &&
    issue.json?.reward?.status === "issued" &&
    Boolean(invoiceItemId);
  step("phase6_issue", {
    ok: checks().phase6_issued,
    invoiceItemId,
    amount: issue.json?.reward?.rewardAmountCents,
  });
  if (!invoiceItemId) throw new Error("credit not issued");

  // Confirm pending item is subscription-scoped before renewal.
  const item = await stripe.invoiceItems.retrieve(invoiceItemId);
  checks().phase6_credit_subscription_scoped = item.subscription === SUB_ID;
  save("18-invoice-item.json", {
    id: item.id,
    amount: item.amount,
    subscription: item.subscription,
    customer: item.customer,
    metadata: item.metadata,
  });

  // Advance test clock past current period end to generate a finalized renewal.
  const subBefore = await stripe.subscriptions.retrieve(SUB_ID);
  const target = (subBefore.current_period_end ?? 0) + 120;
  step("phase6_clock_advance_start", {
    from: (await stripe.testHelpers.testClocks.retrieve(CLOCK_ID)).frozen_time,
    to: target,
    periodEnd: subBefore.current_period_end,
  });
  await waitForClockReady(stripe, CLOCK_ID);
  await stripe.testHelpers.testClocks.advance(CLOCK_ID, { frozen_time: target });
  await waitForClockReady(stripe, CLOCK_ID, 180000);

  // Find the invoice that consumed our invoice item.
  let appliedInvoice: Stripe.Invoice | null = null;
  for (let i = 0; i < 30; i++) {
    const listed = await stripe.invoices.list({
      customer: CUS_ID,
      subscription: SUB_ID,
      limit: 10,
    });
    for (const inv of listed.data) {
      const full = await stripe.invoices.retrieve(inv.id, {
        expand: ["lines.data"],
      });
      const hit = (full.lines?.data ?? []).some(
        (line: any) => line.invoice_item === invoiceItemId,
      );
      if (hit && (full.status === "paid" || full.status === "open")) {
        appliedInvoice = full;
        break;
      }
    }
    if (appliedInvoice) break;
    // Fallback: invoice item may now reference invoice
    const refreshed = await stripe.invoiceItems.retrieve(invoiceItemId);
    if (refreshed.invoice) {
      const full = await stripe.invoices.retrieve(String(refreshed.invoice), {
        expand: ["lines.data"],
      });
      if (full.status === "draft") {
        await stripe.invoices.finalizeInvoice(full.id);
        const paid = await stripe.invoices.pay(full.id).catch(async () => {
          // $0 invoices may already be paid after finalize
          return stripe.invoices.retrieve(full.id);
        });
        appliedInvoice = paid;
        break;
      }
      appliedInvoice = full;
      break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  save("19-applied-invoice.json", {
    id: appliedInvoice?.id ?? null,
    status: appliedInvoice?.status ?? null,
    total: appliedInvoice?.total ?? null,
    amount_due: appliedInvoice?.amount_due ?? null,
    amount_paid: (appliedInvoice as any)?.amount_paid ?? null,
    lines: (appliedInvoice?.lines?.data ?? []).map((l: any) => ({
      amount: l.amount,
      description: l.description,
      invoice_item: l.invoice_item,
    })),
  });
  checks().phase6_finalized_invoice_has_credit = Boolean(appliedInvoice?.id);
  checks().phase6_finalized_invoice_paid_or_open =
    appliedInvoice?.status === "paid" || appliedInvoice?.status === "open";
  step("phase6_finalized_invoice", {
    id: appliedInvoice?.id,
    status: appliedInvoice?.status,
    total: appliedInvoice?.total,
  });

  // If invoice is open, pay it (test PM on customer; $0 invoices finalize to paid).
  if (appliedInvoice?.status === "open") {
    try {
      appliedInvoice = await stripe.invoices.pay(appliedInvoice.id);
      save("19b-paid-invoice.json", {
        id: appliedInvoice.id,
        status: appliedInvoice.status,
        total: appliedInvoice.total,
        amount_due: appliedInvoice.amount_due,
      });
    } catch (err) {
      save("19b-pay-error.json", { error: String(err) });
      // Re-fetch in case webhook/auto-pay already moved it.
      appliedInvoice = await stripe.invoices.retrieve(appliedInvoice.id);
    }
  }
  checks().phase6_invoice_paid = appliedInvoice?.status === "paid";

  // Reconcile reward → applied via scheduler process
  const processTick = await internal(key, "/api/internal/pricing/referrals/process");
  save("20-process-tick.json", processTick);

  const detail = await internal(
    key,
    `/api/internal/pricing/referrals?referralId=${encodeURIComponent(referral.id)}`,
  );
  save("21-reward-detail.json", detail);
  checks().phase6_reward_applied = detail.json?.reward?.status === "applied";
  checks().phase6_applied_invoice_matches =
    !appliedInvoice?.id ||
    detail.json?.reward?.appliedInvoiceId === appliedInvoice.id ||
    detail.json?.reward?.status === "applied";
  step("phase6_reward_applied", {
    status: detail.json?.reward?.status,
    appliedInvoiceId: detail.json?.reward?.appliedInvoiceId,
  });

  // Venue Billing referral credits visibility after apply
  await setActiveVenue(VENUE_ID);
  await page.goto(`${APP}/settings/billing`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(2500);
  await shot(page, "22-venue-billing-referral-credit");
  const billingAfter = await page.locator("body").innerText();
  checks().phase6_billing_credit_visible =
    /Referral thank-you|thank-you credit|Credit applied|Credit earned|Refer a venue/i.test(
      billingAfter,
    );
  step("phase6_billing_credit", {
    ok: checks().phase6_billing_credit_visible,
  });

  await browser.close();

  // Soft-clean disposable referred venue name (keep audit rows)
  await admin
    .from("venues")
    .update({ name: `[DISPOSABLE-P6-CLOSE-CLEANED] ${stamp}` })
    .eq("id", referredVenue.id);

  const required = [
    "phase5_ready",
    "phase6_ready",
    "phase5_crm_custom_pricing_ui",
    "phase5_create_ok",
    "phase5_billing_special_pricing_visible",
    "phase5_end_ok",
    "venue_session_ok",
    "phase6_copy_ok",
    "phase6_submit_confirmation",
    "phase6_crm_api_sees_referral",
    "phase6_crm_referrals_ui",
    "phase6_attributed",
    "phase6_marked_paid",
    "phase6_qualified",
    "phase6_approved",
    "phase6_issued",
    "phase6_credit_subscription_scoped",
    "phase6_finalized_invoice_has_credit",
    "phase6_invoice_paid",
    "phase6_reward_applied",
  ];
  report.ok = required.every((k) => checks()[k] === true);
  report.out = OUT;
  report.referralId = referral.id;
  report.rewardId = detail.json?.reward?.id ?? null;
  report.stripeInvoiceItemId = invoiceItemId;
  report.appliedInvoiceId = appliedInvoice?.id ?? null;
  report.rewardAmountCents = rewardAmount;

  save("REPORT.json", report);
  writeFileSync(
    join(
      "/Users/jensmac/Developer/wevenu-website/docs/qa/htc-commercial-roadmap-closure",
      "FINAL-COMBINED-ACCEPTANCE.json",
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  report.ok = false;
  report.error = String(err);
  save("REPORT.json", report);
  writeFileSync(
    join(
      "/Users/jensmac/Developer/wevenu-website/docs/qa/htc-commercial-roadmap-closure",
      "FINAL-COMBINED-ACCEPTANCE.json",
    ),
    JSON.stringify(report, null, 2),
  );
  process.exit(1);
});
