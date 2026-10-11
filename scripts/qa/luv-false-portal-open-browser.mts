/**
 * Sandbox: disposable venue with zero leads/clients/invites must not see
 * "You've sent the invite" / first-couple portal-open Luv card.
 * Never logs secrets.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/luv-false-portal-open";
const EXPECT_SHA = (process.env.EXPECT_SHA || "").slice(0, 8);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}
mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 400)}`);
}

async function passWelcome(page: {
  url: () => string;
  locator: (s: string) => {
    count: () => Promise<number>;
    check: (o?: { force?: boolean }) => Promise<void>;
    first: () => { count: () => Promise<number>; check: (o?: { force?: boolean }) => Promise<void> };
    isVisible: () => Promise<boolean>;
  };
  getByRole: (r: string, o?: { name?: RegExp }) => {
    count: () => Promise<number>;
    click: () => Promise<void>;
  };
  waitForTimeout: (n: number) => Promise<void>;
}) {
  for (let a = 0; a < 3; a++) {
    const onWelcome = page.url().includes("/welcome");
    const visible = await page
      .locator('[data-welcome-experience="true"]')
      .isVisible()
      .catch(() => false);
    if (!onWelcome && !visible) return;
    const agree = page.locator("#welcome-experience-agree");
    if ((await agree.count()) > 0) await agree.check({ force: true });
    else {
      const fb = page.locator("input[type='checkbox']").first();
      if ((await fb.count()) > 0) await fb.check({ force: true });
    }
    const cont = page.getByRole("button", { name: /^Continue$/i });
    if ((await cont.count()) > 0) await cont.click();
    for (let i = 0; i < 25; i++) {
      if (!page.url().includes("/welcome")) break;
      await page.waitForTimeout(400);
    }
  }
}

async function main() {
  const stamp = Date.now();
  const email = `jennifer+luvportal.${stamp}@hellotocheers.com`;
  const password = `Lp-${stamp}-Aa1x`;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (cErr || !created.user) throw cErr ?? new Error("createUser");
  const userId = created.user.id;
  let venueId = "";

  try {
    const { data: venue, error: vErr } = await admin
      .from("venues")
      .insert({
        owner_user_id: userId,
        name: `Luv Portal Empty ${stamp}`,
        email: `v.${email}`,
      })
      .select("id,name")
      .single();
    if (vErr || !venue) throw vErr ?? new Error("venue");
    venueId = venue.id;

    await admin.from("venue_staff").insert({
      venue_id: venueId,
      user_id: userId,
      full_name: "Luv Portal Empty",
      email,
      role: "owner",
      is_owner: true,
      is_active: true,
      accepted_at: new Date().toISOString(),
      access_title: "administrator",
      title_basis: "administrator",
      capability_overrides: {},
      owner_invite_pending: false,
    });
    await admin.from("venue_staff_active_context").upsert({
      user_id: userId,
      active_venue_id: venueId,
      updated_at: new Date().toISOString(),
    });
    await admin.from("venue_onboarding_intake").upsert(
      {
        venue_id: venueId,
        path: "self_setup",
        venue_name: venue.name,
        space_mode: "one",
        spaces: [{ name: "Main Space", maxCapacity: null }],
        offers_tours: false,
        inquiry_sources: [],
        bring_business_choice: "starting_fresh",
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "venue_id" },
    );

    // Prove empty population
    const [{ count: leadCount }, { count: clientCount }, { count: inviteCount }] =
      await Promise.all([
        admin.from("leads").select("id", { count: "exact", head: true }).eq("venue_id", venueId),
        admin.from("clients").select("id", { count: "exact", head: true }).eq("venue_id", venueId),
        admin
          .from("client_invitations")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", venueId),
      ]);
    record(
      "fixture_empty",
      (leadCount ?? 0) === 0 && (clientCount ?? 0) === 0 && (inviteCount ?? 0) === 0,
      `leads=${leadCount} clients=${clientCount} invites=${inviteCount}`,
    );

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const dpl =
        (await page.content()).match(/data-dpl-id="([a-f0-9]+)"/)?.[1] || "";
      if (EXPECT_SHA) {
        record("runtime_dpl", dpl.startsWith(EXPECT_SHA), `dpl=${dpl}`);
      } else {
        record("runtime_dpl", Boolean(dpl), `dpl=${dpl || "missing"}`);
      }

      await page.fill("#email", email);
      await page.fill("#password", password);
      await page.click('button[type="submit"]');
      for (let i = 0; i < 40; i++) {
        if (!page.url().includes("/login")) break;
        await page.waitForTimeout(400);
      }
      await passWelcome(page);
      await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500);
      await passWelcome(page);

      const body = await page.locator("body").innerText();
      record(
        "no_false_portal_open_card",
        !/hasn't opened their portal/i.test(body) && !/You've sent the invite/i.test(body),
        body.includes("hasn't opened") ? "card present" : "absent",
      );
      await page.screenshot({ path: `${OUT}/dashboard.png`, fullPage: false });

      await page.goto(`${APP}/clients`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1500);
      const clientsText = await page.locator("body").innerText();
      record(
        "clients_empty",
        /no clients|get started|nothing here|0 clients|empty/i.test(clientsText) ||
          !/hasn't opened their portal/i.test(clientsText),
        clientsText.slice(0, 120).replace(/\s+/g, " "),
      );

      await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1500);
      const leadsText = await page.locator("body").innerText();
      record(
        "leads_empty_ok",
        !/You've sent the invite/i.test(leadsText),
        "no false invite claim on leads",
      );

      await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2000);
      const body2 = await page.locator("body").innerText();
      record(
        "dashboard_still_clean_after_nav",
        !/hasn't opened their portal/i.test(body2) && !/You've sent the invite/i.test(body2),
        "after clients/leads round-trip",
      );

      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2000);
      const body3 = await page.locator("body").innerText();
      record(
        "dashboard_still_clean_after_refresh",
        !/hasn't opened their portal/i.test(body3) && !/You've sent the invite/i.test(body3),
        "after reload",
      );
    } finally {
      await browser.close();
    }
  } finally {
    if (venueId) {
      await admin.from("venue_onboarding_intake").delete().eq("venue_id", venueId);
      await admin.from("venue_activation_state").delete().eq("venue_id", venueId);
      await admin.from("venue_activation_scores").delete().eq("venue_id", venueId);
      await admin.from("venue_staff").delete().eq("venue_id", venueId);
      await admin.from("venues").delete().eq("id", venueId);
    }
    await admin.from("venue_staff_active_context").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }

  const required = [
    "fixture_empty",
    "runtime_dpl",
    "no_false_portal_open_card",
    "dashboard_still_clean_after_nav",
    "dashboard_still_clean_after_refresh",
  ];
  const report = {
    observedAt: new Date().toISOString(),
    expectSha: EXPECT_SHA || null,
    checks,
    hardFail: checks.filter((c) => required.includes(c.name) && !c.pass).map((c) => c.name),
    ok: required.every((n) => checks.find((c) => c.name === n)?.pass),
  };
  writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2));
  console.log(report.ok ? "GREEN luv false portal-open" : "NOT GREEN luv false portal-open");
  console.log(JSON.stringify({ ok: report.ok, hardFail: report.hardFail }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
