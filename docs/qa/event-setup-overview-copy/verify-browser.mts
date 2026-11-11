/**
 * Copy-only: Event setup overview card wording on Sandbox.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/event-setup-overview-copy";
mkdirSync(`${OUT}/shots`, { recursive: true });

const EXPECTED =
  "Questionnaires use authorized send when staff choose — scheduled or immediate. Inventory selection and Event Orders are separate workflows found on the Inventory & Event Order card — not part of Setup.";
const FORBIDDEN = [
  "not an automated schedule",
  "Event Order are commercial workflows on the Inventory",
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: detail.slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 400)}`);
}

function servingImage(): { image: string; digest: string } {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  const image = execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
  const digest = execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
    { encoding: "utf8" },
  ).trim();
  return { image, digest };
}

async function staffCookies() {
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
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
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
}

async function main() {
  const expectedSha = process.env.EXPECTED_SHA?.slice(0, 8) ?? "38267f7c";
  const { image, digest } = servingImage();
  record("serving-image", Boolean(image), `${image} ${digest}`);
  record("serving-sha", image.includes(expectedSha), `expected=${expectedSha}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(await staffCookies());
    const page = await ctx.newPage();
    await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 60_000 });
    const show = page.getByRole("button", { name: /Show setup/i }).first();
    if ((await show.count()) > 0) await show.click();
    await page.waitForTimeout(800);
    const panel = page.locator('[data-testid="event-setup-panel"]');
    const text = await panel.innerText();
    record("exact-new-wording", text.includes(EXPECTED), text.includes(EXPECTED) ? "match" : text.slice(0, 800));
    for (const bad of FORBIDDEN) {
      record(`forbidden-absent:${bad.slice(0, 40)}`, !text.includes(bad), bad);
    }
    await page.screenshot({ path: `${OUT}/shots/event-setup-overview-1280.png`, fullPage: false });
    await ctx.close();
  } finally {
    await browser.close();
  }

  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ image, digest, expectedSha, checks }, null, 2));
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length === 0 ? "GREEN" : "NOT GREEN"} ${checks.length - failed.length}/${checks.length}`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
