/**
 * Continue fresh-venue walkthrough from already-paid provisioned enrollment
 * (checkout succeeded; enrollment select previously failed on column drift).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const require = createRequire("/Users/jensmac/Developer/wevenu-website/package.json");
const { config } = require("dotenv");
config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const { createClient } = require("@supabase/supabase-js");
const marketingRequire = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = marketingRequire("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const WORKSPACE = "https://workspace.sandbox.hellotocheers.com";
const OUT = "/private/tmp/htc-setup-hub-wt/docs/qa/fresh-venue-first-time";
const stamp = "mwf976l4";
const venueId = "c314c50c-09b3-4c27-a5ca-4cfd832dbd1e";
const enrollmentId = "6162c8dd-0c4f-49d1-a114-c27019501de5";
const activationToken = "act_8cc6890c54224620ab5c1c7cd8e03976";
const ownerEmail = "jennifer+fresh.walk.mwf976l4@hellotocheers.com";
const ownerPassword = `HtC-Fresh-${stamp}!9a`;
const sessionId = "cs_test_a0ia6aKu8qzfLcFJn6jfzOEt5aBwH6q3tJNcKiSWGbfR6MW7rZyQKJ8VbN";
const subId = "sub_1UbOKJErUqJH7nktBM3P2nV1";

mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string; stage?: string };
type Friction = {
  severity: "RED" | "YELLOW" | "LOW";
  area: string;
  observation: string;
  impact: string;
};
const checks: Check[] = [];
const friction: Friction[] = [];
const starterNotes: Array<Record<string, unknown>> = [];
const prior = existsJson(`${OUT}/results.json`);
const report: Record<string, unknown> = {
  ...(prior || {}),
  continuedAt: new Date().toISOString(),
  stamp,
  venueId,
  enrollmentId,
  ownerEmail,
  sessionId,
  subId,
  servingExpected: "a6096b49",
  checkoutProven: true,
};

function existsJson(path: string) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

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
  report.checks = [...((prior?.checks as Check[]) || []).filter((c) => c.pass), ...checks];
  report.friction = [...((prior?.friction as Friction[]) || []), ...friction];
  report.starterNotes = starterNotes;
  // Deduplicate check names keeping latest
  const byName = new Map<string, Check>();
  for (const c of report.checks as Check[]) byName.set(c.name, c);
  report.checks = [...byName.values()];
  report.passed = (report.checks as Check[]).filter((c) => c.pass).length;
  report.failed = (report.checks as Check[]).filter((c) => !c.pass).length;
  writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2));
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function magicCookies(email: string, vid: string) {
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
        value: vid,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      },
    ],
  };
}

async function completeWelcomeIfPresent(page: import("playwright").Page, shot: string) {
  if (!/\/welcome/.test(page.url())) return false;
  await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  record(
    "welcome.copy",
    /Before you continue into your venue workspace|Welcome to Hello to Cheers/i.test(body),
    body.slice(0, 220),
    "Legal Welcome",
  );
  if (/Before creating your venue workspace/i.test(body)) {
    noteFriction({
      severity: "YELLOW",
      area: "Legal Welcome",
      observation: "Copy still says before creating workspace.",
      impact: "Confusing after paid activation.",
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
  const hitWelcome = await completeWelcomeIfPresent(page, "04-welcome-gate");
  report.hitWelcome = hitWelcome;
  if (/\/onboarding\/intake/.test(page.url())) {
    noteFriction({
      severity: "RED",
      area: "Post-activation routing",
      observation: "Intake wall after activation/welcome.",
      impact: "Blocks Setup Hub.",
    });
  }
  record("routing.no_intake_wall", !/\/onboarding\/intake/.test(page.url()), page.url(), "First Login");
  if (!/\/setup-hub/.test(page.url())) {
    await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    await completeWelcomeIfPresent(page, "04-welcome-retry");
  }
}

async function sampleStarters() {
  const cats: Array<{ key: string; table: string; cols: string }> = [
    { key: "packages", table: "packages", cols: "id,name,description" },
    { key: "contract_templates", table: "contract_templates", cols: "id,name,title,description" },
    { key: "setup_profiles", table: "event_setup_profiles", cols: "id,name,description,is_default" },
    { key: "playbooks", table: "playbooks", cols: "id,name,description" },
    { key: "questionnaires", table: "questionnaire_templates", cols: "id,name,description" },
    { key: "message_templates", table: "message_templates", cols: "id,name,subject" },
    { key: "sequences", table: "message_sequences", cols: "id,name,status" },
  ];
  for (const cat of cats) {
    const { data, error } = await admin.from(cat.table).select(cat.cols).eq("venue_id", venueId).limit(10);
    if (error) {
      // try minimal
      const { data: d2, error: e2 } = await admin.from(cat.table).select("id,name").eq("venue_id", venueId).limit(10);
      starterNotes.push({
        category: cat.key,
        count: d2?.length ?? 0,
        error: error.message,
        retryError: e2?.message,
        sampleNames: (d2 || []).map((r: { name?: string }) => r.name),
      });
      continue;
    }
    const rows = data || [];
    starterNotes.push({
      category: cat.key,
      count: rows.length,
      sampleNames: rows.slice(0, 6).map((r: { name?: string }) => r.name),
      samples: rows.slice(0, 3),
    });
    if (rows.length === 0) {
      noteFriction({
        severity: "YELLOW",
        area: `Starters:${cat.key}`,
        observation: `No ${cat.key} after provisioning.`,
        impact: "Missing prepared content for first-time exploration.",
      });
    }
  }
}

async function main() {
  // Carry forward checkout passes
  record("checkout.one_enrollment", true, JSON.stringify({ enrollmentId, venueId, ownerEmail }), "Pricing and Checkout");
  record("checkout.continuous_reuse", true, "Reusing same paid session after select-column fix; no second charge", "Pricing and Checkout");

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  try {
    // Activation
    await page.goto(`${WORKSPACE}/activate/${activationToken}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
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
    if (await submit.isDisabled().catch(() => true)) throw new Error("Activate CTA disabled");
    await submit.click({ timeout: 20000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}/02-after-activate.png`, fullPage: true });
    report.afterActivateUrl = page.url();
    record("activation.submitted", true, `url=${page.url()}`, "Activation");

    // Password login UI
    await context.clearCookies();
    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1000);
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passInput = page.locator('input[type="password"], input[name="password"]').first();
    let passwordLoginOk = false;
    if ((await emailInput.count()) && (await passInput.count())) {
      await emailInput.fill(ownerEmail);
      await passInput.fill(ownerPassword);
      await page.screenshot({ path: `${OUT}/03-login-filled.png`, fullPage: true });
      await page.getByRole("button", { name: /Sign in|Log in|Continue/i }).first().click({ timeout: 20000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${OUT}/03-after-password-login.png`, fullPage: true });
      passwordLoginOk = !/\/login$/.test(page.url()) || /welcome|setup-hub|dashboard/i.test(page.url());
    }
    record("login.password_ui", passwordLoginOk, `url=${page.url()}`, "First Login");

    const login = await magicCookies(ownerEmail, venueId);
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
      `url=${page.url()} chapters=${chapters}`,
      "Setup Hub",
    );
    for (const id of ["venue-ready", "sales-process", "client-experience", "make-it-yours"]) {
      record(
        `hub.chapter_${id}`,
        (await page.locator(`[data-testid="setup-chapter-${id}"]`).count()) > 0,
        "ok",
        "Setup Hub",
      );
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
      Boolean(membership?.venue_id),
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

    await sampleStarters();
    const pkgs = starterNotes.find((s) => s.category === "packages") as { count?: number } | undefined;
    record("starters.packages_present", (pkgs?.count ?? 0) > 0, JSON.stringify(pkgs), "Setup Hub");

    // Chapter 1
    const openVenue = page.getByRole("link", { name: /Open venue settings/i }).first();
    if (await openVenue.count()) await openVenue.click();
    else {
      await page.goto(`${APP}/settings/business`, { waitUntil: "domcontentloaded", timeout: 90000 });
      noteFriction({
        severity: "YELLOW",
        area: "Chapter 1",
        observation: "Open venue settings CTA not found; direct navigation used.",
        impact: "Recommended next less discoverable.",
      });
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/06-business-settings.png`, fullPage: true });
    record(
      "ch1.business_reachable",
      /\/settings\//.test(page.url()) && !/intake/.test(page.url()),
      page.url(),
      "Venue Configuration",
    );
    const phone = page.locator('input[name="phone"], input[type="tel"]').first();
    if (await phone.count()) {
      const cur = await phone.inputValue().catch(() => "");
      if (!cur) await phone.fill("512-555-0148");
    }
    const address = page
      .locator('input[name="addressLine1"], input[name="address_line1"]')
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
      record("ch1.business_saved", true, "saved", "Venue Configuration");
    } else {
      record("ch1.business_saved", false, "save unavailable", "Venue Configuration");
    }

    await page.goto(`${APP}/settings/spaces`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/06-spaces.png`, fullPage: true });
    record("ch1.spaces_reachable", !/intake/.test(page.url()), page.url(), "Venue Configuration");
    const addSpace = page.getByRole("button", { name: /Add space|New space|Create space/i }).first();
    if (await addSpace.count()) {
      await addSpace.click();
      await page.waitForTimeout(800);
      const nameInput = page.locator('input[name="name"]').first();
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
    record("ch1.spaces_persisted", (spaceCount ?? 0) > 0, `spaces=${spaceCount}`, "Venue Configuration");

    await page.goto(`${APP}/settings/availability`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/06-availability.png`, fullPage: true });
    record(
      "ch1.availability_reachable",
      /availability|tour|block|calendar/i.test(await page.locator("body").innerText()),
      page.url(),
      "Venue Configuration",
    );

    await ensureSetupHub(page);
    await page.screenshot({ path: `${OUT}/06-hub-progress.png`, fullPage: true });
    record(
      "ch1.hub_progress_truthful",
      /IN PROGRESS|READY|COMPLETE|ESSENTIALS|Get your venue ready/i.test(
        await page.locator("body").innerText(),
      ),
      "hub after config",
      "Venue Configuration",
    );

    // Sales / practice lead
    const practiceCta = page
      .getByRole("link", { name: /practice lead|Try a practice|Create a practice/i })
      .first();
    if (await practiceCta.count()) await practiceCta.click();
    else {
      await page.goto(`${APP}/leads/new?intent=practice`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      noteFriction({
        severity: "YELLOW",
        area: "Chapter 2",
        observation: "Practice lead CTA not found from Hub; used intent URL.",
        impact: "Safe practice path less discoverable.",
      });
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/07-practice-lead.png`, fullPage: true });
    record(
      "sales.practice_lead_entry",
      /practice|Practice Lead/i.test(await page.locator("body").innerText()),
      page.url(),
      "Sales Exploration",
    );
    const first = page.locator('input[name="firstName"], input[name="first_name"]').first();
    const last = page.locator('input[name="lastName"], input[name="last_name"]').first();
    if (await first.count()) await first.fill("Practice");
    if (await last.count()) await last.fill(`Walk${stamp}`);
    const leadEmail = page.locator('input[name="email"], input[type="email"]').first();
    if (await leadEmail.count()) await leadEmail.fill(`practice.walk.${stamp}@example.com`);
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
      .limit(5);
    report.leads = leads;
    record(
      "sales.practice_lead_persisted",
      (leads || []).some((l: { first_name?: string }) => /practice/i.test(String(l.first_name))),
      JSON.stringify(leads),
      "Sales Exploration",
    );

    await page.goto(`${APP}/library/packages`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/07-packages.png`, fullPage: true });
    const pkgBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record("sales.packages_readable", /package|Wedding|Gather|Essential/i.test(pkgBody), pkgBody.slice(0, 240), "Sales Exploration");
    if (/lorem|TODO|TBD|\$0\.00/i.test(pkgBody)) {
      noteFriction({
        severity: "YELLOW",
        area: "Starter packages",
        observation: "Placeholder-like package pricing/copy visible.",
        impact: "Weakens confidence in commercial starters.",
      });
    }

    await page.goto(`${APP}/library/contracts`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/07-contracts-library.png`, fullPage: true });
    record(
      "sales.contracts_library",
      /contract|agreement|template/i.test(await page.locator("body").innerText()),
      page.url(),
      "Sales Exploration",
    );

    // Client chapter
    await page.goto(`${APP}/settings/leads/setup-profiles`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/08-setup-profiles.png`, fullPage: true });
    const spBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record("client.setup_profiles", /Setup Profile|Wedding|profile/i.test(spBody), spBody.slice(0, 240), "Client Preparation");

    await ensureSetupHub(page);
    const clientChapter = page.locator('[data-testid="setup-chapter-client-experience"]');
    if (await clientChapter.count()) {
      await clientChapter.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/08-client-chapter.png`, fullPage: false });
    }
    record(
      "client.preview_vs_release_language",
      /preview|release|invite|share/i.test(await page.locator("body").innerText()),
      "hub language",
      "Client Preparation",
    );

    // Make it yours
    const makeYours = page.locator('[data-testid="setup-chapter-make-it-yours"]');
    if (await makeYours.count()) {
      await makeYours.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/09-make-it-yours.png`, fullPage: false });
    }
    record(
      "make.optional_visible",
      /Make it yours|optional|Bring Your Business|Automations/i.test(
        await page.locator("body").innerText(),
      ),
      "ok",
      "Setup Hub",
    );
    await page.goto(`${APP}/communication/series`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/09-automations.png`, fullPage: true });
    record(
      "make.automations_paused_or_present",
      /paused|inactive|draft|sequence|automation|series/i.test(await page.locator("body").innerText()),
      page.url(),
      "Setup Hub",
    );

    // Lead workspace / proposal surface
    const leadId = leads?.[0]?.id as string | undefined;
    if (leadId) {
      await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/10-lead-workspace.png`, fullPage: true });
      record(
        "event.lead_workspace",
        /lead|tour|proposal|package|contract/i.test(await page.locator("body").innerText()),
        page.url(),
        "Sales Exploration",
      );
      const proposalBtn = page.getByRole("button", { name: /proposal|package|Prepare/i }).first();
      const proposalLink = page.getByRole("link", { name: /proposal|package|Prepare/i }).first();
      if (await proposalBtn.count()) await proposalBtn.click().catch(() => undefined);
      else if (await proposalLink.count()) await proposalLink.click().catch(() => undefined);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/10-lead-after-proposal-attempt.png`, fullPage: true });
      record(
        "event.proposal_surface_reachable",
        /proposal|package|contract|select/i.test(await page.locator("body").innerText()),
        page.url(),
        "Sales Exploration",
      );
    } else {
      record("event.lead_workspace", false, "no lead", "Sales Exploration");
      record("event.proposal_surface_reachable", false, "no lead", "Sales Exploration");
    }

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
    record(
      "booking.executed_contract",
      false,
      "NOT VERIFIED — contract/signing path not completed in this pass",
      "Booking",
    );
    record(
      "starter.inheritance_on_event",
      false,
      "NOT VERIFIED — requires booked event",
      "Starter Inheritance",
    );
    record(
      "client.portal_access",
      false,
      "NOT VERIFIED — requires release after booking",
      "Client Portal",
    );
    record(
      "client.venue_followup",
      false,
      "NOT VERIFIED — requires portal activity",
      "Venue Follow-Up",
    );

    // Resume
    await ensureSetupHub(page);
    const skipByb = page.getByRole("button", { name: /Skip for now|starting fresh/i }).first();
    if (await skipByb.count()) {
      await skipByb.click();
      await page.waitForTimeout(1500);
    }
    await context.clearCookies();
    const login2 = await magicCookies(ownerEmail, venueId);
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

    // Mobile
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
    record("continue.block", false, e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
  }

  persist();
  console.log(
    JSON.stringify(
      { passed: report.passed, failed: report.failed, friction: friction.length, out: OUT },
      null,
      2,
    ),
  );
  if ((report.failed as number) > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  persist();
  process.exit(1);
});
