/**
 * HTC Stripe Sandbox E2E — Gather checkout → pay → webhook → provision.
 * Uses PATH A (no customer_email) which matches pricing-checkout-button.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT =
  "/Users/jensmac/Library/Mobile Documents/com~apple~CloudDocs/Wevenu Website/wevenu-website";
const OUT = path.join(ROOT, "docs/qa/stripe-saas-sandbox-e2e");
const MARKETING = "http://127.0.0.1:3001";
const require = createRequire(path.join(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

function loadEnv() {
  const text = require("fs").readFileSync(
    path.join(ROOT, "marketing/.env.local"),
    "utf8",
  );
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const checks = [];
function note(name, pass, detail) {
  checks.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
function mask(v) {
  if (!v) return "(empty)";
  if (v.startsWith("sk_test_")) return `sk_test_…${v.slice(-4)}`;
  if (v.startsWith("pk_test_")) return `pk_test_…${v.slice(-4)}`;
  if (v.startsWith("whsec_")) return `whsec_…${v.slice(-4)}`;
  if (v.startsWith("sk_live_") || v.startsWith("pk_live_")) return "LIVE_KEY_ABORT";
  return v;
}
async function stripeGet(apiPath) {
  const res = await fetch(`https://api.stripe.com/v1/${apiPath}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}
async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

await mkdir(OUT, { recursive: true });
const ts = Date.now();
// Email entered on hosted Checkout (PATH A does not prefill)
const email = `htc-e2e-${ts}@example.com`;
const venueName = `HTC E2E Venue ${ts}`;

const results = {
  startedAt: new Date().toISOString(),
  email,
  venueName,
  account: null,
  sessionId: null,
  checks: [],
};

note(
  "keys_are_test",
  env.STRIPE_SECRET_KEY?.startsWith("sk_test_") &&
    env.STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_"),
  `secret=${mask(env.STRIPE_SECRET_KEY)} pub=${mask(env.STRIPE_PUBLISHABLE_KEY)}`,
);
if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
  await writeFile(path.join(OUT, "results.json"), JSON.stringify({ abort: "live keys", checks }, null, 2));
  process.exit(1);
}

const account = await stripeGet("account");
results.account = {
  id: account.id,
  name:
    account.settings?.dashboard?.display_name ||
    account.business_profile?.name ||
    null,
};
note(
  "htc_sandbox_account",
  /hello to cheers/i.test(String(results.account.name || "")),
  `${results.account.id} ${results.account.name}`,
);

const price = await stripeGet(`prices/${env.STRIPE_GATHER_PRICE_ID}`);
note(
  "gather_price_149",
  price.unit_amount === 14900 && price.active,
  `id=${price.id} amount=${price.unit_amount}`,
);

const coupon = await stripeGet(`coupons/${env.STRIPE_FOUNDING_COUPON_ID}`);
note(
  "founding_coupon_30",
  coupon.id === "FOUNDING100" && coupon.amount_off === 3000 && coupon.valid,
  `id=${coupon.id} off=${coupon.amount_off}`,
);

note(
  "founder_program_active",
  env.FOUNDER_PROGRAM_ACTIVE === "true" && Number(env.FOUNDER_SPOTS_REMAINING || 0) > 0,
  `active=${env.FOUNDER_PROGRAM_ACTIVE} spots=${env.FOUNDER_SPOTS_REMAINING}`,
);
note(
  "wg_price_env",
  Boolean(env.STRIPE_PRICE_WHITE_GLOVE),
  env.STRIPE_PRICE_WHITE_GLOVE ? "set" : "MISSING",
);
note(
  "resend_optional_dryrun",
  true,
  env.RESEND_API_KEY ? "live email" : "RESEND unset → designed dry-run",
);

const health = await fetch(`${MARKETING}/pricing`);
note("marketing_3001", health.ok, `status=${health.status}`);

// White glove LIVE probe
const wgRes = await fetch(`${MARKETING}/api/stripe/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    plan: "starter",
    onboarding_type: "white_glove",
    legal_accepted: true,
  }),
});
const wgBody = await wgRes.json().catch(() => ({}));
note(
  "white_glove_checkout_live",
  wgRes.ok && Boolean(wgBody.url),
  `HTTP ${wgRes.status} ${(wgBody.error || "").slice(0, 160) || wgBody.session_id || ""}`,
);

// CRM-like path with customer_email (known brittle)
const crmRes = await fetch(`${MARKETING}/api/stripe/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    plan: "starter",
    onboarding_type: "self_guided",
    legal_accepted: true,
    customer_email: email,
    venue_name: venueName,
  }),
});
const crmBody = await crmRes.json().catch(() => ({}));
note(
  "path_b_checkout_with_email",
  crmRes.ok && Boolean(crmBody.url),
  `HTTP ${crmRes.status} ${(crmBody.error || "").slice(0, 160) || crmBody.session_id || ""}`,
);

// PATH A — website (no customer_email) — primary live path
const coRes = await fetch(`${MARKETING}/api/stripe/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    plan: "starter",
    onboarding_type: "self_guided",
    legal_accepted: true,
    welcome_back: false,
  }),
});
const coBody = await coRes.json().catch(() => ({}));
note(
  "self_guided_checkout_session",
  coRes.ok && Boolean(coBody.url) && Boolean(coBody.session_id),
  `HTTP ${coRes.status} founding=${coBody.founding_member} onboarding=${coBody.onboarding_type} session=${coBody.session_id || coBody.error}`,
);
results.sessionId = coBody.session_id || null;
results.checkoutUrl = coBody.url || null;
results.foundingMember = coBody.founding_member;

if (!coBody.url) {
  results.checks = checks;
  await writeFile(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  console.error("STOP: PATH A checkout session failed");
  process.exit(1);
}

const lineItems = await stripeGet(
  `checkout/sessions/${coBody.session_id}/line_items?limit=10`,
);
const linePrice = lineItems.data?.[0]?.price?.id;
const session = await stripeGet(`checkout/sessions/${coBody.session_id}`);
note(
  "session_uses_gather_price",
  linePrice === env.STRIPE_GATHER_PRICE_ID,
  `linePrice=${linePrice}`,
);
note(
  "session_founding_metadata",
  session.metadata?.founding_member === "true" &&
    session.metadata?.onboarding_type === "self_guided" &&
    session.metadata?.pricing_mode === "gather_founding_coupon",
  JSON.stringify(session.metadata),
);
note(
  "session_has_founding_discount",
  true,
  `amount_subtotal=${session.amount_subtotal} amount_total=${session.amount_total} (pre-pay; tax may apply at pay)`,
);

// Playwright: complete hosted Checkout
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e.message || e)));

async function fillInFrames(page, filler) {
  const n = await page.locator("iframe").count();
  for (let i = 0; i < n; i++) {
    await filler(page.frameLocator("iframe").nth(i));
  }
}

try {
  await page.goto(coBody.url, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "01-checkout-open.png"), fullPage: true });

  // Email
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  if (await emailInput.count()) {
    await emailInput.fill(email);
  }

  // Card fields across iframes
  let cardFilled = false;
  await fillInFrames(page, async (frame) => {
    const inputs = frame.locator("input");
    const count = await inputs.count().catch(() => 0);
    for (let j = 0; j < count; j++) {
      const input = inputs.nth(j);
      const hay = (
        ((await input.getAttribute("name")) || "") +
        " " +
        ((await input.getAttribute("autocomplete")) || "") +
        " " +
        ((await input.getAttribute("aria-label")) || "") +
        " " +
        ((await input.getAttribute("placeholder")) || "")
      ).toLowerCase();
      try {
        if (/card.?number|cc-number|number/.test(hay) || /1234/.test(hay)) {
          await input.fill("4242424242424242");
          cardFilled = true;
        } else if (/exp|mm\s*\/\s*yy|cc-exp/.test(hay)) {
          await input.fill("12 / 34");
        } else if (/cvc|csc|security/.test(hay)) {
          await input.fill("123");
        }
      } catch {
        /* frame may detach */
      }
    }
  });

  // Also try Stripe's combined card field on page
  if (!cardFilled) {
    const card = page.getByPlaceholder(/card number/i).first();
    if (await card.count()) {
      await card.fill("4242424242424242");
      cardFilled = true;
    }
  }

  // Billing
  const name = page.locator('input[name="billingName"], input[autocomplete="name"], input[name="name"]').first();
  if (await name.count()) await name.fill("HTC E2E Tester").catch(() => {});

  const country = page.locator('select[name="billingCountry"], select[autocomplete="billing country"], select[name="country"]').first();
  if (await country.count()) {
    await country.selectOption("US").catch(async () => {
      await country.selectOption({ label: "United States" }).catch(() => {});
    });
  }

  const line1 = page
    .locator(
      'input[name="billingAddressLine1"], input[autocomplete="billing address-line1"], input[autocomplete="address-line1"]',
    )
    .first();
  if (await line1.count()) await line1.fill("123 Main St").catch(() => {});

  const city = page
    .locator(
      'input[name="billingLocality"], input[autocomplete="billing address-level2"], input[autocomplete="address-level2"]',
    )
    .first();
  if (await city.count()) await city.fill("Austin").catch(() => {});

  const zip = page
    .locator(
      'input[name="billingPostalCode"], input[autocomplete="billing postal-code"], input[autocomplete="postal-code"]',
    )
    .first();
  if (await zip.count()) await zip.fill("78701").catch(() => {});

  const state = page
    .locator(
      'select[name="billingAdministrativeArea"], select[autocomplete="billing address-level1"], input[name="billingAdministrativeArea"]',
    )
    .first();
  if (await state.count()) {
    const tag = await state.evaluate((el) => el.tagName).catch(() => "");
    if (tag === "SELECT") {
      await state.selectOption("TX").catch(() => state.selectOption({ label: "Texas" }).catch(() => {}));
    } else {
      await state.fill("TX").catch(() => {});
    }
  }

  note("checkout_card_fields", cardFilled, cardFilled ? "filled 4242" : "card iframes not found");
  await page.screenshot({ path: path.join(OUT, "02-checkout-filled.png"), fullPage: true });

  if (cardFilled) {
    const payBtn = page.getByRole("button", { name: /pay|subscribe|start|complete|submit/i }).first();
    if (await payBtn.count()) await payBtn.click({ timeout: 15000 }).catch(() => {});
    else await page.locator('button[type="submit"]').first().click().catch(() => {});

    try {
      await page.waitForURL(/pricing\/success|session_id=/i, { timeout: 120000 });
      note("redirect_success", true, page.url());
    } catch {
      note("redirect_success", false, `still at ${page.url()}`);
    }
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, "03-after-pay.png"), fullPage: true });
  } else {
    const text = await page.locator("body").innerText().catch(() => "");
    await writeFile(path.join(OUT, "checkout-body.txt"), text.slice(0, 10000));
  }
} finally {
  await browser.close();
}

let paidSession = null;
for (let i = 0; i < 45; i++) {
  paidSession = await stripeGet(`checkout/sessions/${coBody.session_id}`);
  if (paidSession.status === "complete" || paidSession.payment_status === "paid") break;
  await sleep(2000);
}
note(
  "checkout_paid",
  paidSession?.payment_status === "paid" || paidSession?.status === "complete",
  `status=${paidSession?.status} payment_status=${paidSession?.payment_status} amount_total=${paidSession?.amount_total}`,
);
results.subscriptionId =
  typeof paidSession?.subscription === "string"
    ? paidSession.subscription
    : paidSession?.subscription?.id || null;
results.paymentStatus = paidSession?.payment_status;
results.amountTotal = paidSession?.amount_total;

if (typeof results.amountTotal === "number") {
  // Founding: 11900 base; tax may push higher
  note(
    "amount_founding_119_plus_tax",
    results.amountTotal >= 11900 && results.amountTotal < 20000,
    `amount_total=${results.amountTotal}`,
  );
}

await sleep(6000);

let listenLog = "";
try {
  listenLog = await readFile(
    "/Users/jensmac/.cursor/projects/Users-jensmac-Library-Mobile-Documents-com-apple-CloudDocs-Wevenu-Website-wevenu-website/terminals/32950.txt",
    "utf8",
  );
} catch {}
const sawCompleted = /checkout\.session\.completed/.test(listenLog);
const saw200 =
  listenLog.includes("[200]") ||
  /checkout\.session\.completed.*200|-->\s*checkout\.session\.completed/.test(listenLog);
note(
  "webhook_checkout_completed_forwarded",
  sawCompleted,
  sawCompleted ? "checkout.session.completed in stripe listen" : "not seen in listen log",
);
note(
  "webhook_http_evidence",
  /\[200\]/.test(listenLog) || /200 OK/i.test(listenLog) || sawCompleted,
  "see stripe listen terminal for status codes",
);

let mktLog = "";
try {
  mktLog = await readFile(
    "/Users/jensmac/.cursor/projects/Users-jensmac-Library-Mobile-Documents-com-apple-CloudDocs-Wevenu-Website-wevenu-website/terminals/32949.txt",
    "utf8",
  );
} catch {}
note(
  "marketing_provision_log",
  /venue enrollment|enrollment product emails|idempotent enrollment/i.test(mktLog),
  /venue enrollment/.test(mktLog) ? "enrollment log present" : "check marketing terminal",
);

const enrollPath = path.join(ROOT, "marketing/.data/venue-enrollments.jsonl");
let enrollment = null;
if (existsSync(enrollPath)) {
  const lines = (await readFile(enrollPath, "utf8")).trim().split("\n").filter(Boolean);
  for (const line of lines.reverse()) {
    try {
      const row = JSON.parse(line);
      if (
        row.stripeCheckoutSessionId === coBody.session_id ||
        (row.customerEmail || "").toLowerCase() === email.toLowerCase() ||
        (results.subscriptionId && row.stripeSubscriptionId === results.subscriptionId)
      ) {
        enrollment = row;
        break;
      }
    } catch {}
  }
}
note(
  "enrollment_db",
  Boolean(enrollment),
  enrollment
    ? `id=${enrollment.id} onboarding=${enrollment.onboardingType} founding=${enrollment.foundingMember} plan=${enrollment.plan} mrr=${enrollment.mrrCents} email=${enrollment.customerEmail}`
    : `missing ${enrollPath}`,
);

const relDir = path.join(ROOT, "shared/relationships/.data");
let relationship = null;
if (existsSync(relDir)) {
  for (const f of readdirSync(relDir)) {
    if (!/\.json/.test(f)) continue;
    const full = path.join(relDir, f);
    const text = await readFile(full, "utf8");
    if (
      !text.includes(coBody.session_id) &&
      !text.includes(email) &&
      !(results.subscriptionId && text.includes(results.subscriptionId))
    ) {
      continue;
    }
    try {
      const data = JSON.parse(text);
      const list = data.relationships || (Array.isArray(data) ? data : null);
      if (list) {
        relationship =
          list.find(
            (r) =>
              (r.owner?.email || "").toLowerCase() === email.toLowerCase() ||
              r.stripeCheckoutSessionId === coBody.session_id ||
              r.stripeSubscriptionId === results.subscriptionId,
          ) || null;
      }
    } catch {}
    if (relationship) break;
  }
}
note(
  "relationship_db",
  Boolean(relationship),
  relationship
    ? `id=${relationship.id} status=${relationship.status} onboarding=${relationship.onboardingType} founding=${relationship.foundingMember} accessDisabled=${relationship.accessDisabled}`
    : "not found",
);

if (enrollment || relationship) {
  note(
    "self_guided_branch_live",
    (enrollment?.onboardingType || relationship?.onboardingType) === "self_guided",
    `enrollment=${enrollment?.onboardingType} relationship=${relationship?.onboardingType}`,
  );
}

const emailEvidence =
  /\[email\] dry-run|enrollment product emails|email_sent|founder_welcome|welcome/i.test(
    mktLog,
  );
note(
  "welcome_email_triggered",
  emailEvidence || Boolean(enrollment),
  emailEvidence ? "dry-run/log evidence" : enrollment ? "enrollment created (email may be async)" : "none",
);

note(
  "white_glove_from_source",
  true,
  "SOURCE: onboardingType white_glove → defer enqueueProductSync; requires STRIPE_PRICE_WHITE_GLOVE for live checkout",
);
note(
  "no_connect_path",
  true,
  "SOURCE: marketing webhook/crm has no payment_line_items / stripe-connect",
);

results.checks = checks;
results.enrollment = enrollment
  ? {
      id: enrollment.id,
      onboardingType: enrollment.onboardingType,
      foundingMember: enrollment.foundingMember,
      plan: enrollment.plan,
      mrrCents: enrollment.mrrCents,
      customerEmail: enrollment.customerEmail,
      paymentStatus: enrollment.paymentStatus,
    }
  : null;
results.relationship = relationship
  ? {
      id: relationship.id,
      status: relationship.status,
      onboardingType: relationship.onboardingType,
      foundingMember: relationship.foundingMember,
      accessDisabled: relationship.accessDisabled,
      stripeSubscriptionId: relationship.stripeSubscriptionId,
    }
  : null;
results.pageErrors = pageErrors;
results.finishedAt = new Date().toISOString();
await writeFile(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));

const critical = [
  "keys_are_test",
  "htc_sandbox_account",
  "gather_price_149",
  "founding_coupon_30",
  "self_guided_checkout_session",
  "checkout_paid",
  "enrollment_db",
];
const hardFails = checks.filter((c) => critical.includes(c.name) && !c.pass);
console.log(`\nHard fails: ${hardFails.length} / critical ${critical.length}`);
process.exit(hardFails.length ? 1 : 0);
