/**
 * Sandbox E2E: signed-in Change Password for Venue, Vendor, and Client.
 * Disposable accounts only. Never logs passwords.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/password-recovery";
const EXPECT_SHA = (process.env.EXPECT_SHA || "").slice(0, 8);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}
mkdirSync(OUT, { recursive: true });

type Portal = "venue" | "vendor" | "client";
type Check = { name: string; pass: boolean; detail: string };

function record(checks: Check[], portal: Portal, name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${portal}] ${name} — ${detail.slice(0, 350)}`);
}

async function runPortal(portal: Portal, dpl: string) {
  const checks: Check[] = [];
  const stamp = Date.now();
  const email = `jennifer+pwchange.${portal}.${stamp}@hellotocheers.com`;
  const oldPassword = `OldCh-${portal}-${stamp}-Aa1`;
  const newPassword = `NewCh-${portal}-${stamp}-Bb2`;
  const loginPath =
    portal === "venue" ? "/login" : portal === "vendor" ? "/vendor/login" : "/client/login";

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true,
  });
  if (createErr || !created.user) throw createErr ?? new Error("createUser");
  const userId = created.user.id;

  let venueId: string | null = null;
  let vendorId: string | null = null;
  let clientId: string | null = null;
  let portalToken: string | null = null;

  try {
    if (portal === "venue") {
      const { data: venue, error } = await admin
        .from("venues")
        .insert({ owner_user_id: userId, name: `PWChange Venue ${stamp}`, email })
        .select("id")
        .single();
      if (error || !venue) throw error ?? new Error("venue");
      venueId = venue.id;
      await admin.from("venue_staff").insert({
        venue_id: venueId,
        user_id: userId,
        full_name: "PWChange Venue",
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
    }

    if (portal === "vendor") {
      const { data: vendor, error } = await admin
        .from("vendors")
        .insert({ business_name: `PWChange Vendor ${stamp}`, email, is_claimed: true })
        .select("id")
        .single();
      if (error || !vendor) throw error ?? new Error("vendor");
      vendorId = vendor.id;
      const { error: vuErr } = await admin.from("vendor_users").insert({
        vendor_id: vendorId,
        user_id: userId,
        role: "owner",
        is_active: true,
      });
      if (vuErr) throw vuErr;
    }

    if (portal === "client") {
      const { data: venue, error: vErr } = await admin
        .from("venues")
        .insert({
          owner_user_id: userId,
          name: `PWChange ClientHost ${stamp}`,
          email: `host.${email}`,
        })
        .select("id")
        .single();
      if (vErr || !venue) throw vErr ?? new Error("host venue");
      venueId = venue.id;
      const { data: client, error: cErr } = await admin
        .from("clients")
        .insert({
          venue_id: venueId,
          first_name: "PW",
          last_name: "Change",
          email,
          status: "booking",
          event_type: "wedding",
        })
        .select("id")
        .single();
      if (cErr || !client) throw cErr ?? new Error("client");
      clientId = client.id;
      await admin.from("client_users").insert({ id: userId });
      portalToken = `pwc_${stamp}_${Math.random().toString(36).slice(2, 10)}`;
      const { error: sErr } = await admin.from("client_portal_sessions").insert({
        venue_id: venueId,
        client_id: clientId,
        access_token: portalToken,
        access_level: "couple",
        label: "PW change",
        client_user_id: userId,
        expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      });
      if (sErr) throw sErr;
    }

    record(checks, portal, "runtime_dpl", !EXPECT_SHA || dpl.startsWith(EXPECT_SHA), `dpl=${dpl}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    try {
      await page.goto(`${APP}${loginPath}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      const emailSel = portal === "vendor" ? "#vendor-email" : "#email";
      const passSel = portal === "vendor" ? "#vendor-password" : "#password";
      await page.fill(emailSel, email);
      await page.fill(passSel, oldPassword);
      await page.click('button[type="submit"]');
      for (let i = 0; i < 40; i++) {
        if (!page.url().includes(loginPath.split("?")[0])) break;
        await page.waitForTimeout(400);
      }
      record(checks, portal, "signed_in", !page.url().includes(loginPath.split("?")[0]), `url=${page.url()}`);

      // Navigate to Change Password via normal UI
      let opened = false;
      if (portal === "venue") {
        const menu = page.getByRole("button", { name: /Account menu/i });
        if ((await menu.count()) > 0) {
          await menu.click();
          const item = page.getByRole("menuitem", { name: /Change password/i });
          record(checks, portal, "change_password_nav_visible", (await item.count()) > 0, "UserMenu");
          if ((await item.count()) > 0) {
            await item.click();
            for (let i = 0; i < 20; i++) {
              if (page.url().includes("/account/password")) break;
              await page.waitForTimeout(300);
            }
            opened = page.url().includes("/account/password");
          }
        } else {
          record(checks, portal, "change_password_nav_visible", false, "Account menu missing");
        }
        if (!opened) {
          await page.goto(`${APP}/account/password`, { waitUntil: "domcontentloaded", timeout: 60000 });
          opened = page.url().includes("/account/password");
        }
      }

      if (portal === "vendor") {
        const link = page.getByRole("link", { name: /Change password/i });
        record(checks, portal, "change_password_nav_visible", (await link.count()) > 0, "vendor shell");
        if ((await link.count()) > 0) {
          await link.first().click();
          for (let i = 0; i < 20; i++) {
            if (page.url().includes("/vendor/account/password")) break;
            await page.waitForTimeout(300);
          }
          opened = page.url().includes("/vendor/account/password");
        }
        if (!opened) {
          await page.goto(`${APP}/vendor/account/password`, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          opened = page.url().includes("/vendor/account/password");
        }
      }

      if (portal === "client") {
        // Account is a header button (title=Account)
        const accountBtn = page.getByRole("button", { name: /Account/i }).or(
          page.locator('button[title="Account"]'),
        );
        let navOk = false;
        if ((await accountBtn.count()) > 0) {
          await accountBtn.first().click();
          await page.waitForTimeout(1500);
          navOk = (await page.getByText(/New password/i).count()) > 0;
        }
        record(checks, portal, "change_password_nav_visible", navOk, "portal Account");
        opened = navOk;
        if (!opened && portalToken) {
          await page.goto(`${APP}/p/${portalToken}`, { waitUntil: "domcontentloaded", timeout: 60000 });
          await page.waitForTimeout(1000);
          const btn = page.locator('button[title="Account"]');
          if ((await btn.count()) > 0) {
            await btn.click();
            await page.waitForTimeout(1500);
            opened = (await page.getByText(/New password/i).count()) > 0;
          }
        }
      }

      record(checks, portal, "change_password_surface", opened, `url=${page.url()}`);
      await page.screenshot({
        path: `${OUT}/change-password-${portal}.png`,
        fullPage: false,
      });

      if (!opened) {
        return { portal, checks, ok: false, hardFail: checks.filter((c) => !c.pass).map((c) => c.name) };
      }

      // Mismatch validation
      if (portal === "client") {
        await page.locator("#account-new-password").fill(newPassword);
        await page.locator("#account-confirm-password").fill("mismatch-xxxx");
        await page.getByRole("button", { name: /Change password/i }).click();
        await page.waitForTimeout(1500);
        // toast or stay without success
        const body = await page.locator("body").innerText();
        const toastish =
          /do not match/i.test(body) ||
          (await page.locator("text=/do not match/i").count()) > 0;
        // sonner toasts may leave DOM quickly — also accept that password fields still filled
        record(
          checks,
          portal,
          "mismatch_validation",
          toastish ||
            ((await page.locator("#account-new-password").inputValue()) === newPassword &&
              !(await page.getByText(/Password updated/i).count())),
          "client mismatch",
        );

        await page.locator("#account-new-password").fill(newPassword);
        await page.locator("#account-confirm-password").fill(newPassword);
        await page.getByRole("button", { name: /Change password/i }).click();
        await page.waitForTimeout(3000);
        const successClient =
          (await page.getByText(/Password updated/i).count()) > 0 ||
          /Password updated/i.test(await page.locator("body").innerText());
        record(checks, portal, "change_password_success", successClient, "client toast/body");
        record(
          checks,
          portal,
          "session_preserved",
          page.url().includes("/p/") || (await page.getByText(/New password/i).count()) > 0,
          `url=${page.url()}`,
        );
      } else {
        await page.waitForSelector("#password", { timeout: 15000 });
        await page.fill("#password", newPassword);
        await page.fill("#confirm", "mismatch-xxxx");
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1500);
        const mismatchText = await page.locator("body").innerText();
        record(
          checks,
          portal,
          "mismatch_validation",
          /do not match/i.test(mismatchText),
          "form mismatch",
        );

        await page.fill("#password", newPassword);
        await page.fill("#confirm", newPassword);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2500);
        const successText = await page.locator("body").innerText();
        record(
          checks,
          portal,
          "change_password_success",
          /password was updated/i.test(successText),
          successText.slice(0, 120),
        );
        record(
          checks,
          portal,
          "session_preserved",
          !page.url().includes("/login"),
          `url=${page.url()}`,
        );
      }

      // Sign out and verify passwords
      if (portal === "venue") {
        const menu = page.getByRole("button", { name: /Account menu/i });
        if ((await menu.count()) > 0) {
          await menu.click();
          const signOut = page.getByRole("menuitem", { name: /Sign out/i });
          if ((await signOut.count()) > 0) await signOut.click();
        }
      } else if (portal === "vendor") {
        const signOut = page.getByRole("button", { name: /Sign out/i });
        if ((await signOut.count()) > 0) await signOut.click();
        else await page.goto(`${APP}/vendor/login`, { waitUntil: "domcontentloaded" });
      } else {
        // Fresh context for client login (portal may keep cookie)
        await context.clearCookies();
        await page.goto(`${APP}/client/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
      }

      for (let i = 0; i < 20; i++) {
        if (page.url().includes(loginPath.split("?")[0]) || page.url().includes("/login")) break;
        await page.waitForTimeout(300);
      }
      if (!page.url().includes(loginPath.split("?")[0])) {
        await page.goto(`${APP}${loginPath}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      }

      await page.fill(emailSel, email);
      await page.fill(passSel, oldPassword);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2500);
      record(
        checks,
        portal,
        "old_password_rejected",
        page.url().includes(loginPath.split("?")[0]),
        `url=${page.url()}`,
      );

      await page.fill(emailSel, email);
      await page.fill(passSel, newPassword);
      await page.click('button[type="submit"]');
      for (let i = 0; i < 40; i++) {
        const u = page.url();
        if (portal === "venue" && !u.includes("/login")) break;
        if (portal === "vendor" && u.includes("/vendor/") && !u.includes("/vendor/login")) break;
        if (portal === "client" && u.includes("/p/")) break;
        await page.waitForTimeout(400);
      }
      const u = page.url();
      let signedIn = false;
      if (portal === "venue") signedIn = !u.includes("/login");
      if (portal === "vendor") signedIn = u.includes("/vendor/") && !u.includes("/vendor/login");
      if (portal === "client") signedIn = Boolean(portalToken && u.includes(`/p/${portalToken}`));
      record(checks, portal, "new_password_signin", signedIn, `url=${u}`);
    } finally {
      await browser.close();
    }
  } finally {
    if (portalToken) {
      await admin.from("client_portal_sessions").delete().eq("access_token", portalToken);
    }
    if (clientId) await admin.from("clients").delete().eq("id", clientId);
    await admin.from("client_users").delete().eq("id", userId);
    if (vendorId) {
      await admin.from("vendor_users").delete().eq("user_id", userId);
      await admin.from("vendors").delete().eq("id", vendorId);
    }
    if (venueId) {
      await admin.from("venue_staff_active_context").delete().eq("user_id", userId);
      await admin.from("venue_staff").delete().eq("user_id", userId);
      await admin.from("venues").delete().eq("id", venueId);
    }
    await admin.auth.admin.deleteUser(userId);
  }

  return {
    portal,
    checks,
    ok: checks.every((c) => c.pass),
    hardFail: checks.filter((c) => !c.pass).map((c) => c.name),
  };
}

async function main() {
  const observedAt = new Date().toISOString();
  const loginHtml = await (await fetch(`${APP}/login`)).text();
  const dpl = loginHtml.match(/data-dpl-id="([a-f0-9]+)"/)?.[1] || "";
  if (EXPECT_SHA && !dpl.startsWith(EXPECT_SHA)) {
    console.error(`WRONG TIP dpl=${dpl} expect=${EXPECT_SHA}`);
    process.exit(2);
  }

  const reports = [];
  for (const portal of ["venue", "vendor", "client"] as Portal[]) {
    console.log(`\n=== CHANGE PASSWORD ${portal.toUpperCase()} ===`);
    reports.push(await runPortal(portal, dpl));
  }

  const summary = {
    observedAt,
    expectSha: EXPECT_SHA || null,
    dpl,
    journey: "change_password_signed_in",
    portals: Object.fromEntries(
      reports.map((r) => [r.portal, { ok: r.ok, hardFail: r.hardFail, checks: r.checks }]),
    ),
    ok: reports.every((r) => r.ok),
    hardFail: reports.flatMap((r) => r.hardFail.map((n) => `${r.portal}:${n}`)),
  };
  writeFileSync(`${OUT}/change-password-three-portals-results.json`, JSON.stringify(summary, null, 2));
  console.log(summary.ok ? "\nGREEN signed-in change password (3 portals)" : "\nNOT GREEN change password");
  console.log(JSON.stringify({ ok: summary.ok, hardFail: summary.hardFail }, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
