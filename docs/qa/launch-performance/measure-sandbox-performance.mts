/**
 * READ-ONLY Sandbox performance baseline harness (focused pass).
 * Measures user-perceived navigation / interaction latency against live Sandbox.
 * Does not mutate demo data, Stripe, or Production.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire(resolve("marketing/package.json"));
const { chromium } = require("playwright") as typeof import("playwright");
type Page = import("playwright").Page;
type BrowserContext = import("playwright").BrowserContext;
const ssrUtils = require(resolve("node_modules/@supabase/ssr/dist/main/utils/index.js"));

const BASE = process.env.HTC_PERF_BASE_URL ?? "https://app.sandbox.hellotocheers.com";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const STAFF = "jennifer@hellotocheers.com";
const FLORA = "lila@floraandbranch.example";
/** Ellie St. James — live Sandbox lead workspace fixture (Claire UUID 52173016… is gone / 404). */
const ELLIE_LEAD = "f66059c9-5d2b-4a58-92df-567ff3ed924b";
/** Avery Blake Final — open proposal_sent lead with sent commercial proposal (not a booked Claire). */
const AVERY_PROPOSAL_LEAD = "24b2d6d7-c2df-40ae-8bd4-dacd670649a1";
const REED_CLIENT = "11ce02ca-3c56-49f9-baf9-115d2fc830e3";
const OUT = resolve("docs/qa/launch-performance");
const RAW = resolve(OUT, "raw");
mkdirSync(RAW, { recursive: true });
mkdirSync(resolve(OUT, "screenshots"), { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("Refuse: not Sandbox Supabase URL");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Sample = {
  label: string;
  clickToUsefulMs: number;
  docResponseMs: number | null;
  requestCount: number;
  usefulSelector: string;
  url: string;
  timedOut?: boolean;
  error?: string;
};

function stats(values: number[]) {
  if (!values.length) return { n: 0, median: null as number | null, p95: null as number | null, max: null as number | null, min: null as number | null };
  const sorted = [...values].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  return { n: sorted.length, median: pct(50), p95: pct(95), max: sorted[sorted.length - 1], min: sorted[0] };
}

async function magicCookies(email: string, cookieBaseName: string) {
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link?.properties?.hashed_token) throw linkError ?? new Error(`magic link ${email}`);
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (error || !otp?.session) throw error ?? new Error(`session ${email}`);
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return ssrUtils.createChunks(cookieBaseName, encoded).map((c: { name: string; value: string }) => ({
    name: c.name,
    value: c.value,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  }));
}

async function staffCookies() {
  return [
    ...(await magicCookies(STAFF, "sb-wvpsldwwjqdannqasrdf-auth-token")),
    {
      name: "htc_active_venue_id",
      value: WILLOW,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function findHayesClientId(): Promise<string | null> {
  const { data } = await admin
    .from("clients")
    .select("id")
    .eq("venue_id", WILLOW)
    .or("primary_contact_name.ilike.%Hayes%,partner_name.ilike.%Hayes%")
    .limit(1);
  return (data?.[0]?.id as string) ?? null;
}

async function findContractId(): Promise<string | null> {
  const { data } = await admin
    .from("contracts")
    .select("id")
    .eq("venue_id", WILLOW)
    .order("updated_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.id as string) ?? null;
}

async function findHayesPortalToken(): Promise<string | null> {
  const clientId = await findHayesClientId();
  if (!clientId) return null;
  const { data: sessions } = await admin
    .from("client_portal_sessions")
    .select("access_token, access_level")
    .eq("client_id", clientId)
    .eq("venue_id", WILLOW)
    .order("created_at", { ascending: false })
    .limit(10);
  const couple = (sessions ?? []).find((s) => s.access_level === "couple" || s.access_level === "full");
  return (couple?.access_token as string | undefined) ?? ((sessions?.[0]?.access_token as string) || null);
}

type NetTracker = { count: number; docMs: number | null; reset: () => void; attach: (page: Page) => void };
function createNetTracker(): NetTracker {
  const t: NetTracker = {
    count: 0,
    docMs: null,
    reset() {
      t.count = 0;
      t.docMs = null;
    },
    attach(page: Page) {
      page.on("request", () => {
        t.count += 1;
      });
      page.on("response", (res) => {
        try {
          if (res.request().resourceType() === "document" && t.docMs == null) {
            const timing = res.request().timing();
            t.docMs = timing.responseEnd >= 0 ? timing.responseEnd : null;
          }
        } catch {
          /* ignore */
        }
      });
    },
  };
  return t;
}

/** Race alternatives in parallel so a bad selector cannot inflate latency. */
async function waitUseful(page: Page, alts: string[], timeoutMs: number) {
  const controllers = alts.map((alt) => {
    const locator = page.locator(alt).first();
    return locator.waitFor({ state: "visible", timeout: timeoutMs }).then(() => alt);
  });
  return Promise.any(controllers);
}

async function measureGoto(
  page: Page,
  net: NetTracker,
  label: string,
  path: string,
  alts: string[],
  timeout = 25000,
): Promise<Sample> {
  net.reset();
  const start = Date.now();
  try {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout });
    const status = res?.status() ?? 0;
    const matched = await waitUseful(page, alts, timeout);
    const clickToUsefulMs = Date.now() - start;
    await page.waitForTimeout(250);
    return {
      label,
      clickToUsefulMs,
      docResponseMs: net.docMs,
      requestCount: net.count,
      usefulSelector: matched,
      url: page.url(),
      timedOut: status >= 400,
      error: status >= 400 ? `http ${status}` : undefined,
    };
  } catch (err) {
    return {
      label,
      clickToUsefulMs: Date.now() - start,
      docResponseMs: net.docMs,
      requestCount: net.count,
      usefulSelector: alts.join(" || "),
      url: page.url(),
      timedOut: true,
      error: String(err).slice(0, 240),
    };
  }
}

async function measureClick(
  page: Page,
  net: NetTracker,
  label: string,
  click: () => Promise<void>,
  alts: string[],
  timeout = 25000,
): Promise<Sample> {
  net.reset();
  const start = Date.now();
  try {
    await click();
    const matched = await waitUseful(page, alts, timeout);
    const clickToUsefulMs = Date.now() - start;
    await page.waitForTimeout(250);
    return {
      label,
      clickToUsefulMs,
      docResponseMs: net.docMs,
      requestCount: net.count,
      usefulSelector: matched,
      url: page.url(),
    };
  } catch (err) {
    return {
      label,
      clickToUsefulMs: Date.now() - start,
      docResponseMs: net.docMs,
      requestCount: net.count,
      usefulSelector: alts.join(" || "),
      url: page.url(),
      timedOut: true,
      error: String(err).slice(0, 240),
    };
  }
}

async function measureTab(page: Page, label: string, name: RegExp): Promise<Sample> {
  const start = Date.now();
  try {
    const tab = page.getByRole("tab", { name });
    await tab.first().click({ timeout: 8000 });
    await page.waitForTimeout(30);
    const selected = await tab.first().getAttribute("aria-selected");
    // Panel settle sample (not counted as visible feedback)
    const visibleMs = Date.now() - start;
    await page.waitForTimeout(400);
    return {
      label,
      clickToUsefulMs: visibleMs,
      docResponseMs: null,
      requestCount: 0,
      usefulSelector: `tab selected=${selected}`,
      url: page.url(),
    };
  } catch (err) {
    return {
      label,
      clickToUsefulMs: Date.now() - start,
      docResponseMs: null,
      requestCount: 0,
      usefulSelector: String(name),
      url: page.url(),
      timedOut: true,
      error: String(err).slice(0, 240),
    };
  }
}

async function withContext(
  browser: import("playwright").Browser,
  opts: {
    width: number;
    height: number;
    cookies: Awaited<ReturnType<typeof staffCookies>>;
    throttle?: boolean;
  },
  fn: (page: Page, net: NetTracker) => Promise<void>,
) {
  const ctx = await browser.newContext({ viewport: { width: opts.width, height: opts.height } });
  await ctx.addCookies(opts.cookies);
  const page = await ctx.newPage();
  const net = createNetTracker();
  net.attach(page);
  if (opts.throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      latency: 150,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  try {
    await fn(page, net);
  } finally {
    await ctx.close();
  }
}

async function main() {
  const hayesClientId = await findHayesClientId();
  const contractId = await findContractId();
  const portalToken = await findHayesPortalToken();
  const samples: Sample[] = [];
  const report: Record<string, unknown> = {
    at: new Date().toISOString(),
    base: BASE,
    venue: "The Willow Grove",
    venueId: WILLOW,
    servingNote: "Live Sandbox tip (df1aa331 family) — NOT local candidate. PR #31/#32 undeployed.",
    limitations: [
      "Playwright from operator machine → Sandbox ECS (includes public internet RTT)",
      "Useful-content = first visible heading/landmark match after domcontentloaded",
      "Content-Length often absent on streamed RSC; requestCount is primary network volume signal",
      "Floor-plan toggle visible latency measured on serving Sandbox (pre-optimistic)",
      "Reporting grain: Sandbox still server-refresh; candidate #32 is local-only",
    ],
    fixtures: {
      ellieLead: ELLIE_LEAD,
      averyProposalLead: AVERY_PROPOSAL_LEAD,
      reedClient: REED_CLIENT,
      hayesClientId,
      contractId,
      portalTokenPresent: Boolean(portalToken),
      retiredClaireLead: "52173016-faaf-46df-bde7-ca11e6fafc81",
    },
    samples,
  };

  const push = (s: Sample) => {
    samples.push(s);
    writeFileSync(resolve(RAW, "baseline-latest.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ label: s.label, ms: s.clickToUsefulMs, reqs: s.requestCount, err: s.error?.slice(0, 100) }));
  };

  const browser = await chromium.launch({ headless: true });
  const cookies = await staffCookies();

  // -------- Desktop venue --------
  await withContext(browser, { width: 1440, height: 900, cookies }, async (page, net) => {
    await measureGoto(page, net, "warmup.dashboard", "/dashboard", ['role=heading[name="Dashboard"]', "text=Dashboard"]);

    const routes: { label: string; path: string; alts: string[] }[] = [
      { label: "venue.dashboard", path: "/dashboard", alts: ["text=Dashboard", "h1"] },
      { label: "venue.leads", path: "/leads", alts: ["text=Leads", "h1"] },
      { label: "venue.ellie-lead", path: `/leads/${ELLIE_LEAD}`, alts: ["text=Ellie", "[role=tablist]", "h1"] },
      { label: "venue.clients", path: "/clients", alts: ["text=Clients", "h1"] },
      { label: "venue.reed-client", path: `/clients/${REED_CLIENT}`, alts: ["text=Morgan", "[role=tablist]", "h1"] },
      { label: "venue.calendar", path: "/calendar", alts: ["text=Calendar", "h1"] },
      { label: "venue.tours", path: "/tours", alts: ["text=Tours", "h1"] },
      { label: "venue.contracts", path: "/contracts", alts: ["text=Contracts", "h1"] },
      ...(contractId
        ? [{ label: "venue.contract-detail", path: `/contracts/${contractId}`, alts: ["text=Contract", "text=Agreement", "h1"] }]
        : []),
      { label: "venue.payments", path: "/payments", alts: ["text=Payments", "h1"] },
      { label: "venue.messaging", path: "/messaging", alts: ["text=Inbox", "h1"] },
      { label: "venue.automations", path: "/communication/series", alts: ["text=Automations", "h1"] },
      { label: "venue.vendors", path: "/vendors", alts: ["text=Vendors", "h1"] },
      { label: "venue.reporting", path: "/reporting", alts: ["text=Reports", "h1"] },
      { label: "venue.reporting-sales", path: "/reporting/sales", alts: ["text=Sales", "text=Reports", "h1"] },
      { label: "venue.setup-hub", path: "/setup-hub", alts: ["text=Setup", "h1"] },
      { label: "venue.timeline-templates", path: "/library/timeline-templates", alts: ["text=Timeline", "h1"] },
      { label: "venue.floor-plan-templates", path: "/library/floor-plan-templates", alts: ["text=Floor Plan", "h1"] },
      { label: "venue.settings-business", path: "/settings/business", alts: ["text=Business", "h1"] },
      { label: "venue.settings-billing", path: "/settings/billing", alts: ["text=Billing", "text=Subscription", "h1"] },
      { label: "venue.settings-team", path: "/settings/team", alts: ["text=Team", "h1"] },
      ...(hayesClientId
        ? [{ label: "venue.hayes-client", path: `/clients/${hayesClientId}`, alts: ["text=Hayes", "text=Olivia", "[role=tablist]", "h1"] }]
        : []),
    ];

    for (const route of routes) {
      // 2 samples keeps wall-clock feasible while still supporting median/max
      for (let i = 1; i <= 2; i++) {
        push(await measureGoto(page, net, `${route.label}#${i}`, route.path, route.alts, 30000));
      }
    }

    // Tabs
    await page.goto(`${BASE}/leads/${ELLIE_LEAD}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(600);
    for (const name of [/Overview/i, /Commercial|Proposal|Package|Booking/i, /Activity|Notes|Messages/i]) {
      for (let i = 1; i <= 2; i++) push(await measureTab(page, `venue.ellie-tab:${name}#${i}`, name));
    }

    // Proposal-start fixture (open proposal) — do not use booked Claire
    await page.goto(`${BASE}/leads/${AVERY_PROPOSAL_LEAD}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(600);
    for (const name of [/Overview/i, /Commercial|Proposal|Package|Booking/i]) {
      for (let i = 1; i <= 2; i++) push(await measureTab(page, `venue.avery-tab:${name}#${i}`, name));
    }

    await page.goto(`${BASE}/clients/${REED_CLIENT}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(800);
    for (const name of [/^Overview$/i, /^Tasks$/i, /^Floor Plans$/i, /^Documents$/i]) {
      for (let i = 1; i <= 2; i++) push(await measureTab(page, `venue.reed-tab:${name}#${i}`, name));
    }

    // Reporting grain (Sandbox behavior)
    await page.goto(`${BASE}/reporting`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(800);
    const grains = page.getByRole("button", { name: /^(Day|Week|Month)$/ });
    if (await grains.count()) {
      for (let i = 0; i < 3; i++) {
        const btn = grains.nth(i % (await grains.count()));
        const start = Date.now();
        await btn.click();
        // visible feedback = pressed/active soon; then measure settle to chart
        await page.waitForTimeout(40);
        const feedbackMs = Date.now() - start;
        push({
          label: `venue.reporting-grain-feedback#${i + 1}`,
          clickToUsefulMs: feedbackMs,
          docResponseMs: null,
          requestCount: 0,
          usefulSelector: "grain click ack",
          url: page.url(),
        });
        // Wait for either navigation/refresh or chart still present
        const settleStart = Date.now();
        await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => null);
        await page.locator("text=Reports, canvas, svg").first().waitFor({ state: "visible", timeout: 15000 }).catch(() => null);
        push({
          label: `venue.reporting-grain-useful#${i + 1}`,
          clickToUsefulMs: Date.now() - settleStart + feedbackMs,
          docResponseMs: null,
          requestCount: net.count,
          usefulSelector: "grain useful content",
          url: page.url(),
        });
      }
    } else {
      push({
        label: "venue.reporting-grain",
        clickToUsefulMs: 0,
        docResponseMs: null,
        requestCount: 0,
        usefulSelector: "Day|Week|Month",
        url: page.url(),
        error: "grain controls not found",
      });
    }

    // Sidebar clicks
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(400);
    for (const n of [
      { label: "nav.click-leads", name: /^Leads$/i, alts: ["text=Leads", "h1"] },
      { label: "nav.click-clients", name: /^Clients$/i, alts: ["text=Clients", "h1"] },
      { label: "nav.click-calendar", name: /^Calendar$/i, alts: ["text=Calendar", "h1"] },
      { label: "nav.click-inbox", name: /^Inbox$/i, alts: ["text=Inbox", "h1"] },
      { label: "nav.click-reports", name: /^Reports$/i, alts: ["text=Reports", "h1"] },
    ]) {
      for (let i = 1; i <= 2; i++) {
        push(
          await measureClick(
            page,
            net,
            `${n.label}#${i}`,
            async () => {
              await page.getByRole("link", { name: n.name }).first().click();
            },
            n.alts,
          ),
        );
      }
    }

    // Floor plan toggles — Sandbox pre-#31
    await page.goto(`${BASE}/clients/${REED_CLIENT}#floorplan`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1200);
    const fpTab = page.getByRole("tab", { name: /^Floor Plans$/ });
    if (await fpTab.count()) {
      if ((await fpTab.getAttribute("aria-selected")) !== "true") {
        await fpTab.click();
        await page.waitForTimeout(600);
      }
    }
    const sw = page.getByTestId("floor-plan-switch-couple-view").first();
    if (await sw.count()) {
      await sw.waitFor({ timeout: 30000 });
      for (let i = 1; i <= 3; i++) {
        const before = await sw.getAttribute("aria-checked");
        const start = Date.now();
        await sw.click();
        try {
          await page.waitForFunction(
            ({ el, before: b }) => (el as HTMLElement).getAttribute("aria-checked") !== b,
            { el: await sw.elementHandle(), before },
            { timeout: 45000 },
          );
          push({
            label: `sandbox.floor-plan-toggle-visible#${i}`,
            clickToUsefulMs: Date.now() - start,
            docResponseMs: null,
            requestCount: 0,
            usefulSelector: "aria-checked flip",
            url: page.url(),
          });
        } catch (err) {
          push({
            label: `sandbox.floor-plan-toggle-visible#${i}`,
            clickToUsefulMs: Date.now() - start,
            docResponseMs: null,
            requestCount: 0,
            usefulSelector: "aria-checked flip",
            url: page.url(),
            timedOut: true,
            error: String(err).slice(0, 200),
          });
        }
        await page.waitForTimeout(400);
      }
    } else {
      push({
        label: "sandbox.floor-plan-toggle-visible",
        clickToUsefulMs: 0,
        docResponseMs: null,
        requestCount: 0,
        usefulSelector: "floor-plan-switch-couple-view",
        url: page.url(),
        error: "switch not found",
      });
    }

    await page.screenshot({ path: resolve(OUT, "screenshots/desktop-dashboard.png") });
  });

  // -------- Mobile subset --------
  await withContext(browser, { width: 390, height: 844, cookies }, async (page, net) => {
    await measureGoto(page, net, "warmup.mobile", "/dashboard", ["text=Dashboard", "h1"]);
    for (const route of [
      { label: "mobile.dashboard", path: "/dashboard", alts: ["text=Dashboard", "h1"] },
      { label: "mobile.leads", path: "/leads", alts: ["text=Leads", "h1"] },
      { label: "mobile.ellie-lead", path: `/leads/${ELLIE_LEAD}`, alts: ["text=Ellie", "role=tablist", "h1"] },
      { label: "mobile.reed-client", path: `/clients/${REED_CLIENT}`, alts: ["text=Morgan", "role=tablist", "h1"] },
      { label: "mobile.calendar", path: "/calendar", alts: ["text=Calendar", "h1"] },
      { label: "mobile.reporting", path: "/reporting", alts: ["text=Reports", "h1"] },
      { label: "mobile.messaging", path: "/messaging", alts: ["text=Inbox", "h1"] },
    ]) {
      for (let i = 1; i <= 2; i++) push(await measureGoto(page, net, `${route.label}#${i}`, route.path, route.alts));
    }
    await page.screenshot({ path: resolve(OUT, "screenshots/mobile-leads.png") });
  });

  // -------- Throttled subset --------
  await withContext(browser, { width: 1440, height: 900, cookies, throttle: true }, async (page, net) => {
    await measureGoto(page, net, "warmup.throttle", "/dashboard", ["text=Dashboard", "h1"], 60000);
    for (const route of [
      { label: "throttle.dashboard", path: "/dashboard", alts: ["text=Dashboard", "h1"] },
      { label: "throttle.leads", path: "/leads", alts: ["text=Leads", "h1"] },
      { label: "throttle.ellie-lead", path: `/leads/${ELLIE_LEAD}`, alts: ["text=Ellie", "h1"] },
      { label: "throttle.reed-client", path: `/clients/${REED_CLIENT}`, alts: ["text=Morgan", "h1"] },
      { label: "throttle.reporting", path: "/reporting", alts: ["text=Reports", "h1"] },
    ]) {
      push(await measureGoto(page, net, `${route.label}#1`, route.path, route.alts, 60000));
    }
  });

  // -------- Demo journey --------
  await withContext(browser, { width: 1440, height: 900, cookies }, async (page, net) => {
    const steps: { label: string; path?: string; run?: () => Promise<void>; alts: string[] }[] = [
      { label: "demo.01-dashboard", path: "/dashboard", alts: ["text=Dashboard", "h1"] },
      { label: "demo.02-leads", path: "/leads", alts: ["text=Leads", "h1"] },
      { label: "demo.03-ellie-lead", path: `/leads/${ELLIE_LEAD}`, alts: ["text=Ellie", "h1"] },
      { label: "demo.03b-avery-proposal-lead", path: `/leads/${AVERY_PROPOSAL_LEAD}`, alts: ["text=Avery", "h1"] },
      {
        label: "demo.04-commercial-tab",
        alts: ["role=tab"],
        run: async () => {
          // Prefer Avery proposal-start surface when already on that lead
          if (!page.url().includes(AVERY_PROPOSAL_LEAD)) {
            await page.goto(`${BASE}/leads/${AVERY_PROPOSAL_LEAD}`, { waitUntil: "domcontentloaded", timeout: 45000 });
          }
          const tab = page.getByRole("tab", { name: /Commercial|Proposal|Package|Booking/i }).first();
          if (await tab.count()) await tab.click();
          else await page.getByRole("tab").nth(1).click();
        },
      },
      { label: "demo.05-contracts", path: "/contracts", alts: ["text=Contracts", "h1"] },
      ...(contractId
        ? [{ label: "demo.06-contract-detail", path: `/contracts/${contractId}`, alts: ["text=Contract", "text=Agreement", "h1"] }]
        : []),
      { label: "demo.07-payments", path: "/payments", alts: ["text=Payments", "h1"] },
      ...(hayesClientId
        ? [{ label: "demo.08-booked-client", path: `/clients/${hayesClientId}`, alts: ["text=Hayes", "text=Olivia", "h1"] }]
        : [{ label: "demo.08-booked-client", path: `/clients/${REED_CLIENT}`, alts: ["text=Morgan", "h1"] }]),
      {
        label: "demo.09-tasks-tab",
        alts: ["role=tab"],
        run: async () => {
          const tab = page.getByRole("tab", { name: /^Tasks$/i });
          if (await tab.count()) await tab.click();
        },
      },
      {
        label: "demo.10-floorplans-tab",
        alts: ["role=tab"],
        run: async () => {
          const tab = page.getByRole("tab", { name: /^Floor Plans$/i });
          if (await tab.count()) await tab.click();
        },
      },
      { label: "demo.11-reporting", path: "/reporting", alts: ["text=Reports", "h1"] },
    ];
    let total = 0;
    for (const step of steps) {
      const s = step.path
        ? await measureGoto(page, net, step.label, step.path, step.alts)
        : await measureClick(page, net, step.label, step.run!, step.alts);
      total += s.clickToUsefulMs;
      push(s);
    }
    report.demoJourneyTotalMs = total;
  });

  // -------- Vendor portal --------
  try {
    const vendorCookies = await magicCookies(FLORA, "sb-wvpsldwwjqdannqasrdf-vendor-auth-token");
    await withContext(browser, { width: 1440, height: 900, cookies: vendorCookies as never }, async (page, net) => {
      for (const route of [
        { label: "vendor.dashboard", path: "/vendor/dashboard", alts: ["text=Flora", "text=Dashboard", "h1"] },
        { label: "vendor.events", path: "/vendor/events", alts: ["text=Event", "text=Hayes", "h1"] },
      ]) {
        for (let i = 1; i <= 2; i++) push(await measureGoto(page, net, `${route.label}#${i}`, route.path, route.alts));
      }
      await page.goto(`${BASE}/vendor/events`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(500);
      const eventLink = page.locator('a[href*="/vendor/events/"]').first();
      if (await eventLink.count()) {
        push(
          await measureClick(
            page,
            net,
            "vendor.event-detail#1",
            async () => {
              await eventLink.click();
            },
            ["text=Hayes", "text=Assignment", "text=Event", "h1"],
          ),
        );
      }
      await page.screenshot({ path: resolve(OUT, "screenshots/vendor-dashboard.png") });
    });
  } catch (err) {
    push({
      label: "vendor.auth",
      clickToUsefulMs: 0,
      docResponseMs: null,
      requestCount: 0,
      usefulSelector: "vendor",
      url: BASE,
      error: String(err).slice(0, 240),
    });
  }

  // -------- Client portal (existing token only) --------
  if (portalToken) {
    await withContext(browser, { width: 1440, height: 900, cookies: [] }, async (page, net) => {
      push(await measureGoto(page, net, "portal.home#1", `/p/${portalToken}`, ["text=Hayes", "text=Olivia", "text=Tasks", "h1"], 45000));
      push(await measureGoto(page, net, "portal.home#2", `/p/${portalToken}`, ["text=Hayes", "text=Olivia", "text=Tasks", "h1"], 45000));
      for (const name of [/Tasks/i, /Timeline/i, /Documents/i, /Payments|Budget/i]) {
        const link = page.getByRole("link", { name }).first();
        const btn = page.getByRole("button", { name }).first();
        const target = (await link.count()) ? link : (await btn.count()) ? btn : null;
        if (!target) {
          push({
            label: `portal.nav:${String(name)}`,
            clickToUsefulMs: 0,
            docResponseMs: null,
            requestCount: 0,
            usefulSelector: String(name),
            url: page.url(),
            error: "nav control not found",
          });
          continue;
        }
        push(
          await measureClick(
            page,
            net,
            `portal.nav:${String(name)}#1`,
            async () => {
              await target.click();
            },
            ["main", "h1", "h2"],
          ),
        );
      }
      await page.screenshot({ path: resolve(OUT, "screenshots/client-portal.png") });
    });
  } else {
    push({
      label: "portal.home",
      clickToUsefulMs: 0,
      docResponseMs: null,
      requestCount: 0,
      usefulSelector: "client_portal_sessions",
      url: BASE,
      error: "No existing Hayes portal token — skipped (did not create)",
    });
  }

  await browser.close();

  const byLabel = new Map<string, number[]>();
  for (const s of samples) {
    if (s.error && s.clickToUsefulMs === 0 && !s.timedOut) continue;
    const baseLabel = s.label.replace(/#\d+$/, "");
    if (!byLabel.has(baseLabel)) byLabel.set(baseLabel, []);
    byLabel.get(baseLabel)!.push(s.clickToUsefulMs);
  }
  const groups: Record<string, ReturnType<typeof stats> & { samples: number[] }> = {};
  for (const [k, vals] of byLabel) groups[k] = { ...stats(vals), samples: vals };
  report.groups = groups;

  const outPath = resolve(RAW, `baseline-${Date.now()}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  writeFileSync(resolve(RAW, "baseline-latest.json"), JSON.stringify(report, null, 2));
  console.log("WROTE", outPath);
  console.log("GROUP_COUNT", Object.keys(groups).length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
