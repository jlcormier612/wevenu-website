/**
 * Full-restoration matrix evidence wave: desktop + mobile shots + hospitality probes
 * for remaining BLOCKED routes. Read-only against live Sandbox.
 *
 * Writes docs/design/hospitality-restore-sandbox/recovery-evidence/matrix-wave/
 */
import { createClient } from "@supabase/supabase-js";
import * as ssrUtils from "@supabase/ssr";
import { chromium, type Page } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const OUT = resolve("docs/design/hospitality-restore-sandbox/recovery-evidence/matrix-wave");
const BASE = process.env.HTC_VISUAL_BASE_URL ?? "https://app.sandbox.hellotocheers.com";

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

async function shellProbe(page: Page) {
  return {
    hospitality: await page.locator(".htc-hospitality-page").count(),
    workingCard: await page.locator(".htc-working-card").count(),
    heading: await page.locator("h1, h2").count(),
    phase12: await page.locator("[data-phase12], .htc-phase-12").count(),
    toolbar: await page.locator(".htc-toolbar, [data-toolbar]").count(),
    title: await page.title(),
    url: page.url(),
  };
}

const ROUTES: { key: string; path: string }[] = [
  { key: "dashboard-shell", path: "/dashboard" },
  { key: "leads-list", path: "/leads" },
  { key: "clients-list", path: "/clients" },
  { key: "tours", path: "/tours" },
  { key: "calendar", path: "/calendar" },
  { key: "contracts", path: "/contracts" },
  { key: "proposals", path: "/proposals" },
  { key: "packages", path: "/packages" },
  { key: "payments", path: "/payments" },
  { key: "vendors", path: "/vendors" },
  { key: "messaging-inbox", path: "/messaging" },
  { key: "automations", path: "/communication/series" },
  { key: "timeline-templates", path: "/library/timeline-templates" },
  { key: "floor-plan-templates", path: "/library/floor-plan-templates" },
  { key: "questionnaire-templates", path: "/library/questionnaire-templates" },
  { key: "event-order-templates", path: "/library/event-order-templates" },
  { key: "tasks", path: "/tasks" },
  { key: "documents", path: "/documents" },
  { key: "guides", path: "/guides" },
  { key: "wedding-websites", path: "/wedding-websites" },
  { key: "setup-hub", path: "/setup" },
  { key: "setup-profiles", path: "/setup/profiles" },
  { key: "venue-settings", path: "/settings/venue" },
  { key: "branding", path: "/settings/branding" },
  { key: "spaces", path: "/settings/spaces" },
  { key: "staff", path: "/settings/staff" },
  { key: "billing", path: "/settings/billing" },
  { key: "reporting-overview", path: "/reporting" },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cookies = await authCookies();
  const browser = await chromium.launch({ headless: true });
  const report: Record<string, unknown> = {
    at: new Date().toISOString(),
    base: BASE,
    servingNote: "Live Sandbox df1aa331 tip — read-only evidence for matrix",
    routes: {} as Record<string, unknown>,
  };

  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await context.addCookies(cookies);
    const page = await context.newPage();
    for (const route of ROUTES) {
      const key = `${route.key}__${vp.name}`;
      let status = "ok";
      try {
        const res = await page.goto(`${BASE}${route.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await page.waitForTimeout(800);
        status = String(res?.status() ?? "nav");
      } catch (err) {
        status = `error:${(err as Error).message.slice(0, 120)}`;
      }
      const shot = `${OUT}/${key}.png`;
      try {
        await page.screenshot({ path: shot, fullPage: false });
      } catch {
        /* page may be crashed */
      }
      const assertions = await shellProbe(page).catch(() => ({
        hospitality: -1,
        workingCard: -1,
        heading: -1,
        phase12: -1,
        toolbar: -1,
        title: "probe-failed",
        url: page.url(),
      }));
      const routes = report.routes as Record<string, Record<string, unknown>>;
      if (!routes[route.key]) {
        routes[route.key] = { path: route.path, assertions: {}, shots: {} };
      }
      const entry = routes[route.key];
      (entry.shots as Record<string, string>)[vp.name] = shot;
      if (vp.name === "desktop") {
        entry.assertions = { ...assertions, httpStatus: status };
        entry.verdict =
          assertions.hospitality > 0
            ? "PASS_SHELL"
            : assertions.heading > 0
              ? "FAIL_NO_HOSPITALITY"
              : "BLOCKED_EMPTY";
      }
    }
    await context.close();
  }

  await browser.close();
  writeFileSync(`${OUT}/matrix-wave.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
