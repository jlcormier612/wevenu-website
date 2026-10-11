/**
 * Sandbox E2E: venue Forgot password → recovery link → new password → sign-in.
 * Disposable user only. Uses admin generateLink (no customer email send).
 * Never logs tokens, passwords, or full recovery URLs.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECT_SHA = (process.env.EXPECT_SHA || "").slice(0, 8);
const OUT = "docs/qa/password-recovery";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}

mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 400)}`);
}

function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const keys = [...u.searchParams.keys()];
    return `${u.origin}${u.pathname}?keys=${keys.join(",")}`;
  } catch {
    return "(unparseable)";
  }
}

async function main() {
  const observedAt = new Date().toISOString();
  const stamp = Date.now();
  const email = `pwreset.e2e.${stamp}@hellotocheers-test.invalid`;
  const oldPassword = `Old-${stamp}-Aa1x`;
  const newPassword = `New-${stamp}-Bb2y`;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true,
  });
  if (createErr || !created.user) throw createErr ?? new Error("create user failed");
  const userId = created.user.id;

  const redirectTo = "http://app.sandbox.hellotocheers.com/auth/confirm?next=%2Freset-password";
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (linkErr || !linkData.properties?.action_link) {
    throw linkErr ?? new Error("generateLink failed");
  }
  const actionLink = linkData.properties.action_link;
  let redirectParam: string | null = null;
  try {
    redirectParam = new URL(actionLink).searchParams.get("redirect_to");
  } catch {
    /* ignore */
  }
  record(
    "recovery_link_redirect",
    Boolean(redirectParam && decodeURIComponent(redirectParam).includes("/auth/confirm")),
    `redirect_to=${redirectParam ? decodeURIComponent(redirectParam) : "null"}`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Login shell + Forgot password link
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const loginHtml = await page.content();
  const dpl = loginHtml.match(/data-dpl-id="([a-f0-9]+)"/)?.[1] || "";
  if (EXPECT_SHA) {
    record("runtime_dpl", dpl.startsWith(EXPECT_SHA), `dpl=${dpl}`);
  } else {
    record("runtime_dpl", Boolean(dpl), `dpl=${dpl || "missing"}`);
  }
  const forgot = page.getByRole("link", { name: /Forgot password\?/i });
  record("forgot_link_visible", await forgot.count() > 0, "login form");
  await page.screenshot({ path: `${OUT}/01-login-forgot-link.png`, fullPage: false });

  await forgot.click();
  await page.waitForTimeout(1500);
  record(
    "forgot_route",
    page.url().includes("/forgot-password"),
    `url=${page.url()}`,
  );
  await page.screenshot({ path: `${OUT}/02-forgot-password.png`, fullPage: false });

  // Request form shows generic success (may or may not deliver to .invalid)
  await page.fill("#email", email);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  const forgotText = await page.locator("body").innerText();
  record(
    "forgot_generic_success",
    /If an account exists for that email/i.test(forgotText),
    forgotText.slice(0, 200),
  );

  // Follow recovery action link (Supabase verify → /auth/confirm → /reset-password)
  await page.goto(actionLink, { waitUntil: "domcontentloaded", timeout: 90000 });
  for (let i = 0; i < 30; i++) {
    if (page.url().includes("/reset-password") || page.url().includes("/forgot-password")) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);
  record(
    "landed_reset_password",
    page.url().includes("/reset-password"),
    `url=${redactUrl(page.url())}`,
  );
  await page.screenshot({ path: `${OUT}/03-reset-password.png`, fullPage: false });

  if (page.url().includes("/reset-password")) {
    await page.fill("#password", newPassword);
    await page.fill("#confirm", newPassword);
    await page.click('button[type="submit"]');
    for (let i = 0; i < 30; i++) {
      if (page.url().includes("/login")) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);
    const loginAfter = await page.locator("body").innerText();
    record(
      "password_updated_to_login",
      page.url().includes("/login") && /password was updated|Sign in/i.test(loginAfter),
      `url=${page.url()} snippet=${loginAfter.slice(0, 180)}`,
    );
    await page.screenshot({ path: `${OUT}/04-login-after-reset.png`, fullPage: false });

    // Old password must fail
    await page.fill("#email", email);
    await page.fill("#password", oldPassword);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
    record(
      "old_password_rejected",
      page.url().includes("/login"),
      `url=${page.url()}`,
    );

    // New password signs in (may land welcome/setup — not dashboard)
    await page.fill("#email", email);
    await page.fill("#password", newPassword);
    await page.click('button[type="submit"]');
    for (let i = 0; i < 30; i++) {
      if (!page.url().includes("/login")) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2000);
    record(
      "new_password_signin",
      !page.url().includes("/login"),
      `url=${page.url()}`,
    );
    await page.screenshot({ path: `${OUT}/05-signed-in.png`, fullPage: false });
  }

  // Replay original action link should not grant a fresh reset blindly
  const context2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await context2.newPage();
  await page2.goto(actionLink, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page2.waitForTimeout(3000);
  const replayUrl = page2.url();
  record(
    "replay_link_safe",
    replayUrl.includes("/forgot-password") ||
      replayUrl.includes("error=invalid_link") ||
      !replayUrl.includes("/reset-password") ||
      /invalid|expired/i.test(await page2.locator("body").innerText()),
    `url=${redactUrl(replayUrl)}`,
  );
  await context2.close();

  // Unauthenticated /reset-password
  const context3 = await browser.newContext();
  const page3 = await context3.newPage();
  await page3.goto(`${APP}/reset-password`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page3.waitForTimeout(1500);
  record(
    "reset_requires_recovery_session",
    page3.url().includes("/forgot-password"),
    `url=${page3.url()}`,
  );
  await context3.close();

  await browser.close();

  // Cleanup disposable user
  await admin.auth.admin.deleteUser(userId);

  const report = {
    observedAt,
    expectSha: EXPECT_SHA || null,
    dpl,
    fixtureEmail: email,
    userIdPrefix: userId.slice(0, 8) + "…",
    checks,
    hardFail: checks.filter((c) => !c.pass).map((c) => c.name),
    ok: checks.every((c) => c.pass),
  };
  writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2));
  console.log(report.ok ? "GREEN password recovery E2E" : "NOT GREEN password recovery E2E");
  console.log(JSON.stringify({ ok: report.ok, hardFail: report.hardFail }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
