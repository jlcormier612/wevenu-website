/**
 * Reproduce / verify venue-switch white-screen on Sandbox.
 * Disposable user with two venues. Never logs secrets.
 *
 * Covers:
 * - new account sign-in + initial venue render
 * - switch to authorized venue without reload (intake-incomplete target)
 * - switch back / repeated switches
 * - refresh preserves active venue
 * - unauthorized venue id rejected by RPC (DB check)
 * - destination renders (not blank) after hard nav
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";

config({ path: ".env.local", quiet: true });
process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/venue-switch-white-screen";
const EXPECT_SHA = (process.env.EXPECT_SHA || "").slice(0, 8);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}
mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 500)}`);
}

async function passWelcome(page: {
  url: () => string;
  locator: (s: string) => {
    count: () => Promise<number>;
    check: (o?: { force?: boolean }) => Promise<void>;
    first: () => {
      count: () => Promise<number>;
      check: (o?: { force?: boolean }) => Promise<void>;
    };
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

async function pageLooksBlank(page: {
  locator: (s: string) => { innerText: () => Promise<string>; count: () => Promise<number> };
  evaluate: (fn: () => unknown) => Promise<unknown>;
}): Promise<{ blank: boolean; detail: string; text: string }> {
  const text = (await page.locator("body").innerText().catch(() => "")).trim();
  const hasShell = (await page.locator("[data-slot='sidebar'], header, nav, main h1").count()) > 0;
  const bodyChildCount = (await page.evaluate(() => {
    const b = document.body;
    return b ? b.children.length : 0;
  })) as number;
  const blank = (!text || text.length < 8) && !hasShell;
  return {
    blank,
    detail: `textLen=${text.length} hasShell=${hasShell} bodyChildren=${bodyChildCount} snippet=${text.slice(0, 80)}`,
    text,
  };
}

async function switchTo(
  page: {
    getByRole: (r: string, o?: { name?: RegExp }) => {
      count: () => Promise<number>;
      click: () => Promise<void>;
      filter: (o: { hasText: string }) => {
        count: () => Promise<number>;
        first: () => { click: () => Promise<void> };
      };
    };
    waitForTimeout: (n: number) => Promise<void>;
    waitForLoadState: (s: string, o?: { timeout?: number }) => Promise<void>;
    url: () => string;
  },
  venueName: string,
) {
  const switcher = page.getByRole("button", { name: /Switch venue/i });
  if ((await switcher.count()) === 0) throw new Error("switcher missing");
  await switcher.click();
  await page.waitForTimeout(400);
  const item = page.getByRole("menuitem").filter({ hasText: venueName });
  if ((await item.count()) === 0) throw new Error(`membership missing: ${venueName}`);
  await item.first().click();
  // Hard navigation: wait for load
  await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await passWelcome(page);
}

async function main() {
  const observedAt = new Date().toISOString();
  const stamp = Date.now();
  const email = `jennifer+vswitch.${stamp}@hellotocheers.com`;
  const password = `Vs-${stamp}-Aa1x`;

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

  const venues: { id: string; name: string }[] = [];
  try {
    for (const label of ["A", "B"]) {
      const name = `VSwitch ${label} ${stamp}`;
      const { data: venue, error } = await admin
        .from("venues")
        .insert({ owner_user_id: userId, name, email: `${label}.${email}` })
        .select("id,name")
        .single();
      if (error || !venue) throw error ?? new Error("venue");
      venues.push({ id: venue.id, name: venue.name });
      await admin.from("venue_staff").insert({
        venue_id: venue.id,
        user_id: userId,
        full_name: `VSwitch ${label}`,
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
      // A submitted; B incomplete — switch A→B hits intake redirect (failure mode).
      if (label === "A") {
        await admin.from("venue_onboarding_intake").upsert(
          {
            venue_id: venue.id,
            path: "self_setup",
            venue_name: name,
            space_mode: "one",
            spaces: [{ name: "Main Space", maxCapacity: null }],
            offers_tours: false,
            inquiry_sources: [],
            bring_business_choice: "starting_fresh",
            submitted_at: new Date().toISOString(),
          },
          { onConflict: "venue_id" },
        );
      }
    }
    await admin.from("venue_staff_active_context").upsert({
      user_id: userId,
      active_venue_id: venues[0].id,
      updated_at: new Date().toISOString(),
    });

    // Unauthorized rejection (RPC, not UI)
    {
      const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      );
      const { error: signErr } = await userClient.auth.signInWithPassword({ email, password });
      if (signErr) {
        record("unauthorized_rpc_rejected", false, `signIn failed: ${signErr.message}`);
      } else {
        const foreignId = randomUUID();
        const { data } = await userClient.rpc("set_active_venue", { p_venue_id: foreignId });
        const payload = data as { ok?: boolean; error?: string } | null;
        record(
          "unauthorized_rpc_rejected",
          payload?.ok === false,
          `error=${payload?.error ?? "none"}`,
        );
        await userClient.auth.signOut();
      }
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg: { type: () => string; text: () => string }) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
    });
    page.on("pageerror", (err: Error) => {
      pageErrors.push(String(err.message || err).slice(0, 200));
    });

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
      await page.waitForTimeout(1500);
      await passWelcome(page);

      const initial = await pageLooksBlank(page);
      record(
        "initial_active_venue_renders",
        !initial.blank && !page.url().includes("/login"),
        `url=${page.url()} ${initial.detail}`,
      );
      await page.screenshot({ path: `${OUT}/01-before-switch.png`, fullPage: false });

      const switcher = page.getByRole("button", { name: /Switch venue/i });
      record("switcher_visible", (await switcher.count()) > 0, "header Switch venue");
      if ((await switcher.count()) === 0) {
        throw new Error("Venue switcher not visible");
      }

      // Primary defect: A (submitted) → B (incomplete intake) without reload
      consoleErrors.length = 0;
      pageErrors.length = 0;
      await switchTo(page, venues[1].name);
      const afterB = await pageLooksBlank(page);
      await page.screenshot({ path: `${OUT}/02-after-switch-no-reload.png`, fullPage: true });
      record(
        "switch_to_intake_venue_not_blank",
        !afterB.blank,
        `url=${page.url()} ${afterB.detail} consoleErrs=${consoleErrors.length} pageErrs=${pageErrors.length}`,
      );
      record(
        "switch_to_intake_venue_has_ui",
        !afterB.blank &&
          /Intake|Onboarding|Setup|Dashboard|Switch venue|Welcome/i.test(afterB.text),
        `url=${page.url()}`,
      );
      record(
        "lands_on_intake_or_dashboard",
        /\/(onboarding\/intake|dashboard)/.test(page.url()),
        `url=${page.url()}`,
      );
      record(
        "no_uncaught_pageerror_after_switch",
        pageErrors.length === 0,
        pageErrors.slice(0, 3).join(" | ") || "none",
      );

      // Active venue in DB is B
      {
        const { data: ctx } = await admin
          .from("venue_staff_active_context")
          .select("active_venue_id")
          .eq("user_id", userId)
          .maybeSingle();
        record(
          "active_venue_is_target",
          ctx?.active_venue_id === venues[1].id,
          `active=${ctx?.active_venue_id ?? "null"} expected=${venues[1].id}`,
        );
      }

      // Refresh preserves active venue (secondary persistence check)
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1500);
      await passWelcome(page);
      const afterReload = await pageLooksBlank(page);
      record(
        "refresh_preserves_render",
        !afterReload.blank,
        `url=${page.url()} ${afterReload.detail}`,
      );
      {
        const { data: ctx } = await admin
          .from("venue_staff_active_context")
          .select("active_venue_id")
          .eq("user_id", userId)
          .maybeSingle();
        record(
          "refresh_preserves_active_venue",
          ctx?.active_venue_id === venues[1].id,
          `active=${ctx?.active_venue_id ?? "null"}`,
        );
      }
      await page.screenshot({ path: `${OUT}/03-after-reload.png`, fullPage: false });

      // Switch back to A (submitted) — dashboard should render
      await switchTo(page, venues[0].name);
      const afterA = await pageLooksBlank(page);
      record(
        "switch_back_not_blank",
        !afterA.blank,
        `url=${page.url()} ${afterA.detail}`,
      );
      {
        const { data: ctx } = await admin
          .from("venue_staff_active_context")
          .select("active_venue_id")
          .eq("user_id", userId)
          .maybeSingle();
        record(
          "switch_back_active_venue",
          ctx?.active_venue_id === venues[0].id,
          `active=${ctx?.active_venue_id ?? "null"}`,
        );
      }

      // Repeated switches remain stable
      await switchTo(page, venues[1].name);
      const r1 = await pageLooksBlank(page);
      await switchTo(page, venues[0].name);
      const r2 = await pageLooksBlank(page);
      record(
        "repeated_switches_stable",
        !r1.blank && !r2.blank,
        `b=${r1.detail} | a=${r2.detail}`,
      );

      // From /onboarding/intake (force B first, then open intake, switch to A)
      await switchTo(page, venues[1].name);
      await page.goto(`${APP}/onboarding/intake`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(1000);
      await passWelcome(page);
      record(
        "on_intake_route_before_switch",
        page.url().includes("/onboarding/intake"),
        `url=${page.url()}`,
      );
      await switchTo(page, venues[0].name);
      const fromIntake = await pageLooksBlank(page);
      record(
        "switch_from_intake_route_not_blank",
        !fromIntake.blank,
        `url=${page.url()} ${fromIntake.detail}`,
      );
      await page.screenshot({ path: `${OUT}/04-switch-from-intake.png`, fullPage: false });
    } finally {
      await browser.close();
    }
  } finally {
    for (const v of venues) {
      await admin.from("venue_onboarding_intake").delete().eq("venue_id", v.id);
      await admin.from("venue_staff").delete().eq("venue_id", v.id);
      await admin.from("venues").delete().eq("id", v.id);
    }
    await admin.from("venue_staff_active_context").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }

  const required = [
    "runtime_dpl",
    "initial_active_venue_renders",
    "switcher_visible",
    "switch_to_intake_venue_not_blank",
    "switch_to_intake_venue_has_ui",
    "active_venue_is_target",
    "switch_back_not_blank",
    "repeated_switches_stable",
    "switch_from_intake_route_not_blank",
    "unauthorized_rpc_rejected",
  ];
  const report = {
    observedAt,
    expectSha: EXPECT_SHA || null,
    checks,
    hardFail: checks.filter((c) => required.includes(c.name) && !c.pass).map((c) => c.name),
    ok: required.every((name) => checks.find((c) => c.name === name)?.pass),
  };
  writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2));
  console.log(report.ok ? "GREEN venue switch (no white screen)" : "NOT GREEN venue switch");
  console.log(JSON.stringify({ ok: report.ok, hardFail: report.hardFail }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
