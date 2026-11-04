/**
 * Rule K + Wave F Sandbox serving check — SHA + polish smoke (non-destructive).
 *
 *   EXPECT_SHA=3be58e1b09b5ffe9c0f16b3148eaa51055bb8519 \
 *   npx tsx docs/qa/staff-light-canvas/rule-k-wave-f/verify-sandbox.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssr = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = process.env.HTC_APP_URL ?? "https://app.sandbox.hellotocheers.com";
const EXPECT_SHA =
  process.env.EXPECT_SHA ?? "3be58e1b09b5ffe9c0f16b3148eaa51055bb8519";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = join(process.cwd(), "docs/qa/staff-light-canvas/rule-k-wave-f");
const EVID = join(OUT, "evidence");
const DESK = "/Users/jensmac/Desktop/htc-rule-k-review";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESK, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

const results: Record<string, unknown> = {
  expectSha: EXPECT_SHA,
  app: APP,
  checks: {},
  shots: [] as string[],
};

function record(id: string, ok: boolean, detail?: unknown) {
  (results.checks as Record<string, unknown>)[id] = { ok, detail };
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}`, detail ?? "");
}

function extractDeploySha(html: string): string | null {
  const fromAttr = html.match(/data-dpl-id="([a-f0-9]+)"/i)?.[1];
  if (fromAttr) return fromAttr;
  return html.match(/[?&]dpl=([a-f0-9]+)/i)?.[1] ?? null;
}

function rgbToHex(rgb: string | null | undefined): string | null {
  if (!rgb) return null;
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  return (
    "#" +
    [m[1], m[2], m[3]]
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
      .toLowerCase()
  );
}

const loginHtml = await (await fetch(`${APP}/login`)).text();
const dpl = extractDeploySha(loginHtml);
const shaOk =
  !!dpl && (dpl === EXPECT_SHA || EXPECT_SHA.startsWith(dpl) || dpl.startsWith(EXPECT_SHA.slice(0, 8)));
record("deploy_sha", shaOk, { dpl, EXPECT_SHA, source: "ssr-/login" });
if (!shaOk) {
  writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
  process.exit(2);
}

const { data: link } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: "jennifer@hellotocheers.com",
});
const { data: otp } = await anon.auth.verifyOtp({
  type: "email",
  token_hash: link!.properties!.hashed_token!,
});
const base = {
  domain: new URL(APP).hostname,
  path: "/",
  httpOnly: false,
  secure: APP.startsWith("https"),
  sameSite: "Lax" as const,
};
const cookies = [
  ...ssr
    .createChunks(
      "sb-wvpsldwwjqdannqasrdf-auth-token",
      "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session)),
    )
    .map((c: { name: string; value: string }) => ({ ...base, ...c })),
  { ...base, name: "htc_active_venue_id", value: FANCY },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});
await context.addCookies(cookies);
const page = await context.newPage();

async function shot(name: string) {
  const file = `${name}.png`;
  const full = join(EVID, file);
  await page.screenshot({ path: full, fullPage: false });
  copyFileSync(full, join(DESK, file));
  (results.shots as string[]).push(file);
}

try {
  // Saved Reports — guidance blue; cards white on beige (not blue nest)
  await page.goto(`${APP}/reporting/saved`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("main", { timeout: 30000 });
  const savedProbe = await page.evaluate(() => {
    const guidance = document.querySelector(
      '[aria-label="About Saved Reports"]',
    ) as HTMLElement | null;
    const list = document.querySelector("[data-report-saved-list]") as HTMLElement | null;
    const card = list?.querySelector('[data-slot="card"]') as HTMLElement | null;
    const shell = document.querySelector(".htc-report-saved-shell");
    const g = guidance ? getComputedStyle(guidance) : null;
    const c = card ? getComputedStyle(card) : null;
    const canvas = getComputedStyle(document.querySelector("main") ?? document.body);
    return {
      hasGuidance: !!guidance,
      hasShell: !!shell,
      guidanceText: guidance?.innerText?.slice(0, 160) ?? null,
      guidanceBg: g?.backgroundColor ?? null,
      cardBg: c?.backgroundColor ?? null,
      canvasBg: canvas.backgroundColor,
      brokenCopy: (guidance?.innerText ?? "").includes("starters point at"),
    };
  });
  const guidanceHex = rgbToHex(savedProbe.guidanceBg);
  const cardHex = rgbToHex(savedProbe.cardBg);
  record("saved_reports_structure", !savedProbe.hasShell && savedProbe.hasGuidance && !savedProbe.brokenCopy, savedProbe);
  record(
    "saved_reports_colors",
    !!guidanceHex && guidanceHex !== "#ffffff" && cardHex === "#ffffff",
    { guidanceHex, cardHex, canvas: rgbToHex(savedProbe.canvasBg) },
  );
  await shot("sandbox-saved-reports");

  // Public Forms — white cards on beige
  await page.goto(`${APP}/library/public-forms`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("main", { timeout: 30000 });
  const formsProbe = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("main .rounded-lg.border")].filter((el) =>
      el.querySelector("a[href*='/library/public-forms/']"),
    ) as HTMLElement[];
    const first = cards[0] ?? null;
    const bg = first ? getComputedStyle(first).backgroundColor : null;
    return {
      cardCount: cards.length,
      firstBg: bg,
      hasPublished: !!document.body.innerText.match(/Published/),
    };
  });
  record(
    "public_forms_white_cards",
    formsProbe.cardCount === 0 || rgbToHex(formsProbe.firstBg) === "#ffffff",
    { ...formsProbe, hex: rgbToHex(formsProbe.firstBg) },
  );
  await shot("sandbox-public-forms");

  // Timeline Templates — venue-facing copy
  await page.goto(`${APP}/library/timeline-templates`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("main", { timeout: 30000 });
  const timelineText = await page.locator("main").innerText();
  record(
    "timeline_copy",
    timelineText.includes("you build once and apply") && !timelineText.includes("a venue builds"),
    { snippet: timelineText.match(/Reusable day-of[^\n]+/)?.[0] ?? null },
  );
  await shot("sandbox-timeline-templates");

  // Automations edit — working card eucalyptus header
  await page.goto(`${APP}/communication/series`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector("main", { timeout: 30000 });
  const editHref = await page
    .locator('a[href*="/communication/series/"][href$="/edit"]')
    .first()
    .getAttribute("href");
  if (editHref) {
    await page.goto(`${APP}${editHref}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector(".htc-working-card", { timeout: 30000 });
    const autoProbe = await page.evaluate(() => {
      const header = document.querySelector(
        '.htc-working-card > [data-slot="card-header"]',
      ) as HTMLElement | null;
      return {
        headerBg: header ? getComputedStyle(header).backgroundColor : null,
        workingCards: document.querySelectorAll(".htc-working-card").length,
        hasHelp: !!document.querySelector("section.htc-automations-help"),
      };
    });
    const headerHex = rgbToHex(autoProbe.headerBg);
    record(
      "automations_working_card",
      autoProbe.workingCards >= 1 && !!headerHex && headerHex !== "#ffffff" && headerHex !== "transparent",
      { ...autoProbe, headerHex },
    );
    await shot("sandbox-automations-edit");
  } else {
    record("automations_working_card", false, { error: "no edit link" });
  }
} finally {
  await context.close();
  await browser.close();
  writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
}

const failed = Object.values(results.checks as Record<string, { ok: boolean }>).some((c) => !c.ok);
process.exit(failed ? 1 : 0);
