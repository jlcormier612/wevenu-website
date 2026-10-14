/**
 * Verify Dashboard Luv no longer shows aggregate delivery celebration.
 * No sends. EXPECTED_SHA required.
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
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const OUT = "docs/qa/luv-delivery-summary-card";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

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
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

mkdirSync(OUT, { recursive: true });
const image = await servingImage();
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
const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
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
const consoleErrors: string[] = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies(cookies);
const page = await context.newPage();
page.on("console", (msg: { type: () => string; text: () => string }) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(2500);
await page.keyboard.press("Escape").catch(() => {});
await page.screenshot({ path: `${OUT}/dashboard-1280.png`, fullPage: false });

const body = await page.locator("body").innerText();
record(
  "No all-delivered celebration copy",
  !/reached its destination/i.test(body) && !/no failures/i.test(body),
  "celebration absent",
);
record(
  "No quantified last-day failure Luv copy",
  !/couldn't be delivered in the last day/i.test(body),
  "failure aggregate absent",
);
record(
  "Dashboard core intact without delivery Luv card",
  /Today'?s Focus|Good (morning|afternoon|evening)/i.test(body),
  "greeting/focus retained; Luv entry may be absent when no other L1 candidate",
);

await page.goto(`${APP}/messaging/health`, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/health-still-readiness-1280.png`, fullPage: false });
const health = await page.locator("body").innerText();
record(
  "Communication Health remains Readiness",
  /Communication Readiness|How to read this page/i.test(health)
    && (await page.locator('[data-testid="message-history-row"]').count()) === 0,
  "no history rows",
);

const narrow = await browser.newContext({ viewport: { width: 390, height: 844 } });
await narrow.addCookies(cookies);
const npage = await narrow.newPage();
await npage.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 90_000 });
await npage.waitForTimeout(2000);
await npage.screenshot({ path: `${OUT}/dashboard-390.png`, fullPage: false });
const nbody = await npage.locator("body").innerText();
record(
  "Narrow: no delivery celebration",
  !/reached its destination/i.test(nbody),
  "390",
);

await narrow.close();
await browser.close();

record(
  "No critical console errors",
  !consoleErrors.some((e) => /TypeError|ReferenceError|ChunkLoadError/i.test(e)),
  `errors=${consoleErrors.length}`,
);

const pass = checks.every((c) => c.pass);
writeFileSync(
  `${OUT}/browser-results.json`,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      expectedSha: EXPECTED,
      servingImage: image,
      pass,
      checks,
      consoleErrors: consoleErrors.slice(0, 10),
    },
    null,
    2,
  ),
);
console.log(pass ? "ALL PASS" : "SOME FAIL");
process.exit(pass ? 0 : 1);
