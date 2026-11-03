/**
 * Phase 11C — Reports corrections verification screenshots (Saved + Sales).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const ORIG = "/Users/jensmac/Developer/wevenu-website";
config({ path: `${ORIG}/.env.local`, quiet: true });
const require = createRequire(`${ORIG}/marketing/package.json`);
const { chromium } = require("playwright");
const ssr = require(`${ORIG}/node_modules/@supabase/ssr/dist/main/utils/index.js`);

const OUT = `${ORIG}/docs/qa/staff-light-canvas/phase11-cohesive-redesign/11c-reports-corrections-calendar-design`;
const EVID = join(OUT, "evidence", "reports");
const DESKTOP = "/Users/jensmac/Desktop/htc-phase11c-reports-corrections";
mkdirSync(EVID, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const APP = process.env.HTC_CAPTURE_BASE ?? "http://127.0.0.1:3000";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});
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

const routes = [
  { label: "saved", path: "/reporting/saved" },
  { label: "sales", path: "/reporting/sales" },
  { label: "overview", path: "/reporting" },
];

const viewports = [
  { width: 1440, height: 900, tag: "desktop" },
  { width: 390, height: 844, tag: "mobile-390" },
  { width: 375, height: 812, tag: "mobile-375" },
];

const browser = await chromium.launch();
const results: Record<string, unknown>[] = [];

for (const route of routes) {
  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    await ctx.addCookies(cookies);
    await ctx.addInitScript(`window.localStorage.setItem("theme","light")`);
    const page = await ctx.newPage();
    const res = await page.goto(`${APP}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(2500);

    const probe = await page.evaluate(`(() => {
      const bodyText = document.body?.innerText || "";
      const templatesLink = [...document.querySelectorAll("a")].find((a) =>
        /^\\s*Templates\\s*$/i.test((a.textContent || "").trim()) ||
        /←\\s*Templates/i.test(a.textContent || "")
      );
      const kpis = document.querySelector("[data-sales-leads-kpis]");
      const method = document.querySelector("[data-sales-leads-method]");
      const leadsTitle = [...document.querySelectorAll("h1,h2,h3,[class*=CardTitle]")].find((el) =>
        /Leads from this period/i.test(el.textContent || "")
      );
      let kpiAfterTitle = null;
      let methodAfterKpi = null;
      if (leadsTitle && kpis) {
        const pos = leadsTitle.compareDocumentPosition(kpis);
        kpiAfterTitle = (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      }
      if (kpis && method) {
        const pos = kpis.compareDocumentPosition(method);
        methodAfterKpi = (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      }
      const kpiTop = kpis ? Math.round(kpis.getBoundingClientRect().top) : null;
      return {
        h1: document.querySelector("h1")?.textContent?.trim() || null,
        url: location.pathname,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        hasTemplatesBreadcrumbText: /←\\s*Templates|\\bTemplates\\b/.test(
          (document.querySelector("[data-htc-phase10=reporting]")?.innerText || "").slice(0, 400),
        ) && Boolean(templatesLink),
        templatesHref: templatesLink?.getAttribute("href") || null,
        templatesText: templatesLink?.textContent?.trim() || null,
        hasLeadsKpis: Boolean(kpis),
        hasMethodDetails: Boolean(method),
        kpiAfterTitle,
        methodAfterKpi,
        kpiTop,
        introAccent: Boolean(document.querySelector(".htc-hospitality-intro-accent")),
        activeTab: document.querySelector("[data-report-tab-active=true]")?.getAttribute("data-report-tab"),
        bodyHasHowCalculated: /How these numbers are calculated/i.test(bodyText),
      };
    })()`);

    const file = `${route.label}-${vp.tag}.png`;
    const path = join(EVID, file);
    await page.screenshot({ path, fullPage: false });
    copyFileSync(path, join(DESKTOP, file));

    if (route.label === "sales" && vp.tag.startsWith("mobile") && (await page.locator("[data-sales-leads-method] summary").count())) {
      await page.locator("[data-sales-leads-method] summary").click();
      await page.waitForTimeout(300);
      const openFile = `${route.label}-${vp.tag}-method-open.png`;
      const openPath = join(EVID, openFile);
      await page.screenshot({ path: openPath, fullPage: false });
      copyFileSync(openPath, join(DESKTOP, openFile));
      results.push({ label: route.label, viewport: `${vp.tag}-method-open`, screenshot: openPath });
    }

    results.push({
      label: route.label,
      viewport: vp.tag,
      status: res?.status() ?? null,
      screenshot: path,
      ...probe,
    });
    await ctx.close();
  }
}

await browser.close();
writeFileSync(join(OUT, "reports-browser-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({
  label: (r as { label: string }).label,
  vp: (r as { viewport: string }).viewport,
  status: (r as { status?: number }).status,
  templates: (r as { hasTemplatesBreadcrumbText?: boolean }).hasTemplatesBreadcrumbText,
  templatesHref: (r as { templatesHref?: string | null }).templatesHref,
  kpiTop: (r as { kpiTop?: number | null }).kpiTop,
  kpiAfterTitle: (r as { kpiAfterTitle?: boolean | null }).kpiAfterTitle,
  methodAfterKpi: (r as { methodAfterKpi?: boolean | null }).methodAfterKpi,
  overflowX: (r as { overflowX?: boolean }).overflowX,
  activeTab: (r as { activeTab?: string }).activeTab,
})), null, 2));
console.log("Desktop →", DESKTOP);
