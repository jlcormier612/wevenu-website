/**
 * Client invite / public auth: primary Wordmark must stay legible when the
 * visitor prefers dark mode. AuthBrandFrame light-locks the page chrome.
 * Sandbox only. No mutations.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const OUT = "docs/qa/client-invite-logo-contrast";
const PRIMARY = "hello-to-cheers-logo-primary-transparent.png";
const ON_DARK = "hello-to-cheers-logo-on-dark-transparent.png";

const ROUTES = [
  { id: "client-accept", path: "/client/accept", title: "Invalid Invitation" },
  { id: "client-login", path: "/client/login", title: "Welcome back" },
  { id: "join", path: "/join", title: "Invalid Invitation" },
  { id: "vendor-accept", path: "/vendor/accept", title: "Link invalid or expired" },
  { id: "venue-login", path: "/login", title: "Welcome back" },
] as const;

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

function parseRgb(s: string): { r: number; g: number; b: number } | null {
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

async function probeAuthLogo(page: import("playwright").Page) {
  return page.evaluate(({ primary, onDark }) => {
    const lock = document.querySelector("[data-theme-lock='light']");
    const frame = document.querySelector("[data-auth-brand-frame]");
    const logo =
      (document.querySelector('img[alt="Hello to Cheers"]') as HTMLImageElement | null) ??
      null;
    if (!logo) {
      return { found: false } as const;
    }
    const src = logo.getAttribute("src") || "";
    const cs = getComputedStyle(logo);
    const main = logo.closest("main") ?? logo.closest("[data-theme-lock]") ?? document.body;
    const bg = getComputedStyle(main).backgroundColor;
    const rect = logo.getBoundingClientRect();
    return {
      found: true,
      src,
      isPrimary: src.includes(primary),
      isOnDark: src.includes(onDark),
      opacity: cs.opacity,
      filter: cs.filter,
      bg,
      hasThemeLock: Boolean(lock),
      hasAuthFrame: Boolean(frame) || Boolean(lock),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      htmlHasDark: document.documentElement.classList.contains("dark"),
    };
  }, { primary: PRIMARY, onDark: ON_DARK });
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

  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { w: 1280, h: 900, label: "1280" },
      { w: 390, h: 844, label: "390" },
    ] as const) {
      for (const route of ROUTES) {
        // Prefer dark OS + dark class — page must still light-lock for Wordmark.
        const context = await browser.newContext({
          viewport: { width: viewport.w, height: viewport.h },
          colorScheme: "dark",
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
          localStorage.setItem("theme", "dark");
          document.documentElement.classList.add("dark");
        });
        await page.goto(`${APP}${route.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await page.waitForTimeout(900);
        // Re-assert dark preference after hydration (next-themes may flip).
        await page.evaluate(() => {
          document.documentElement.classList.add("dark");
          localStorage.setItem("theme", "dark");
        });
        await page.waitForTimeout(300);

        const shot = `${OUT}/${route.id}-dark-${viewport.label}.png`;
        await page.screenshot({ path: shot, fullPage: false });

        const probe = await probeAuthLogo(page);
        const name = `${route.id}@${viewport.label}`;
        record(`${name}: logo found`, Boolean(probe.found), JSON.stringify(probe));
        if (probe.found) {
          record(`${name}: primary asset`, probe.isPrimary === true, `src=${probe.src}`);
          record(`${name}: not on-dark`, probe.isOnDark === false, `src=${probe.src}`);
          record(
            `${name}: theme-lock light`,
            probe.hasThemeLock === true,
            `lock=${probe.hasThemeLock} frame=${probe.hasAuthFrame}`,
          );
          record(
            `${name}: no opacity wash`,
            Number(probe.opacity) >= 0.99,
            `opacity=${probe.opacity}`,
          );
          record(
            `${name}: no filter wash`,
            !probe.filter || probe.filter === "none",
            `filter=${probe.filter}`,
          );
          record(
            `${name}: logo sized`,
            (probe.height ?? 0) >= 36 && (probe.width ?? 0) >= 80,
            `w=${probe.width} h=${probe.height}`,
          );
          const rgb = parseRgb(probe.bg || "");
          const L = rgb ? relativeLuminance(rgb) : 0;
          // Warm taupe/linen mix should be clearly light (L ≳ 0.45). Heritage-sage muted fails.
          record(
            `${name}: page chrome light enough for primary mark`,
            L >= 0.45,
            `bg=${probe.bg} L=${L.toFixed(3)}`,
          );
        }

        // Light preference control (desktop accept only) — no regression.
        if (viewport.label === "1280" && route.id === "client-accept") {
          await page.evaluate(() => {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
          });
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${OUT}/client-accept-light-1280.png` });
          const lightProbe = await probeAuthLogo(page);
          record(
            "client-accept@light: still primary + lock",
            Boolean(lightProbe.found) &&
              lightProbe.isPrimary === true &&
              lightProbe.hasThemeLock === true,
            JSON.stringify(lightProbe),
          );
        }

        await context.close();
      }
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
        routes: ROUTES.map((r) => r.path),
        asset: `/brand/${PRIMARY}`,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(allPass ? "ALL PASS" : "SOME FAILED");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
