/**
 * Hospitality visual acceptance harness (Sandbox).
 *
 * Captures representative staff routes and asserts structural hospitality
 * markers on the rendered DOM — not merely that CSS class strings exist in
 * source files. Baselines live under docs/design/hospitality-visual-baselines/.
 *
 * Usage (local, with .env.local Supabase admin):
 *   npx tsx scripts/qa/hospitality-visual-baselines.mts
 *   npx tsx scripts/qa/hospitality-visual-baselines.mts --update-baselines
 */
import { createClient } from "@supabase/supabase-js";
import * as ssrUtils from "@supabase/ssr";
import { chromium, type Page } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve("docs/design/hospitality-visual-baselines");
const UPDATE = process.argv.includes("--update-baselines");
const BASE = "https://app.sandbox.hellotocheers.com";

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
    key: "templates",
    path: "/library",
    assertions: async (page) => ({
      hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
      title: await page.title(),
    }),
  },
];

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
  return ssrUtils.createChunks(cookieName, encoded).map((c) => ({
    name: c.name,
    value: c.value,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  }));
}

const REQUIRED: Record<string, (v: Record<string, boolean | number | string>) => boolean> = {
  "reporting-overview": (v) =>
    Number(v.metricTiles) >= 6 && Boolean(v.hasBusinessFunnel) && Boolean(v.hasOutstandingTone),
  dashboard: (v) => Boolean(v.hospitalityPage),
  leads: (v) => Boolean(v.hospitalityPage) && Boolean(v.toolbar),
  clients: (v) => Boolean(v.hospitalityPage) && Boolean(v.toolbar),
  billing: (v) => Boolean(v.hospitalityPage),
  templates: (v) => Boolean(v.hospitalityPage),
};

async function main() {
  mkdirSync(`${ROOT}/current`, { recursive: true });
  mkdirSync(`${ROOT}/approved`, { recursive: true });
  const cookies = await authCookies();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookies);
  const page = await context.newPage();
  const report: Record<string, unknown> = { at: new Date().toISOString(), routes: {} };
  let failed = 0;

  for (const route of routes) {
    await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(400);
    const shot = `${ROOT}/current/${route.key}.png`;
    await page.screenshot({ path: shot, fullPage: false });
    if (UPDATE || !existsSync(`${ROOT}/approved/${route.key}.png`)) {
      writeFileSync(`${ROOT}/approved/${route.key}.png`, readFileSync(shot));
    }
    const assertions = await route.assertions(page);
    const ok = REQUIRED[route.key]?.(assertions) ?? true;
    if (!ok) failed += 1;
    report.routes[route.key] = { ok, assertions, shot };
  }

  await browser.close();
  writeFileSync(`${ROOT}/last-run.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failed > 0) {
    console.error(`FAIL: ${failed} route(s) failed hospitality visual assertions`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
