/**
 * Corrected-path follow-up for matrix routes that 404'd on guessed paths.
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
    title: await page.title(),
    url: page.url(),
  };
}

const ROUTES = [
  { key: "settings-business", path: "/settings/business" },
  { key: "settings-team", path: "/settings/team" },
  { key: "setup-profiles", path: "/settings/leads/setup-profiles" },
  { key: "setup-hub-canonical", path: "/setup-hub" },
  { key: "guide", path: "/guide" },
  { key: "library-documents", path: "/library/documents" },
  { key: "availability", path: "/settings/availability" },
  { key: "help", path: "/help" },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cookies = await authCookies();
  const browser = await chromium.launch({ headless: true });
  const report: Record<string, unknown> = { at: new Date().toISOString(), base: BASE, routes: {} };

  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await context.addCookies(cookies);
    const page = await context.newPage();
    for (const route of ROUTES) {
      const res = await page.goto(`${BASE}${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(700);
      const shot = `${OUT}/${route.key}__${vp.name}.png`;
      await page.screenshot({ path: shot, fullPage: false });
      const assertions = { ...(await shellProbe(page)), httpStatus: String(res?.status() ?? "nav") };
      const routes = report.routes as Record<string, Record<string, unknown>>;
      if (!routes[route.key]) routes[route.key] = { path: route.path, assertions: {}, shots: {} };
      (routes[route.key].shots as Record<string, string>)[vp.name] = shot;
      if (vp.name === "desktop") {
        routes[route.key].assertions = assertions;
        routes[route.key].verdict =
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
  writeFileSync(`${OUT}/matrix-wave-corrected.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
