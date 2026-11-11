/**
 * Exact-runtime browser proof: Meadowbrook Rory Luv Noticed must not show
 * the stale early-arrival unanswered insight. No customer sends.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { execSync } from "node:child_process";

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
const OUT = "docs/qa/luv-noticed-stale-attendance";
const LEAD = "09d26751-f184-461f-9cdb-8891b676cd61";
const CONV = "dcba7cbc-77d7-4707-ac0d-e615016c186f";
const STAFF = "jlcormier612@gmail.com";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");
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

function servingImage(): string {
  try {
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

async function cookiesFor(email: string) {
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !link?.properties?.hashed_token) {
    throw new Error(`magiclink failed: ${error?.message}`);
  }
  const { data: session, error: verifyErr } = await anon.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });
  if (verifyErr || !session.session) throw new Error(`verifyOtp: ${verifyErr?.message}`);
  const projectRef = new URL(url).hostname.split(".")[0]!;
  const cookieName = `sb-${projectRef}-auth-token`;
  const chunked = ssrUtils.createChunks(
    cookieName,
    JSON.stringify(session.session),
  ) as Array<{ name: string; value: string }>;
  return chunked.map((c) => ({
    name: c.name,
    value: c.value,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  }));
}

mkdirSync(OUT, { recursive: true });
const image = servingImage();
record("Serving expected SHA", image.includes(EXPECTED.slice(0, 12)), image || "unknown");

const { data: convBefore } = await admin
  .from("conversations")
  .select("venue_unread, needs_response")
  .eq("id", CONV)
  .single();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies(await cookiesFor(STAFF));
const page = await context.newPage();
const consoleErrors: string[] = [];
page.on("console", (msg: { type: () => string; text: () => string }) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await page.goto(`${APP}/leads/${LEAD}`, { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(2000);

// Open Luv tab if present
const luvTab = page.getByRole("tab", { name: /Luv/i }).or(page.locator('[value="luv"], button:has-text("Luv")')).first();
if (await luvTab.count()) {
  try {
    await luvTab.click({ timeout: 5000 });
    await page.waitForTimeout(1500);
  } catch {
    /* overview may already show Noticed */
  }
}

await page.screenshot({ path: `${OUT}/rory-lead-luv-1280.png`, fullPage: true });
const bodyText = await page.locator("body").innerText();

const stalePatterns = [
  /don't see an answer recorded/i,
  /still unanswered in the customer conversation/i,
  /They asked about Can I come in tonight/i,
  /Draft a reply to their question/i,
];
const staleHits = stalePatterns.filter((re) => re.test(bodyText)).map((re) => re.source);
record(
  "Browser: no stale early-arrival unanswered Noticed copy",
  staleHits.length === 0,
  staleHits.length ? staleHits.join(" | ") : "none",
);
record(
  "Browser: early-arrival message not presented as unanswered ACTION",
  !/come in tonight[\s\S]{0,120}(unanswered|don't see an answer|Draft a reply to their question)/i.test(bodyText),
  "scanned lead page body",
);

const { data: convAfter } = await admin
  .from("conversations")
  .select("venue_unread, needs_response")
  .eq("id", CONV)
  .single();
record(
  "Browser visit did not clear needs_response (open lead ≠ clear needs_response)",
  convAfter?.needs_response === convBefore?.needs_response,
  JSON.stringify({ before: convBefore, after: convAfter }),
);

const criticalConsole = consoleErrors.filter(
  (t) => !/favicon|ResizeObserver|hydration/i.test(t),
);
record(
  "No critical console errors",
  criticalConsole.length === 0,
  criticalConsole.slice(0, 3).join(" | ") || "none",
);

await browser.close();

const results = {
  at: new Date().toISOString(),
  expectedSha: EXPECTED,
  servingImage: image,
  convBefore,
  convAfter,
  staleHits,
  consoleErrors: criticalConsole,
  checks,
  allPass: checks.every((c) => c.pass),
  productionUntouched: true,
  noCustomerSends: true,
};
writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ allPass: results.allPass, pass: checks.filter((c) => c.pass).length, fail: checks.filter((c) => !c.pass).length }, null, 2));
if (!results.allPass) process.exit(1);
