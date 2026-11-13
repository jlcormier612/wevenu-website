/**
 * Close Scenario A (real paid Checkout) + Scenario B (paid before enrollment /
 * reconcile creates enrollment) for Welcome & Subscription Access Reliability.
 *
 * Disposable fixtures only. Loads Stripe SaaS test key from /tmp/htc-stripe-saas.env
 * (written from Secrets Manager for this run — never logged).
 *
 *   npx tsx scripts/qa/welcome-access-scenarios-ab.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: "/tmp/htc-stripe-saas.env", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

const MARKETING = "https://sandbox.hellotocheers.com";
const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/welcome-subscription-access-reliability";
const STRIPE_KEY = (process.env.STRIPE_SECRET_KEY || "").trim();
const stamp = Date.now().toString(36);

mkdirSync(OUT, { recursive: true });

if (!STRIPE_KEY.startsWith("sk_test_")) {
  throw new Error("STRIPE_SECRET_KEY test key required (sk_test_)");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox Supabase");
}

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 500)}`);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const disposableVenueIds: string[] = [];
const disposableUserIds: string[] = [];
const disposableEnrollmentIds: string[] = [];

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

/** Marketing reconcile can briefly return HTML under load; retry for JSON. */
async function postReconcile(sessionId: string) {
  let last: { status: number; text: string } | null = null;
  for (let i = 0; i < 8; i++) {
    const res = await fetch(`${MARKETING}/api/stripe/reconcile-checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const text = await res.text();
    if (text.trim().startsWith("{")) {
      return { status: res.status, body: JSON.parse(text) as Record<string, unknown> };
    }
    last = { status: res.status, text: text.slice(0, 180) };
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`reconcile non-JSON after retries: ${JSON.stringify(last)}`);
}

async function fillFirst(
  page: import("playwright").Page,
  sels: string[],
  value: string,
  opts?: { seq?: boolean },
) {
  for (const sel of sels) {
    const loc = page.locator(sel).first();
    if (!(await loc.count().catch(() => 0))) continue;
    if (!(await loc.isVisible().catch(() => false))) continue;
    await loc.click({ force: true });
    if (opts?.seq) {
      await loc.fill("");
      await loc.pressSequentially(value, { delay: 25 });
    } else {
      await loc.fill(value);
    }
    return sel;
  }
  for (const frame of page.frames()) {
    for (const sel of sels) {
      const loc = frame.locator(sel).first();
      if (!(await loc.count().catch(() => 0))) continue;
      if (!(await loc.isVisible().catch(() => false))) continue;
      await loc.click({ force: true }).catch(() => undefined);
      if (opts?.seq) {
        await loc.fill("").catch(() => undefined);
        await loc
          .pressSequentially(value, { delay: 25 })
          .catch(async () => loc.fill(value));
      } else {
        await loc.fill(value).catch(async () =>
          loc.pressSequentially(value, { delay: 25 }),
        );
      }
      return `frame:${frame.name() || "f"}:${sel}`;
    }
  }
  return null;
}

async function completeHostedCheckout(
  checkoutUrl: string,
  email: string,
  shotPrefix: string,
) {
  // Stripe hosted Checkout confirms payment reliably in headed Chrome; headless
  // can click Subscribe without charging (payment_status stays unpaid).
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1100 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const log: string[] = [];
  try {
    await page.goto(checkoutUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `${OUT}/${shotPrefix}-01-open.png`, fullPage: true });

    // Guacamole Checkout: email/address live in the habanero elements iframe.
    log.push(
      "email:" +
        (await fillFirst(
          page,
          ['input[name="email"]', 'input[autocomplete="email"]', 'input[type="email"]'],
          email,
        )),
    );

    // Select Card payment method (exact "Card" text node — not "Card number").
    // Guacamole: fields appear in the habanero elements iframe after Card is selected.
    async function selectCardPaymentMethod() {
      for (const frame of page.frames()) {
        const clicked = await frame
          .evaluate(() => {
            const nodes = Array.from(document.querySelectorAll("*"));
            for (const el of nodes) {
              const own = Array.from(el.childNodes)
                .filter((n) => n.nodeType === Node.TEXT_NODE)
                .map((n) => (n.textContent || "").trim())
                .join("");
              if (own !== "Card") continue;
              const target =
                (el.closest("button,label,[role='radio'],[role='button']") as HTMLElement | null) ||
                (el as HTMLElement);
              target.click();
              return true;
            }
            return false;
          })
          .catch(() => false);
        if (clicked) {
          log.push("card_selected:" + (frame.name() || "f"));
          await page.waitForTimeout(1200);
          return true;
        }
      }
      return false;
    }

    let cardExpanded = await selectCardPaymentMethod();
    log.push("card_expanded:" + cardExpanded);

    // Wait until Card number is visibly selected (not Klarna/Cash App).
    let cardReady = false;
    for (let i = 0; i < 25; i++) {
      let numberVisible = false;
      for (const frame of page.frames()) {
        const loc = frame.locator(
          'input[name="number"][autocomplete="cc-number"], input[aria-label="Card number"]',
        ).first();
        if ((await loc.count()) && (await loc.isVisible().catch(() => false))) {
          numberVisible = true;
          break;
        }
      }
      if (numberVisible) {
        const found = await fillFirst(
          page,
          [
            'input[name="number"][autocomplete="cc-number"]',
            'input[aria-label="Card number"]',
            'input[placeholder="Card number"]',
          ],
          "4242424242424242",
          { seq: true },
        );
        if (found) {
          log.push("card:" + found);
          cardReady = true;
          break;
        }
      }
      await selectCardPaymentMethod();
      await page.waitForTimeout(400);
    }
    if (!cardReady) {
      await page.screenshot({ path: `${OUT}/${shotPrefix}-no-card.png`, fullPage: true });
      throw new Error("card fields not found after expanding Card");
    }

    log.push(
      "exp:" +
        (await fillFirst(
          page,
          [
            'input[name="expiry"]',
            'input[autocomplete="cc-exp"]',
            'input[aria-label*="Expiration"]',
            'input[placeholder="MM / YY"]',
          ],
          "1234",
          { seq: true },
        )),
    );
    log.push(
      "cvc:" +
        (await fillFirst(
          page,
          [
            'input[name="cvc"]',
            'input[autocomplete="cc-csc"]',
            'input[aria-label="Security code"]',
            'input[placeholder="Security code"]',
          ],
          "123",
          { seq: true },
        )),
    );

    log.push(
      "name:" +
        (await fillFirst(
          page,
          [
            'input[name="name"]',
            'input[autocomplete="billing name"]',
            'input[autocomplete="name"]',
            'input[placeholder="Full name"]',
          ],
          "Access Reliability Owner",
        )),
    );
    log.push(
      "line1:" +
        (await fillFirst(
          page,
          [
            'input[name="addressLine1"]',
            'input[autocomplete="billing address-line1"]',
            'input[placeholder="Address"]',
          ],
          "500 Congress Avenue",
        )),
    );
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(400);
    log.push(
      "city:" +
        (await fillFirst(
          page,
          [
            'input[name="locality"]',
            'input[autocomplete="billing address-level2"]',
            'input[placeholder="City"]',
          ],
          "Austin",
        )),
    );
    log.push(
      "zip:" +
        (await fillFirst(
          page,
          [
            'input[name="postalCode"]',
            'input[autocomplete="billing postal-code"]',
            'input[placeholder="ZIP code"]',
          ],
          "78701",
          { seq: true },
        )),
    );
    // State text input in guacamole
    log.push(
      "state:" +
        (await fillFirst(
          page,
          [
            'input[autocomplete="billing address-level1"]',
            'input[placeholder="State"]',
          ],
          "TX",
        )),
    );

    // Re-assert Card is still the selected method before paying.
    let cardStillVisible = false;
    for (const frame of page.frames()) {
      const loc = frame.locator('input[aria-label="Card number"]').first();
      if ((await loc.count()) && (await loc.isVisible().catch(() => false))) {
        cardStillVisible = true;
        break;
      }
    }
    if (!cardStillVisible) {
      await selectCardPaymentMethod();
      await page.waitForTimeout(800);
      // Re-fill card if accordion collapsed again
      await fillFirst(
        page,
        ['input[aria-label="Card number"]', 'input[name="number"][autocomplete="cc-number"]'],
        "4242424242424242",
        { seq: true },
      );
      await fillFirst(
        page,
        ['input[name="expiry"]', 'input[autocomplete="cc-exp"]'],
        "1234",
        { seq: true },
      );
      await fillFirst(
        page,
        ['input[name="cvc"]', 'input[autocomplete="cc-csc"]'],
        "123",
        { seq: true },
      );
    }

    // Uncheck Link "save my information" when present (avoids phone requirement noise).
    for (const frame of page.frames()) {
      const save = frame.getByLabel(/save my information/i);
      if (await save.count()) {
        if (await save.isChecked().catch(() => false)) {
          await save.uncheck({ force: true }).catch(() => undefined);
          log.push("unchecked_save");
        }
      }
    }

    await page.screenshot({ path: `${OUT}/${shotPrefix}-02-filled.png`, fullPage: true });

    // Subscribe lives inside the habanero elements iframe (not the top document).
    let btn: import("playwright").Locator | null = null;
    for (let i = 0; i < 50 && !btn; i++) {
      for (const frame of page.frames()) {
        const c = frame.getByRole("button", { name: "Subscribe" }).first();
        if ((await c.count()) && (await c.isVisible().catch(() => false))) {
          btn = c;
          log.push("subscribe_frame:" + (frame.name() || "f"));
          break;
        }
      }
      if (!btn) await page.waitForTimeout(300);
    }
    if (!btn) {
      await page.screenshot({ path: `${OUT}/${shotPrefix}-no-subscribe.png`, fullPage: true });
      throw new Error("Subscribe button not found");
    }
    await btn.scrollIntoViewIfNeeded().catch(() => undefined);
    for (let i = 0; i < 40; i++) {
      if (!(await btn.isDisabled().catch(() => true))) break;
      await page.waitForTimeout(400);
    }
    if (await btn.isDisabled().catch(() => true)) {
      await page.screenshot({ path: `${OUT}/${shotPrefix}-subscribe-disabled.png`, fullPage: true });
      throw new Error("Subscribe remained disabled — not clicking");
    }
    // One click only — never retry payment submission.
    await btn.click({ timeout: 15000 });
    log.push("clicked_once");

    // Poll Stripe for paid (redirect may lag); do not re-click.
    const sessionMatch = checkoutUrl.match(/cs_test_[A-Za-z0-9]+/);
    const pollId = sessionMatch?.[0];
    if (pollId) {
      for (let i = 0; i < 60; i++) {
        try {
          const s = await stripeGet(`checkout/sessions/${pollId}`);
          if (s.payment_status === "paid") {
            log.push("paid_via_poll");
            break;
          }
        } catch {
          /* ignore transient */
        }
        if (/pricing\/success/i.test(page.url()) && !/checkout\.stripe\.com/i.test(page.url())) {
          log.push("nav:" + page.url());
          break;
        }
        await page.waitForTimeout(2000);
      }
    } else {
      try {
        await page.waitForURL(/pricing\/success|session_id=/i, { timeout: 120000 });
        log.push("nav:" + page.url());
      } catch {
        await page.waitForTimeout(8000);
        log.push("still:" + page.url());
      }
    }
    await page.screenshot({ path: `${OUT}/${shotPrefix}-03-after.png`, fullPage: true });
    const successBody = (await page.locator("body").innerText().catch(() => "")).replace(
      /\s+/g,
      " ",
    );
    return { finalUrl: page.url(), successBody, log };
  } finally {
    await browser.close();
  }
}

async function startCheckoutFromPricingUi(opts: {
  venueName: string;
  firstName: string;
  lastName: string;
  emailHint: string;
}) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  try {
    await page.goto(`${MARKETING}/pricing`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/A-pricing.png`, fullPage: false });

    // Open Gather plan → onboarding selection overlay
    const gatherBtn = page
      .getByRole("button", { name: /continue with this plan|gather|get started|choose gather/i })
      .first();
    if (await gatherBtn.count()) await gatherBtn.click({ timeout: 15000 });
    else {
      await page.locator("button").filter({ hasText: /Gather|Get started|Choose/i }).first().click({
        timeout: 15000,
      });
    }

    await page
      .locator('input[placeholder="Sally"]')
      .first()
      .waitFor({ state: "visible", timeout: 20000 });
    await page.locator('input[placeholder="Sally"]').fill(opts.firstName);
    await page.locator('input[placeholder="Sunshine"]').fill(opts.lastName);
    await page.locator('input[placeholder="Sally Sunshine Events"]').fill(opts.venueName);

    // Legal checkbox: click the control (not the Terms link) so React state updates.
    const legalLabel = page.locator("label").filter({ hasText: /agree to the/i }).first();
    await legalLabel.locator('input[type="checkbox"]').click({ force: true });
    await page.waitForTimeout(300);

    await page.screenshot({ path: `${OUT}/A-onboarding-selection.png`, fullPage: true });

    const selfBtn = page
      .locator("article")
      .filter({ hasText: /I'll set it up myself/i })
      .getByRole("button", { name: /Continue to Checkout/i })
      .first();
    if (await selfBtn.isDisabled()) {
      throw new Error("Continue to Checkout still disabled after filling details + legal");
    }

    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/stripe/checkout") && r.request().method() === "POST",
        { timeout: 60000 },
      ).catch(() => null),
      selfBtn.click({ timeout: 20000 }),
    ]);

    let sessionId = "";
    let checkoutUrl = "";
    if (resp) {
      const body = (await resp.json().catch(() => ({}))) as {
        session_id?: string;
        url?: string;
        founding_member?: boolean;
        error?: string;
      };
      sessionId = body.session_id || "";
      checkoutUrl = body.url || "";
      if (body.error) throw new Error(`checkout API: ${body.error}`);
    }

    try {
      await page.waitForURL(/checkout\.stripe\.com/, { timeout: 90000 });
      checkoutUrl = page.url();
    } catch {
      if (!checkoutUrl) throw new Error("did not reach Stripe Checkout");
      await page.goto(checkoutUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    }

    if (!sessionId) {
      const m = checkoutUrl.match(/cs_test_[A-Za-z0-9]+/);
      sessionId = m?.[0] || "";
    }

    return { browser, page, sessionId, checkoutUrl };
  } catch (e) {
    await browser.close();
    throw e;
  }
}

async function countStarters(venueId: string) {
  const tables = [
    "packages",
    "contract_templates",
    "message_templates",
    "inventory_categories",
    "inventory_templates",
  ] as const;
  const out: Record<string, number> = {};
  for (const t of tables) {
    const { count } = await admin
      .from(t)
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    out[t] = count ?? 0;
  }
  return out;
}

async function cleanup() {
  for (const id of disposableEnrollmentIds) {
    await admin.from("venue_enrollments").delete().eq("id", id).catch(() => undefined);
  }
  for (const venueId of disposableVenueIds) {
    await admin.from("venue_starter_provisioning").delete().eq("venue_id", venueId).catch(() => undefined);
    await admin.from("venue_onboarding_intake").delete().eq("venue_id", venueId).catch(() => undefined);
    await admin.from("venue_setup_hub_state").delete().eq("venue_id", venueId).catch(() => undefined);
    await admin.from("venue_staff_active_context").delete().eq("active_venue_id", venueId).catch(() => undefined);
    await admin.from("venue_staff").delete().eq("venue_id", venueId).catch(() => undefined);
    // best-effort related rows
    for (const t of [
      "packages",
      "contract_templates",
      "message_templates",
      "inventory_categories",
      "inventory_templates",
    ]) {
      await admin.from(t).delete().eq("venue_id", venueId).catch(() => undefined);
    }
    await admin.from("venues").delete().eq("id", venueId).catch(() => undefined);
  }
  for (const userId of disposableUserIds) {
    await admin.from("legal_acceptances").delete().eq("user_id", userId).catch(() => undefined);
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
  }
}

async function main() {
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    // Access fix landed at 68c32f73; Sandbox tip after harness PR #52 is a7bca7d4.
    servingExpected: "a7bca7d4",
    accessFixSha: "68c32f73",
    stamp,
  };

  // ---------- Scenario A ----------
  const venueNameA = `DISPOSABLE Access Paid A ${stamp}`;
  const emailA = `jennifer+access.paid.a.${stamp}@hellotocheers.com`;
  let sessionIdA = "";
  let checkoutUrlA = "";

  try {
    // Prefer full UI journey; fall back to API checkout create if overlay selectors drift.
    try {
      const ui = await startCheckoutFromPricingUi({
        venueName: venueNameA,
        firstName: "Paid",
        lastName: "Owner",
        emailHint: emailA,
      });
      sessionIdA = ui.sessionId;
      checkoutUrlA = ui.checkoutUrl;
      // Close the pricing browser — pay in dedicated Checkout browser
      await ui.browser.close();
      record(
        "A.ui_checkout_started",
        Boolean(sessionIdA && checkoutUrlA),
        `session=${sessionIdA} url=${checkoutUrlA.slice(0, 80)}`,
      );
    } catch (uiErr) {
      record(
        "A.ui_checkout_started",
        false,
        uiErr instanceof Error ? uiErr.message : String(uiErr),
      );
      const res = await fetch(`${MARKETING}/api/stripe/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: "starter",
          onboarding_type: "self_guided",
          venue_name: venueNameA,
          first_name: "Paid",
          last_name: "Owner",
          legal_accepted: true,
        }),
      });
      const body = (await res.json()) as {
        url?: string;
        session_id?: string;
        founding_member?: boolean;
        error?: string;
      };
      if (!res.ok || !body.url || !body.session_id) {
        throw new Error(`API checkout failed: ${res.status} ${JSON.stringify(body)}`);
      }
      sessionIdA = body.session_id;
      checkoutUrlA = body.url;
      report.aCheckoutFallback = "api";
      report.aFounding = body.founding_member;
      record(
        "A.api_checkout_fallback",
        true,
        `session=${sessionIdA} founding=${body.founding_member}`,
      );
    }

    // Prefill customer email on session via Stripe? Hosted page may ask.
    const pay = await completeHostedCheckout(checkoutUrlA, emailA, "A-pay");
    report.aPayLog = pay.log;
    report.aFinalUrl = pay.finalUrl;

    // Authoritative Stripe state
    let session = await stripeGet(`checkout/sessions/${sessionIdA}`);
    for (let i = 0; i < 30 && session.payment_status !== "paid"; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      session = await stripeGet(`checkout/sessions/${sessionIdA}`);
    }
    record(
      "A.stripe_paid",
      session.payment_status === "paid" &&
        (session.status === "complete" || Boolean(session.subscription)),
      `payment_status=${session.payment_status} status=${session.status} sub=${session.subscription} amount_total=${session.amount_total}`,
    );

    // Reconcile (idempotent) — also covers success-page path
    const rec1 = await postReconcile(sessionIdA);
    record(
      "A.reconcile_ok",
      rec1.status === 200 &&
        (rec1.body.status === "reconciled" || rec1.body.status === "already_enrolled"),
      JSON.stringify(rec1.body),
    );

    // Wait for enrollment
    let enrollments: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 40; i++) {
      const { data } = await admin
        .from("venue_enrollments")
        .select(
          "id,venue_id,status,owner_email,plan,onboarding_type,stripe_subscription_id,stripe_customer_id,activation_token,founding_member",
        )
        .eq("stripe_checkout_session_id", sessionIdA);
      enrollments = (data as Array<Record<string, unknown>>) || [];
      if (enrollments.length >= 1 && enrollments[0]?.venue_id) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    record("A.one_enrollment", enrollments.length === 1, JSON.stringify(enrollments));
    const enr = enrollments[0];
    if (enr?.id) disposableEnrollmentIds.push(String(enr.id));
    if (enr?.venue_id) disposableVenueIds.push(String(enr.venue_id));

    // Resolve owner user if activated later — track for cleanup when present
    if (enr?.owner_email) {
      const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = users.users?.find(
        (u) => u.email?.toLowerCase() === String(enr.owner_email).toLowerCase(),
      );
      if (match) disposableUserIds.push(match.id);
    }

    record(
      "A.tier_and_ownership_fields",
      Boolean(enr?.stripe_subscription_id) &&
        Boolean(enr?.owner_email) &&
        (String(enr?.plan || "").includes("starter") ||
          String(enr?.plan || "").includes("gather") ||
          String(enr?.plan || "") === "starter"),
      `plan=${enr?.plan} email=${enr?.owner_email} founding=${enr?.founding_member} onboarding=${enr?.onboarding_type}`,
    );

    // Stripe subscription status
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as { id?: string } | null)?.id ||
          String(enr?.stripe_subscription_id || "");
    if (subId) {
      const sub = await stripeGet(`subscriptions/${subId}`);
      record(
        "A.stripe_subscription_active",
        ["active", "trialing"].includes(sub.status),
        `sub=${subId} status=${sub.status} items=${JSON.stringify(sub.items?.data?.map((i: { price?: { id?: string; unit_amount?: number } }) => ({ price: i.price?.id, amount: i.price?.unit_amount })))}`,
      );
    } else {
      record("A.stripe_subscription_active", false, "missing subscription id");
    }

    // Success page CTA
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage();
    await page.goto(`${MARKETING}/pricing/success?session_id=${sessionIdA}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2500);
    const successText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    await page.screenshot({ path: `${OUT}/A-success.png`, fullPage: true });
    record(
      "A.success_cta",
      /Get started|Sign in|Continue/i.test(successText),
      successText.slice(0, 280),
    );
    await browser.close();

    // Starters if venue provisioned
    if (enr?.venue_id) {
      const starters = await countStarters(String(enr.venue_id));
      const starterTotal = Object.values(starters).reduce((a, b) => a + b, 0);
      record(
        "A.starters_present",
        starterTotal > 0,
        JSON.stringify(starters),
      );
      report.aStarters = starters;
      report.aVenueId = enr.venue_id;
    } else {
      record("A.starters_present", false, "no venue_id yet");
    }

    // No duplicate subscriptions for this session
    const { count: subCount } = await admin
      .from("venue_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("stripe_subscription_id", subId || "missing");
    record(
      "A.no_duplicate_subscription_enrollments",
      (subCount ?? 0) <= 1,
      `count=${subCount} sub=${subId}`,
    );

    report.scenarioA = { sessionIdA, subId, enrollment: enr };
  } catch (e) {
    record("A.block", false, e instanceof Error ? e.message : String(e));
  }

  // ---------- Scenario B ----------
  try {
    // Use a fresh paid session: API create → pay once → delete disposable enrollment → reconcile recreates.
    const venueNameB = `DISPOSABLE Access Paid B ${stamp}`;
    const emailB = `jennifer+access.paid.b.${stamp}@hellotocheers.com`;
    const res = await fetch(`${MARKETING}/api/stripe/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        plan: "starter",
        onboarding_type: "self_guided",
        venue_name: venueNameB,
        first_name: "Before",
        last_name: "Webhook",
        legal_accepted: true,
      }),
    });
    const body = (await res.json()) as { url?: string; session_id?: string; error?: string };
    if (!res.ok || !body.url || !body.session_id) {
      throw new Error(`B checkout create failed: ${JSON.stringify(body)}`);
    }
    const sessionIdB = body.session_id;

    // Confirm unpaid / no enrollment before pay
    const preRec = (await postReconcile(sessionIdB)).body;
    record(
      "B.prepay_not_eligible",
      preRec.ok === true && preRec.status === "not_eligible",
      JSON.stringify(preRec),
    );

    const payB = await completeHostedCheckout(body.url, emailB, "B-pay");
    report.bPayLog = payB.log;
    report.bFinalUrl = payB.finalUrl;

    let sessionB = await stripeGet(`checkout/sessions/${sessionIdB}`);
    for (let i = 0; i < 30 && sessionB.payment_status !== "paid"; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      sessionB = await stripeGet(`checkout/sessions/${sessionIdB}`);
    }
    record(
      "B.stripe_paid_eligible",
      sessionB.payment_status === "paid",
      `payment_status=${sessionB.payment_status} status=${sessionB.status} sub=${sessionB.subscription}`,
    );

    // Wait briefly for possible webhook, then clear disposable enrollment to simulate
    // "paid + Stripe eligible but HTC enrollment missing" (webhook delay equivalent).
    await new Promise((r) => setTimeout(r, 3000));
    const { data: beforeClear } = await admin
      .from("venue_enrollments")
      .select("id,venue_id,stripe_subscription_id")
      .eq("stripe_checkout_session_id", sessionIdB);
    const hadWebhookEnrollment = (beforeClear?.length ?? 0) > 0;
    report.bHadWebhookEnrollment = hadWebhookEnrollment;

    for (const row of beforeClear || []) {
      if (row.venue_id) {
        disposableVenueIds.push(row.venue_id);
        await admin
          .from("venue_enrollments")
          .update({ venue_id: null, activation_token: null, status: "pending" })
          .eq("id", row.id);
      }
      await admin.from("venue_enrollments").delete().eq("id", row.id);
    }

    const { count: afterClear } = await admin
      .from("venue_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("stripe_checkout_session_id", sessionIdB);
    record(
      "B.pre_reconcile_no_enrollment",
      (afterClear ?? 0) === 0,
      `cleared webhook rows=${beforeClear?.length ?? 0} remaining=${afterClear}`,
    );

    // Stripe still paid
    const stillPaid = await stripeGet(`checkout/sessions/${sessionIdB}`);
    record(
      "B.stripe_still_paid_pre_reconcile",
      stillPaid.payment_status === "paid",
      `payment_status=${stillPaid.payment_status}`,
    );

    const recB = await postReconcile(sessionIdB);
    record(
      "B.reconcile_creates_enrollment",
      recB.status === 200 &&
        (recB.body.status === "reconciled" || recB.body.status === "already_enrolled"),
      JSON.stringify(recB.body),
    );

    // Prefer reconciled (proves create path). already_enrolled means webhook raced recreate.
    let enrollB: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 30; i++) {
      const { data } = await admin
        .from("venue_enrollments")
        .select(
          "id,venue_id,status,owner_email,plan,stripe_subscription_id,activation_token",
        )
        .eq("stripe_checkout_session_id", sessionIdB);
      enrollB = (data as Array<Record<string, unknown>>) || [];
      if (enrollB.length >= 1) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    record("B.one_enrollment_after_reconcile", enrollB.length === 1, JSON.stringify(enrollB));
    if (enrollB[0]?.id) disposableEnrollmentIds.push(String(enrollB[0].id));
    if (enrollB[0]?.venue_id) disposableVenueIds.push(String(enrollB[0].venue_id));

    // Idempotent second reconcile + fake webhook retry equivalent
    const recB2 = (await postReconcile(sessionIdB)).body;
    const recB3 = (await postReconcile(sessionIdB)).body;
    const { count: enrollCountB } = await admin
      .from("venue_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("stripe_checkout_session_id", sessionIdB);
    record(
      "B.idempotent_no_duplicates",
      enrollCountB === 1 &&
        recB2.status === "already_enrolled" &&
        recB3.status === "already_enrolled",
      `count=${enrollCountB} rec2=${JSON.stringify(recB2)} rec3=${JSON.stringify(recB3)}`,
    );

    // Success page after reconcile
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage();
    await page.goto(`${MARKETING}/pricing/success?session_id=${sessionIdB}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2000);
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    await page.screenshot({ path: `${OUT}/B-success.png`, fullPage: true });
    record(
      "B.success_ready",
      /Get started|Sign in|Continue/i.test(text),
      text.slice(0, 280),
    );
    await browser.close();

    report.scenarioB = {
      sessionIdB,
      hadWebhookEnrollment,
      reconcile: recB.body,
      enrollment: enrollB[0],
    };
  } catch (e) {
    record("B.block", false, e instanceof Error ? e.message : String(e));
  }

  // ---------- Negative-path spot checks (no full C–I) ----------
  try {
    const forged = (await postReconcile("cs_test_forged_not_real_session")).body;
    record(
      "NEG.forged_blocked",
      forged.ok === true && forged.status === "not_eligible",
      JSON.stringify(forged),
    );

    const unpaid = await fetch(`${MARKETING}/api/stripe/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        plan: "starter",
        onboarding_type: "self_guided",
        venue_name: `DISPOSABLE Access Unpaid Spot ${stamp}`,
        first_name: "No",
        last_name: "Pay",
        legal_accepted: true,
      }),
    }).then((r) => r.json());
    const unpaidRec = (await postReconcile(String(unpaid.session_id))).body;
    const { count: unpaidEnroll } = await admin
      .from("venue_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("stripe_checkout_session_id", unpaid.session_id);
    record(
      "NEG.unpaid_blocked",
      unpaidRec.status === "not_eligible" && (unpaidEnroll ?? 0) === 0,
      `rec=${JSON.stringify(unpaidRec)} count=${unpaidEnroll}`,
    );
  } catch (e) {
    record("NEG.block", false, e instanceof Error ? e.message : String(e));
  }

  await cleanup();

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  report.finishedAt = new Date().toISOString();
  report.passed = passed;
  report.failed = failed;
  report.checks = checks;
  writeFileSync(`${OUT}/scenarios-ab-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed, failed, out: OUT }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => undefined);
  process.exit(1);
});
