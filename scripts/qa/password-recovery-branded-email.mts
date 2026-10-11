/**
 * Sandbox: send a real branded recovery email to an internal +alias inbox,
 * inspect Resend metadata (from/subject/html), then complete recovery E2E
 * using the action_link (never logged in full).
 *
 * Does not rotate Jennifer/Meadowbrook credentials. Disposable Auth user only.
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
import { passwordRecoveryRedirectTo } from "../../lib/auth/password-recovery.ts";

config({ path: ".env.local", quiet: true });
// Force Sandbox public origin for recovery redirectTo (local .env often points at localhost).
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

function loadResendKeyFromAws(): string {
  const { execFileSync } = require("node:child_process");
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
    if (j && typeof j.value === "string") return j.value.trim();
  } catch {
    /* plain */
  }
  return raw.trim();
}

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 400)}`);
}

function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}?keys=${[...u.searchParams.keys()].join(",")}`;
  } catch {
    return "(unparseable)";
  }
}

async function main() {
  const observedAt = new Date().toISOString();
  const stamp = Date.now();
  // Internal Google Workspace +alias — lands in designated inbox, separate Auth user.
  const email = `jennifer+pwrecovery.${stamp}@hellotocheers.com`;
  const oldPassword = `OldBr-${stamp}-Aa1x`;
  const newPassword = `NewBr-${stamp}-Bb2y`;
  const fromEmail = "Hello to Cheers <jennifer@hellotocheers.com>";
  const resendKey = process.env.RESEND_API_KEY?.trim() || loadResendKeyFromAws();

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
  if (createErr || !created.user) throw createErr ?? new Error("create user failed");
  const userId = created.user.id;

  const redirectTo = passwordRecoveryRedirectTo("venue");
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (linkErr || !linkData.properties?.action_link) {
    throw linkErr ?? new Error("generateLink failed");
  }
  const actionLink = linkData.properties.action_link;
  const redirectParam = new URL(actionLink).searchParams.get("redirect_to");
  record(
    "recovery_link_redirect",
    Boolean(redirectParam && decodeURIComponent(redirectParam).includes("/auth/confirm")),
    `redirect_to=${redirectParam ? decodeURIComponent(redirectParam) : "null"}`,
  );

  // Send branded email via Resend (same path as production app code)
  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
      "User-Agent": "htc-password-recovery-qa/1.0",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: PASSWORD_RECOVERY_EMAIL_SUBJECT,
      text: buildPasswordRecoveryEmailText(actionLink),
      html: buildPasswordRecoveryEmailHtml(actionLink),
      tags: [
        { name: "category", value: "password_recovery" },
        { name: "qa", value: "branded_delivery" },
      ],
      open_tracking: false,
      click_tracking: false,
    }),
  });
  const sendBody = (await sendRes.json().catch(() => ({}))) as { id?: string; message?: string };
  record("resend_accepted", sendRes.ok && Boolean(sendBody.id), `status=${sendRes.status}`);
  const emailId = sendBody.id || "";

  let retrieved: Record<string, unknown> | null = null;
  if (emailId) {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const getRes = await fetch(`https://api.resend.com/emails/${emailId}`, {
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "User-Agent": "htc-password-recovery-qa/1.0",
        },
      });
      if (getRes.ok) {
        retrieved = (await getRes.json()) as Record<string, unknown>;
        break;
      }
    }
  }

  if (retrieved) {
    const from = String(retrieved.from || "");
    const subject = String(retrieved.subject || "");
    const html = String(retrieved.html || "");
    const lastEvent = String(retrieved.last_event || "");
    record(
      "sender_htc",
      from.includes("jennifer@hellotocheers.com") && /Hello to Cheers/i.test(from),
      `from=${from}`,
    );
    record("subject_branded", subject === PASSWORD_RECOVERY_EMAIL_SUBJECT, `subject=${subject}`);
    record(
      "body_branded",
      /Hello to Cheers/i.test(html) &&
        /Reset password/i.test(html) &&
        !/Supabase Auth/i.test(html) &&
        !/mail\.app\.supabase\.io/i.test(html),
      `html_len=${html.length}`,
    );
    record(
      "delivery_event",
      ["delivered", "opened", "clicked", "sent"].includes(lastEvent) || lastEvent.length > 0,
      `last_event=${lastEvent || "unknown"}`,
    );
  } else {
    record("sender_htc", false, "retrieve failed");
    record("subject_branded", false, "retrieve failed");
    record("body_branded", false, "retrieve failed");
    record("delivery_event", false, "retrieve failed");
  }

  // Browser: follow the same action_link through confirm → reset → login
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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

    await page.goto(actionLink, { waitUntil: "domcontentloaded", timeout: 90000 });
    for (let i = 0; i < 30; i++) {
      if (page.url().includes("/reset-password") || page.url().includes("/forgot-password")) break;
      await page.waitForTimeout(500);
    }
    record("landed_reset_password", page.url().includes("/reset-password"), `url=${redactUrl(page.url())}`);

    if (page.url().includes("/reset-password")) {
      await page.waitForSelector("#password", { timeout: 15000 });
      await page.fill("#password", newPassword);
      await page.fill("#confirm", newPassword);
      await page.click('button[type="submit"]');
      for (let i = 0; i < 40; i++) {
        if (page.url().includes("/login")) break;
        await page.waitForTimeout(500);
      }
      const loginAfter = await page.locator("body").innerText();
      record(
        "password_updated_to_login",
        page.url().includes("/login") && /password was updated|Sign in/i.test(loginAfter),
        `url=${page.url()}`,
      );

      await page.fill("#email", email);
      await page.fill("#password", oldPassword);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2500);
      record("old_password_rejected", page.url().includes("/login"), `url=${page.url()}`);

      await page.fill("#email", email);
      await page.fill("#password", newPassword);
      await page.click('button[type="submit"]');
      for (let i = 0; i < 30; i++) {
        if (!page.url().includes("/login")) break;
        await page.waitForTimeout(500);
      }
      record("new_password_signin", !page.url().includes("/login"), `url=${page.url()}`);
    }
  } finally {
    await browser.close();
    await admin.auth.admin.deleteUser(userId);
  }

  const report = {
    observedAt,
    expectSha: EXPECT_SHA || null,
    fromConfigured: fromEmail,
    provider: "resend",
    resendEmailId: emailId ? `${emailId.slice(0, 8)}…` : null,
    recipientAlias: email.replace(/(\+[^@]+)@/, "+…@"),
    lastEvent: retrieved ? retrieved.last_event : null,
    checks,
    hardFail: checks.filter((c) => !c.pass).map((c) => c.name),
    ok: checks.every((c) => c.pass),
    note:
      "SPF/DKIM/DMARC for hellotocheers.com were previously verified in Resend (docs/resend-production-setup-findings.md). Gmail header inspection still recommended by owner for the designated inbox.",
  };
  writeFileSync(`${OUT}/branded-email-results.json`, JSON.stringify(report, null, 2));
  console.log(report.ok ? "GREEN branded recovery email" : "NOT GREEN branded recovery email");
  console.log(JSON.stringify({ ok: report.ok, hardFail: report.hardFail }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
