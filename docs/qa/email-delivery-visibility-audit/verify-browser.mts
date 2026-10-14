/**
 * Sandbox browser verify — email delivery visibility simplification.
 * No sends. Magic-link Fancy venue. EXPECTED_SHA required.
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
const OUT = "docs/qa/email-delivery-visibility-audit";
const FAILED_CLIENT = "94fdf029-d912-4b1f-9c5a-79efd0757427";

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

async function main() {
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
  const consoleErrors: string[] = [];

  async function runViewport(width: number, height: number) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addCookies(cookies);
    const page = await context.newPage();
    page.on("console", (msg: { type: () => string; text: () => string }) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(`${APP}/messaging/health`, { waitUntil: "networkidle", timeout: 60000 });
    await page.screenshot({ path: `${OUT}/health-${width}.png`, fullPage: true });

    const readiness = await page.locator('[data-testid="communication-readiness"]').count();
    const attentionCard = await page.locator('[data-testid="attention-stat-card"]').count();
    const historyList = await page.locator('[data-testid="message-history-list"]').count();
    const healthWidgetIssues = await page.locator('[data-testid="health-issue-row"]').count();
    const bodyText = await page.locator("body").innerText();

    if (width === 1280) {
      record("Readiness present", readiness >= 1, `count=${readiness}`);
      record("Aggregate attention tile absent", attentionCard === 0, `count=${attentionCard}`);
      record(
        "Aggregate failure list / Excellent scoring absent",
        !/Messages that need your attention/i.test(bodyText)
          && !/Excellent/i.test(bodyText)
          && healthWidgetIssues === 0
          && historyList === 0,
        `history=${historyList} issues=${healthWidgetIssues}`,
      );
      record(
        "Health page points owners to Inbox for failures",
        /open that conversation in Inbox/i.test(bodyText),
        "intro copy",
      );
    }

    await page.goto(`${APP}/clients/${FAILED_CLIENT}#messages`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    // Expand a failed bubble if collapsed
    const failedBadge = page.locator('[data-testid="message-status-badge"]').filter({
      hasText: "Couldn't deliver",
    }).first();
    await page.waitForTimeout(1500);
    if ((await failedBadge.count()) === 0) {
      // try expanding any message row
      const rows = page.locator('[data-conversation-message], [data-message-id], button, [role="button"]');
      const n = Math.min(await rows.count(), 12);
      for (let i = 0; i < n; i++) {
        try { await rows.nth(i).click({ timeout: 500 }); } catch { /* ignore */ }
        if ((await failedBadge.count()) > 0) break;
      }
    }

    await page.screenshot({ path: `${OUT}/thread-compact-${width}.png`, fullPage: true });

    if (width === 1280) {
      const badgeCount = await failedBadge.count();
      record("Compact Couldn't deliver badge present", badgeCount >= 1, `count=${badgeCount}`);

      if (badgeCount >= 1) {
        const badgeText = ((await failedBadge.innerText()) || "").replace(/\s+/g, " ").trim();
        record(
          "Badge has no inline reputation / mailing-list prose",
          !/reputation/i.test(badgeText) && !/mailing list/i.test(badgeText)
            && badgeText.length < 40,
          `text=${badgeText.slice(0, 80)}`,
        );

        const inlineExplain = await page.locator('[data-testid="message-failure-explanation"]').count();
        record("Failure explanation not inline before open", inlineExplain === 0, `count=${inlineExplain}`);

        await failedBadge.click();
        await page.waitForTimeout(500);
        const explain = page.locator('[data-testid="message-failure-explanation"]');
        const next = page.locator('[data-testid="message-failure-next-action"]');
        const explainN = await explain.count();
        const nextN = await next.count();
        record("Detail popover shows explanation", explainN >= 1, `count=${explainN}`);
        record("Detail popover shows next action", nextN >= 1, `count=${nextN}`);
        if (explainN >= 1) {
          const t = await explain.first().innerText();
          record(
            "Popover explanation omits reputation scare",
            !/reputation/i.test(t) && !/mailing list/i.test(t),
            t.slice(0, 120),
          );
        }
        await page.screenshot({ path: `${OUT}/thread-detail-open-${width}.png`, fullPage: true });
      }
    }

    await context.close();
  }

  await runViewport(1280, 800);
  await runViewport(390, 844);
  await browser.close();

  record(
    "No critical console errors",
    !consoleErrors.some((e) => /TypeError|ReferenceError|ChunkLoadError/i.test(e)),
    `errors=${consoleErrors.length}`,
  );

  const pass = checks.every((c) => c.pass);
  const results = {
    at: new Date().toISOString(),
    expectedSha: EXPECTED,
    servingImage: image,
    pass,
    checks,
    consoleErrors: consoleErrors.slice(0, 20),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  console.log(pass ? "ALL PASS" : "SOME FAIL");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
