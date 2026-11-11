/**
 * Gate D — Inbox attention card + delivery-failure display.
 * Sandbox only. Magic-link auth. No sends.
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
const EXPECTED = process.env.EXPECTED_SHA ?? "8d9eb28bdef67382657666edae04e26b3f3b86ab";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/inbox-attention-delivery-display";

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

  try {
    await page.goto(`${APP}/messaging/health`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/health-desktop.png`, fullPage: true });

    const attentionCard = page.locator('[data-testid="attention-stat-card"]');
    const attentionCountText = (await attentionCard.innerText()).replace(/\s+/g, " ");
    const countMatch = attentionCountText.match(/(\d+)\s+need/i);
    const attentionCount = countMatch ? Number(countMatch[1]) : -1;
    record("Attention count readable", attentionCount >= 0, `count=${attentionCount} text=${attentionCountText.slice(0, 80)}`);

    if (attentionCount === 0) {
      const tag = await attentionCard.evaluate((el: Element) => el.tagName);
      record("Count 0 card is not a link", tag !== "A", `tag=${tag}`);
      await page.goto(`${APP}/messaging/health?attention=1`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(800);
      const emptyBody = await page.locator("body").innerText();
      record(
        "Empty attention filter is honest",
        /No messages currently need attention/i.test(emptyBody),
        "empty copy",
      );
      await page.screenshot({ path: `${OUT}/attention-empty.png`, fullPage: true });
    } else {
      const href = await attentionCard.getAttribute("href");
      const aria = await attentionCard.getAttribute("aria-label");
      const tag = await attentionCard.evaluate((el: Element) => el.tagName);
      record(
        "Attention card is a link to filtered history",
        tag === "A" && href === "/messaging/health?attention=1",
        `tag=${tag} href=${href}`,
      );
      record(
        "Attention card has accessible label",
        Boolean(aria && /need your attention/i.test(aria)),
        `aria=${aria}`,
      );

      await attentionCard.focus();
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return { tag: null, outline: "" };
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          outline: `${cs.outlineStyle} ${cs.boxShadow}`,
          aria: el.getAttribute("aria-label"),
          testId: el.getAttribute("data-testid"),
        };
      });
      record(
        "Keyboard focus reaches attention control",
        focused.tag === "A" && focused.testId === "attention-stat-card",
        JSON.stringify(focused),
      );

      await attentionCard.click();
      await page.waitForTimeout(1200);
      const filteredUrl = page.url();
      record(
        "Click opens attention filter",
        filteredUrl.includes("attention=1"),
        filteredUrl,
      );
      const filteredBody = await page.locator("body").innerText();
      record(
        "Filtered heading present",
        /Messages that need your attention/i.test(filteredBody),
        "heading",
      );
      const rows = page.locator('[data-testid="message-history-row"]');
      const rowCount = await rows.count();
      record("Filtered list has rows", rowCount > 0, `rows=${rowCount}`);

      const statuses = await rows.evaluateAll((els: Element[]) =>
        els.map((el) => el.getAttribute("data-status")),
      );
      const allFailure = statuses.every((s) => s === "failed" || s === "undelivered");
      record(
        "Filtered rows are failure statuses only",
        allFailure && statuses.length > 0,
        `statuses=${JSON.stringify(statuses.slice(0, 12))}`,
      );

      const loadMore = page.locator('[data-testid="message-history-load-more"]');
      if (await loadMore.count()) {
        const before = await rows.count();
        await loadMore.click();
        await page.waitForTimeout(400);
        const after = await rows.count();
        record("Load more reveals additional rows", after > before, `before=${before} after=${after}`);
      } else {
        record(
          "Full result set on first page or under page size",
          rowCount <= 20 || rowCount === attentionCount,
          `rows=${rowCount} count=${attentionCount}`,
        );
      }

      await page.screenshot({ path: `${OUT}/attention-filtered-desktop.png`, fullPage: true });

      // Delivery-failure clipping: measure badge text overflow in history rows.
      const clipProbe = await page.evaluate(() => {
        const badges = Array.from(
          document.querySelectorAll('[data-testid="message-history-row"] button'),
        ) as HTMLElement[];
        const sample = badges.slice(0, 8).map((btn) => {
          const text = (btn.innerText || "").replace(/\s+/g, " ").trim();
          const overflowX = btn.scrollWidth > btn.clientWidth + 1;
          const overflowY = btn.scrollHeight > btn.clientHeight + 1;
          const labelEl = btn.querySelector("span span.break-words, span.min-w-0");
          const labelOverflow = labelEl
            ? (labelEl as HTMLElement).scrollWidth > (labelEl as HTMLElement).clientWidth + 1
            : false;
          return { text: text.slice(0, 120), overflowX, overflowY, labelOverflow };
        });
        const couldnt = sample.filter((s) => /Couldn.?t deliver|Not delivered/i.test(s.text));
        return { sampleCount: sample.length, couldnt, anyClip: couldnt.some((c) => c.overflowX || c.labelOverflow) };
      });
      record(
        "Couldn't deliver text not horizontally clipped",
        clipProbe.couldnt.length === 0 || !clipProbe.anyClip,
        JSON.stringify(clipProbe),
      );
    }

    // Narrow viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      attentionCount > 0 ? `${APP}/messaging/health?attention=1` : `${APP}/messaging/health`,
      { waitUntil: "networkidle", timeout: 60000 },
    );
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/health-narrow-390.png`, fullPage: true });

    const narrowClip = await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll('[data-testid="message-history-row"] button'),
      ) as HTMLElement[];
      return btns.slice(0, 6).map((btn) => {
        const text = (btn.innerText || "").replace(/\s+/g, " ").trim();
        return {
          text: text.slice(0, 140),
          overflowX: btn.scrollWidth > btn.clientWidth + 1,
          clientWidth: btn.clientWidth,
          scrollWidth: btn.scrollWidth,
        };
      });
    });
    const failureNarrow = narrowClip.filter((s) => /Couldn.?t deliver|Not delivered/i.test(s.text));
    record(
      "Narrow viewport failure text not clipped",
      failureNarrow.length === 0 || failureNarrow.every((f) => !f.overflowX),
      JSON.stringify(failureNarrow.slice(0, 4)),
    );

    // Also open unfiltered history for any failure rows when attention was 0
    if (attentionCount === 0) {
      await page.goto(`${APP}/messaging/health`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/history-unfiltered-narrow.png`, fullPage: true });
    }
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
