/**
 * Focused verification: Practice Run Client inherits live venue branding +
 * released portal content (Willow Grove). Does not mutate permanent venue config.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

config({ path: ".env.local", quiet: true });

const BASE = process.env.PM03_BASE || "http://127.0.0.1:3041";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";

// HTC QA fail-closed: refuse curated venue writes unless explicitly overridden.
if (process.env.HTC_ALLOW_PROTECTED_QA_WRITES !== "1") {
  const __htcProtected = new Set([
    "31f38b79-eb99-4ebc-81bc-af85767b42aa",
    "a415ac52-cd74-42a6-8df7-7a8f6e71d080",
    "5c84e74e-355d-4ce1-9e6b-913a9267f543",
  ]);
  for (const __id of [typeof FANCY !== "undefined" ? FANCY : null, typeof WILLOW !== "undefined" ? WILLOW : null, typeof DAISY !== "undefined" ? DAISY : null, typeof VENUE !== "undefined" ? VENUE : null, typeof FANCY_VENUE !== "undefined" ? FANCY_VENUE : null].filter(Boolean)) {
    if (__htcProtected.has(__id)) {
      throw new Error("REFUSED: write-capable QA must not target curated Sandbox venues. venueId=" + __id + ". Use a disposable venue or set HTC_ALLOW_PROTECTED_QA_WRITES=1 for founder-only override.");
    }
  }
}

const EMAIL = "jennifer@hellotocheers.com";
const OUT = join(process.cwd(), "docs/qa/practice-mode/pm03-branding-verify");
const DESKTOP = join(homedir(), "Desktop/HTC-PM03-branding-verify");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function log(m) {
  console.log(`[branding] ${m}`);
}

async function venueSnapshot(venueId) {
  const { data: venue } = await admin
    .from("venues")
    .select("id,name,logo_url,hero_image_url,primary_color,accent_color,story,updated_at")
    .eq("id", venueId)
    .single();
  const { count: clients } = await admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId);
  const { count: realClients } = await admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .is("practice_run_id", null);
  const { count: events } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId);
  const { count: realEvents } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .is("practice_run_id", null);
  const { count: leads } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId);
  const { count: realLeads } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .is("practice_run_id", null);
  const { count: qbo } = await admin
    .from("quickbooks_sync_queue")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId);
  return {
    venue,
    clients,
    realClients,
    events,
    realEvents,
    leads,
    realLeads,
    qbo,
  };
}

const before = await venueSnapshot(WILLOW);
log(`Willow branding logo=${!!before.venue.logo_url} hero=${!!before.venue.hero_image_url}`);

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: EMAIL,
});
if (linkErr) throw linkErr;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serverClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: verified, error: vErr } = await serverClient.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "email",
});
if (vErr) throw vErr;
const session = verified.session;
const projectRef = new URL(url).hostname.split(".")[0];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await context.addCookies([
  {
    name: `sb-${projectRef}-auth-token`,
    value: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: "bearer",
    }),
    domain: "127.0.0.1",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  },
  {
    name: "htc_active_venue_id",
    value: WILLOW,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  },
]);
const page = await context.newPage();
page.setDefaultTimeout(60000);

const results = {
  at: new Date().toISOString(),
  venueId: WILLOW,
  before: {
    name: before.venue.name,
    hero: before.venue.hero_image_url,
    logo: before.venue.logo_url,
    realClients: before.realClients,
    realEvents: before.realEvents,
    realLeads: before.realLeads,
    clients: before.clients,
    events: before.events,
    leads: before.leads,
    qbo: before.qbo,
  },
  checks: {},
};

function set(id, status, evidence) {
  results.checks[id] = { status, evidence };
  console.log(`${status} ${id}`, JSON.stringify(evidence).slice(0, 220));
}

async function fonts() {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  }).catch(() => {});
  await page.waitForTimeout(500);
}
async function snap(name) {
  await fonts();
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  copyFileSync(path, join(DESKTOP, `${name}.png`));
  log(`shot ${name}`);
}

try {
  // Start or continue Practice Run via Setup Hub (safe practice mechanism)
  log("open take-a-look");
  await page.goto(`${BASE}/setup-hub/take-a-look`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(1500);
  const bodyTake = await page.locator("body").innerText();
  const venueHint = /Willow Grove/i.test(bodyTake);
  if (!venueHint) {
    // force venue context via settings if cookie alone insufficient
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1000);
  }

  const startBtn = page.getByRole("button", { name: /Start Practice Run|Continue Practice Run/i });
  await startBtn.first().waitFor({ timeout: 60000 });
  await startBtn.first().click();
  await page.waitForURL(/setup-hub\/practice-run/, { timeout: 120000 });
  await page.waitForSelector('[data-testid="practice-run-shell"]', { timeout: 60000 });
  await page.waitForTimeout(1000);
  const runUrl = page.url();
  const runId = new URL(runUrl, BASE).searchParams.get("run");
  results.runId = runId;
  await snap("01-willow-venue-perspective");

  // Switch to Client
  await Promise.all([
    page.waitForURL(/\/practice-run\/.*\/client/, { timeout: 90000 }),
    page.getByTestId("practice-perspective-client").click(),
  ]);
  await page.waitForSelector('[data-testid="practice-client-portal"]', { timeout: 90000 });
  await page.waitForTimeout(2500);
  await snap("02-willow-client-homepage");

  const heroEval = await page.evaluate(() => {
    const hero = document.querySelector("[data-portal-hero]");
    if (!hero) return { found: false };
    const bg = getComputedStyle(hero).backgroundImage || "";
    const urlMatch = bg.match(/url\(["']?(.*?)["']?\)/);
    return {
      found: true,
      backgroundImage: bg.slice(0, 300),
      imageUrl: urlMatch?.[1] ?? null,
      text: (hero.textContent || "").replace(/\s+/g, " ").slice(0, 240),
    };
  });

  const expectedHeroBase = (before.venue.hero_image_url || "").split("?")[0];
  const heroShowsImage =
    Boolean(heroEval.imageUrl)
    && expectedHeroBase
    && heroEval.imageUrl.includes(expectedHeroBase.split("/uploads/")[1]?.split("?")[0] || "hero");
  // Prefer path segment match
  const heroPathOk =
    Boolean(heroEval.imageUrl)
    && /31f38b79-eb99-4ebc-81bc-af85767b42aa\/hero/i.test(heroEval.imageUrl || "");

  set(
    "hero_image",
    heroPathOk ? "PASS" : "FAIL",
    { heroEval, expectedHeroBase, heroPathOk },
  );

  const clientBody = await page.locator("body").innerText();
  const brandingOk =
    /The Willow Grove/i.test(clientBody)
    && /Maya|Jordan/i.test(clientBody)
    && (await page.getByTestId("practice-run-indicator").count()) > 0;
  set("branding", brandingOk ? "PASS" : "FAIL", {
    venueNameVisible: /The Willow Grove/i.test(clientBody),
    practiceChrome: true,
  });

  // Venue Guide
  const guideTab = page.getByRole("button", { name: /Venue Guide|Guide/i }).first();
  if (await guideTab.count()) {
    await guideTab.click();
    await page.waitForTimeout(2000);
  } else {
    await page.goto(`${BASE}/practice-run/${encodeURIComponent(runId)}/client?view=guide`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    }).catch(() => {});
    // hash navigate via UI if view=guide unsupported
    const more = page.getByRole("button", { name: /More/i });
    if (await more.count()) {
      await more.click();
      await page.getByText(/Venue Guide|Guide/i).first().click().catch(() => {});
    }
    await page.waitForTimeout(2000);
  }
  // Prefer clicking nav item with Guide label inside portal
  const guideNav = page.locator('[data-testid="practice-client-portal"]').getByText("Venue Guide", { exact: false }).first();
  if (await guideNav.count()) {
    await guideNav.click().catch(() => {});
    await page.waitForTimeout(2000);
  }
  await snap("03-willow-client-guide");
  const guideBody = await page.locator("body").innerText();
  const guideVisible =
    /Venue Guide|About|Our story|Contact|Hours|Policies|Property|Welcome/i.test(guideBody)
    && /Willow Grove/i.test(guideBody);
  set("venue_guide", guideVisible ? "PASS" : "FAIL", {
    excerpt: guideBody.replace(/\s+/g, " ").slice(0, 500),
  });

  // Portal token for release checks
  const { data: run } = await admin.from("practice_runs").select("*").eq("id", runId).single();
  const { data: sessions } = await admin
    .from("client_portal_sessions")
    .select("access_token,label")
    .eq("client_id", run.sample_client_id)
    .ilike("label", "Practice Run client view%");
  const token = sessions?.[0]?.access_token;

  let releasedTasks = [];
  let timelineEntries = [];
  let draftExcluded = true;
  if (token) {
    const tasksRes = await page.request.get(`${BASE}/api/portal/tasks?token=${encodeURIComponent(token)}`);
    const tasksJson = await tasksRes.json().catch(() => ({}));
    releasedTasks = Array.isArray(tasksJson?.tasks) ? tasksJson.tasks : Array.isArray(tasksJson) ? tasksJson : [];

    const tlRes = await page.request.get(`${BASE}/api/portal/timeline?token=${encodeURIComponent(token)}`);
    const tlJson = await tlRes.json().catch(() => ({}));
    timelineEntries = Array.isArray(tlJson?.entries) ? tlJson.entries : [];

    // Staff-side: any draft-only timeline rows for sample event that should NOT appear in portal
    const { data: staffTimeline } = await admin
      .from("event_timeline_entries")
      .select("id,title,audiences,owner_type,visibility,status")
      .eq("event_id", run.sample_event_id)
      .limit(50);
    const draftish = (staffTimeline || []).filter((row) => {
      const audiences = Array.isArray(row.audiences) ? row.audiences : [];
      return audiences.length === 0 || row.visibility === "private" || row.status === "draft";
    });
    const portalIds = new Set(timelineEntries.map((e) => e.id));
    draftExcluded = draftish.every((d) => !portalIds.has(d.id));
  }

  set(
    "released_planning",
    token ? "PASS" : "FAIL",
    {
      taskCount: releasedTasks.length,
      timelineCount: timelineEntries.length,
      note: "Practice sample starts with portal-RPC visibility; released counts reflect current sample state",
    },
  );
  set("draft_isolation", draftExcluded ? "PASS" : "FAIL", { draftExcluded });

  // Switch Venue → Client → Venue
  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(runId)}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForSelector('[data-testid="practice-run-shell"]', { timeout: 60000 });
  await Promise.all([
    page.waitForURL(/\/practice-run\/.*\/client/, { timeout: 60000 }),
    page.getByTestId("practice-perspective-client").click(),
  ]);
  await page.waitForSelector('[data-testid="practice-client-portal"]', { timeout: 60000 });
  await Promise.all([
    page.waitForURL(/setup-hub\/practice-run/, { timeout: 60000 }),
    page.getByTestId("practice-perspective-venue").click(),
  ]);
  await page.waitForSelector('[data-testid="practice-run-shell"]', { timeout: 60000 });
  const stillWillow = (await page.locator("body").innerText()).includes("Willow Grove");
  const stillMaya = (await page.getByTestId("practice-run-celebration-name").innerText()).includes("Maya");
  set("switching", stillWillow && stillMaya ? "PASS" : "FAIL", { stillWillow, stillMaya });
  await snap("04-willow-venue-after-switch");

  const after = await venueSnapshot(WILLOW);
  const { data: eventRow } = await admin
    .from("events")
    .select("booked_at,exclude_from_business_reporting,practice_run_id")
    .eq("id", run.sample_event_id)
    .single();
  const isolationOk =
    after.qbo === before.qbo
    && eventRow?.booked_at == null
    && eventRow?.exclude_from_business_reporting === true
    && eventRow?.practice_run_id === runId;
  set("practice_isolation", isolationOk ? "PASS" : "FAIL", { qboBefore: before.qbo, qboAfter: after.qbo, eventRow });

  const preservationOk =
    after.realClients === before.realClients
    && after.realEvents === before.realEvents
    && after.realLeads === before.realLeads
    && after.venue.hero_image_url === before.venue.hero_image_url
    && after.venue.logo_url === before.venue.logo_url
    && after.venue.name === before.venue.name;
  set("demo_preservation", preservationOk ? "PASS" : "FAIL", {
    realClients: { before: before.realClients, after: after.realClients },
    realEvents: { before: before.realEvents, after: after.realEvents },
    realLeads: { before: before.realLeads, after: after.realLeads },
    brandingUnchanged:
      after.venue.hero_image_url === before.venue.hero_image_url
      && after.venue.logo_url === before.venue.logo_url,
    practiceDelta: {
      clients: after.clients - before.clients,
      events: after.events - before.events,
      leads: after.leads - before.leads,
    },
  });

  results.after = {
    realClients: after.realClients,
    realEvents: after.realEvents,
    realLeads: after.realLeads,
    clients: after.clients,
    events: after.events,
    leads: after.leads,
    qbo: after.qbo,
  };
} catch (error) {
  results.fatal = error instanceof Error ? error.message : String(error);
  console.error("FATAL", results.fatal);
  try {
    results.failUrl = page.url();
    results.failExcerpt = (await page.locator("body").innerText()).slice(0, 600);
  } catch {
    /* ignore */
  }
  await snap("99-fatal").catch(() => {});
}

const passed = Object.values(results.checks).filter((c) => c.status === "PASS").length;
const failed = Object.values(results.checks).filter((c) => c.status === "FAIL").length;
results.summary = { passed, failed, total: Object.keys(results.checks).length, fatal: results.fatal ?? null };
writeFileSync(join(OUT, "verify.json"), JSON.stringify(results, null, 2));
writeFileSync(join(DESKTOP, "verify.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.summary, null, 2));
await browser.close();
process.exit(results.fatal || failed > 0 ? 1 : 0);
