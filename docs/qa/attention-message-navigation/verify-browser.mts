/**
 * Attention navigation — Sandbox read-only after deploy.
 * Asserts Attention rows expose hrefs (lead/client or Inbox conversation deep-link)
 * and that the first linked row opens a messaging/lead/client destination.
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
const OUT = "docs/qa/attention-message-navigation";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

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

async function cookiesFor() {
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

mkdirSync(OUT, { recursive: true });
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const image = await servingImage();
record(
  "Serving expected SHA",
  image.includes(EXPECTED.slice(0, 12)),
  `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies(await cookiesFor());
const page = await context.newPage();

const results: Record<string, unknown> = {
  at: new Date().toISOString(),
  expectedSha: EXPECTED,
  servingImage: image,
};

try {
  await page.goto(`${APP}/messaging/health?attention=1`, {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await page.waitForSelector('[data-testid="message-history-row"]', { timeout: 60_000 });
  await page.screenshot({ path: `${OUT}/attention-1280.png`, fullPage: false });

  const rows = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid="message-history-row"]')).map(
      (li) => {
        const a = li.querySelector("a");
        return {
          status: li.getAttribute("data-status") ?? "",
          href: a?.getAttribute("href") ?? null,
          preview: li.querySelector("p.truncate.text-xs")?.textContent?.trim()?.slice(0, 60) ?? null,
        };
      },
    );
  });
  results.rowCount = rows.length;
  results.rowsSample = rows.slice(0, 5);
  const withHref = rows.filter((r) => r.href);
  const inboxDeep = withHref.filter((r) => (r.href ?? "").startsWith("/messaging?conversation="));
  const recordDeep = withHref.filter(
    (r) => (r.href ?? "").startsWith("/leads/") || (r.href ?? "").startsWith("/clients/"),
  );
  const withoutHref = rows.filter((r) => !r.href);

  record(
    "attention_first_page_has_rows",
    rows.length > 0,
    `rows=${rows.length}`,
  );
  record(
    "attention_href_coverage",
    withoutHref.length === 0 && withHref.length === rows.length,
    `withHref=${withHref.length}/${rows.length} inboxDeep=${inboxDeep.length} recordDeep=${recordDeep.length} without=${withoutHref.length}`,
  );

  if (withHref[0]?.href) {
    await page.goto(`${APP}${withHref[0].href}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(2000);
    await page.keyboard.press("Escape").catch(() => {});
    await page.screenshot({ path: `${OUT}/destination-1280.png`, fullPage: false });
    const destUrl = page.url();
    results.clickedHref = withHref[0].href;
    results.destinationUrl = destUrl;
    const okDest =
      destUrl.includes("/messaging") ||
      destUrl.includes("/leads/") ||
      destUrl.includes("/clients/");
    record(
      "attention_link_opens_destination",
      okDest,
      `href=${withHref[0].href} landed=${destUrl}`,
    );
  } else {
    record("attention_link_opens_destination", false, "no href to click");
  }
} catch (e) {
  results.error = e instanceof Error ? e.message : String(e);
  record("browser_run", false, results.error as string);
} finally {
  await browser.close();
}

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass).length;
results.checks = checks;
results.summary = { passed, failed, total: checks.length };
writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.summary, null, 2));
process.exit(failed > 0 ? 1 : 0);
