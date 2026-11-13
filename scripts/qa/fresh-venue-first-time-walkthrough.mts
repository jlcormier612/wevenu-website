/**
 * Fresh disposable venue — complete first-time customer walkthrough (Sandbox).
 * Pricing → Checkout → Activation → Login → Welcome → Hub → config → sales →
 * representative event path → starter quality notes → mobile.
 *
 *   NODE_PATH=.../node_modules npx tsx scripts/qa/fresh-venue-first-time-walkthrough.mts
 *
 * Headed Chrome required for hosted Stripe Checkout payment.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";

const require = createRequire("/Users/jensmac/Developer/wevenu-website/package.json");
const { config } = require("dotenv");
config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
config({ path: "/tmp/htc-stripe-saas.env", quiet: true });
const { createClient } = require("@supabase/supabase-js");
const marketingRequire = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = marketingRequire("playwright");

const MARKETING = "https://sandbox.hellotocheers.com";
const APP = "https://app.sandbox.hellotocheers.com";
const WORKSPACE = "https://workspace.sandbox.hellotocheers.com";
const OUT = "/private/tmp/htc-setup-hub-wt/docs/qa/fresh-venue-first-time";
const STRIPE_KEY = (process.env.STRIPE_SECRET_KEY || "").trim();
const stamp = Date.now().toString(36);
const venueName = `DISPOSABLE Fresh Walk ${stamp}`;
const ownerEmail = `jennifer+fresh.walk.${stamp}@hellotocheers.com`;
const ownerPassword = `HtC-Fresh-${stamp}!9a`;

mkdirSync(OUT, { recursive: true });

if (!STRIPE_KEY.startsWith("sk_test_")) {
  throw new Error("STRIPE_SECRET_KEY test key required");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox Supabase");
}

type Check = { name: string; pass: boolean; detail: string; stage?: string };
type Friction = {
  severity: "RED" | "YELLOW" | "LOW";
  area: string;
  observation: string;
  impact: string;
  action?: string;
};

const checks: Check[] = [];
const friction: Friction[] = [];
const starterNotes: Array<Record<string, unknown>> = [];
const report: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  stamp,
  venueName,
  ownerEmail,
  servingExpected: "a6096b49",
};

function record(name: string, pass: boolean, detail: string, stage?: string) {
  checks.push({ name, pass, detail, stage });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 420)}`);
}

function noteFriction(f: Friction) {
  friction.push(f);
  console.log(`FRICTION ${f.severity} [${f.area}] ${f.observation.slice(0, 280)}`);
}

function persist() {
  report.finishedAt = new Date().toISOString();
  report.passed = checks.filter((c) => c.pass).length;
  report.failed = checks.filter((c) => !c.pass).length;
  report.checks = checks;
  report.friction = friction;
  report.starterNotes = starterNotes;
  writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2));
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

async function postReconcile(sessionId: string) {
  let last: { status: number; text: string } | null = null;
  for (let i = 0; i < 8; i++) {
    const res = await fetch(`${MARKETING}/api/stripe/reconcile-checkout`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const text = await res.text();
    if (text.trim().startsWith("{")) {
      return { status: res.status, body: JSON.parse(text) as Record<string, unknown> };
    }
    last = { status: res.status, text: text.slice(0, 180) };
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`reconcile non-JSON: ${JSON.stringify(last)}`);
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

async function completeHostedCheckout(checkoutUrl: string) {
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
    await page.screenshot({ path: `${OUT}/01-checkout-open.png`, fullPage: true });

    log.push(
      "email:" +
        (await fillFirst(
          page,
          ['input[name="email"]', 'input[autocomplete="email"]', 'input[type="email"]'],
          ownerEmail,
        )),
    );

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

    await selectCardPaymentMethod();
    let cardReady = false;
    for (let i = 0; i < 25; i++) {
      let numberVisible = false;
      for (const frame of page.frames()) {
        const loc = frame
          .locator(
            'input[name="number"][autocomplete="cc-number"], input[aria-label="Card number"]',
          )
          .first();
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
      await page.screenshot({ path: `${OUT}/01-checkout-no-card.png`, fullPage: true });
      throw new Error("card fields not found");
    }

    await fillFirst(
      page,
      ['input[name="expiry"]', 'input[autocomplete="cc-exp"]', 'input[placeholder="MM / YY"]'],
      "1234",
      { seq: true },
    );
    await fillFirst(
      page,
      ['input[name="cvc"]', 'input[autocomplete="cc-csc"]', 'input[aria-label="Security code"]'],
      "123",
      { seq: true },
    );
    await fillFirst(
      page,
      ['input[name="name"]', 'input[autocomplete="billing name"]', 'input[placeholder="Full name"]'],
      "Fresh Walk Owner",
    );
    await fillFirst(
      page,
      [
        'input[name="addressLine1"]',
        'input[autocomplete="billing address-line1"]',
        'input[placeholder="Address"]',
      ],
      "500 Congress Avenue",
    );
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(400);
    await fillFirst(
      page,
      [
        'input[name="locality"]',
        'input[autocomplete="billing address-level2"]',
        'input[placeholder="City"]',
      ],
      "Austin",
    );
    await fillFirst(
      page,
      [
        'input[name="postalCode"]',
        'input[autocomplete="billing postal-code"]',
        'input[placeholder="ZIP code"]',
      ],
      "78701",
      { seq: true },
    );
    await fillFirst(
      page,
      ['input[autocomplete="billing address-level1"]', 'input[placeholder="State"]'],
      "TX",
    );

    for (const frame of page.frames()) {
      const save = frame.getByLabel(/save my information/i);
      if (await save.count()) {
        if (await save.isChecked().catch(() => false)) {
          await save.uncheck({ force: true }).catch(() => undefined);
        }
      }
    }

    await page.screenshot({ path: `${OUT}/01-checkout-filled.png`, fullPage: true });

    let btn: import("playwright").Locator | null = null;
    for (let i = 0; i < 50 && !btn; i++) {
      for (const frame of page.frames()) {
        const c = frame.getByRole("button", { name: "Subscribe" }).first();
        if ((await c.count()) && (await c.isVisible().catch(() => false))) {
          btn = c;
          break;
        }
      }
      if (!btn) await page.waitForTimeout(300);
    }
    if (!btn) throw new Error("Subscribe button not found");
    for (let i = 0; i < 40; i++) {
      if (!(await btn.isDisabled().catch(() => true))) break;
      await page.waitForTimeout(400);
    }
    if (await btn.isDisabled().catch(() => true)) {
      throw new Error("Subscribe remained disabled");
    }
    await btn.click({ timeout: 15000 });
    log.push("clicked_subscribe");

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
          /* ignore */
        }
        if (/pricing\/success/i.test(page.url()) && !/checkout\.stripe\.com/i.test(page.url())) {
          log.push("nav:" + page.url());
          break;
        }
        await page.waitForTimeout(2000);
      }
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/01-checkout-after-pay.png`, fullPage: true });
    return { log, finalUrl: page.url() };
  } finally {
    await browser.close();
  }
}

async function magicCookies(email: string, venueId: string) {
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const { data: verified, error: vErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token!,
    type: "email",
  });
  if (vErr) throw vErr;
  const session = verified.session!;
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  return {
    userId: session.user.id as string,
    cookies: [
      {
        name: `sb-${projectRef}-auth-token`,
        value: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          expires_in: session.expires_in,
          token_type: "bearer",
          user: session.user,
        }),
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      },
      {
        name: "htc_active_venue_id",
        value: venueId,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      },
    ],
  };
}

async function completeWelcomeIfPresent(
  page: import("playwright").Page,
  shot: string,
) {
  if (!/\/welcome/.test(page.url())) return false;
  await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  if (/Before creating your venue workspace/i.test(body)) {
    noteFriction({
      severity: "YELLOW",
      area: "Legal Welcome",
      observation: "Welcome still implies workspace does not exist yet after paid activation.",
      impact: "Undermines confidence that payment/activation succeeded.",
      action: "Copy already updated on main; confirm serving SHA includes fix.",
    });
  }
  const agree = page.locator('input[type="checkbox"]').first();
  if (await agree.count()) {
    await agree.check({ force: true }).catch(async () => agree.click({ force: true }));
  }
  const cont = page.getByRole("button", { name: /^Continue$/i }).first();
  await cont.waitFor({ state: "visible", timeout: 20000 });
  for (let i = 0; i < 40; i++) {
    if (!(await cont.isDisabled().catch(() => true))) break;
    await page.waitForTimeout(250);
  }
  await Promise.all([
    page
      .waitForURL((u) => !u.pathname.includes("/welcome"), { timeout: 45000 })
      .catch(() => null),
    cont.click({ timeout: 20000 }),
  ]);
  await page.waitForTimeout(1500);
  return true;
}

async function ensureSetupHub(page: import("playwright").Page) {
  await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  await completeWelcomeIfPresent(page, "04-welcome-gate");
  if (/\/onboarding\/intake/.test(page.url())) {
    noteFriction({
      severity: "RED",
      area: "Post-activation routing",
      observation: "Landed on /onboarding/intake instead of Setup Hub after activation/welcome.",
      impact: "Blocks first-time Setup Hub experience.",
    });
    record("routing.no_intake_wall", false, page.url(), "First Login");
  } else {
    record("routing.no_intake_wall", !/\/onboarding\/intake/.test(page.url()), page.url(), "First Login");
  }
  if (!/\/setup-hub/.test(page.url())) {
    await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    await completeWelcomeIfPresent(page, "04-welcome-gate-retry");
  }
}

async function sampleStarterQuality(venueId: string) {
  const categories: Array<{
    key: string;
    table: string;
    cols: string;
  }> = [
    { key: "packages", table: "packages", cols: "id,name,description,is_starter,price_cents" },
    {
      key: "contract_templates",
      table: "contract_templates",
      cols: "id,name,description,is_starter",
    },
    {
      key: "setup_profiles",
      table: "event_setup_profiles",
      cols: "id,name,description,is_default,is_starter",
    },
    { key: "playbooks", table: "playbooks", cols: "id,name,description,is_starter" },
    {
      key: "questionnaires",
      table: "questionnaire_templates",
      cols: "id,name,description,is_starter",
    },
    {
      key: "message_templates",
      table: "message_templates",
      cols: "id,name,subject,is_starter",
    },
    {
      key: "sequences",
      table: "message_sequences",
      cols: "id,name,status,is_starter,paused",
    },
  ];

  for (const cat of categories) {
    const { data, error } = await admin
      .from(cat.table)
      .select(cat.cols)
      .eq("venue_id", venueId)
      .limit(8);
    if (error) {
      starterNotes.push({ category: cat.key, error: error.message });
      continue;
    }
    const rows = data || [];
    const emptyName = rows.filter((r: Record<string, unknown>) => !String(r.name || "").trim());
    const thinDesc = rows.filter((r: Record<string, unknown>) => {
      const d = String(r.description || r.subject || "");
      return d.trim().length > 0 && d.trim().length < 12;
    });
    const note = {
      category: cat.key,
      count: rows.length,
      sampleNames: rows.slice(0, 5).map((r: Record<string, unknown>) => r.name),
      emptyNames: emptyName.length,
      thinDescriptions: thinDesc.length,
      samples: rows.slice(0, 3),
    };
    starterNotes.push(note);
    if (rows.length === 0) {
      noteFriction({
        severity: "YELLOW",
        area: `Starters:${cat.key}`,
        observation: `No ${cat.key} rows after provisioning.`,
        impact: "Owner cannot explore this area with prepared content.",
      });
    }
    if (emptyName.length > 0) {
      noteFriction({
        severity: "YELLOW",
        area: `Starters:${cat.key}`,
        observation: `${emptyName.length} starter(s) missing names.`,
        impact: "Looks unfinished in Library.",
      });
    }
  }
}

async function main() {
  // ---------- Pricing / Checkout ----------
  let sessionId = "";
  let checkoutUrl = "";
  try {
    const pricingBrowser = await chromium.launch({ channel: "chrome", headless: true });
    const pricingPage = await pricingBrowser.newPage();
    await pricingPage.goto(`${MARKETING}/pricing`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await pricingPage.waitForTimeout(2000);
    await pricingPage.screenshot({ path: `${OUT}/00-pricing.png`, fullPage: true });
    const pricingBody = (await pricingPage.locator("body").innerText()).replace(/\s+/g, " ");
    record(
      "pricing.visible",
      /Gather|Starter|\/mo|month|founding|White Glove|Launch/i.test(pricingBody),
      pricingBody.slice(0, 240),
      "Pricing and Checkout",
    );
    await pricingBrowser.close();

    const res = await fetch(`${MARKETING}/api/stripe/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        plan: "starter",
        onboarding_type: "self_guided",
        venue_name: venueName,
        first_name: "Fresh",
        last_name: "Walker",
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
      throw new Error(`checkout create failed: ${res.status} ${JSON.stringify(body)}`);
    }
    sessionId = body.session_id;
    checkoutUrl = body.url;
    report.checkout = { sessionId, founding: body.founding_member };
    record(
      "checkout.session_created",
      true,
      `session=${sessionId} founding=${body.founding_member}`,
      "Pricing and Checkout",
    );

    const pay = await completeHostedCheckout(checkoutUrl);
    report.payLog = pay.log;
    report.payFinalUrl = pay.finalUrl;

    let session = await stripeGet(`checkout/sessions/${sessionId}`);
    for (let i = 0; i < 30 && session.payment_status !== "paid"; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      session = await stripeGet(`checkout/sessions/${sessionId}`);
    }
    record(
      "checkout.stripe_paid",
      session.payment_status === "paid",
      `payment_status=${session.payment_status} amount_total=${session.amount_total} sub=${session.subscription}`,
      "Pricing and Checkout",
    );

    const rec = await postReconcile(sessionId);
    record(
      "checkout.reconcile",
      rec.status === 200 &&
        (rec.body.status === "reconciled" || rec.body.status === "already_enrolled"),
      JSON.stringify(rec.body),
      "Pricing and Checkout",
    );

    let enrollment: Record<string, unknown> | null = null;
    for (let i = 0; i < 40; i++) {
      const { data } = await admin
        .from("venue_enrollments")
        .select(
          "id,venue_id,status,owner_email,plan,onboarding_type,activation_token,stripe_subscription_id,stripe_checkout_session_id,venue_name",
        )
        .eq("stripe_checkout_session_id", sessionId);
      if (data?.length && data[0]?.venue_id && data[0]?.activation_token) {
        enrollment = data[0] as Record<string, unknown>;
        break;
      }
      if (data === null) {
        // Fall back without optional columns if schema drifts.
        const { data: retry } = await admin
          .from("venue_enrollments")
          .select(
            "id,venue_id,status,owner_email,plan,onboarding_type,activation_token,stripe_subscription_id,stripe_checkout_session_id,venue_name",
          )
          .eq("stripe_subscription_id", String(session.subscription || ""))
          .limit(1);
        if (retry?.[0]?.venue_id) {
          enrollment = retry[0] as Record<string, unknown>;
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    record(
      "checkout.one_enrollment",
      Boolean(enrollment?.venue_id) && Boolean(enrollment?.activation_token),
      JSON.stringify(enrollment),
      "Pricing and Checkout",
    );
    report.enrollment = enrollment;
    if (!enrollment?.venue_id || !enrollment.activation_token) {
      throw new Error("enrollment or activation_token missing");
    }

    // Activation + login must use the enrollment owner_email Stripe/reconcile recorded.
    if (enrollment.owner_email) {
      report.ownerEmail = String(enrollment.owner_email);
    }
  } catch (e) {
    record(
      "checkout.block",
      false,
      e instanceof Error ? e.message : String(e),
      "Pricing and Checkout",
    );
    persist();
    process.exitCode = 1;
    return;
  }

  const venueId = String(report.enrollment && (report.enrollment as { venue_id: string }).venue_id);
  const activationToken = String(
    (report.enrollment as { activation_token: string }).activation_token,
  );
  const resolvedOwnerEmail = String(
    report.ownerEmail ||
      (report.enrollment as { owner_email?: string })?.owner_email ||
      ownerEmail,
  );
  report.ownerEmail = resolvedOwnerEmail;

  // ---------- Activation → Login → Welcome → Hub (continuous) ----------
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  try {
    const activateUrl = `${WORKSPACE}/activate/${activationToken}`;
    await page.goto(activateUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/02-activate.png`, fullPage: true });
    const actBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record(
      "activation.page",
      /password|Create your password|Let's get you started/i.test(actBody),
      actBody.slice(0, 280),
      "Activation",
    );

    await page.locator('input[name="password"], input[type="password"]').first().fill(ownerPassword);
    const confirm = page.locator('input[name="confirm"], input[name="confirmPassword"]').first();
    if (await confirm.count()) await confirm.fill(ownerPassword);
    const ownerRadio = page.locator('input[name="ownershipChoice"][value="owner"]');
    if (await ownerRadio.count()) await ownerRadio.check({ force: true });
    const legal = page.locator('input[name="legalAccepted"]');
    if (await legal.count()) await legal.check({ force: true });
    else {
      const anyLegal = page
        .getByText(/agree to the/i)
        .locator("..")
        .locator('input[type="checkbox"]')
        .first();
      if (await anyLegal.count()) await anyLegal.check({ force: true });
    }
    await page.screenshot({ path: `${OUT}/02-activate-filled.png`, fullPage: true });
    const submit = page
      .getByRole("button", { name: /Let's go|Activate|Create account|Continue|Get started/i })
      .first();
    await submit.waitFor({ state: "visible", timeout: 15000 });
    for (let i = 0; i < 40; i++) {
      if (!(await submit.isDisabled().catch(() => true))) break;
      await page.waitForTimeout(250);
    }
    if (await submit.isDisabled().catch(() => true)) {
      throw new Error("Activate CTA remained disabled");
    }
    await submit.click({ timeout: 20000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}/02-after-activate.png`, fullPage: true });
    report.afterActivateUrl = page.url();
    record(
      "activation.submitted",
      /login|setup-hub|welcome|activated=1/i.test(page.url() + (await page.locator("body").innerText()).slice(0, 200)),
      `url=${page.url()}`,
      "Activation",
    );

    // Prefer real password login UI for continuous customer journey.
    await context.clearCookies();
    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1000);
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passInput = page.locator('input[type="password"], input[name="password"]').first();
    if ((await emailInput.count()) && (await passInput.count())) {
      await emailInput.fill(resolvedOwnerEmail);
      await passInput.fill(ownerPassword);
      await page.screenshot({ path: `${OUT}/03-login-filled.png`, fullPage: true });
      const loginBtn = page.getByRole("button", { name: /Sign in|Log in|Continue/i }).first();
      await loginBtn.click({ timeout: 20000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${OUT}/03-after-password-login.png`, fullPage: true });
      record(
        "login.password_ui",
        !/\/login$/.test(page.url()) || /welcome|setup-hub|dashboard/i.test(page.url()),
        `url=${page.url()}`,
        "First Login",
      );
    } else {
      record("login.password_ui", false, "login form fields missing — falling back to magic session", "First Login");
    }

    // Ensure authoritative session + active venue (covers cases where password login lags).
    const login = await magicCookies(resolvedOwnerEmail, venueId);
    await context.clearCookies();
    await context.addCookies(login.cookies);
    report.ownerUserId = login.userId;

    await ensureSetupHub(page);
    await page.screenshot({ path: `${OUT}/05-setup-hub.png`, fullPage: true });
    const hubBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    const chapters = await page.locator('[data-testid="setup-hub-chapters"]').count();
    record(
      "hub.four_chapters",
      /\/setup-hub/.test(page.url()) && chapters > 0,
      `url=${page.url()} chapters=${chapters} body=${hubBody.slice(0, 220)}`,
      "Setup Hub",
    );
    for (const id of ["venue-ready", "sales-process", "client-experience", "make-it-yours"]) {
      const el = page.locator(`[data-testid="setup-chapter-${id}"]`);
      record(`hub.chapter_${id}`, (await el.count()) > 0, `count=${await el.count()}`, "Setup Hub");
    }
    record(
      "hub.not_forced_sequence",
      /any order|do not need to finish everything|Four approachable/i.test(hubBody),
      hubBody.slice(0, 220),
      "Setup Hub",
    );

    const { data: membership } = await admin
      .from("venue_staff")
      .select("venue_id,role,is_owner")
      .eq("venue_id", venueId)
      .eq("user_id", login.userId)
      .maybeSingle();
    record(
      "login.correct_venue_membership",
      Boolean(membership?.venue_id) && Boolean(membership?.is_owner || membership?.role === "owner"),
      JSON.stringify(membership),
      "First Login",
    );

    const { data: venue } = await admin
      .from("venues")
      .select("id,name,account_status,access_disabled")
      .eq("id", venueId)
      .maybeSingle();
    record(
      "login.subscription_access",
      venue?.account_status !== "suspended" && !venue?.access_disabled,
      JSON.stringify(venue),
      "First Login",
    );

    // Starters
    await sampleStarterQuality(venueId);
    const pkgCount = Number(
      (starterNotes.find((s) => s.category === "packages") as { count?: number } | undefined)
        ?.count || 0,
    );
    record("starters.packages_present", pkgCount > 0, `packages=${pkgCount}`, "Setup Hub");

    // ---------- Chapter 1 via Hub CTA ----------
    const openVenue = page.getByRole("link", { name: /Open venue settings/i }).first();
    if (await openVenue.count()) {
      await openVenue.click();
      await page.waitForTimeout(2000);
    } else {
      await page.goto(`${APP}/settings/business`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      noteFriction({
        severity: "YELLOW",
        area: "Chapter 1",
        observation: "Recommended 'Open venue settings' CTA not found on Hub; navigated directly.",
        impact: "Owner may not know where to start without Hub CTA.",
      });
    }
    await page.screenshot({ path: `${OUT}/06-business-settings.png`, fullPage: true });
    record(
      "ch1.business_reachable",
      /\/settings\//.test(page.url()) && !/onboarding\/intake/.test(page.url()),
      page.url(),
      "Venue Configuration",
    );

    // Fill representative identity fields when present
    const phone = page.locator('input[name="phone"], input[type="tel"]').first();
    if (await phone.count()) {
      const cur = await phone.inputValue().catch(() => "");
      if (!cur) await phone.fill("512-555-0148");
    }
    const address = page
      .locator('input[name="addressLine1"], input[name="address_line1"], input[placeholder*="Address"]')
      .first();
    if (await address.count()) {
      const cur = await address.inputValue().catch(() => "");
      if (!cur) await address.fill("500 Congress Avenue");
    }
    const city = page.locator('input[name="city"]').first();
    if (await city.count()) {
      const cur = await city.inputValue().catch(() => "");
      if (!cur) await city.fill("Austin");
    }
    const save = page.getByRole("button", { name: /^Save/i }).first();
    if (await save.count() && !(await save.isDisabled().catch(() => true))) {
      await save.click();
      await page.waitForTimeout(1500);
      record("ch1.business_saved", true, "clicked Save", "Venue Configuration");
    } else {
      record("ch1.business_saved", false, "Save not available/disabled", "Venue Configuration");
      noteFriction({
        severity: "YELLOW",
        area: "Chapter 1",
        observation: "Could not confidently Save business settings from first-pass UI.",
        impact: "Owner may doubt whether identity changes persist.",
      });
    }

    // Spaces
    await page.goto(`${APP}/settings/spaces`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/06-spaces.png`, fullPage: true });
    const spacesBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record(
      "ch1.spaces_reachable",
      /space|capacity|Add/i.test(spacesBody) && !/onboarding\/intake/.test(page.url()),
      page.url(),
      "Venue Configuration",
    );
    const addSpace = page.getByRole("button", { name: /Add space|New space|Create space/i }).first();
    if (await addSpace.count()) {
      await addSpace.click();
      await page.waitForTimeout(1000);
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      if (await nameInput.count()) {
        await nameInput.fill(`Garden Terrace ${stamp}`);
        const cap = page.locator('input[name="capacity"], input[name="maxCapacity"]').first();
        if (await cap.count()) await cap.fill("120");
        const saveSpace = page.getByRole("button", { name: /^Save|Create|Add$/i }).first();
        if (await saveSpace.count()) {
          await saveSpace.click();
          await page.waitForTimeout(1500);
        }
      }
    }
    const { count: spaceCount } = await admin
      .from("venue_spaces")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    record(
      "ch1.spaces_persisted",
      (spaceCount ?? 0) > 0,
      `spaces=${spaceCount}`,
      "Venue Configuration",
    );

    // Availability
    await page.goto(`${APP}/settings/availability`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/06-availability.png`, fullPage: true });
    record(
      "ch1.availability_reachable",
      /availability|tour|block|calendar/i.test(await page.locator("body").innerText()) &&
        !/onboarding\/intake/.test(page.url()),
      page.url(),
      "Venue Configuration",
    );

    // Hub progress after config
    await ensureSetupHub(page);
    await page.screenshot({ path: `${OUT}/06-hub-progress.png`, fullPage: true });
    const progressBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record(
      "ch1.hub_progress_truthful",
      /IN PROGRESS|READY|COMPLETE|ESSENTIALS|Get your venue ready/i.test(progressBody),
      progressBody.slice(0, 240),
      "Venue Configuration",
    );

    // ---------- Chapter 2 sales ----------
    const salesChapter = page.locator('[data-testid="setup-chapter-sales-process"]');
    if (await salesChapter.count()) {
      await salesChapter.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
    const practiceCta = page
      .getByRole("link", { name: /practice lead|Try a practice|Create a practice/i })
      .first();
    if (await practiceCta.count()) {
      await practiceCta.click();
      await page.waitForTimeout(2000);
    } else {
      await page.goto(`${APP}/leads/new?intent=practice`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      noteFriction({
        severity: "YELLOW",
        area: "Chapter 2",
        observation: "Practice lead CTA not obvious from Hub chapter; used intent URL.",
        impact: "Owner may not discover safe practice path from Hub alone.",
      });
    }
    await page.screenshot({ path: `${OUT}/07-practice-lead.png`, fullPage: true });
    const practiceBanner = page.locator('[data-testid="practice-lead-banner"]');
    const practiceBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record(
      "sales.practice_lead_entry",
      (await practiceBanner.count()) > 0 || /Practice Lead|practice/i.test(practiceBody),
      page.url(),
      "Sales Exploration",
    );

    // Fill and save practice lead
    const first = page.locator('input[name="firstName"], input[name="first_name"]').first();
    const last = page.locator('input[name="lastName"], input[name="last_name"]').first();
    if (await first.count()) await first.fill("Practice");
    if (await last.count()) await last.fill(`Walk${stamp}`);
    const leadEmail = page.locator('input[name="email"], input[type="email"]').first();
    if (await leadEmail.count()) {
      await leadEmail.fill(`practice.walk.${stamp}@example.com`);
    }
    const createLead = page
      .getByRole("button", { name: /Create lead|Save lead|Add lead|Create/i })
      .first();
    if (await createLead.count()) {
      await createLead.click();
      await page.waitForTimeout(2500);
    }
    await page.screenshot({ path: `${OUT}/07-practice-lead-after.png`, fullPage: true });
    const { data: leads } = await admin
      .from("leads")
      .select("id,first_name,last_name,email,status")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(3);
    report.leads = leads;
    record(
      "sales.practice_lead_persisted",
      (leads || []).some((l) => /practice/i.test(`${l.first_name} ${l.last_name}`)),
      JSON.stringify(leads),
      "Sales Exploration",
    );

    // Packages from Library path a customer would use
    await page.goto(`${APP}/library/packages`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    if (/\/packages/.test(page.url()) && !/library/.test(page.url())) {
      noteFriction({
        severity: "LOW",
        area: "Packages navigation",
        observation: `library/packages redirected to ${page.url()}.`,
        impact: "Mild terminology inconsistency between Hub copy and URL.",
      });
    }
    await page.screenshot({ path: `${OUT}/07-packages.png`, fullPage: true });
    const pkgBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record(
      "sales.packages_readable",
      /package|Gather|Essential|Wedding|pricing/i.test(pkgBody),
      pkgBody.slice(0, 240),
      "Sales Exploration",
    );
    if (/\$0|TODO|lorem|placeholder|TBD/i.test(pkgBody)) {
      noteFriction({
        severity: "YELLOW",
        area: "Starter packages",
        observation: "Package list shows placeholder-like or $0 pricing language.",
        impact: "Undermines credibility of starter commercial content.",
      });
    }

    // Contracts templates
    await page.goto(`${APP}/library/contracts`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/07-contracts-library.png`, fullPage: true });
    record(
      "sales.contracts_library",
      /contract|agreement|template/i.test(await page.locator("body").innerText()),
      page.url(),
      "Sales Exploration",
    );

    // ---------- Chapter 3 client experience surfaces ----------
    await page.goto(`${APP}/settings/leads/setup-profiles`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/08-setup-profiles.png`, fullPage: true });
    const spBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record(
      "client.setup_profiles",
      /Setup Profile|Wedding|profile/i.test(spBody),
      spBody.slice(0, 240),
      "Client Preparation",
    );
    if (!/Wedding/i.test(spBody)) {
      noteFriction({
        severity: "YELLOW",
        area: "Setup Profiles",
        observation: "Wedding Setup Profile not obviously named in first view.",
        impact: "Owner may not recognize the default starter profile.",
      });
    }

    // Preview/release language check on Hub chapter 3
    await ensureSetupHub(page);
    const clientChapter = page.locator('[data-testid="setup-chapter-client-experience"]');
    if (await clientChapter.count()) {
      await clientChapter.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/08-client-chapter.png`, fullPage: false });
    }
    const hubClientBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record(
      "client.preview_vs_release_language",
      /preview|release|invite|not yet|share/i.test(hubClientBody),
      hubClientBody.slice(0, 240),
      "Client Preparation",
    );

    // ---------- Chapter 4 optional ----------
    const makeYours = page.locator('[data-testid="setup-chapter-make-it-yours"]');
    if (await makeYours.count()) {
      await makeYours.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/09-make-it-yours.png`, fullPage: false });
    }
    record(
      "make.optional_visible",
      /Make it yours|optional|Bring Your Business|Automations|Communications/i.test(
        await page.locator("body").innerText(),
      ),
      "chapter visible",
      "Setup Hub",
    );
    await page.goto(`${APP}/communication/series`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/09-automations.png`, fullPage: true });
    const seriesBody = await page.locator("body").innerText();
    record(
      "make.automations_paused_or_present",
      /paused|inactive|draft|sequence|automation|series/i.test(seriesBody),
      seriesBody.slice(0, 220),
      "Setup Hub",
    );
    if (/active|running|enabled/i.test(seriesBody) && !/paused/i.test(seriesBody)) {
      noteFriction({
        severity: "YELLOW",
        area: "Automations",
        observation: "Automation series UI does not clearly show paused-by-default state.",
        impact: "Owner may fear accidental client contact.",
      });
    }

    // ---------- Representative event path (as far as safe UI allows) ----------
    const leadId = leads?.[0]?.id as string | undefined;
    if (leadId) {
      await page.goto(`${APP}/leads/${leadId}`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/10-lead-workspace.png`, fullPage: true });
      const leadWs = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      record(
        "event.lead_workspace",
        /lead|tour|proposal|package|contract|status/i.test(leadWs),
        page.url(),
        "Sales Exploration",
      );

      // Try to open proposal / package actions if visible — do not send.
      const proposalBtn = page
        .getByRole("button", { name: /proposal|package|Create proposal|Prepare/i })
        .first();
      const proposalLink = page
        .getByRole("link", { name: /proposal|package|Create proposal/i })
        .first();
      if (await proposalBtn.count()) {
        await proposalBtn.click().catch(() => undefined);
        await page.waitForTimeout(1500);
      } else if (await proposalLink.count()) {
        await proposalLink.click().catch(() => undefined);
        await page.waitForTimeout(1500);
      }
      await page.screenshot({ path: `${OUT}/10-lead-after-proposal-attempt.png`, fullPage: true });
      report.eventPathUrl = page.url();
      record(
        "event.proposal_surface_reachable",
        /proposal|package|contract|select/i.test(await page.locator("body").innerText()),
        page.url(),
        "Sales Exploration",
      );
    } else {
      record("event.lead_workspace", false, "no lead id", "Sales Exploration");
      record("event.proposal_surface_reachable", false, "skipped", "Sales Exploration");
    }

    // Booking / contract / portal — mark honestly if not fully exercised
    const { count: contractCount } = await admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    const { count: eventCount } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    report.contractCount = contractCount;
    report.eventCount = eventCount;
    if ((contractCount ?? 0) === 0) {
      record(
        "booking.executed_contract",
        false,
        "NOT VERIFIED in this pass — no contract created yet for fresh venue",
        "Booking",
      );
      record(
        "client.portal_access",
        false,
        "NOT VERIFIED — depends on booked event + release",
        "Client Portal",
      );
      record(
        "client.venue_followup",
        false,
        "NOT VERIFIED — depends on portal interaction",
        "Venue Follow-Up",
      );
    }

    // ---------- Save/resume ----------
    const skipByb = page.getByRole("button", { name: /Skip for now|starting fresh/i }).first();
    await ensureSetupHub(page);
    if (await skipByb.count()) {
      await skipByb.click();
      await page.waitForTimeout(1500);
    }
    await context.clearCookies();
    const login2 = await magicCookies(resolvedOwnerEmail, venueId);
    await context.addCookies(login2.cookies);
    await ensureSetupHub(page);
    await page.screenshot({ path: `${OUT}/11-resume.png`, fullPage: true });
    const { data: hubState } = await admin
      .from("venue_setup_hub_state")
      .select("bring_your_business_path,bring_your_business_manual_confirmed_at")
      .eq("venue_id", venueId)
      .maybeSingle();
    report.hubState = hubState;
    record(
      "resume.persists",
      /\/setup-hub/.test(page.url()) &&
        (await page.locator('[data-testid="setup-hub-chapters"]').count()) > 0,
      `url=${page.url()} byb=${JSON.stringify(hubState)}`,
      "Save/Resume",
    );

    // ---------- Mobile ----------
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureSetupHub(page);
    await page.screenshot({ path: `${OUT}/12-mobile-hub.png`, fullPage: true });
    record(
      "mobile.hub_chapters",
      (await page.locator('[data-testid="setup-hub-chapters"]').count()) > 0,
      page.url(),
      "Mobile",
    );
    await page.goto(`${APP}/leads/new?intent=practice`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/12-mobile-practice.png`, fullPage: true });
    record(
      "mobile.practice_lead",
      /practice|lead/i.test(await page.locator("body").innerText()),
      page.url(),
      "Mobile",
    );
  } catch (e) {
    record("walkthrough.block", false, e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
  }

  persist();
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        failed: report.failed,
        friction: friction.length,
        out: OUT,
        venueId,
        ownerEmail,
      },
      null,
      2,
    ),
  );
  if ((report.failed as number) > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  persist();
  process.exit(1);
});
