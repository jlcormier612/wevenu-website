/**
 * Sandbox: Availability capacity copy — no “simple venue”; capacity ≠ public.
 * Fancy owner via magic-link. No settings mutations. No email/SMS send.
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
const EXPECTED = process.env.EXPECTED_SHA ?? "841b27065cbbfb6500b6f013bc87760e059f325f";
const EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/availability-settings-language-audit";

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

async function servingImage(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const task = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!task || task === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${task} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const image = await servingImage();
  const tipOk =
    image.includes(EXPECTED.slice(0, 12)) ||
    image.includes("ffbe34c7") ||
    image.includes("841b2706") ||
    image.includes("d5e36593");
  record("Serving copy lineage", tipOk, `image=${image || "unknown"}`);

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
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
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();
  try {
    await page.goto(`${APP}/settings/availability`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(1200);
    const body = await page.locator("body").innerText();
    await page.screenshot({ path: `${OUT}/availability-settings-1280.png`, fullPage: true });

    record("No simple venue wording", !/simple venue/i.test(body), "removed");
    record(
      "Capacity hosts-one-event copy",
      /hosts one event at a time/i.test(body),
      "hint",
    );
    record(
      "Capacity does not enable public inquiries",
      /does not make dates with confirmed events available for new public inquiries/i.test(body),
      "separation",
    );
    record(
      "Points to confirmed-event control",
      /When a confirmed event is already on the calendar/i.test(body),
      "control",
    );
    record(
      "Staff limits do not override public preference",
      /do not override the separate public confirmed-event availability preference/i.test(body),
      "card description",
    );
  } finally {
    await browser.close();
  }

  const out = { url: `${APP}/settings/availability`, email: EMAIL, image, checks, pass: checks.every((c) => c.pass) };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(out, null, 2));
  console.log(out.pass ? "AVAILABILITY_COPY_BROWSER_PASS" : "AVAILABILITY_COPY_BROWSER_FAIL");
  if (!out.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
