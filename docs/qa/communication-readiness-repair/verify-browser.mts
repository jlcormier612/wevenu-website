/**
 * Sandbox proof: Communication Readiness status definitions + test email + SMS gated.
 * Fancy Venue — texting not configured. Does not send SMS. Email test uses venue pathway.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "6abedcfb408d653b94ab1f4d3d65fc58ef3a3e3d";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/communication-readiness-repair";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: FANCY_EMAIL,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");

  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  const cookies = [
    ...ssrUtils.createChunks(cookieName, encoded).map(
      (c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      }),
    ),
    {
      name: "htc_active_venue_id",
      value: FANCY,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();

  try {
    const resp = await page.goto(`${APP}/messaging/health`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    const dpl =
      (resp?.headers()?.link || "").match(/dpl=([0-9a-f]{40})/)?.[1] ?? null;
    record("serving_commit", dpl === EXPECTED, dpl ?? "missing");

    await page.getByText(/Message statuses/i).first().waitFor({ timeout: 30_000 });
    const body = await page.locator("body").innerText();
    await page.screenshot({ path: `${OUT}/desktop-readiness.png`, fullPage: false });

    record("status_sent_def", /Sent[\s\S]{0,40}submitted|accepted it for sending/i.test(body), "defs");
    record("status_delivered_def", /Delivered[\s\S]{0,120}does not prove/i.test(body), "defs");
    record("status_received_def", /Received[\s\S]{0,80}incoming message/i.test(body), "defs");
    record("status_replied_def", /Replied[\s\S]{0,80}matched/i.test(body), "defs");
    record("setup_still_present", /Email connected|Texting setup/i.test(body), "setup");
    record("dashboard_count_note", /waiting on a delivery confirmation/i.test(body), "tiles");

    const smsBtn = page.getByRole("button", { name: /Send test text/i });
    record("sms_disabled_when_unconfigured", await smsBtn.isDisabled(), "sms button");
    record(
      "sms_unconfigured_copy",
      /will not call the texting provider|Enable text messaging/i.test(body),
      "sms copy",
    );

    const emailBtn = page.getByRole("button", { name: /Send test email/i });
    record("email_enabled", !(await emailBtn.isDisabled()), "email button");
    await emailBtn.click();
    await page
      .getByRole("status")
      .filter({ hasText: /accepted by the email provider|Sandbox test inbox|could not|isn't|can't/i })
      .first()
      .waitFor({ timeout: 45_000 })
      .catch(() => null);
    const feedback = await page.getByRole("status").allInnerTexts().catch(() => []);
    const feedbackText = feedback.join(" | ");
    record(
      "email_test_inline_feedback",
      /accepted by the email provider|Sandbox test inbox/i.test(feedbackText),
      feedbackText.slice(0, 240) || "missing",
    );
    record(
      "email_feedback_not_false_delivered",
      feedbackText.length === 0 || !/delivered successfully/i.test(feedbackText),
      feedbackText.slice(0, 240) || "ok",
    );
    await page.screenshot({ path: `${OUT}/after-email-test.png`, fullPage: false });

    // Narrow viewport — definitions should still be present (stacked).
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${OUT}/narrow-readiness.png`, fullPage: false });
    const narrowBody = await page.locator("body").innerText();
    record("narrow_status_defs", /Message statuses/i.test(narrowBody) && /Sent/i.test(narrowBody), "390");

    const pass = checks.every((c) => c.pass);
    writeFileSync(
      `${OUT}/browser-results.json`,
      JSON.stringify({ expected: EXPECTED, dpl, feedbackText, checks, pass }, null, 2),
    );
    console.log(JSON.stringify({ dpl, feedbackText, pass }, null, 2));
    process.exitCode = pass ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
