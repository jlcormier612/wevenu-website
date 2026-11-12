/**
 * Extra hospitality restoration evidence: attention nav, relationship photos,
 * multi-venue switcher, and a template editor — desktop + mobile.
 *
 * Writes to docs/design/hospitality-restore-sandbox/recovery-evidence/
 */
import { createClient } from "@supabase/supabase-js";
import * as ssrUtils from "@supabase/ssr";
import { chromium, type Page } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const OUT = resolve("docs/design/hospitality-restore-sandbox/recovery-evidence");
const BASE = "https://app.sandbox.hellotocheers.com";

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

type Probe = {
  key: string;
  path: string;
  probe: (page: Page) => Promise<Record<string, boolean | number | string>>;
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cookies = await authCookies();
  const browser = await chromium.launch({ headless: true });
  const report: Record<string, unknown> = { at: new Date().toISOString(), base: BASE, routes: {} };

  // Resolve a concrete lead + timeline template for deep links.
  const boot = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await boot.addCookies(cookies);
  const bootPage = await boot.newPage();
  await bootPage.goto(`${BASE}/leads`, { waitUntil: "networkidle", timeout: 60000 });
  const leadHref =
    (await bootPage.locator('a[href^="/leads/"]').first().getAttribute("href")) ?? "/leads";
  await bootPage.goto(`${BASE}/library/timeline-templates`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  const timelineHref =
    (await bootPage.locator('a[href*="/library/timeline-templates/"]').first().getAttribute("href")) ??
    "/library/timeline-templates";
  await boot.close();

  const probes: Probe[] = [
    {
      key: "attention-dashboard",
      path: "/dashboard",
      probe: async (page) => ({
        hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
        needsAttentionText: (await page.getByText(/Needs attention/i).count()) > 0,
        navAttentionFetch: await page.evaluate(async () => {
          try {
            const res = await fetch("/api/navigation/attention");
            return res.status;
          } catch {
            return -1;
          }
        }),
        sidebarBadgeNodes: await page.locator("[data-attention-badge], .htc-badge-attention").count(),
      }),
    },
    {
      key: "multi-venue-header",
      path: "/dashboard",
      probe: async (page) => ({
        venueSwitcher: (await page.locator('[data-testid="venue-switcher"], [aria-label*="venue" i]').count()) > 0
          || (await page.getByRole("button", { name: /venue|switch/i }).count()) > 0
          || (await page.locator("text=/Jen.?s Fancy Venue|Hello to Cheers/i").count()) > 0,
        headerPresent: (await page.locator("header").count()) > 0,
      }),
    },
    {
      key: "relationship-lead",
      path: leadHref,
      probe: async (page) => ({
        leadPath: leadHref,
        photoAvatar: (await page.locator('[data-testid="relationship-photo-avatar"], img[alt*="photo" i]').count()) > 0
          || (await page.locator(".htc-relationship-photo, [data-relationship-photo]").count()) > 0,
        hospitalityOrTabs: (await page.locator(".htc-hospitality-page, [data-relationship-tabs]").count()) > 0,
        tabShell: (await page.locator(".htc-record-link, [role='tablist']").count()) > 0,
      }),
    },
    {
      key: "timeline-template-editor",
      path: timelineHref,
      probe: async (page) => ({
        editorPath: timelineHref,
        hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
        workingCard: (await page.locator(".htc-working-card").count()) > 0,
      }),
    },
    {
      key: "billing-cards",
      path: "/settings/billing",
      probe: async (page) => ({
        hospitalityPage: (await page.locator(".htc-hospitality-page").count()) > 0,
        orgOrSubscriptionText:
          (await page.getByText(/subscription|billing|plan|organization/i).count()) > 0,
      }),
    },
  ];

  for (const vp of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await context.addCookies(cookies);
    const page = await context.newPage();
    for (const probe of probes) {
      const key = `${probe.key}__${vp.name}`;
      await page.goto(`${BASE}${probe.path}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(500);
      const shot = `${OUT}/${key}.png`;
      await page.screenshot({ path: shot, fullPage: false });
      if (vp.name === "desktop") {
        const assertions = await probe.probe(page);
        report.routes[probe.key] = { assertions, shots: { desktop: shot } };
      } else {
        const entry = report.routes[probe.key] as { shots?: Record<string, string> };
        if (entry?.shots) entry.shots.mobile = shot;
      }
    }
    await context.close();
  }

  await browser.close();
  writeFileSync(`${OUT}/evidence.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
