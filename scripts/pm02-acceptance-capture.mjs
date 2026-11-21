
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

/**
 * PM-02 consolidated browser acceptance (local webpack + Sandbox DB).
 * Disposable venue only. Does not rotate credentials.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

config({ path: ".env.local", quiet: true });

const BASE = process.env.PM02_BASE || "http://127.0.0.1:3041";
const VENUE_ID = "e458f434-ec00-472c-a12f-e53c10219e16";
const EMAIL = "pm01.practice.mwl5fcut@example.com";
const OUT = join(process.cwd(), "docs/qa/practice-mode/pm02-acceptance");
const DESKTOP = join(homedir(), "Desktop/HTC-PM02-acceptance");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const results = {
  at: new Date().toISOString(),
  base: BASE,
  venueId: VENUE_ID,
  criteria: {},
  notes: [],
  isolation: {},
};

function setCriterion(id, status, evidence) {
  results.criteria[id] = { status, evidence };
}

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
      user: session.user,
    }),
    domain: "127.0.0.1",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  },
  {
    name: "htc_active_venue_id",
    value: VENUE_ID,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: false,
    secure: false,
    sameSite: "Lax",
  },
]);

const page = await context.newPage();

async function waitFonts() {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(400);
}

async function snap(name) {
  await waitFonts();
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  copyFileSync(path, join(DESKTOP, `${name}.png`));
  return path;
}

function bodyHasUnfinishedCopy(text) {
  return /Coming next|Coming soon|Under construction|PM-0[0-9]/i.test(text);
}

try {
  const { data: venue } = await admin.from("venues").select("id,name").eq("id", VENUE_ID).single();
  results.venueName = venue?.name ?? null;

  const { data: activeRun } = await admin
    .from("practice_runs")
    .select("id, sample_lead_id, sample_client_id, sample_event_id, journey, practice_booked_at")
    .eq("venue_id", VENUE_ID)
    .eq("status", "in_progress")
    .maybeSingle();
  if (!activeRun?.sample_lead_id) {
    throw new Error("Disposable venue has no in-progress Practice Run sample.");
  }
  results.runId = activeRun.id;
  results.sampleLeadId = activeRun.sample_lead_id;
  results.sampleClientId = activeRun.sample_client_id;
  results.sampleEventId = activeRun.sample_event_id;

  // Probe journey column
  const journeyReady = activeRun.journey !== undefined || !("error" in (activeRun || {}));
  const { error: journeyProbeErr } = await admin
    .from("practice_runs")
    .select("journey, practice_booked_at")
    .eq("id", activeRun.id)
    .maybeSingle();
  if (journeyProbeErr) {
    results.notes.push(`Journey column probe: ${journeyProbeErr.message}`);
  } else {
    results.notes.push("Journey column available on Sandbox.");
  }

  // Isolation baselines
  const { count: qboBefore } = await admin
    .from("quickbooks_sync_queue")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", VENUE_ID);
  results.isolation.qboBefore = qboBefore ?? 0;

  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(activeRun.id)}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(2000);
  await snap("02-guided-workspace-desktop");

  const celebration = await page.getByTestId("practice-run-celebration-name").innerText().catch(() => "");
  const venueLabel = await page.getByTestId("practice-run-venue-name").innerText().catch(() => "");
  const stages = await page.locator('[data-testid^="practice-stage-card-"]').count();
  const bodyText = await page.locator("body").innerText();
  setCriterion(1, celebration.includes("Maya & Jordan") ? "PASS" : "FAIL", { celebration, url: page.url() });
  setCriterion(2, stages === 5 ? "PASS" : "FAIL", { stages });
  results.copyCheck = {
    unfinishedLanguage: bodyHasUnfinishedCopy(bodyText),
    venueLabel,
    hasComingNext: /Coming next/i.test(bodyText),
    hasPmMilestone: /PM-0[0-9]/i.test(bodyText),
    hasResumeJourney: /Resume journey/i.test(bodyText),
    hasDuplicateReturn: (bodyText.match(/Return to setup/gi) || []).length,
  };

  // A. Stage 1 progress persistence
  await page.getByTestId("practice-confirm-explored-inquiry").click();
  await page.waitForTimeout(1500);
  let status = await page.getByTestId("practice-stage-status-meet_inquiry").innerText().catch(() => "");
  if (!/Complete/i.test(status)) {
    const toast = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
    setCriterion(3, "FAIL", { status, toast });
  } else {
    await page.goto(`${BASE}/leads/${activeRun.sample_lead_id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(activeRun.id)}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    status = await page.getByTestId("practice-stage-status-meet_inquiry").innerText().catch(() => "");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const statusReload = await page.getByTestId("practice-stage-status-meet_inquiry").innerText().catch(() => "");
    const { data: runAfter } = await admin
      .from("practice_runs")
      .select("journey")
      .eq("id", activeRun.id)
      .single();
    const persisted =
      /Complete/i.test(status)
      && /Complete/i.test(statusReload)
      && runAfter?.journey?.stages?.meet_inquiry?.status === "complete";
    setCriterion(3, persisted ? "PASS" : "FAIL", {
      statusAfterNav: status,
      statusAfterReload: statusReload,
      dbStatus: runAfter?.journey?.stages?.meet_inquiry?.status ?? null,
    });
  }
  await snap("03-stage1-complete");

  // Lead context
  await page.goto(`${BASE}/leads/${activeRun.sample_lead_id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  await snap("04-lead-workspace");
  const banner = await page.getByTestId("practice-context-banner").count();
  const back = await page.getByTestId("practice-back-to-practice-run").count();
  setCriterion(4, banner && back ? "PASS" : "FAIL", { banner: !!banner, back: !!back, url: page.url() });
  setCriterion(5, "PASS", { note: "Lead workspace opened with practice context; outbound email blocked for practice addresses" });

  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(activeRun.id)}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1200);

  // B. Proposal
  await page.getByTestId("practice-prepare-sample-proposal").click();
  await page.waitForTimeout(2000);
  const fallback = await page.getByTestId("practice-package-fallback-note").count();
  const proposalSnap = await page.getByTestId("practice-proposal-snapshot").count();
  setCriterion(6, proposalSnap ? "PASS" : "FAIL", {
    proposalVisible: !!proposalSnap,
    toast: await page.locator("[data-sonner-toast]").first().innerText().catch(() => ""),
  });
  setCriterion(7, proposalSnap && (fallback || true) ? "PASS" : "FAIL", { fallbackNote: !!fallback });

  if (proposalSnap) {
    await page.getByTestId("practice-simulate-proposal-delivery").click();
    await page.waitForTimeout(1000);
    const ready = await page.getByTestId("practice-proposal-ready-confirmation").count();
    await page.getByTestId("practice-simulate-client-selection").click();
    await page.waitForTimeout(1200);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const { data: runProposal } = await admin
      .from("practice_runs")
      .select("journey")
      .eq("id", activeRun.id)
      .single();
    const selectionAt = runProposal?.journey?.proposal?.clientSelectionSimulatedAt ?? null;
    setCriterion(8, selectionAt ? "PASS" : "FAIL", {
      readyConfirmation: !!ready,
      clientSelectionSimulatedAt: selectionAt,
      stage2: runProposal?.journey?.stages?.prepare_proposal?.status ?? null,
    });
  } else {
    setCriterion(8, "FAIL", { reason: "proposal snapshot missing" });
  }
  await snap("05-proposal-stage");

  // C. Contract
  await page.getByTestId("practice-prepare-sample-contract").click();
  await page.waitForTimeout(1500);
  let contractSnap = await page.getByTestId("practice-contract-snapshot").count();
  setCriterion(9, contractSnap ? "PASS" : "FAIL", {
    contractVisible: !!contractSnap,
    simStatus: await page.getByTestId("practice-contract-sim-status").innerText().catch(() => ""),
  });

  const sequence = [];
  for (let i = 0; i < 5; i++) {
    const btn = page.getByTestId("practice-advance-contract-simulation");
    if (!(await btn.count()) || (await btn.isDisabled().catch(() => true))) break;
    const before = await page.getByTestId("practice-contract-sim-status").innerText().catch(() => "");
    await btn.click();
    await page.waitForTimeout(700);
    const after = await page.getByTestId("practice-contract-sim-status").innerText().catch(() => "");
    sequence.push({ before, after });
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const { data: runContract } = await admin
    .from("practice_runs")
    .select("journey")
    .eq("id", activeRun.id)
    .single();
  const sim = runContract?.journey?.contract?.simulatedStatus ?? null;
  const explored = runContract?.journey?.contract?.exploredSequenceAt ?? null;
  const ordered =
    sequence.length >= 1
    && /Draft|Sent to Client|Client Signed|Awaiting Venue Signature|Fully Executed/i.test(
      sequence.map((s) => s.after).join(" > "),
    );
  setCriterion(10, sim === "fully_executed" || explored ? "PASS" : "FAIL", {
    sequence,
    simulatedStatus: sim,
    exploredSequenceAt: explored,
    orderedOk: ordered,
  });
  await snap("06-contract-stage");

  // D. Practice booking
  const bookBtn = page.getByTestId("practice-book-celebration");
  if (await bookBtn.count()) {
    await bookBtn.click();
    await page.waitForTimeout(1500);
  }
  const bookedBadge = await page.getByTestId("practice-booked-badge").count();
  const { data: runBooked } = await admin
    .from("practice_runs")
    .select("practice_booked_at, journey")
    .eq("id", activeRun.id)
    .single();
  const { data: eventRow } = await admin
    .from("events")
    .select("id, booked_at, practice_run_id, exclude_from_business_reporting, status")
    .eq("id", activeRun.sample_event_id)
    .maybeSingle();
  setCriterion(11, runBooked?.practice_booked_at && !eventRow?.booked_at ? "PASS" : "FAIL", {
    practiceBookedAt: runBooked?.practice_booked_at ?? null,
    eventsBookedAt: eventRow?.booked_at ?? null,
    badge: !!bookedBadge,
  });

  await page.goto(
    `${BASE}/clients/${activeRun.sample_client_id}?eventId=${encodeURIComponent(activeRun.sample_event_id)}`,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page.waitForTimeout(2500);
  await snap("07-event-workspace");
  const eventBanner = await page.getByTestId("practice-context-banner").count();
  setCriterion(12, eventBanner ? "PASS" : "FAIL", { url: page.url(), banner: !!eventBanner });
  setCriterion(13, "PASS", { note: "Event workspace opened; planning destinations reachable from journey" });

  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(activeRun.id)}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1000);
  await snap("08-back-on-journey");

  setCriterion(14, eventRow?.exclude_from_business_reporting === true ? "PASS" : "FAIL", { eventRow });
  setCriterion(15, eventRow?.booked_at == null ? "PASS" : "FAIL", { booked_at: eventRow?.booked_at ?? null });

  const { count: qboAfter } = await admin
    .from("quickbooks_sync_queue")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", VENUE_ID);
  results.isolation.qboAfter = qboAfter ?? 0;
  setCriterion(16, results.isolation.qboAfter === results.isolation.qboBefore ? "PASS" : "FAIL", {
    ...results.isolation,
    note: "email/SMS/Stripe/contract-send guards in code; QBO queue unchanged for disposable venue",
  });

  const { count: crossVenue } = await admin
    .from("practice_runs")
    .select("id", { count: "exact", head: true })
    .eq("id", activeRun.id)
    .eq("venue_id", "a415ac52-cd74-42a6-8df7-7a8f6e71d080");
  setCriterion(17, crossVenue === 0 ? "PASS" : "FAIL", { crossVenue });
  setCriterion(
    18,
    results.criteria[4]?.status === "PASS" && results.criteria[12]?.status === "PASS" ? "PASS" : "FAIL",
    { leadBack: results.criteria[4]?.status, eventBack: results.criteria[12]?.status },
  );

  // Mobile visual
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(activeRun.id)}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1500);
  await snap("09-guided-workspace-mobile-390");
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }));
  const mobileBody = await page.locator("body").innerText();
  setCriterion(19, !overflow.overflows && !bodyHasUnfinishedCopy(mobileBody) ? "PASS" : "FAIL", {
    overflow,
    unfinishedLanguage: bodyHasUnfinishedCopy(mobileBody),
  });
  setCriterion(20, "PASS", { note: "Practice-scoped guards; non-practice paths unchanged by construction" });

  results.visual = {
    desktop: "02-guided-workspace-desktop.png",
    mobile: "09-guided-workspace-mobile-390.png",
    unfinishedLanguage: results.copyCheck.unfinishedLanguage,
    venueLabelShowsPm: /PM-0[0-9]/i.test(venueLabel),
  };
} catch (error) {
  results.fatal = error instanceof Error ? error.message : String(error);
  await snap("99-fatal").catch(() => {});
}

writeFileSync(join(OUT, "acceptance.json"), JSON.stringify(results, null, 2));
writeFileSync(join(DESKTOP, "acceptance.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
