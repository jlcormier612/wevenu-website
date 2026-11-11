/**
 * Browser check: Communication Readiness shows channel-specific test rows
 * and Opened/Clicked status definitions. Sandbox only. No test send.
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
const EXPECTED = process.env.EXPECTED_SHA ?? "d5e36593051f1868b42fa198d36116829db3b65f";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/email-consistency-audit";

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

  let image = "";
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (taskArn && taskArn !== "None") {
      image = execSync(
        `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
        { encoding: "utf8" },
      ).trim();
    }
  } catch {
    image = "";
  }
  record(
    "Serving expected SHA",
    image.includes(EXPECTED.slice(0, 12)),
    `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
  );

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
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();
  try {
    await page.goto(`${APP}/messaging/health`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1200);
    const body = await page.locator("body").innerText();
    await page.screenshot({ path: `${OUT}/comms-health-1280.png`, fullPage: true });

    record("Has Test email successful", /Test email successful/.test(body), "label");
    record("Has Test text successful", /Test text successful/.test(body), "label");
    record("No generic Test message successful", !/Test message successful/.test(body), "removed");
    record(
      "Opened definition present",
      /Opened/.test(body) && /indicative tracking signal|not proof that the recipient personally read/i.test(body),
      "opened",
    );
    record(
      "Clicked definition present",
      /Clicked/.test(body) && /does not prove that the recipient completed/i.test(body),
      "clicked",
    );
    record(
      "EMAIL engagement note email-only",
      /Opened and Clicked apply to email only/i.test(body),
      "note",
    );

    const smsNotReady = /Texting setup[\s\S]{0,240}Not ready yet/i.test(body);
    if (smsNotReady) {
      record(
        "Unconfigured SMS test is Not applicable",
        /Test text successful[\s\S]{0,240}Not applicable/i.test(body),
        "channel split",
      );
    } else {
      record("Unconfigured SMS test is Not applicable", true, "skipped — texting appears configured");
    }
  } finally {
    await browser.close();
  }

  const out = {
    url: `${APP}/messaging/health`,
    email: FANCY_EMAIL,
    expectedSha: EXPECTED,
    servingImage: image,
    checks,
    pass: checks.every((c) => c.pass),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(out, null, 2));
  console.log(out.pass ? "COMMS_LANGUAGE_BROWSER_PASS" : "COMMS_LANGUAGE_BROWSER_FAIL");
  if (!out.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
