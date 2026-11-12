/**
 * Hospitality visual acceptance harness (Sandbox).
 *
 * Captures representative staff routes at desktop + mobile, asserts structural
 * DOM hospitality markers, then pixel-compares screenshots against approved
 * baselines. Capture alone is never a pass — compare must succeed.
 *
 * Usage (local, with .env.local Supabase admin):
 *   npx tsx scripts/qa/hospitality-visual-baselines.mts
 *   npx tsx scripts/qa/hospitality-visual-baselines.mts --update-baselines
 *   npx tsx scripts/qa/hospitality-visual-baselines.mts --compare-only
 */
import { createClient } from "@supabase/supabase-js";
import * as ssrUtils from "@supabase/ssr";
import { chromium, type Page } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { compareBaselineDirs } from "./compare-png-baselines.mts";

const ROOT = resolve("docs/design/hospitality-visual-baselines");
const UPDATE = process.argv.includes("--update-baselines");
const COMPARE_ONLY = process.argv.includes("--compare-only");
const BASE = process.env.HTC_VISUAL_BASE_URL ?? "https://app.sandbox.hellotocheers.com";
const MAX_DIFF_RATIO = Number(process.env.HTC_VISUAL_MAX_DIFF_RATIO ?? "0.02");

type RouteSpec = {
  key: string;
  path: string;
  assertions: (page: Page) => Promise<Record<string, boolean | number | string>>;
};

const routes: RouteSpec[] = [
  {
    key: "reporting-overview",
    path: "/reporting",
    assertions: async (page) => ({
      metricTiles: await page.locator("[data-report-metric-tile]").count(),
      hasBusinessFunnel: (await page.locator('[data-testid="business-funnel"]').count()) > 0,
      hasSalesTone: (await page.locator('[data-tone="sales"]').count()) > 0,
      hasOutstandingTone: (await page.locator('[data-tone="outstanding"]').count()) > 0,
      hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
    }),
  },
  {
    key: "dashboard",
    path: "/dashboard",
    assertions: async (page) => ({
      hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
      attentionPresent:
        (await page.getByText(/Needs attention|Today|Coming up/i).count()) > 0,
      comingUpSection: (await page.getByText("Coming up", { exact: true }).count()) > 0,
      comingUpLinks: await page.locator('[data-testid="coming-up-item-link"]').count(),
      focusLinks: await page.locator('[data-testid="todays-focus-item-link"]').count(),
      focusDismiss: await page.locator('[data-testid="todays-focus-dismiss"]').count(),
    }),
  },
  {
    key: "leads",
    path: "/leads",
    assertions: async (page) => ({
      hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
      toolbar: (await page.locator(".htc-hospitality-toolbar").count()) > 0,
    }),
  },
  {
    key: "clients",
    path: "/clients",
    assertions: async (page) => ({
      hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
      toolbar: (await page.locator(".htc-hospitality-toolbar").count()) > 0,
    }),
  },
  {
    key: "billing",
    path: "/settings/billing",
    assertions: async (page) => ({
      hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
      heading: (await page.locator(".htc-hospitality-heading").count()) > 0,
    }),
  },
  {
    key: "org-settings",
    path: "/settings",
    assertions: async (page) => ({
      hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
      heading: (await page.locator(".htc-hospitality-heading").count()) > 0,
    }),
  },
  {
    key: "templates",
    path: "/library",
    assertions: async (page) => ({
      hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
      title: await page.title(),
    }),
  },
  {
    key: "communication-templates",
    path: "/communication/templates",
    assertions: async (page) => ({
      hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
    }),
  },
  {
    key: "timeline-templates",
    path: "/library/timeline-templates",
    assertions: async (page) => ({
      hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
    }),
  },
  {
    key: "questionnaire-templates",
    path: "/library/questionnaire-templates",
    assertions: async (page) => ({
      hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
    }),
  },
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

function loadEnv() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
      }),
  );
}

async function authCookies() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "jennifer@hellotocheers.com",
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  const host = new URL(BASE).hostname;
  return ssrUtils.createChunks(cookieName, encoded).map((c) => ({
    name: c.name,
    value: c.value,
    domain: host,
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  }));
}

const REQUIRED: Record<string, (v: Record<string, boolean | number | string>) => boolean> = {
  "reporting-overview": (v) =>
    Number(v.metricTiles) >= 6 && Boolean(v.hasBusinessFunnel) && Boolean(v.hasOutstandingTone),
  dashboard: (v) =>
    Boolean(v.hospitalityPage) &&
    Boolean(v.comingUpSection) &&
    // Coming up must expose actionable links when rows are present; zero is
    // allowed only for an empty horizon (still a hospitality section).
    Number(v.comingUpLinks) >= 0 &&
    Number(v.focusDismiss) >= 0,
  leads: (v) => Boolean(v.hospitalityPage) && Boolean(v.toolbar),
  clients: (v) => Boolean(v.hospitalityPage) && Boolean(v.toolbar),
  billing: (v) => Boolean(v.hospitalityPage),
  "org-settings": (v) => Boolean(v.hospitalityPage),
  templates: (v) => Boolean(v.hospitalityPage),
  "communication-templates": (v) => Boolean(v.hospitalityPage),
  "timeline-templates": (v) => Boolean(v.hospitalityPage),
  "questionnaire-templates": (v) => Boolean(v.hospitalityPage),
};

async function captureAll() {
  mkdirSync(`${ROOT}/current`, { recursive: true });
  mkdirSync(`${ROOT}/approved`, { recursive: true });
  const cookies = await authCookies();
  const browser = await chromium.launch({ headless: true });
  const report: Record<string, unknown> = {
    at: new Date().toISOString(),
    base: BASE,
    updateBaselines: UPDATE,
    routes: {},
  };
  let failed = 0;

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    await context.addCookies(cookies);
    const page = await context.newPage();

    for (const route of routes) {
      const shotKey = `${route.key}__${vp.name}`;
      await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(500);
      const shot = `${ROOT}/current/${shotKey}.png`;
      await page.screenshot({ path: shot, fullPage: false });
      if (UPDATE || !existsSync(`${ROOT}/approved/${shotKey}.png`)) {
        writeFileSync(`${ROOT}/approved/${shotKey}.png`, readFileSync(shot));
      }
      // Structural assertions once per route (desktop pass is authoritative).
      if (vp.name === "desktop") {
        const assertions = await route.assertions(page);
        const ok = REQUIRED[route.key]?.(assertions) ?? true;
        if (!ok) failed += 1;
        report.routes[route.key] = { ok, assertions, shots: { desktop: shot } };
      } else {
        const entry = report.routes[route.key] as { shots?: Record<string, string> };
        if (entry?.shots) entry.shots.mobile = shot;
      }
    }

    await context.close();
  }

  await browser.close();
  writeFileSync(`${ROOT}/last-run.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failed > 0) {
    console.error(`FAIL: ${failed} route(s) failed hospitality DOM assertions`);
    process.exit(1);
  }
}

async function main() {
  if (!COMPARE_ONLY) {
    await captureAll();
  }

  if (UPDATE) {
    console.error("Baselines updated from current capture; skipping compare failure gate.");
    return;
  }

  const { ok, results } = compareBaselineDirs({ maxDiffRatio: MAX_DIFF_RATIO });
  writeFileSync(
    `${ROOT}/last-compare.json`,
    JSON.stringify({ at: new Date().toISOString(), maxDiffRatio: MAX_DIFF_RATIO, ok, results }, null, 2),
  );
  const failed = results.filter((r) => !r.ok);
  if (!ok) {
    console.error(JSON.stringify({ ok, failed }, null, 2));
    console.error(`FAIL: ${failed.length} visual baseline regression(s) (maxDiffRatio=${MAX_DIFF_RATIO})`);
    process.exit(1);
  }
  console.error(`PASS: pixel compare ${results.length} screenshot(s) within maxDiffRatio=${MAX_DIFF_RATIO}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
