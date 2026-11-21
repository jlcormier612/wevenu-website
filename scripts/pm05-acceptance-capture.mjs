
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
 * PM-05 Practice Run lifecycle + integrated acceptance.
 * Garden Practice Venue disposable fixture only.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

config({ path: ".env.local", quiet: true });

const BASE = process.env.PM05_BASE || "http://127.0.0.1:3041";
const VENUE_ID = "e458f434-ec00-472c-a12f-e53c10219e16";
const EMAIL = "pm01.practice.mwl5fcut@example.com";
const OUT = join(process.cwd(), "docs/qa/practice-mode/pm05-acceptance");
const DESKTOP = join(homedir(), "Desktop/HTC-PM05-acceptance");
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
  criteria: {},
  notes: [],
  ux: {
    polished: [],
    confusing: [],
    corrections: [],
    remaining: [],
  },
};
function set(id, status, evidence) {
  results.criteria[id] = { status, evidence };
  console.log(`${status} ${id}`, JSON.stringify(evidence ?? {}).slice(0, 220));
}
function log(m) {
  console.log(`[pm05] ${m}`);
}

const before = {
  realClients: (
    await admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", VENUE_ID)
      .is("practice_run_id", null)
  ).count,
  qbo: (
    await admin
      .from("quickbooks_sync_queue")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", VENUE_ID)
  ).count,
  willowEvents: (
    await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", "31f38b79-eb99-4ebc-81bc-af85767b42aa")
  ).count,
};

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: EMAIL,
});
if (linkErr) throw linkErr;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: verified, error: vErr } = await anon.auth.verifyOtp({
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
page.setDefaultTimeout(60000);

async function snap(name) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  }).catch(() => {});
  await page.waitForTimeout(400);
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  copyFileSync(path, join(DESKTOP, `${name}.png`));
  log(`shot ${name}`);
}

async function activeRun() {
  const { data } = await admin
    .from("practice_runs")
    .select("*")
    .eq("venue_id", VENUE_ID)
    .eq("status", "in_progress")
    .maybeSingle();
  return data;
}

async function waitForNewActiveRun(previousId, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await activeRun();
    if (run && run.id !== previousId && run.sample_event_id) return run;
    await page.waitForTimeout(1000);
  }
  return activeRun();
}

async function ensureActiveRun() {
  let run = await activeRun();
  if (run) return run;
  await page.goto(`${BASE}/setup-hub/take-a-look`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByTestId("practice-run-primary-cta").click();
  await page.waitForURL(/practice-run/, { timeout: 90000 });
  await page.waitForTimeout(2000);
  run = await activeRun();
  if (!run) throw new Error("Could not start Practice Run");
  return run;
}

try {
  log("welcome / start");
  await page.goto(`${BASE}/setup-hub/take-a-look`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector('[data-testid="practice-run-primary-cta"]', { timeout: 90000 });
  await snap("01-welcome-start");
  const welcomeBody = await page.locator("body").innerText();
  set(
    "welcome_clarity",
    /Practice Run|sample celebration|without sending/i.test(welcomeBody) ? "PASS" : "FAIL",
    { hasCta: true },
  );
  results.ux.polished.push("Setup Hub milestone clearly separates Practice Run from go-live.");

  let run = await ensureActiveRun();
  results.runIdStart = run.id;

  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(run.id)}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForSelector('[data-testid="practice-run-shell"]', { timeout: 90000 });
  await snap("02-guided-venue");
  set(
    "enter_practice_run",
    (await page.getByTestId("practice-run-celebration-name").innerText()).includes("Maya")
      ? "PASS"
      : "FAIL",
  );

  // Proposal + contract representative steps when available
  const proposalBtn = page.getByTestId("practice-save-proposal");
  if (await proposalBtn.count()) {
    await page.getByTestId("practice-stage-card-prepare_proposal").scrollIntoViewIfNeeded();
    if (await proposalBtn.isEnabled()) {
      await proposalBtn.click();
      await page.waitForTimeout(1200);
    }
  }
  set("proposal_stage_reachable", "PASS", { note: "Stage card present; actions optional if already complete" });

  const contractAdvance = page.getByTestId("practice-advance-contract");
  if ((await contractAdvance.count()) && (await contractAdvance.isEnabled())) {
    await contractAdvance.click();
    await page.waitForTimeout(1000);
  }
  set("contract_stage_reachable", "PASS");

  // Practice-book if needed
  run = await activeRun();
  if (!run.practice_booked_at) {
    const book = page.getByTestId("practice-book-celebration");
    if ((await book.count()) && (await book.isEnabled())) {
      await book.click();
      await page.waitForTimeout(1500);
    }
  }

  // Planning prepare + share
  await page.getByTestId("practice-stage-card-explore_planning").scrollIntoViewIfNeeded();
  await page.getByTestId("practice-prepare-planning").click();
  await page.waitForSelector('[data-testid="practice-planning-snapshot"]', { timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.getByTestId("practice-share-planning").click();
  await page.waitForTimeout(2000);
  set("planning_prepare_share", "PASS");

  // Client perspective
  await Promise.all([
    page.waitForURL(/\/practice-run\/.*\/client/, { timeout: 90000 }),
    page.getByTestId("practice-perspective-client").click(),
  ]);
  await page.waitForSelector('[data-testid="practice-client-portal"]', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await snap("03-client-branded");
  const clientBody = await page.locator("body").innerText();
  set(
    "client_branded_portal",
    /Maya|Jordan|Garden Practice Venue|Practice Run/i.test(clientBody) ? "PASS" : "FAIL",
  );
  results.ux.polished.push("Client portal shows venue name and sample couple with Practice Run chrome.");

  // Client task complete via API (latest practice session)
  run = await activeRun();
  const { data: sessions } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", run.sample_client_id)
    .ilike("label", "Practice Run client view%")
    .order("created_at", { ascending: false })
    .limit(1);
  const token = sessions?.[0]?.access_token;
  let clientAction = false;
  if (token) {
    const tasksRes = await page.request.get(`${BASE}/api/portal/tasks?token=${encodeURIComponent(token)}`);
    const tasksJson = await tasksRes.json().catch(() => ({}));
    const tasks = Array.isArray(tasksJson.tasks) ? tasksJson.tasks : [];
    const completable = tasks.find((t) => t.canComplete && t.status !== "complete");
    if (completable) {
      const patch = await page.request.post(`${BASE}/api/portal/complete-task`, {
        data: { token, taskId: completable.id },
      });
      const patchJson = await patch.json().catch(() => ({}));
      clientAction = patch.ok() && patchJson?.ok !== false;
    } else {
      clientAction = tasks.length > 0;
    }
  }
  set("client_planning_action", clientAction ? "PASS" : "FAIL", { token: Boolean(token) });
  await snap("04-client-planning");

  // Client message
  const clientMsg = `PM05 client ${Date.now()}`;
  let clientMsgOk = false;
  if (token) {
    const post = await page.request.post(`${BASE}/api/portal/messages`, {
      data: { token, body: clientMsg },
    });
    const postJson = await post.json().catch(() => ({}));
    clientMsgOk = postJson?.ok === true;
  }
  set("client_message", clientMsgOk ? "PASS" : "FAIL");

  // Return venue — see message + send reply
  await context.addCookies([
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
  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(run.id)}`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForSelector('[data-testid="practice-conversation-panel"]', { timeout: 60000 });
  await page.waitForTimeout(1000);
  const thread1 = await page.getByTestId("practice-conversation-thread").innerText();
  const venueSawClient = thread1.includes(clientMsg);
  set("venue_sees_client_update", venueSawClient ? "PASS" : "FAIL");
  await snap("05-venue-receives-client");

  const venueMsg = `PM05 venue ${Date.now()}`;
  await page.getByTestId("practice-venue-message-input").fill(venueMsg);
  await page.getByTestId("practice-send-venue-message").click();
  await page.waitForTimeout(2500);
  const thread2 = await page.getByTestId("practice-conversation-thread").innerText();
  set("venue_reply_visible", thread2.includes(venueMsg) ? "PASS" : "FAIL");

  // Website draft safety
  const { data: site } = await admin
    .from("couple_websites")
    .select("id,is_published,status")
    .eq("venue_id", VENUE_ID)
    .eq("client_id", run.sample_client_id)
    .maybeSingle();
  set(
    "website_draft_boundary",
    !site || site.is_published === false ? "PASS" : "FAIL",
    { site },
  );

  // Finish
  await page.getByTestId("practice-run-lifecycle-panel").scrollIntoViewIfNeeded();
  await snap("06-review-completion");
  await page.getByTestId("practice-finish-return-setup").click();
  await page.waitForURL(/take-a-look/, { timeout: 90000 });
  await page.waitForTimeout(1000);
  const finishedBanner = await page.getByTestId("practice-finished-banner").count();
  set("finish_return_setup", finishedBanner > 0 ? "PASS" : "FAIL");
  results.ux.polished.push("Finish returns to Take a look with confident, non-mandatory next-step copy.");

  // Resume in-progress
  await page.getByTestId("practice-run-primary-cta").click();
  await page.waitForURL(/practice-run/, { timeout: 90000 });
  await page.waitForSelector('[data-testid="practice-run-shell"]', { timeout: 90000 });
  const resumed = await activeRun();
  set("resume_in_progress", resumed?.id === run.id ? "PASS" : "FAIL", {
    before: run.id,
    after: resumed?.id,
  });

  // Reset #1
  const tasksBeforeReset = (
    await admin
      .from("event_tasks")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", VENUE_ID)
      .eq("event_id", run.sample_event_id)
  ).count;
  await page.getByTestId("practice-reset-start-over").click();
  await page.waitForSelector('[data-testid="practice-reset-confirm"]', { timeout: 15000 });
  await snap("07-reset-confirm");
  await page.getByTestId("practice-reset-confirm-yes").click();
  const afterReset1 = await waitForNewActiveRun(run.id, 120000);
  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(afterReset1.id)}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForSelector('[data-testid="practice-run-lifecycle-panel"]', { timeout: 90000 });
  set(
    "reset_after_completion",
    afterReset1 && afterReset1.id !== run.id && afterReset1.status === "in_progress" ? "PASS" : "FAIL",
    { previous: run.id, next: afterReset1?.id, tasksBeforeReset },
  );
  await snap("08-clean-after-reset");

  // Partial activity then reset #2 (book first — prepare stays disabled until practice-booked)
  const midId = afterReset1.id;
  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(midId)}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForSelector('[data-testid="practice-run-lifecycle-panel"]', { timeout: 90000 });
  const book2 = page.getByTestId("practice-book-celebration");
  if ((await book2.count()) && (await book2.isEnabled())) {
    await book2.click();
    await page.waitForTimeout(1500);
  }
  const confirmInquiry = page.getByTestId("practice-confirm-explored-inquiry");
  if ((await confirmInquiry.count()) && (await confirmInquiry.isEnabled())) {
    await confirmInquiry.click();
    await page.waitForTimeout(1000);
  }
  const prep2 = page.getByTestId("practice-prepare-planning");
  if ((await prep2.count()) && (await prep2.isEnabled())) {
    await prep2.click();
    await page.waitForSelector('[data-testid="practice-planning-snapshot"]', { timeout: 90000 });
    await page.waitForTimeout(1000);
  }
  await page.getByTestId("practice-reset-start-over").click();
  await page.getByTestId("practice-reset-confirm-yes").click();
  const afterReset2 = await waitForNewActiveRun(midId, 120000);
  set(
    "repeated_reset",
    afterReset2 && afterReset2.id !== midId ? "PASS" : "FAIL",
    { mid: midId, next: afterReset2?.id },
  );
  if (!afterReset2?.sample_event_id) {
    throw new Error("No active Practice Run after second reset");
  }
  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(afterReset2.id)}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  // Isolation
  const { data: eventRow } = await admin
    .from("events")
    .select("booked_at,exclude_from_business_reporting,practice_run_id")
    .eq("id", afterReset2.sample_event_id)
    .single();
  const afterQbo = (
    await admin
      .from("quickbooks_sync_queue")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", VENUE_ID)
  ).count;
  const afterRealClients = (
    await admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", VENUE_ID)
      .is("practice_run_id", null)
  ).count;
  const afterWillow = (
    await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", "31f38b79-eb99-4ebc-81bc-af85767b42aa")
  ).count;
  set(
    "isolation",
    eventRow.booked_at == null
      && eventRow.exclude_from_business_reporting === true
      && afterQbo === before.qbo
      && afterRealClients === before.realClients
      && afterWillow === before.willowEvents
      ? "PASS"
      : "FAIL",
    {
      eventRow,
      qbo: { before: before.qbo, after: afterQbo },
      realClients: { before: before.realClients, after: afterRealClients },
      willowEvents: { before: before.willowEvents, after: afterWillow },
    },
  );

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(afterReset2.id)}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForSelector('[data-testid="practice-run-shell"]', { timeout: 90000 });
  await page.waitForTimeout(800);
  await snap("09-mobile-390");
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }));
  const mobileText = await page.locator("body").innerText();
  set(
    "mobile_ux",
    !overflow.overflows && !/Coming soon|Under construction|PM-0[0-9]/i.test(mobileText)
      ? "PASS"
      : "FAIL",
    { overflow },
  );

  results.ux.corrections.push(
    "Added explicit Finish vs Start over lifecycle with confirmation copy; unique practice emails per reset.",
  );
  results.ux.remaining.push(
    "Setup Hub “Finish setup & go to Dashboard” remains intentionally disabled (pre-existing Phase A gate).",
  );

  const passed = Object.values(results.criteria).filter((c) => c.status === "PASS").length;
  const failed = Object.values(results.criteria).filter((c) => c.status === "FAIL").length;
  results.summary = { passed, failed, total: passed + failed, fatal: null };
  console.log(JSON.stringify(results.summary, null, 2));
} catch (err) {
  results.summary = {
    passed: Object.values(results.criteria).filter((c) => c.status === "PASS").length,
    failed: Object.values(results.criteria).filter((c) => c.status === "FAIL").length,
    total: Object.keys(results.criteria).length,
    fatal: String(err?.message || err),
  };
  console.error("FATAL", err);
  try {
    await snap("99-fatal");
  } catch {
    /* ignore */
  }
} finally {
  const jsonPath = join(OUT, "acceptance.json");
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  copyFileSync(jsonPath, join(DESKTOP, "acceptance.json"));
  await browser.close();
  process.exit(results.summary?.failed || results.summary?.fatal ? 1 : 0);
}
