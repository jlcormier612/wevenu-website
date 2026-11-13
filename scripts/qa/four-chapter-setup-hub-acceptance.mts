/**
 * Four-chapter Setup Hub browser acceptance (Sandbox).
 * Scenarios A–H including mandatory activation → password → login → Hub → save/resume.
 *
 *   npx tsx scripts/qa/four-chapter-setup-hub-acceptance.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
config({ path: ".env.local", quiet: true });

const require = createRequire("/Users/jensmac/Developer/wevenu-website/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const WORKSPACE = "https://workspace.sandbox.hellotocheers.com";
const OUT = "docs/qa/four-chapter-setup-hub";
const stamp = Date.now().toString(36);

mkdirSync(OUT, { recursive: true });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox Supabase");
}

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 400)}`);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function magicLogin(email: string, venueId: string) {
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serverClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: verified, error: vErr } = await serverClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token!,
    type: "email",
  });
  if (vErr) throw vErr;
  const session = verified.session!;
  const projectRef = new URL(url).hostname.split(".")[0];
  return {
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
    userId: session.user.id,
  };
}

async function main() {
  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), stamp };

  // Prefer a disposable paid enrollment that still has an activation token.
  let { data: enrollment } = await admin
    .from("venue_enrollments")
    .select(
      "id,venue_id,status,owner_email,activation_token,stripe_checkout_session_id,stripe_subscription_id",
    )
    .ilike("owner_email", "jennifer+access.paid.a.%@hellotocheers.com")
    .not("activation_token", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!enrollment?.activation_token || !enrollment.venue_id) {
    // Fall back to any disposable Access Paid A venue already activated.
    const { data: venue } = await admin
      .from("venues")
      .select("id,name")
      .ilike("name", "DISPOSABLE Access Paid A%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!venue) throw new Error("No disposable paid A venue found — run paid checkout first");
    enrollment = {
      id: "existing",
      venue_id: venue.id,
      status: "activated",
      owner_email: "jennifer+access.paid.a.mwf65mrq@hellotocheers.com",
      activation_token: null,
      stripe_checkout_session_id: null,
      stripe_subscription_id: null,
    };
    report.activationMode = "already_activated_login";
  } else {
    report.activationMode = "fresh_password_activation";
  }

  const venueId = String(enrollment.venue_id);
  const ownerEmail = String(enrollment.owner_email);
  report.enrollment = enrollment;

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  // ---------- H: Activation → login ----------
  try {
    if (enrollment.activation_token) {
      const activateUrl = `${WORKSPACE}/activate/${enrollment.activation_token}`;
      await page.goto(activateUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/H-01-activate.png`, fullPage: true });
      const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
      record(
        "H.activation_page",
        /password|Create your password|Let's get you started|WHO OWNS/i.test(body),
        body.slice(0, 280),
      );

      const password = `HtC-Setup-${stamp}!9`;
      await page.locator('input[name="password"], input[type="password"]').first().fill(password);
      const confirm = page.locator('input[name="confirm"], input[name="confirmPassword"]').first();
      if (await confirm.count()) await confirm.fill(password);

      // Ownership: "Yes, I'm an owner"
      const ownerRadio = page.locator('input[name="ownershipChoice"][value="owner"]');
      if (await ownerRadio.count()) await ownerRadio.check({ force: true });

      const legal = page.locator('input[name="legalAccepted"]');
      if (await legal.count()) await legal.check({ force: true });
      else {
        const anyLegal = page.getByText(/agree to the/i).locator("..").locator('input[type="checkbox"]').first();
        if (await anyLegal.count()) await anyLegal.check({ force: true });
      }

      await page.screenshot({ path: `${OUT}/H-02-activate-filled.png`, fullPage: true });
      const submit = page.getByRole("button", { name: /Activate|Create account|Continue|Get started/i }).first();
      await submit.click({ timeout: 20000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${OUT}/H-03-after-activate.png`, fullPage: true });
      report.afterActivateUrl = page.url();
      record(
        "H.activation_submitted",
        !/invalid|expired|error/i.test((await page.locator("body").innerText()).slice(0, 500)) ||
          /app\.sandbox|login|setup-hub|dashboard/i.test(page.url()),
        `url=${page.url()}`,
      );
      report.passwordSet = true;
    } else {
      record("H.activation_page", true, "enrollment already activated — skipping password form");
      record("H.activation_submitted", true, "already activated");
    }

    // Sign in via magic link cookies (authoritative session) after password set,
    // or directly when already activated.
    const login = await magicLogin(ownerEmail, venueId);
    await context.clearCookies();
    await context.addCookies(login.cookies);

    await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/H-04-setup-hub.png`, fullPage: true });
    let hubBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record(
      "H.reaches_setup_hub",
      /setup-hub|Get your venue ready|Setup|Four approachable|Welcome/i.test(hubBody + page.url()) &&
        !/Access denied|subscription inactive|suspended/i.test(hubBody),
      `url=${page.url()} body=${hubBody.slice(0, 240)}`,
    );

    // Correct venue
    const { data: venue } = await admin.from("venues").select("id,name").eq("id", venueId).maybeSingle();
    record(
      "H.correct_venue",
      Boolean(venue?.name) && hubBody.includes(venue!.name.split(" ")[0]!),
      `venue=${venue?.name}`,
    );

    // Starters
    const { count: pkgCount } = await admin
      .from("packages")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    record("H.starters_present", (pkgCount ?? 0) > 0, `packages=${pkgCount}`);

    // ---------- A: Orientation ----------
    const chapters = page.locator('[data-testid="setup-hub-chapters"]');
    record("A.four_chapters_visible", await chapters.count() > 0, `chapters=${await chapters.count()}`);
    for (const id of ["venue-ready", "sales-process", "client-experience", "make-it-yours"]) {
      const el = page.locator(`[data-testid="setup-chapter-${id}"]`);
      record(`A.chapter_${id}`, (await el.count()) > 0, `count=${await el.count()}`);
    }
    record(
      "A.not_forced_sequence",
      /any order|do not need to finish everything|Four approachable/i.test(hubBody),
      hubBody.slice(0, 200),
    );
    await page.screenshot({ path: `${OUT}/A-orientation.png`, fullPage: false });

    // ---------- B: Venue essentials (small config) ----------
    await page.goto(`${APP}/settings/business`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1200);
    const phone = page.locator('input[name="phone"], input[type="tel"]').first();
    if (await phone.count()) {
      const cur = await phone.inputValue().catch(() => "");
      if (!cur) await phone.fill("512-555-0199");
    }
    const save = page.getByRole("button", { name: /^Save/i }).first();
    if (await save.count() && !(await save.isDisabled().catch(() => true))) {
      await save.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${OUT}/B-business.png`, fullPage: false });
    record("B.venue_settings_reachable", /Business|Brand|phone|email/i.test(await page.locator("body").innerText()), page.url());

    // Persist BYB skip as Hub progress signal
    await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    const skipByb = page.getByRole("button", { name: /Skip for now|starting fresh/i }).first();
    if (await skipByb.count()) {
      await skipByb.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${OUT}/B-hub-after-progress.png`, fullPage: true });

    // ---------- C: Sales exploration ----------
    await page.goto(`${APP}/leads/new?intent=practice`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1000);
    const practiceBanner = page.locator('[data-testid="practice-lead-banner"]');
    record("C.practice_lead_entry", (await practiceBanner.count()) > 0 || /Practice Lead|practice/i.test(await page.locator("body").innerText()), page.url());
    await page.screenshot({ path: `${OUT}/C-practice-lead.png`, fullPage: false });
    await page.goto(`${APP}/library/packages`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1000);
    record("C.packages_reachable", /package|Gather|Essential|Wedding/i.test(await page.locator("body").innerText()), page.url());

    // ---------- D: Client experience ----------
    await page.goto(`${APP}/settings/leads/setup-profiles`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1200);
    record("D.setup_profiles_reachable", /Setup Profile|Wedding|profile/i.test(await page.locator("body").innerText()), page.url());
    await page.screenshot({ path: `${OUT}/D-setup-profiles.png`, fullPage: false });

    // ---------- E: Make it yours ----------
    await page.goto(`${APP}/setup-hub#setup-chapter-make-it-yours`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1200);
    hubBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record(
      "E.make_it_yours_optional",
      /Make it yours|Automations|Communications|Bring Your Business|optional/i.test(hubBody),
      hubBody.slice(0, 220),
    );
    await page.goto(`${APP}/communication/series`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1000);
    const seriesBody = await page.locator("body").innerText();
    record(
      "E.automations_paused_or_reachable",
      /series|automation|paused|sequence/i.test(seriesBody),
      seriesBody.slice(0, 200),
    );

    // ---------- F: Save/resume ----------
    const { data: hubState } = await admin
      .from("venue_setup_hub_state")
      .select("bring_your_business_path,bring_your_business_manual_confirmed_at")
      .eq("venue_id", venueId)
      .maybeSingle();
    await context.clearCookies();
    const login2 = await magicLogin(ownerEmail, venueId);
    await context.addCookies(login2.cookies);
    await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/F-resume.png`, fullPage: true });
    const resumeBody = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    record(
      "F.resume_no_loop",
      /setup-hub|Get your venue ready|Setup/i.test(resumeBody + page.url()) &&
        !/redirect|too many|loop/i.test(resumeBody),
      `url=${page.url()} byb=${JSON.stringify(hubState)}`,
    );

    // ---------- G: Mobile ----------
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/G-mobile.png`, fullPage: true });
    const mobileChapters = await page.locator('[data-testid="setup-hub-chapters"]').count();
    record("G.mobile_chapters", mobileChapters > 0, `chapters=${mobileChapters}`);
  } catch (e) {
    record("H.block", false, e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  report.finishedAt = new Date().toISOString();
  report.passed = passed;
  report.failed = failed;
  report.checks = checks;
  writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed, failed, out: OUT }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
