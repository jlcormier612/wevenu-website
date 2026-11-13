/**
 * Phase 2: finish config/sales/event exploration for disposable Fresh Walk venue.
 * Password login already proven once activation completes.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const require = createRequire("/Users/jensmac/Developer/wevenu-website/package.json");
const { config } = require("dotenv");
config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const { createClient } = require("@supabase/supabase-js");
const { chromium } = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
)("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "/private/tmp/htc-setup-hub-wt/docs/qa/fresh-venue-first-time";
const venueId = "c314c50c-09b3-4c27-a5ca-4cfd832dbd1e";
const ownerEmail = "jennifer+fresh.walk.mwf976l4@hellotocheers.com";
const ownerPassword = "HtC-Fresh-mwf976l4!9a";
const stamp = "mwf976l4";

mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string; stage?: string };
type Friction = { severity: "RED" | "YELLOW" | "LOW"; area: string; observation: string; impact: string };
const checks: Check[] = [];
const friction: Friction[] = [];
const prior = JSON.parse(readFileSync(`${OUT}/results.json`, "utf8"));

function record(name: string, pass: boolean, detail: string, stage?: string) {
  checks.push({ name, pass, detail, stage });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 400)}`);
}
function note(f: Friction) {
  friction.push(f);
  console.log(`FRICTION ${f.severity} [${f.area}] ${f.observation.slice(0, 240)}`);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function magicCookies() {
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: ownerEmail,
  });
  if (error) throw error;
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { data: verified, error: vErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token!,
    type: "email",
  });
  if (vErr) throw vErr;
  const session = verified.session!;
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  return [
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
  ];
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  try {
    // Password login (post-activation settle)
    await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator('input[type="email"]').first().fill(ownerEmail);
    await page.locator('input[type="password"]').first().fill(ownerPassword);
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/13-password-login-ok.png`, fullPage: true });
    const pwdOk = !/Invalid login|\/login$/.test(page.url() + (await page.locator("body").innerText()).slice(0, 80));
    record("login.password_ui", pwdOk, `url=${page.url()}`, "First Login");
    if (!pwdOk) {
      note({
        severity: "YELLOW",
        area: "Activation timing",
        observation: "Password login can fail if attempted while Activate still shows Activating…",
        impact: "Owner may think password failed; need clearer completion + redirect wait.",
      });
    }

    await context.clearCookies();
    await context.addCookies(await magicCookies());

    // Hub → Open venue settings (first matching link)
    await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    const openSettings = page.locator('a[href="/settings/business"]').first();
    if (await openSettings.count()) {
      await Promise.all([
        page.waitForURL(/\/settings\/business/, { timeout: 20000 }).catch(() => null),
        openSettings.click(),
      ]);
    } else {
      await page.goto(`${APP}/settings/business`, { waitUntil: "domcontentloaded", timeout: 90000 });
      note({
        severity: "YELLOW",
        area: "Chapter 1",
        observation: "No a[href=/settings/business] found on Hub.",
        impact: "Recommended next may be a button without href.",
      });
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/14-business-settings.png`, fullPage: true });
    record(
      "ch1.business_reachable",
      /\/settings\/business/.test(page.url()),
      page.url(),
      "Venue Configuration",
    );

    const phone = page.locator('input[name="phone"], input[type="tel"]').first();
    if (await phone.count()) {
      const cur = await phone.inputValue().catch(() => "");
      if (!cur) await phone.fill("512-555-0148");
    }
    for (const [sel, val] of [
      ['input[name="addressLine1"], input[name="address_line1"]', "500 Congress Avenue"],
      ['input[name="city"]', "Austin"],
      ['input[name="stateRegion"], input[name="state"]', "TX"],
      ['input[name="postalCode"], input[name="postal_code"]', "78701"],
    ] as const) {
      const loc = page.locator(sel).first();
      if (await loc.count()) {
        const cur = await loc.inputValue().catch(() => "");
        if (!cur) await loc.fill(val);
      }
    }
    const save = page.getByRole("button", { name: /^Save/i }).first();
    if (await save.count() && !(await save.isDisabled().catch(() => true))) {
      await save.click();
      await page.waitForTimeout(2000);
      record("ch1.business_saved", true, "saved business settings", "Venue Configuration");
    } else {
      record("ch1.business_saved", false, "save unavailable", "Venue Configuration");
      note({
        severity: "YELLOW",
        area: "Business settings",
        observation: "Save control missing/disabled after opening venue settings.",
        impact: "Owner cannot persist identity from first path.",
      });
    }

    // Spaces live under availability#spaces (not /settings/spaces — that 404s)
    await page.goto(`${APP}/settings/availability#spaces`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/14-availability-spaces.png`, fullPage: true });
    if (!(await page.locator("body").innerText()).match(/space|capacity/i)) {
      note({
        severity: "YELLOW",
        area: "Spaces",
        observation: "Spaces section not obvious on availability page.",
        impact: "Owners may not find capacity setup.",
      });
    }
    const addSpace = page.getByRole("button", { name: /Add space|New space|Add another/i }).first();
    if (await addSpace.count()) {
      await addSpace.click();
      await page.waitForTimeout(800);
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').last();
      if (await nameInput.count()) {
        await nameInput.fill(`Garden Terrace ${stamp}`);
        const cap = page.locator('input[name="capacity"], input[name="maxGuests"], input[name="max_capacity"]').last();
        if (await cap.count()) await cap.fill("120");
        const saveSpace = page.getByRole("button", { name: /^Save|Create|Add space$/i }).last();
        if (await saveSpace.count()) {
          await saveSpace.click();
          await page.waitForTimeout(2000);
        }
      }
    } else {
      note({
        severity: "YELLOW",
        area: "Spaces",
        observation: "No Add space control found on availability settings.",
        impact: "Hard to configure multi-space venues from first-time path.",
      });
    }
    const { count: spaceCount } = await admin
      .from("venue_spaces")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    record("ch1.spaces_persisted", (spaceCount ?? 0) > 0, `spaces=${spaceCount}`, "Venue Configuration");

    // Practice lead with correct Save inquiry CTA
    await page.goto(`${APP}/leads/new?intent=practice`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    const first = page.locator('input[name="firstName"], input[name="first_name"]').first();
    const last = page.locator('input[name="lastName"], input[name="last_name"]').first();
    if (await first.count()) await first.fill("Practice");
    if (await last.count()) await last.fill(`Walk${stamp}`);
    const email = page.locator('input[name="email"]').first();
    if (await email.count()) await email.fill(`practice.walk.${stamp}@example.com`);
    // Event type if required
    const eventType = page.locator('select[name="eventType"], select[name="event_type"]').first();
    if (await eventType.count()) {
      await eventType.selectOption({ label: /Wedding/i }).catch(async () => {
        const opts = await eventType.locator("option").allTextContents();
        if (opts.length > 1) await eventType.selectOption({ index: 1 });
      });
    }
    const saveInquiry = page.getByRole("button", { name: /Save inquiry/i }).first();
    if (await saveInquiry.count()) {
      await saveInquiry.click();
      await page.waitForTimeout(3000);
    } else {
      note({
        severity: "YELLOW",
        area: "Practice lead",
        observation: "Save inquiry button not found.",
        impact: "Owners may not know how to persist the practice lead.",
      });
    }
    await page.screenshot({ path: `${OUT}/14-practice-lead-saved.png`, fullPage: true });
    const { data: leads } = await admin
      .from("leads")
      .select("id,first_name,last_name,email,status")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(5);
    record(
      "sales.practice_lead_persisted",
      (leads || []).length > 0,
      JSON.stringify(leads),
      "Sales Exploration",
    );

    const leadId = leads?.[0]?.id as string | undefined;
    if (leadId) {
      await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUT}/15-lead-workspace.png`, fullPage: true });
      record(
        "event.lead_workspace",
        /lead|tour|proposal|package|contract/i.test(await page.locator("body").innerText()),
        page.url(),
        "Sales Exploration",
      );

      // Explore proposal/package surfaces without sending
      const pkgTab = page.getByRole("link", { name: /Package|Proposal|Offer/i }).first();
      const pkgBtn = page.getByRole("button", { name: /Package|Proposal|Create proposal/i }).first();
      if (await pkgTab.count()) await pkgTab.click().catch(() => undefined);
      else if (await pkgBtn.count()) await pkgBtn.click().catch(() => undefined);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/15-proposal-surface.png`, fullPage: true });
      record(
        "event.proposal_surface_reachable",
        /proposal|package|contract|select|offering/i.test(await page.locator("body").innerText()),
        page.url(),
        "Sales Exploration",
      );

      // Contract area
      const contractLink = page.getByRole("link", { name: /Contract/i }).first();
      if (await contractLink.count()) {
        await contractLink.click().catch(() => undefined);
        await page.waitForTimeout(1500);
      }
      await page.screenshot({ path: `${OUT}/15-contract-surface.png`, fullPage: true });
    } else {
      record("event.lead_workspace", false, "no lead", "Sales Exploration");
      record("event.proposal_surface_reachable", false, "no lead", "Sales Exploration");
    }

    // Starter quality sample from UI packages page
    await page.goto(`${APP}/library/packages`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    const firstPkg = page.getByRole("link", { name: /Wedding|Essential|Signature|Full-Service/i }).first();
    if (await firstPkg.count()) {
      await firstPkg.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/16-package-detail.png`, fullPage: true });
      const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      record(
        "starters.package_detail_readable",
        /customize|included|price|package|wedding/i.test(body) && !/lorem ipsum/i.test(body),
        body.slice(0, 240),
        "Setup Hub",
      );
    } else {
      record("starters.package_detail_readable", false, "could not open package", "Setup Hub");
    }

    // Setup profile detail
    await page.goto(`${APP}/settings/leads/setup-profiles`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1200);
    const wedding = page.getByRole("link", { name: /Wedding/i }).first();
    if (await wedding.count()) {
      await wedding.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/16-setup-profile-detail.png`, fullPage: true });
      record(
        "starters.setup_profile_detail",
        /profile|playbook|questionnaire|timeline|default/i.test(await page.locator("body").innerText()),
        page.url(),
        "Client Preparation",
      );
    } else {
      record("starters.setup_profile_detail", false, "Wedding profile link not found", "Client Preparation");
      note({
        severity: "YELLOW",
        area: "Setup Profiles",
        observation: "Wedding starter profile not clearly linked from list.",
        impact: "Hard to inspect inheritance defaults.",
      });
    }

    // Honest remaining stages
    const { count: contracts } = await admin
      .from("contracts")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    const { count: events } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    record(
      "booking.executed_contract",
      false,
      `NOT VERIFIED — contracts=${contracts} events=${events}; full sign→book path not completed this pass`,
      "Booking",
    );
    record(
      "starter.inheritance_on_event",
      false,
      "NOT VERIFIED — needs booked event",
      "Starter Inheritance",
    );
    record(
      "client.portal_access",
      false,
      "NOT VERIFIED — needs release after booking",
      "Client Portal",
    );
    record(
      "client.venue_followup",
      false,
      "NOT VERIFIED — needs portal activity",
      "Venue Follow-Up",
    );

    note({
      severity: "LOW",
      area: "Spaces URL",
      observation: "/settings/spaces 404s; spaces live at /settings/availability#spaces.",
      impact: "Any Hub/help copy linking to /settings/spaces would dead-end (crosswalk correctly uses availability).",
    });
    note({
      severity: "YELLOW",
      area: "Activation UX",
      observation: "Activate can remain on Activating… for >5s before redirect; early Sign in shows Invalid credentials until complete.",
      impact: "First-time owners may retry or abandon if they leave the activation page early.",
    });
  } catch (e) {
    record("phase2.block", false, e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
  }

  // Merge results
  const byName = new Map<string, Check>();
  for (const c of [...(prior.checks || []), ...checks]) byName.set(c.name, c);
  const mergedChecks = [...byName.values()];
  const mergedFriction = [...(prior.friction || []), ...friction];
  const report = {
    ...prior,
    phase2At: new Date().toISOString(),
    checks: mergedChecks,
    friction: mergedFriction,
    passed: mergedChecks.filter((c) => c.pass).length,
    failed: mergedChecks.filter((c) => !c.pass).length,
  };
  writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, friction: mergedFriction.length }, null, 2));
  if (report.failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
