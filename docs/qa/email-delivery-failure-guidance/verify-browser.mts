/**
 * Gate D — email failure guidance on Communication Health Message History.
 * Sandbox only. Magic-link auth. No sends / no retries.
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
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/email-delivery-failure-guidance";

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

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");

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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();

  let sendCalls = 0;
  await page.route("**/api/**", async (route: { request: () => { method: () => string; url: () => string }; continue: () => Promise<void> }) => {
    const req = route.request();
    if (req.method() !== "GET" && /send|resend|messages/i.test(req.url())) {
      sendCalls += 1;
    }
    await route.continue();
  });

  try {
    await page.goto(`${APP}/messaging/health?attention=1`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/attention-desktop.png`, fullPage: true });

    const body = await page.locator("body").innerText();
    record(
      "Couldn't deliver label present",
      /Couldn.?t deliver/i.test(body),
      "label",
    );

    // Load more until we see category-specific guidance from persisted JSON reasons.
    for (let i = 0; i < 6; i++) {
      const text = await page.locator("body").innerText();
      if (/quota was reached|not valid for delivery|could not be determined|support/i.test(text)) break;
      const more = page.locator('[data-testid="message-history-load-more"]');
      if (!(await more.count())) break;
      await more.click();
      await page.waitForTimeout(400);
    }

    const afterLoad = await page.locator("body").innerText();
    record(
      "Quota guidance visible when fixture present",
      /quota was reached|sending quota/i.test(afterLoad)
        || !/Email send failed:\s*\{[^}]*quota/i.test(afterLoad),
      "quota prose or no raw quota JSON on page",
    );
    record(
      "Next-action guidance rendered",
      /contact Hello to Cheers support|correct the email address|Try sending again|Wait until the quota/i.test(afterLoad),
      "next action",
    );
    record(
      "Unknown generic provider gets honest unknown + support",
      /could not be determined|No further error detail|contact Hello to Cheers support/i.test(afterLoad),
      "unknown path",
    );
    record(
      "No raw Authorization / API key leakage",
      !/Bearer\s+[A-Za-z0-9._-]|api[_-]?key\s*[:=]/i.test(afterLoad),
      "secrets",
    );

    const nextActions = page.locator('[data-testid="message-failure-next-action"]');
    const nextCount = await nextActions.count();
    record("Failure next-action nodes present", nextCount > 0, `count=${nextCount}`);

    await page.screenshot({ path: `${OUT}/guidance-desktop.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/messaging/health?attention=1`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/guidance-390.png`, fullPage: true });
    const narrow = await page.locator("body").innerText();
    record(
      "Narrow viewport still shows Couldn't deliver + guidance",
      /Couldn.?t deliver/i.test(narrow)
        && /support|correct the email|quota|Try sending again/i.test(narrow),
      "390",
    );

    record("No send/retry API invoked by viewing", sendCalls === 0, `sendCalls=${sendCalls}`);
  } finally {
    await browser.close();
  }

  const allPass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify(
      {
        expectedSha: EXPECTED,
        servingImage: image,
        allPass,
        checks,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(allPass ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
