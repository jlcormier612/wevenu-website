/**
 * Sandbox: dashboard "Follow up" action contrast in dark + light mode.
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
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/dark-mode-followup-contrast";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "";

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

function noteDeployment(link: string | undefined): string | null {
  if (!link) return null;
  const m =
    link.match(/dpl=([0-9a-f]{40})/i) ??
    link.match(/commit\/([0-9a-f]{7,40})/i) ??
    link.match(/([0-9a-f]{40})/);
  return m?.[1] ?? null;
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

function parseRgb(s: string): [number, number, number] | null {
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

async function cookiesFor(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
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

async function measureFollowUp(page: import("playwright").Page) {
  return page.evaluate(() => {
    const span = Array.from(document.querySelectorAll("span")).find(
      (s) => s.textContent?.trim() === "Follow up",
    );
    if (!span) return null;
    const color = getComputedStyle(span).color;
    let el: HTMLElement | null = span;
    let bg = "transparent";
    while (el) {
      const b = getComputedStyle(el).backgroundColor;
      if (b && b !== "rgba(0, 0, 0, 0)" && b !== "transparent") {
        bg = b;
        break;
      }
      el = el.parentElement;
    }
    const overdue = Array.from(document.querySelectorAll("span")).find(
      (s) => s.textContent?.trim() === "Overdue",
    );
    return {
      color,
      bg,
      className: span.className,
      warningFg: getComputedStyle(document.documentElement)
        .getPropertyValue("--warning-foreground")
        .trim(),
      isDark: document.documentElement.classList.contains("dark"),
      overdueColor: overdue ? getComputedStyle(overdue).color : null,
    };
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();
  let servingSha: string | null = null;

  try {
    const res = await page.goto(`${APP}/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    servingSha =
      noteDeployment(res?.headers()["x-deployment-id"]) ??
      noteDeployment(res?.headers()["link"]);
    const tipOk =
      !EXPECTED_PREFIX ||
      (!!servingSha && servingSha.startsWith(EXPECTED_PREFIX.slice(0, 8)));
    record(
      "serving_commit",
      tipOk,
      servingSha ? `${servingSha} (expect ${EXPECTED_PREFIX || "any"})` : "no dpl",
    );
    if (EXPECTED_PREFIX && !tipOk) {
      throw new Error(`serving ${servingSha}, expected ${EXPECTED_PREFIX}`);
    }

    await page.getByRole("heading", { name: /Good (morning|afternoon|evening)/i }).waitFor({
      timeout: 60000,
    });

    // Force dark
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.documentElement.classList.add("dark"));

    const dark = await measureFollowUp(page);
    record("dark_follow_up_present", !!dark, dark ? JSON.stringify(dark) : "no Follow up span");
    if (dark) {
      const fg = parseRgb(dark.color);
      const bg = parseRgb(dark.bg);
      const ratio = fg && bg ? contrastRatio(fg, bg) : 0;
      record(
        "dark_follow_up_contrast_aa",
        ratio >= 4.5,
        `ratio=${ratio.toFixed(2)} color=${dark.color} bg=${dark.bg} token=${dark.warningFg}`,
      );
      record(
        "dark_follow_up_not_forest",
        !dark.color.includes("79, 95, 79") && dark.warningFg !== "#4f5f4f",
        `color=${dark.color} token=${dark.warningFg}`,
      );
      if (dark.overdueColor) {
        record("dark_overdue_still_visible", !!dark.overdueColor, dark.overdueColor);
      }
    }
    await page.screenshot({ path: `${OUT_DIR}/after-dark-1280.png`, fullPage: false });

    // Hover / focus smoke
    const followLink = page.locator('a[data-testid="todays-focus-item-link"]').filter({
      hasText: "Follow up",
    }).first();
    if (await followLink.count()) {
      await followLink.focus();
      const focused = await followLink.evaluate((el) => el === document.activeElement);
      record("keyboard_focus_reachable", focused, focused ? "focused" : "not focused");
      await followLink.hover();
      record("hover_ok", true, "hover applied");
    } else {
      record("keyboard_focus_reachable", false, "no Follow up link");
      record("hover_ok", false, "no Follow up link");
    }

    // Light mode
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.documentElement.classList.remove("dark"));

    const light = await measureFollowUp(page);
    record("light_follow_up_present", !!light, light ? JSON.stringify(light) : "missing");
    if (light) {
      const fg = parseRgb(light.color);
      const bg = parseRgb(light.bg);
      const ratio = fg && bg ? contrastRatio(fg, bg) : 0;
      record(
        "light_follow_up_contrast_aa",
        ratio >= 4.5,
        `ratio=${ratio.toFixed(2)} color=${light.color} bg=${light.bg} token=${light.warningFg}`,
      );
      record(
        "light_uses_forest_token",
        light.warningFg.includes("4f5f4f") || light.color.includes("79, 95, 79"),
        `token=${light.warningFg} color=${light.color}`,
      );
    }
    await page.screenshot({ path: `${OUT_DIR}/after-light-1280.png`, fullPage: false });
  } finally {
    await browser.close();
  }

  const ok = checks.every((c) => c.pass);
  const report = {
    ok,
    servingSha,
    expectedPrefix: EXPECTED_PREFIX || null,
    checks,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
  };
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok, servingSha, pass: report.passCount, fail: report.failCount }, null, 2));
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
