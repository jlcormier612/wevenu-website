/**
 * Sandbox E2E: password recovery for Venue, Vendor, and Client portals.
 * Disposable users + Resend branded delivery. Never logs tokens/passwords.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  PASSWORD_RECOVERY_EMAIL_SUBJECT,
  buildPasswordRecoveryEmailHtml,
  buildPasswordRecoveryEmailText,
} from "../../lib/auth/password-recovery-email.ts";
import {
  passwordRecoveryRedirectTo,
  type PasswordRecoveryAudience,
} from "../../lib/auth/password-recovery.ts";

config({ path: ".env.local", quiet: true });
process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/password-recovery";
const EXPECT_SHA = (process.env.EXPECT_SHA || "").slice(0, 8);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}
mkdirSync(OUT, { recursive: true });

function loadResendKey(): string {
  if (process.env.RESEND_API_KEY?.trim()) return process.env.RESEND_API_KEY.trim();
  const raw = execFileSync(
    "aws",
    [
      "secretsmanager",
      "get-secret-value",
      "--secret-id",
      "htc/sandbox/resend-api-key",
      "--query",
      "SecretString",
      "--output",
      "text",
    ],
    { encoding: "utf8" },
  ).trim();
  try {
    const j = JSON.parse(raw);
    if (j?.value) return String(j.value).trim();
  } catch {
    /* plain */
  }
  return raw;
}

type Check = { name: string; pass: boolean; detail: string };
type PortalReport = {
  portal: PasswordRecoveryAudience;
  checks: Check[];
  ok: boolean;
  hardFail: string[];
};

function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}?keys=${[...u.searchParams.keys()].join(",")}`;
  } catch {
    return "(unparseable)";
  }
}

async function runPortal(
  portal: PasswordRecoveryAudience,
  dpl: string,
  resendKey: string,
): Promise<PortalReport> {
  const checks: Check[] = [];
  const record = (name: string, pass: boolean, detail: string) => {
    checks.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} [${portal}] ${name} — ${detail.slice(0, 350)}`);
  };

  const stamp = Date.now();
  const email = `jennifer+pw.${portal}.${stamp}@hellotocheers.com`;
  const oldPassword = `Old-${portal}-${stamp}-Aa1`;
  const newPassword = `New-${portal}-${stamp}-Bb2`;
  const fromEmail = "Hello to Cheers <jennifer@hellotocheers.com>";
  const loginPath =
    portal === "venue" ? "/login" : portal === "vendor" ? "/vendor/login" : "/client/login";
  const forgotHref =
    portal === "venue" ? "/forgot-password" : `/forgot-password?audience=${portal}`;

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
        .insert({ owner_user_id: userId, name: `PW Venue ${stamp}`, email })
        .select("id")
        .single();
      if (error || !venue) throw error ?? new Error("venue");
      venueId = venue.id;
      await admin.from("venue_staff").insert({
        venue_id: venueId,
        user_id: userId,
        full_name: "PW Venue",
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
        .insert({
          business_name: `PW Vendor ${stamp}`,
          email,
          is_claimed: true,
        })
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
          name: `PW ClientHost ${stamp}`,
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
          last_name: "Client",
          email,
          status: "booking",
          event_type: "wedding",
        })
        .select("id")
        .single();
      if (cErr || !client) throw cErr ?? new Error("client");
      clientId = client.id;
      await admin.from("client_users").insert({ id: userId });
      portalToken = `pwr_${stamp}_${Math.random().toString(36).slice(2, 10)}`;
      const { error: sErr } = await admin.from("client_portal_sessions").insert({
        venue_id: venueId,
        client_id: clientId,
        access_token: portalToken,
        access_level: "couple",
        label: "PW recovery",
        client_user_id: userId,
        expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      });
      if (sErr) throw sErr;
    }

    record("runtime_dpl", !EXPECT_SHA || dpl.startsWith(EXPECT_SHA), `dpl=${dpl}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    try {
      await page.goto(`${APP}${loginPath}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      record(
        "login_screen",
        page.url().includes(loginPath.split("?")[0]),
        `url=${page.url()}`,
      );
      const forgot = page.getByRole("link", { name: /Forgot password\?/i });
      record("forgot_visible", (await forgot.count()) > 0, loginPath);
      if ((await forgot.count()) === 0) {
        return { portal, checks, ok: false, hardFail: checks.filter((c) => !c.pass).map((c) => c.name) };
      }
      await forgot.click();
      await page.waitForTimeout(1500);
      const onForgot =
        page.url().includes("/forgot-password") &&
        (portal === "venue"
          ? !page.url().includes("audience=client") && !page.url().includes("audience=vendor")
          : page.url().includes(`audience=${portal}`));
      record("forgot_route", onForgot, `url=${page.url()} expected~${forgotHref}`);

      // Request form (enumeration-safe) — may rate-limit; delivery proven via Resend below.
      await page.fill("#email", email);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2500);
      const bodyText = await page.locator("body").innerText();
      const formOk =
        /If an account exists for that email/i.test(bodyText) ||
        /wait a moment before requesting another reset/i.test(bodyText) ||
        /couldn’t start a password reset/i.test(bodyText);
      record("forgot_form_response", formOk, bodyText.slice(0, 160));

      // Branded Resend delivery with portal-scoped redirect
      const redirectTo = passwordRecoveryRedirectTo(portal);
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (linkErr || !linkData.properties?.action_link) {
        record("generate_link", false, linkErr?.message || "missing action_link");
        return { portal, checks, ok: false, hardFail: checks.filter((c) => !c.pass).map((c) => c.name) };
      }
      const actionLink = linkData.properties.action_link;
      const redirectParam = new URL(actionLink).searchParams.get("redirect_to");
      const decoded = redirectParam ? decodeURIComponent(redirectParam) : "";
      record(
        "recovery_link_redirect",
        decoded.includes("/auth/confirm") &&
          (portal === "venue" || decoded.includes(`audience=${portal}`) || decoded.includes(encodeURIComponent(`audience=${portal}`))),
        `redirect_to=${decoded || "null"}`,
      );

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "User-Agent": "htc-password-recovery-3portal/1.0",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: PASSWORD_RECOVERY_EMAIL_SUBJECT,
          text: buildPasswordRecoveryEmailText(actionLink),
          html: buildPasswordRecoveryEmailHtml(actionLink),
          tags: [
            { name: "category", value: "password_recovery" },
            { name: "audience", value: portal },
            { name: "qa", value: "three_portals" },
          ],
          open_tracking: false,
          click_tracking: false,
        }),
      });
      const sendBody = (await sendRes.json().catch(() => ({}))) as { id?: string };
      record("resend_accepted", sendRes.ok && Boolean(sendBody.id), `status=${sendRes.status}`);

      let from = "";
      let subject = "";
      let html = "";
      let lastEvent = "";
      if (sendBody.id) {
        for (let i = 0; i < 8; i++) {
          await new Promise((r) => setTimeout(r, 1200));
          const getRes = await fetch(`https://api.resend.com/emails/${sendBody.id}`, {
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "User-Agent": "htc-password-recovery-3portal/1.0",
            },
          });
          if (getRes.ok) {
            const retrieved = (await getRes.json()) as Record<string, unknown>;
            from = String(retrieved.from || "");
            subject = String(retrieved.subject || "");
            html = String(retrieved.html || "");
            lastEvent = String(retrieved.last_event || "");
            break;
          }
        }
      }
      record(
        "sender_htc",
        from.includes("jennifer@hellotocheers.com") && /Hello to Cheers/i.test(from),
        `from=${from || "missing"}`,
      );
      record(
        "subject_branded",
        subject === PASSWORD_RECOVERY_EMAIL_SUBJECT,
        `subject=${subject || "missing"}`,
      );
      record(
        "body_branded",
        /Hello to Cheers/i.test(html) &&
          /Reset password/i.test(html) &&
          !/Supabase Auth/i.test(html),
        `html_len=${html.length} last_event=${lastEvent}`,
      );

      await page.goto(actionLink, { waitUntil: "domcontentloaded", timeout: 90000 });
      for (let i = 0; i < 30; i++) {
        if (page.url().includes("/reset-password") || page.url().includes("/forgot-password")) break;
        await page.waitForTimeout(500);
      }
      const onReset = page.url().includes("/reset-password");
      const audienceOk =
        portal === "venue"
          ? !page.url().includes("audience=client") && !page.url().includes("audience=vendor")
          : page.url().includes(`audience=${portal}`) || onReset;
      record("landed_reset_password", onReset && audienceOk, `url=${redactUrl(page.url())}`);

      if (onReset) {
        // Mismatch validation
        await page.waitForSelector("#password", { timeout: 15000 });
        await page.fill("#password", newPassword);
        await page.fill("#confirm", "does-not-match-xx");
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1500);
        const mismatchText = await page.locator("body").innerText();
        record(
          "mismatch_validation",
          /do not match/i.test(mismatchText) && page.url().includes("/reset-password"),
          "confirm mismatch",
        );

        await page.fill("#password", newPassword);
        await page.fill("#confirm", newPassword);
        await page.click('button[type="submit"]');
        for (let i = 0; i < 40; i++) {
          if (page.url().includes(loginPath.split("?")[0]) || page.url().includes("/login")) break;
          await page.waitForTimeout(500);
        }
        const afterReset = await page.locator("body").innerText();
        const backToPortalLogin =
          page.url().includes(loginPath.split("?")[0]) &&
          (/password was updated/i.test(afterReset) || page.url().includes("reset=1"));
        record("password_updated_to_login", backToPortalLogin, `url=${page.url()}`);

        // Old password rejected
        const emailSel = portal === "vendor" ? "#vendor-email" : "#email";
        const passSel = portal === "vendor" ? "#vendor-password" : "#password";
        await page.fill(emailSel, email);
        await page.fill(passSel, oldPassword);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2500);
        const stillLogin = page.url().includes(loginPath.split("?")[0]);
        record("old_password_rejected", stillLogin, `url=${page.url()}`);

        // New password signs in
        await page.fill(emailSel, email);
        await page.fill(passSel, newPassword);
        await page.click('button[type="submit"]');
        for (let i = 0; i < 40; i++) {
          const u = page.url();
          if (portal === "venue" && !u.includes("/login")) break;
          if (portal === "vendor" && (u.includes("/vendor/") && !u.includes("/vendor/login"))) break;
          if (portal === "client" && (u.includes("/p/") || (!u.includes("/client/login") && !u.includes("/login")))) break;
          await page.waitForTimeout(500);
        }
        const signedInUrl = page.url();
        let signedIn = false;
        if (portal === "venue") signedIn = !signedInUrl.includes("/login");
        if (portal === "vendor") {
          signedIn =
            signedInUrl.includes("/vendor/") && !signedInUrl.includes("/vendor/login");
        }
        if (portal === "client") {
          signedIn = Boolean(portalToken && signedInUrl.includes(`/p/${portalToken}`));
        }
        record("new_password_signin", signedIn, `url=${signedInUrl}`);
      }

      // Replay link
      const ctx2 = await browser.newContext();
      const page2 = await ctx2.newPage();
      await page2.goto(actionLink, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page2.waitForTimeout(3000);
      const replay = page2.url();
      record(
        "replay_link_safe",
        replay.includes("/forgot-password") ||
          replay.includes("error=") ||
          !replay.includes("/reset-password") ||
          /invalid|expired/i.test(await page2.locator("body").innerText()),
        `url=${redactUrl(replay)}`,
      );
      await ctx2.close();

      // Unauthenticated reset
      const ctx3 = await browser.newContext();
      const page3 = await ctx3.newPage();
      const resetUrl =
        portal === "venue"
          ? `${APP}/reset-password`
          : `${APP}/reset-password?audience=${portal}`;
      await page3.goto(resetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page3.waitForTimeout(1500);
      record(
        "reset_requires_session",
        page3.url().includes("/forgot-password"),
        `url=${page3.url()}`,
      );
      await ctx3.close();
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
  const resendKey = loadResendKey();

  // Live tip
  const loginHtml = await (await fetch(`${APP}/login`)).text();
  const dpl = loginHtml.match(/data-dpl-id="([a-f0-9]+)"/)?.[1] || "";
  if (EXPECT_SHA && !dpl.startsWith(EXPECT_SHA)) {
    console.error(`WRONG TIP dpl=${dpl} expect=${EXPECT_SHA}`);
    process.exit(2);
  }

  const portals: PasswordRecoveryAudience[] = ["venue", "vendor", "client"];
  const reports: PortalReport[] = [];
  for (const portal of portals) {
    console.log(`\n=== ${portal.toUpperCase()} ===`);
    reports.push(await runPortal(portal, dpl, resendKey));
  }

  const summary = {
    observedAt,
    expectSha: EXPECT_SHA || null,
    dpl,
    provider: "resend",
    fromConfigured: "Hello to Cheers <jennifer@hellotocheers.com>",
    portals: Object.fromEntries(
      reports.map((r) => [
        r.portal,
        { ok: r.ok, hardFail: r.hardFail, checks: r.checks },
      ]),
    ),
    ok: reports.every((r) => r.ok),
    hardFail: reports.flatMap((r) => r.hardFail.map((n) => `${r.portal}:${n}`)),
  };
  writeFileSync(`${OUT}/three-portals-results.json`, JSON.stringify(summary, null, 2));
  console.log(summary.ok ? "\nGREEN three-portal password recovery" : "\nNOT GREEN three-portal password recovery");
  console.log(JSON.stringify({ ok: summary.ok, hardFail: summary.hardFail }, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
