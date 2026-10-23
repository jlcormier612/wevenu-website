/**
 * Sandbox — Client Portal Preview legibility under staff dark theme.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/client-portal-preview-legibility";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function parseRgb(s: string): [number, number, number] | null {
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
function relLum([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg: string, bg: string): number | null {
  const a = parseRgb(fg);
  const b = parseRgb(bg);
  if (!a || !b) return null;
  const L1 = relLum(a);
  const L2 = relLum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

async function cookiesFor() {
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
  const image = await servingImage();
  record(
    "serving-sha",
    !EXPECTED_SHA || image.includes(EXPECTED_SHA.slice(0, 12)),
    `expected=${EXPECTED_SHA.slice(0, 12)} ecs=${image}`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
  });
  await context.addCookies(await cookiesFor());
  const page = await context.newPage();
  await page.addInitScript(`() => {
    localStorage.setItem("theme", "dark");
    document.documentElement.classList.add("dark");
  }`);

  const previewUrl = `${APP}/clients/${CLIENT}/portal-preview?event=${EVENT}`;
  await page.goto(previewUrl, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector('[data-testid="client-portal-preview"]', { timeout: 45000 });
  const locked = await page.getAttribute('[data-testid="client-portal-preview"]', "data-theme-lock");
  record("theme-lock-light", locked === "light", `lock=${locked}`);

  const tabs = ["event-order", "floor-plans", "planning", "inventory", "vendors"] as const;
  for (const tab of tabs) {
    await page.click(`[data-testid="portal-preview-tab-${tab}"]`);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/shots/preview-${tab}-dark-1280.png`, fullPage: true });
    const sample = await page.evaluate(`(() => {
      const root = document.querySelector('[data-testid="client-portal-preview"]');
      if (!root) return null;
      const heading = root.querySelector(".text-heading, h2, [class*='text-heading']");
      const muted = root.querySelector(".text-muted-foreground");
      const bg = getComputedStyle(root).backgroundColor;
      const h = heading ? getComputedStyle(heading).color : null;
      const m = muted ? getComputedStyle(muted).color : null;
      return { bg, heading: h, muted: m, headingText: heading?.textContent?.slice(0, 80) };
    })()`);
    if (!sample?.bg || !sample.heading) {
      record(`contrast-${tab}`, false, JSON.stringify(sample));
      continue;
    }
    const hr = ratio(sample.heading, sample.bg);
    const mr = sample.muted ? ratio(sample.muted, sample.bg) : null;
    const pass = (hr ?? 0) >= 4.5 && (mr == null || mr >= 3);
    record(
      `contrast-${tab}`,
      pass,
      `heading=${hr?.toFixed(2)} muted=${mr?.toFixed(2) ?? "n/a"} ${JSON.stringify(sample)}`,
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('[data-testid="portal-preview-tab-vendors"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/shots/preview-vendors-dark-390.png`, fullPage: true });
  record("narrow-vendors-shot", true, "390");

  // Read-only: no network mutation to share/release endpoints while clicking tabs
  const mutating: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    if (/share|release|invite|send|invoice/i.test(u) && req.method() !== "GET") mutating.push(`${req.method()} ${u}`);
  });
  for (const tab of tabs) {
    await page.click(`[data-testid="portal-preview-tab-${tab}"]`);
    await page.waitForTimeout(200);
  }
  record("no-mutating-requests-on-tab-switch", mutating.length === 0, JSON.stringify(mutating.slice(0, 5)));

  await browser.close();
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ expectedSha: EXPECTED_SHA, checks }, null, 2));
  const failed = checks.filter((c) => !c.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
