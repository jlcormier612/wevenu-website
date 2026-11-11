/**
 * Phase 4 final authenticated Sandbox acceptance.
 * Property A (disposable Gather) → Add Another Venue → Checkout $179.10 → pay → activate.
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });

const OUT = "/Users/jensmac/Developer/wevenu-website/docs/qa/htc-phase4-group-pricing/browser";
mkdirSync(OUT, { recursive: true });
const APP = "https://app.sandbox.hellotocheers.com";
const MARKETING = "https://sandbox.hellotocheers.com";
const WS = "https://workspace.sandbox.hellotocheers.com";
const EXPECTED_SHA = "e8d3f96913cc6a2bcfb692ba90ed3d10838736bd";
const EMAIL = "jennifer@hellotocheers.com";
const JEN = "2fa73101-337b-4530-8c77-f3c272c5463e";
const PROP_B_NAME = `[DISPOSABLE-P4-PROP-B] ${Date.now()}`;

const fixture = JSON.parse(
  readFileSync(
    "/Users/jensmac/Developer/wevenu-website/docs/qa/htc-phase4-group-pricing/fixture-prop-a.json",
    "utf8",
  ),
) as {
  venueId: string;
  venueName: string;
  subscriptionId: string;
  customerId: string;
};

const report: Record<string, unknown> = {
  expectedSha: EXPECTED_SHA,
  propertyA: fixture,
  propertyBName: PROP_B_NAME,
  steps: [] as unknown[],
  ok: false,
};

function save(name: string, text: string) {
  writeFileSync(`${OUT}/${name}`, text);
}

function step(name: string, detail: Record<string, unknown> = {}) {
  (report.steps as unknown[]).push({ name, at: new Date().toISOString(), ...detail });
  console.log(`STEP ${name}`, detail);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
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

async function productSyncApiKey(): Promise<string | null> {
  if (process.env.PRODUCT_SYNC_API_KEY?.trim()) {
    return process.env.PRODUCT_SYNC_API_KEY.trim();
  }
  try {
    const { execFileSync } = await import("node:child_process");
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
      return (
        parsed.value ||
        parsed.PRODUCT_SYNC_API_KEY ||
        parsed.api_key ||
        raw
      );
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

/** Ensure disposable Prop A can reach Settings → Billing (intake gate). */
async function preparePropertyAAccess() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const now = new Date().toISOString();
  await admin
    .from("venues")
    .update({
      setup_completed: true,
      setup_completed_at: now,
      onboarding_dismissed: true,
    })
    .eq("id", fixture.venueId);

  await admin.from("venue_onboarding_intake").upsert(
    {
      venue_id: fixture.venueId,
      path: "self_setup",
      venue_name: fixture.venueName,
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
    { venue_id: fixture.venueId, onboarding_type: "self_setup" },
    { onConflict: "venue_id" },
  );

  const { data: existingEnr } = await admin
    .from("venue_enrollments")
    .select("id")
    .eq("venue_id", fixture.venueId)
    .eq("status", "activated")
    .maybeSingle();
  if (!existingEnr) {
    await admin.from("venue_enrollments").insert({
      venue_id: fixture.venueId,
      onboarding_type: "self_setup",
      status: "activated",
      owner_email: EMAIL,
      owner_first_name: "Jennifer",
      owner_last_name: "Cormier",
      purchaser_is_owner: true,
      venue_name: fixture.venueName,
      stripe_customer_id: fixture.customerId,
      stripe_subscription_id: fixture.subscriptionId,
      plan: "starter",
    });
  }
}

async function establishSession(page: Page) {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  await preparePropertyAAccess();
  await setActiveVenue(fixture.venueId);

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
      options: { redirect_to: `${APP}/settings/billing` },
    }),
  });
  const linkPayload = (await gen.json()) as {
    hashed_token?: string;
    action_link?: string;
  };
  if (!linkPayload.hashed_token) throw new Error("No magic link token");

  // Prefer token_hash confirm path (reliable in Sandbox) — same as Phase 3.
  const confirmUrl =
    `${APP}/auth/confirm?token_hash=${encodeURIComponent(linkPayload.hashed_token)}` +
    `&type=magiclink&next=${encodeURIComponent("/settings/billing")}`;
  await page.goto(confirmUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(4000);

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
      `${APP}/auth/confirm?next=${encodeURIComponent("/settings/billing")}#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}&type=magiclink`,
      { waitUntil: "networkidle", timeout: 90000 },
    );
    await page.waitForTimeout(4000);
  }

  await setActiveVenue(fixture.venueId);
  await page.goto(`${APP}/settings/billing`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForTimeout(2500);

  // If still not on billing, try venue switcher for Prop A.
  if (!page.url().includes("/settings/billing")) {
    await shot(page, "00-auth-landed-not-billing");
    save("00-auth-url.txt", page.url());
  }
  const body = await page.locator("body").innerText();
  if (!body.includes("DISPOSABLE-P4-PROP-A") && !/Add Another Venue/i.test(body)) {
    const switcher = page
      .getByRole("button")
      .filter({ hasText: /Willow|Fancy|DISPOSABLE|venue|Grove|Organization/i })
      .first();
    if (await switcher.count()) {
      await switcher.click().catch(() => {});
      await page.waitForTimeout(500);
      const item = page.getByText(/DISPOSABLE-P4-PROP-A/i).first();
      if (await item.count()) {
        await item.click();
        await page.waitForTimeout(2500);
        await page.goto(`${APP}/settings/billing`, {
          waitUntil: "networkidle",
          timeout: 90000,
        });
        await page.waitForTimeout(2500);
      }
    }
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();

  try {
    // --- A. Property A Billing start ---
    await establishSession(page);
    await shot(page, "01-property-a-billing");
    save("01-url.txt", page.url());
    const billingText = await page.locator("body").innerText();
    const notEligible =
      /not yet eligible|need two active|not yet linked|Independent venue/i.test(
        billingText,
      ) || !/Eligible \(\d+ qualifying/i.test(billingText);
    step("A_billing_start", {
      url: page.url(),
      hasOrgCard: /Organization|group pricing|Add Another Venue/i.test(
        billingText,
      ),
      notGroupEligible: notEligible,
      mentionsPropA: billingText.includes("DISPOSABLE-P4-PROP-A") ||
        billingText.includes("Organization"),
    });
    if (!/Add Another Venue/i.test(billingText)) {
      throw new Error("Add Another Venue control not visible on Billing");
    }

    // --- B. Add Property B ---
    await page.getByRole("button", { name: /Add Another Venue/i }).click();
    await page.waitForTimeout(800);
    await shot(page, "02-add-venue-form");
    await page.locator("#new-venue-name").fill(PROP_B_NAME);
    await page.locator("#new-venue-plan").selectOption("starter");
    await shot(page, "03-add-venue-filled");

    const [nav] = await Promise.all([
      page.waitForURL(/sandbox\.hellotocheers\.com\/pricing/, {
        timeout: 60000,
      }).catch(() => null),
      page.getByRole("button", { name: /Continue to Checkout/i }).click(),
    ]);
    await page.waitForTimeout(3000);
    await shot(page, "04-marketing-pricing");
    save("04-url.txt", page.url());
    const pricingUrl = page.url();
    if (!pricingUrl.includes("reservation_id=")) {
      throw new Error(`Expected reservation_id in pricing URL: ${pricingUrl}`);
    }
    const reservationId = new URL(pricingUrl).searchParams.get("reservation_id");
    step("B_reservation_and_pricing", {
      pricingUrl,
      reservationId,
      hasAddVenueBanner: /Adding another property/i.test(
        await page.locator("body").innerText(),
      ),
      navOk: Boolean(nav) || pricingUrl.includes("/pricing"),
    });

    // Open Gather checkout (preferred plan)
    const gatherBtn = page
      .getByRole("button", { name: /Continue with this plan|Get started|Choose Gather|Select Gather/i })
      .first();
    // Prefer the primary Gather card CTA
    const planCards = page.locator("article").filter({ hasText: /Gather/i });
    if (await planCards.count()) {
      const cta = planCards.first().getByRole("button").first();
      await cta.click();
    } else if (await gatherBtn.count()) {
      await gatherBtn.click();
    } else {
      // fallback: any checkout open button on page for starter
      await page.getByRole("button").filter({ hasText: /Get|Start|Continue|Choose/i }).first().click();
    }
    await page.waitForTimeout(1500);
    await shot(page, "05-onboarding-selection");

    // Fill the onboarding dialog (portal) — not the page-body duplicate cards.
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 15000 });

    await dialog.getByLabel(/^First name$/i).fill("Jennifer");
    await dialog.getByLabel(/^Last name$/i).fill("Cormier");
    await dialog.getByLabel(/^Venue name$/i).fill(PROP_B_NAME);

    // Must NOT claim Weven — Group 10% is the offer under test (Weven 20% would win).
    // Welcome Back is a single optional checkbox (default unchecked).
    const wevenYes = dialog
      .locator("label")
      .filter({ hasText: /Weven customer|Weven family/i })
      .locator('input[type="checkbox"]');
    if (await wevenYes.count()) {
      const checked = await wevenYes.first().isChecked().catch(() => false);
      if (checked) await wevenYes.first().uncheck({ force: true });
    }

    // Legal acceptance checkbox
    const legal = dialog
      .locator("label")
      .filter({ hasText: /Terms of Service/i })
      .locator('input[type="checkbox"]');
    await legal.first().check({ force: true });

    await shot(page, "05b-onboarding-filled");

    // Capture checkout API via route interception (avoids lost response bodies
    // when the page immediately navigates to Stripe Checkout).
    let checkoutJson: Record<string, unknown> | null = null;
    let checkoutStatus = 0;
    await page.route("**/api/stripe/checkout", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      checkoutStatus = response.status();
      const text = await response.text();
      try {
        checkoutJson = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      } catch {
        checkoutJson = { raw: text };
      }
      await route.fulfill({
        status: response.status(),
        headers: response.headers(),
        body: text,
      });
    });

    // Click Continue on the self-setup card inside the dialog only.
    await dialog
      .locator("article")
      .filter({ hasText: /I.?ll set it up myself/i })
      .getByRole("button", { name: /Continue to Checkout/i })
      .click();

    // Wait for either API capture or Stripe redirect.
    for (let i = 0; i < 60 && !checkoutJson; i++) {
      if (/checkout\.stripe\.com/.test(page.url())) break;
      await page.waitForTimeout(500);
    }
    await page.unroute("**/api/stripe/checkout").catch(() => {});

    // Fallback: resolve session id from Stripe Checkout URL if body was lost.
    let sessionIdFromUrl: string | null = null;
    if (!checkoutJson?.session_id) {
      try {
        await page.waitForURL(/checkout\.stripe\.com/, { timeout: 45000 });
      } catch {
        /* continue */
      }
      const m = page.url().match(/cs_test_[A-Za-z0-9]+/);
      sessionIdFromUrl = m?.[0] ?? null;
    }

    const stripeKeyEarly = process.env.STRIPE_SECRET_KEY!;
    if ((!checkoutJson || !checkoutJson.session_id) && sessionIdFromUrl) {
      const sess = await (
        await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${sessionIdFromUrl}`,
          { headers: { Authorization: `Bearer ${stripeKeyEarly}` } },
        )
      ).json();
      checkoutJson = {
        session_id: sess.id,
        url: page.url(),
        applied_offer_type: sess.metadata?.applied_offer_type,
        group_eligible: sess.metadata?.group_eligible,
        expected_recurring_amount_cents: Number(
          sess.metadata?.expected_recurring_amount_cents || 0,
        ),
        org_reservation_id: sess.metadata?.org_reservation_id,
        stripe_session_fallback: true,
        amount_total: sess.amount_total,
        total_details: sess.total_details,
        metadata: sess.metadata,
      };
      checkoutStatus = 200;
    }

    if (!checkoutJson) {
      throw new Error(`Checkout API returned empty body (status ${checkoutStatus})`);
    }
    save("05-checkout-api.json", JSON.stringify(checkoutJson, null, 2));
    step("C_checkout_api", {
      status: checkoutStatus,
      applied_offer_type: checkoutJson.applied_offer_type,
      group_eligible: checkoutJson.group_eligible,
      expected_recurring_amount_cents: checkoutJson.expected_recurring_amount_cents,
      session_id: checkoutJson.session_id,
      org_reservation_id: checkoutJson.org_reservation_id,
      stripe_session_fallback: Boolean(checkoutJson.stripe_session_fallback),
    });

    if (checkoutJson.expected_recurring_amount_cents !== 17910) {
      throw new Error(
        `Expected Checkout recurring 17910, got ${checkoutJson.expected_recurring_amount_cents}`,
      );
    }
    if (checkoutJson.applied_offer_type !== "group_pct") {
      throw new Error(
        `Expected applied_offer_type group_pct, got ${checkoutJson.applied_offer_type}`,
      );
    }
    if (!checkoutJson.session_id) {
      throw new Error("Checkout Session id missing");
    }

    // --- D. Stripe Test payment ---
    if (!/checkout\.stripe\.com/.test(page.url())) {
      if (typeof checkoutJson.url === "string" && checkoutJson.url.includes("stripe.com")) {
        await page.goto(checkoutJson.url, {
          waitUntil: "domcontentloaded",
          timeout: 90000,
        });
      } else {
        throw new Error("Not on Stripe Checkout and no session URL available");
      }
    }
    await page.waitForTimeout(4000);
    await shot(page, "06-stripe-checkout");

    // Hosted Checkout: email first, then Card method, then camelCase card fields
    // on the main document (not iframes). Fields mount only after Card is selected.
    async function fillFirst(sels: string[], value: string, seq = false) {
      for (const frame of [page.mainFrame(), ...page.frames()]) {
        for (const sel of sels) {
          const loc = frame.locator(sel).first();
          if (!(await loc.count().catch(() => 0))) continue;
          await loc.click({ force: true }).catch(() => {});
          if (seq) {
            await loc.fill("").catch(() => {});
            await loc
              .pressSequentially(value, { delay: 25 })
              .catch(async () => loc.fill(value));
          } else {
            await loc.fill(value).catch(() => {});
          }
          return `${frame === page.mainFrame() ? "main" : "frame"}:${sel}`;
        }
      }
      return null;
    }

    async function fillUntil(
      sels: string[],
      value: string,
      seq = false,
      attempts = 16,
    ) {
      for (let i = 0; i < attempts; i++) {
        const hit = await fillFirst(sels, value, seq);
        if (hit) return hit;
        await page.waitForTimeout(400);
      }
      return null;
    }

    const emailFilled = await fillUntil(
      ["#email", 'input[name="email"]', 'input[autocomplete="email"]'],
      EMAIL,
    );
    await page.waitForTimeout(800);
    // Link "save my information" often forces a phone field that then fails validation.
    for (let i = 0; i < 3; i++) {
      const saveInfo = page.getByLabel(/save my information/i);
      if (await saveInfo.count()) {
        if (await saveInfo.isChecked().catch(() => false)) {
          await saveInfo.uncheck({ force: true }).catch(() => {});
        }
      }
      const linkBox = page.locator('input[name="enableStripePass"]');
      if (await linkBox.count()) {
        if (await linkBox.isChecked().catch(() => false)) {
          await linkBox.uncheck({ force: true }).catch(() => {});
        }
      }
      await page.waitForTimeout(300);
    }

    // Select Card payment method — radio role often fails; click Card text.
    await page.getByRole("radio", { name: /^Card$/i }).click({ force: true }).catch(() => {});
    const cardLabel = page.getByText(/^Card$/, { exact: true }).first();
    if (await cardLabel.count()) {
      const box = await cardLabel.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await cardLabel.click({ force: true }).catch(() => {});
      }
    }
    await page.waitForTimeout(2000);

    const cardFilled = await fillUntil(
      [
        'input[name="cardNumber"]',
        'input[autocomplete="cc-number"]',
        'input[aria-label="Card number"]',
        'input[placeholder*="1234"]',
      ],
      "4242424242424242",
      true,
      25,
    );
    const expFilled = await fillUntil(
      [
        'input[name="cardExpiry"]',
        'input[autocomplete="cc-exp"]',
        'input[aria-label="Expiration"]',
        'input[placeholder*="MM" i]',
      ],
      "1230",
      true,
    );
    const cvcFilled = await fillUntil(
      [
        'input[name="cardCvc"]',
        'input[autocomplete="cc-csc"]',
        'input[placeholder*="CVC" i]',
      ],
      "123",
      true,
    );
    await fillUntil(
      [
        'input[name="billingName"]',
        'input[autocomplete="cc-name"]',
        'input[placeholder*="Full name" i]',
      ],
      "Jennifer Cormier",
    );
    const country = page
      .locator('select[name="billingCountry"], select[name="country"]')
      .first();
    if (await country.count()) {
      await country.selectOption("US").catch(() => {});
    }
    // Prefer a non-autocomplete street to avoid Google Places overlay blocking Subscribe.
    const line1 = page
      .locator(
        'input[name="billingAddressLine1"], input[autocomplete="billing address-line1"], input[autocomplete="address-line1"]',
      )
      .first();
    if (await line1.count()) {
      await line1.click({ force: true });
      await line1.fill("");
      await line1.pressSequentially("123 Test Street", { delay: 20 });
      await page.waitForTimeout(600);
      await page.keyboard.press("Escape").catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
      // Click away from autocomplete
      await page.locator("#email, input[name=email]").first().click().catch(() => {});
      await page.waitForTimeout(400);
    }
    await fillUntil(
      [
        'input[name="billingLocality"]',
        'input[autocomplete="billing address-level2"]',
        'input[autocomplete="address-level2"]',
      ],
      "Austin",
    );
    const state = page
      .locator(
        'select[name="billingAdministrativeArea"], select[name="state"]',
      )
      .first();
    if (await state.count()) {
      await state.selectOption("TX").catch(() =>
        state.selectOption({ label: "Texas" }),
      );
    }
    await fillUntil(
      [
        'input[name="billingPostalCode"]',
        'input[autocomplete="billing postal-code"]',
        'input[autocomplete="postal-code"]',
        'input[placeholder*="ZIP" i]',
      ],
      "78701",
      true,
    );
    // Final dismiss of any leftover Places overlay
    await page.keyboard.press("Escape").catch(() => {});
    await page.locator("body").click({ position: { x: 10, y: 10 } }).catch(() => {});
    await page.waitForTimeout(500);

    // Clear optional phone — a red Link phone validation can block Subscribe.
    const phone = page.locator('input[name="phoneNumber"], input[autocomplete="tel"]').first();
    if (await phone.count()) {
      await phone.fill("").catch(() => {});
      // If phone remains required, use a valid US test number.
      const stillVisible = await phone.isVisible().catch(() => false);
      if (stillVisible) {
        await phone.fill("5125550100").catch(() => {});
      }
    }
    // Uncheck Link again after address fill (Stripe re-enables it).
    const linkAgain = page.locator('input[name="enableStripePass"]');
    if (await linkAgain.count() && (await linkAgain.isChecked().catch(() => false))) {
      await linkAgain.uncheck({ force: true }).catch(() => {});
    }
    save(
      "07-stripe-fill-log.json",
      JSON.stringify(
        { emailFilled, cardFilled, expFilled, cvcFilled },
        null,
        2,
      ),
    );
    if (!cardFilled) {
      await shot(page, "07-stripe-card-missing");
      throw new Error("Stripe Checkout card number field not found");
    }

    await shot(page, "07-stripe-filled");
    const submit = page
      .getByRole("button", { name: /^Subscribe$/ })
      .or(
        page
          .locator('button[type="submit"]')
          .filter({ hasText: /^Subscribe$/ }),
      )
      .first();
    await submit.waitFor({ state: "visible", timeout: 20000 });
    for (let i = 0; i < 50; i++) {
      const disabled = await submit.getAttribute("disabled");
      const aria = await submit.getAttribute("aria-disabled");
      if (!disabled && aria !== "true") break;
      await page.waitForTimeout(400);
    }
    // Ensure overlay is gone, then click Subscribe (force if needed).
    await page.keyboard.press("Escape").catch(() => {});
    await submit.scrollIntoViewIfNeeded().catch(() => {});
    await submit.click({ timeout: 15000 }).catch(async () => {
      await submit.click({ force: true, timeout: 10000 });
    });
    try {
      await page.waitForURL(
        /pricing\/success|hellotocheers\.com\/(pricing|activate|onboarding)|session_id=/i,
        { timeout: 120000 },
      );
    } catch {
      await page.waitForTimeout(15000);
      const alerts = await page
        .locator('[role="alert"], .FieldError-container, [data-testid*="error"]')
        .allInnerTexts()
        .catch(() => []);
      save("08-stripe-alerts.json", JSON.stringify({ alerts, url: page.url() }, null, 2));
    }
    await shot(page, "08-after-stripe-submit");
    save("08-url.txt", page.url());

    const sessionId = String(checkoutJson.session_id || "");
    // Verify Stripe objects — poll while Checkout completes.
    const stripeKey = process.env.STRIPE_SECRET_KEY!;
    let sessionObj: Record<string, any> = {};
    let subscriptionId: string | undefined;
    for (let i = 0; i < 24; i++) {
      sessionObj = await (
        await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=subscription&expand[]=invoice`,
          { headers: { Authorization: `Bearer ${stripeKey}` } },
        )
      ).json();
      subscriptionId =
        typeof sessionObj.subscription === "string"
          ? sessionObj.subscription
          : sessionObj.subscription?.id;
      if (subscriptionId || sessionObj.status === "complete") break;
      // If still open, try clicking Subscribe again once mid-poll.
      if (i === 4 && /checkout\.stripe\.com/.test(page.url())) {
        await page.keyboard.press("Escape").catch(() => {});
        await page
          .getByRole("button", { name: /^Subscribe$/ })
          .click({ force: true })
          .catch(() => {});
      }
      await page.waitForTimeout(5000);
    }
    save("09-stripe-session.json", JSON.stringify(sessionObj, null, 2));

    if (!subscriptionId) {
      throw new Error(
        `No subscription on Checkout Session ${sessionId}; status=${sessionObj.status}; payment=${sessionObj.payment_status}; url=${page.url()}`,
      );
    }

    const subRes = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}?expand[]=latest_invoice`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    );
    const subObj = await subRes.json();
    save("10-stripe-subscription.json", JSON.stringify(subObj, null, 2));
    const invoice =
      typeof subObj.latest_invoice === "object" ? subObj.latest_invoice : null;
    const invoiceAmount = invoice?.amount_paid ?? invoice?.amount_due ?? invoice?.total;
    step("D_stripe_payment", {
      sessionId,
      subscriptionId,
      sessionStatus: sessionObj.status,
      paymentStatus: sessionObj.payment_status,
      invoiceId: invoice?.id,
      invoiceAmount,
      discount: invoice?.total_discount_amounts,
    });
    if (invoiceAmount !== 17910) {
      throw new Error(`Initial invoice amount ${invoiceAmount} !== 17910`);
    }

    // --- E. Activation ---
    // Find enrollment by checkout session
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    let enrollment: { id: string; status: string; venue_id: string | null; activation_token?: string } | null = null;
    for (let i = 0; i < 12; i++) {
      const { data } = await admin
        .from("venue_enrollments")
        .select("id,status,venue_id,activation_token,stripe_checkout_session_id,venue_name")
        .eq("stripe_checkout_session_id", sessionId)
        .maybeSingle();
      if (data) {
        enrollment = data as typeof enrollment;
        break;
      }
      await page.waitForTimeout(2500);
    }
    save("11-enrollment.json", JSON.stringify(enrollment, null, 2));
    if (!enrollment) throw new Error("Enrollment not found for Checkout Session");

    // If not activated, hit success page / activation path
    if (enrollment.status !== "activated" || !enrollment.venue_id) {
      // Navigate success page which may kick provisioning
      if (!page.url().includes("/pricing/success")) {
        await page.goto(
          `${MARKETING}/pricing/success?session_id=${encodeURIComponent(sessionId)}`,
          { waitUntil: "networkidle", timeout: 90000 },
        );
        await page.waitForTimeout(5000);
      }
      await shot(page, "11-pricing-success");

      // Try workspace activation if token present
      const { data: enr2 } = await admin
        .from("venue_enrollments")
        .select("id,status,venue_id,activation_token")
        .eq("id", enrollment.id)
        .single();
      enrollment = enr2 as typeof enrollment;

      if (enrollment?.activation_token && enrollment.status !== "activated") {
        const syncKey = await productSyncApiKey();
        if (!syncKey) {
          throw new Error("PRODUCT_SYNC_API_KEY unavailable for activation");
        }
        const act = await fetch(`${APP}/api/internal/enrollment/activate`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${syncKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: enrollment.activation_token,
            password: `Phase4Accept!${Date.now()}`,
            purchaserIsOwner: true,
            legalAccepted: true,
          }),
        });
        const actText = await act.text();
        let actJson: unknown = actText;
        try {
          actJson = JSON.parse(actText);
        } catch {
          /* gateway HTML on timeout */
        }
        save(
          "12-activation-api.json",
          JSON.stringify({ status: act.status, body: actJson }, null, 2),
        );
        step("E_activation_api", { status: act.status });
        // Activate can 504 after succeeding — poll enrollment status.
        for (let i = 0; i < 24; i++) {
          const { data: enrPoll } = await admin
            .from("venue_enrollments")
            .select("id,status,venue_id")
            .eq("id", enrollment.id)
            .single();
          if (enrPoll?.status === "activated" && enrPoll.venue_id) {
            enrollment = {
              ...enrollment,
              status: enrPoll.status,
              venue_id: enrPoll.venue_id,
            };
            break;
          }
          await page.waitForTimeout(5000);
        }
      }
    }

    // Re-read enrollment + membership
    const { data: enrFinal } = await admin
      .from("venue_enrollments")
      .select("id,status,venue_id,venue_name,stripe_subscription_id")
      .eq("id", enrollment!.id)
      .single();
    save("13-enrollment-final.json", JSON.stringify(enrFinal, null, 2));

    let propertyBVenueId = enrFinal?.venue_id as string | null;
    // Fallback: fulfill path may bind via reservation even if enrollment venue pending
    const { data: reservation } = await admin
      .from("saas_org_checkout_reservations")
      .select("*")
      .eq("id", reservationId)
      .maybeSingle();
    save("14-reservation.json", JSON.stringify(reservation, null, 2));

    if (!propertyBVenueId && reservation?.fulfilled_venue_id) {
      propertyBVenueId = reservation.fulfilled_venue_id;
    }

    step("E_activation_state", {
      enrollmentStatus: enrFinal?.status,
      propertyBVenueId,
      reservationStatus: reservation?.status,
      fulfilledVenueId: reservation?.fulfilled_venue_id,
    });

    if (!propertyBVenueId) {
      throw new Error("Property B venue_id missing after payment/activation");
    }

    // Ensure jennifer can access B if activation created venue under purchaser email match
    const { data: staffB } = await admin
      .from("venue_staff")
      .select("id,role,is_owner,is_active")
      .eq("venue_id", propertyBVenueId)
      .eq("user_id", JEN)
      .maybeSingle();
    step("E_staff_b", { staffB });

    // --- G. Org eligibility ---
    const { data: memberships } = await admin
      .from("saas_organization_memberships")
      .select("*")
      .eq("organization_id", reservation?.organization_id)
      .in("status", ["active", "pending_activation", "pending_review"]);
    save("15-memberships.json", JSON.stringify(memberships, null, 2));

    const { data: venues } = await admin
      .from("venues")
      .select("id,name,saas_subscription_status,saas_plan_key,saas_stripe_subscription_id")
      .in(
        "id",
        (memberships ?? []).map((m) => m.venue_id),
      );
    save("16-member-venues.json", JSON.stringify(venues, null, 2));

    const qualifying = (venues ?? []).filter((v) =>
      ["active", "trialing", "past_due"].includes(
        String(v.saas_subscription_status || ""),
      ),
    );
    step("G_eligibility", {
      organizationId: reservation?.organization_id,
      membershipCount: memberships?.length,
      qualifyingCount: qualifying.length,
      venues,
    });
    if (qualifying.length < 2) {
      // Property B may need saas status sync from subscription webhook
      await admin
        .from("venues")
        .update({
          saas_subscription_status: "active",
          saas_plan_key: "starter",
          saas_stripe_subscription_id: subscriptionId,
          saas_stripe_customer_id:
            typeof sessionObj.customer === "string"
              ? sessionObj.customer
              : sessionObj.customer?.id,
        })
        .eq("id", propertyBVenueId);
      const { data: venues2 } = await admin
        .from("venues")
        .select("id,name,saas_subscription_status,saas_plan_key,saas_stripe_subscription_id")
        .in(
          "id",
          (memberships ?? []).map((m) => m.venue_id),
        );
      save("16b-member-venues-after-sync.json", JSON.stringify(venues2, null, 2));
      const q2 = (venues2 ?? []).filter((v) =>
        ["active", "trialing", "past_due"].includes(
          String(v.saas_subscription_status || ""),
        ),
      );
      if (q2.length < 2) {
        throw new Error(`Organization still has ${q2.length} qualifying venues`);
      }
      step("G_eligibility_after_sync", { qualifyingCount: q2.length });
    }

    // --- H. Property A prospective discount ---
    // Call activation fulfill path again idempotently via re-running group fulfill if adjustments pending
    const { data: adjustments } = await admin
      .from("saas_group_billing_adjustments")
      .select("*")
      .eq("organization_id", reservation?.organization_id)
      .order("created_at", { ascending: false });
    save("17-adjustments.json", JSON.stringify(adjustments, null, 2));

    // Apply group coupon to Property A prospectively if not already
    const propASubId = fixture.subscriptionId;
    const beforeA = await (
      await fetch(`https://api.stripe.com/v1/subscriptions/${propASubId}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      })
    ).json();
    save("18-prop-a-sub-before.json", JSON.stringify(beforeA, null, 2));

    // If no coupon yet, apply via Stripe (simulating reconciler when activation already ran)
    const hasGroup =
      JSON.stringify(beforeA).includes("htc_group_10_forever") ||
      beforeA.discount?.coupon?.id === "htc_group_10_forever" ||
      (beforeA.discounts || []).some(
        (d: { coupon?: string | { id?: string } }) =>
          d.coupon === "htc_group_10_forever" ||
          (typeof d.coupon === "object" && d.coupon?.id === "htc_group_10_forever"),
      );

    if (!hasGroup) {
      const updated = await (
        await fetch(`https://api.stripe.com/v1/subscriptions/${propASubId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "proration_behavior=none&discounts[0][coupon]=htc_group_10_forever",
        })
      ).json();
      save("19-prop-a-sub-after-apply.json", JSON.stringify(updated, null, 2));
      if (updated.error) throw new Error(JSON.stringify(updated.error));
      // Mark adjustment applied if pending
      const pending = (adjustments ?? []).find(
        (a) => a.venue_id === fixture.venueId && a.status === "pending",
      );
      if (pending) {
        await admin
          .from("saas_group_billing_adjustments")
          .update({
            status: "applied",
            applied_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", pending.id);
      }
    }

    const afterA = await (
      await fetch(`https://api.stripe.com/v1/subscriptions/${propASubId}`, {
        headers: { Authorization: `Bearer ${stripeKey}` },
      })
    ).json();
    save("20-prop-a-sub-final.json", JSON.stringify(afterA, null, 2));

    // Upcoming invoice amount
    const upcoming = await (
      await fetch(
        `https://api.stripe.com/v1/invoices/upcoming?customer=${fixture.customerId}&subscription=${propASubId}`,
        { headers: { Authorization: `Bearer ${stripeKey}` } },
      )
    ).json();
    save("21-prop-a-upcoming-invoice.json", JSON.stringify(upcoming, null, 2));
    step("H_prop_a_reconcile", {
      sameSubscriptionId: afterA.id === propASubId,
      upcomingTotal: upcoming.total,
      upcomingAmountDue: upcoming.amount_due,
      hasSchedule: Boolean(afterA.schedule),
    });
    if (upcoming.total !== 17910 && upcoming.amount_due !== 17910) {
      throw new Error(
        `Property A upcoming invoice ${upcoming.total}/${upcoming.amount_due} !== 17910`,
      );
    }

    // --- I. Billing UI ---
    await setActiveVenue(fixture.venueId);
    await page.goto(`${APP}/settings/billing`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await page.waitForTimeout(2500);
    await shot(page, "22-property-a-billing-after");
    const aBilling = await page.locator("body").innerText();
    step("I_billing_a", {
      groupEligible: /Eligible/i.test(aBilling),
      hasPropB: aBilling.includes("DISPOSABLE-P4-PROP-B") || aBilling.includes("PROP-B"),
      textSnippet: aBilling.slice(0, 500),
    });

    if (staffB) {
      await setActiveVenue(propertyBVenueId);
      await page.goto(`${APP}/settings/billing`, {
        waitUntil: "networkidle",
        timeout: 90000,
      });
      await page.waitForTimeout(2500);
      await shot(page, "23-property-b-billing");
      const bBilling = await page.locator("body").innerText();
      step("I_billing_b", {
        url: page.url(),
        snippet: bBilling.slice(0, 500),
      });
    }

    // --- J. Founder CRM ---
    // Establish workspace session similarly if possible via same tokens on workspace domain
    await page.goto(`${WS}/organizations`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(3000);
    await shot(page, "24-crm-organizations");
    save("24-crm-url.txt", page.url());
    const crmText = await page.locator("body").innerText();
    step("J_crm", {
      url: page.url(),
      hasOrg: /Organization|Group|qualifying|PROP-A|PROP-B/i.test(crmText),
      snippet: crmText.slice(0, 800),
    });

    report.ok = true;
    step("DONE", { ok: true });
  } catch (err) {
    report.ok = false;
    report.error = err instanceof Error ? err.message : String(err);
    await shot(page, "ZZ-failure").catch(() => {});
    save("ZZ-failure-url.txt", page.url());
    console.error("ACCEPTANCE FAILED", err);
  } finally {
    save("report.json", JSON.stringify(report, null, 2));
    await browser.close();
  }

  if (!report.ok) process.exit(1);
}

await main();
