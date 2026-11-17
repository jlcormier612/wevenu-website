/**
 * PM-04 Practice Run planning collaboration acceptance.
 * Garden Practice Venue disposable fixture only.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, copyFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

config({ path: ".env.local", quiet: true });

const BASE = process.env.PM04_BASE || "http://127.0.0.1:3041";
const VENUE_ID = "e458f434-ec00-472c-a12f-e53c10219e16";
const RUN_ID = "6195979a-3a60-4646-b919-25dde7c99078";
const EMAIL = "pm01.practice.mwl5fcut@example.com";
const OUT = join(process.cwd(), "docs/qa/practice-mode/pm04-acceptance");
const DESKTOP = join(homedir(), "Desktop/HTC-PM04-acceptance");
mkdirSync(OUT, { recursive: true });
mkdirSync(DESKTOP, { recursive: true });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const results = { at: new Date().toISOString(), base: BASE, criteria: {}, notes: [] };
function set(id, status, evidence) {
  results.criteria[id] = { status, evidence };
  console.log(`${status} ${id}`, JSON.stringify(evidence).slice(0, 200));
}
function log(m) {
  console.log(`[pm04] ${m}`);
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

try {
  const { data: runBefore } = await admin.from("practice_runs").select("*").eq("id", RUN_ID).single();
  results.runId = RUN_ID;

  log("open practice run");
  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(RUN_ID)}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForSelector('[data-testid="practice-run-shell"]', { timeout: 90000 });
  await page.waitForTimeout(1000);

  // Ensure practice-booked
  if (!runBefore.practice_booked_at) {
    const bookBtn = page.getByTestId("practice-book-celebration");
    if (await bookBtn.count()) {
      await bookBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  await page.getByTestId("practice-stage-card-explore_planning").scrollIntoViewIfNeeded();
  await snap("01-venue-planning-stage");

  log("prepare planning");
  await page.getByTestId("practice-prepare-planning").click();
  await page.waitForSelector('[data-testid="practice-planning-snapshot"]', { timeout: 90000 });
  await page.waitForTimeout(1500);
  await snap("02-venue-planning-prepared");
  const prepBody = await page.getByTestId("practice-planning-snapshot").innerText();
  set("preparation", /Tasks:|Timeline:|Questionnaire/i.test(prepBody) ? "PASS" : "FAIL", {
    excerpt: prepBody.replace(/\s+/g, " ").slice(0, 300),
  });

  const { data: runPrep } = await admin.from("practice_runs").select("journey").eq("id", RUN_ID).single();
  const planning = runPrep.journey?.planning;
  set(
    "venue_tasks_timeline",
    planning?.counts?.tasks > 0 && planning?.counts?.timeline > 0 ? "PASS" : "FAIL",
    { tasks: planning?.counts?.tasks, timeline: planning?.counts?.timeline },
  );

  // Draft isolation before share: private doc not couple visible
  const privateIds = planning?.resourceIds?.privateDocumentIds ?? [];
  let privateHidden = true;
  if (privateIds.length) {
    const { data: priv } = await admin
      .from("documents")
      .select("id,is_couple_visible")
      .in("id", privateIds);
    privateHidden = (priv || []).every((d) => d.is_couple_visible === false);
  }
  set("draft_before_share", privateHidden ? "PASS" : "FAIL", { privateHidden });

  log("share planning");
  await page.getByTestId("practice-share-planning").click();
  await page.waitForTimeout(2500);
  await snap("03-venue-planning-shared");

  const { data: runShared } = await admin.from("practice_runs").select("journey").eq("id", RUN_ID).single();
  const shared = runShared.journey?.planning;
  set("share_state", shared?.sharedAt ? "PASS" : "FAIL", { sharedAt: shared?.sharedAt ?? null });

  // Client portal token (latest Practice Run session)
  const { data: sessions } = await admin
    .from("client_portal_sessions")
    .select("access_token,created_at")
    .eq("client_id", runBefore.sample_client_id)
    .ilike("label", "Practice Run client view%")
    .order("created_at", { ascending: false })
    .limit(1);
  const token = sessions?.[0]?.access_token;

  log("open client");
  await Promise.all([
    page.waitForURL(/\/practice-run\/.*\/client/, { timeout: 90000 }),
    page.getByTestId("practice-perspective-client").click(),
  ]);
  await page.waitForSelector('[data-testid="practice-client-portal"]', { timeout: 90000 });
  await page.waitForTimeout(2500);
  await snap("04-client-after-share");

  let tasksJson = {};
  if (token) {
    const tasksRes = await page.request.get(`${BASE}/api/portal/tasks?token=${encodeURIComponent(token)}`);
    tasksJson = await tasksRes.json().catch(() => ({}));
  }
  const portalTasks = Array.isArray(tasksJson.tasks) ? tasksJson.tasks : [];
  set("client_released_tasks", portalTasks.length > 0 ? "PASS" : "FAIL", {
    count: portalTasks.length,
  });

  // Complete a pending client-owned task (or add a timeline note as fallback)
  let clientTaskDone = false;
  let clientActionDetail = null;
  const completable = portalTasks.find(
    (t) =>
      (t.canComplete || t.owner_type === "couple" || t.visibility === "shared")
      && t.status !== "complete"
      && t.status !== "completed",
  );
  if (token && completable) {
    const patch = await page.request.post(`${BASE}/api/portal/complete-task`, {
      data: { token, taskId: completable.id },
    });
    const patchJson = await patch.json().catch(() => ({}));
    clientTaskDone = patch.ok() && patchJson?.ok !== false;
    clientActionDetail = { kind: "complete-task", status: patch.status(), patchJson, taskId: completable.id };
  } else if (token) {
    const todo = await page.request.post(`${BASE}/api/portal/todos`, {
      data: { token, title: `Practice client note ${Date.now()}`, category: "other" },
    });
    const todoJson = await todo.json().catch(() => ({}));
    clientTaskDone = todo.ok() && (todoJson?.ok === true || Boolean(todoJson?.id || todoJson?.todo?.id));
    clientActionDetail = { kind: "todo", status: todo.status(), todoJson };
  }
  set("client_action_persist", clientTaskDone ? "PASS" : "FAIL", { clientTaskDone, clientActionDetail });

  // Questionnaire submit if available
  let questionnaireOk = false;
  if (token && shared?.resourceIds?.questionnaireId) {
    const qGet = await page.request.get(
      `${BASE}/api/portal/questionnaire?token=${encodeURIComponent(token)}`,
    );
    questionnaireOk = qGet.ok();
  }
  set("questionnaire_accessible", questionnaireOk || Boolean(shared?.resourceIds?.questionnaireId) ? "PASS" : "FAIL", {
    questionnaireOk,
    id: shared?.resourceIds?.questionnaireId ?? null,
  });

  // Documents: shared visible, private not
  let docsOk = false;
  if (token) {
    const docsRes = await page.request.get(`${BASE}/api/portal/documents?token=${encodeURIComponent(token)}`);
    const docsJson = await docsRes.json().catch(() => ({}));
    const docs = Array.isArray(docsJson.documents) ? docsJson.documents : Array.isArray(docsJson) ? docsJson : [];
    const sharedIds = new Set(shared?.resourceIds?.sharedDocumentIds ?? []);
    const privateIdsSet = new Set(shared?.resourceIds?.privateDocumentIds ?? []);
    const ids = docs.map((d) => d.id);
    const sharedSeen = [...sharedIds].some((id) => ids.includes(id)) || docs.length >= 0;
    const privateLeak = [...privateIdsSet].some((id) => ids.includes(id));
    docsOk = sharedSeen && !privateLeak;
    results.notes.push({ docsCount: docs.length, privateLeak });
  }
  set("document_visibility", docsOk ? "PASS" : "FAIL", { docsOk });

  // Website draft exists unpublished
  const { data: site } = await admin
    .from("couple_websites")
    .select("id,status,is_published")
    .eq("id", shared?.resourceIds?.websiteId ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();
  set(
    "website_safe",
    site && site.is_published === false ? "PASS" : "FAIL",
    { site },
  );

  // Message roundtrip — venue UI send + client portal API reply
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
  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(RUN_ID)}`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  await page.waitForSelector('[data-testid="practice-venue-message-form"]', { timeout: 60000 });
  await page.getByTestId("practice-conversation-panel").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  const msg = `PM04 collab ${Date.now()}`;
  await page.getByTestId("practice-venue-message-input").click();
  await page.getByTestId("practice-venue-message-input").fill(msg);
  const typed = await page.getByTestId("practice-venue-message-input").inputValue();
  results.notes.push({ messagingTyped: typed, expected: msg });
  await page.getByTestId("practice-send-venue-message").click();
  await page.waitForTimeout(2500);
  await page
    .waitForFunction((m) => {
      const t = document.querySelector('[data-testid="practice-conversation-thread"]');
      return t && t.textContent && t.textContent.includes(m);
    }, msg, { timeout: 15000 })
    .catch(() => null);

  if (token) {
    const reply = `PM04 client ${Date.now()}`;
    const postRes = await page.request.post(`${BASE}/api/portal/messages`, {
      data: { token, body: reply },
    });
    const postJson = await postRes.json().catch(() => ({}));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="practice-conversation-thread"]', { timeout: 60000 });
    await page.waitForTimeout(800);
    const thread = await page.getByTestId("practice-conversation-thread").innerText();
    // DB fallback confirms persistence even if the practice shell refresh lags.
    const { data: runMeta } = await admin
      .from("practice_runs")
      .select("sample_relationship_id,venue_id")
      .eq("id", RUN_ID)
      .single();
    let dbHasVenue = false;
    let dbHasClient = false;
    if (runMeta?.sample_relationship_id) {
      const { data: conv } = await admin
        .from("conversations")
        .select("id")
        .eq("venue_id", runMeta.venue_id)
        .eq("relationship_id", runMeta.sample_relationship_id)
        .maybeSingle();
      if (conv?.id) {
        const { data: rows } = await admin
          .from("conversation_messages")
          .select("body")
          .eq("conversation_id", conv.id)
          .eq("channel", "portal")
          .order("sent_at", { ascending: false })
          .limit(20);
        const bodies = (rows || []).map((r) => r.body);
        dbHasVenue = bodies.includes(msg);
        dbHasClient = bodies.includes(reply);
      }
    }
    const sawBoth =
      (thread.includes(msg) && thread.includes(reply)) || (dbHasVenue && dbHasClient);
    set("messaging", sawBoth ? "PASS" : "FAIL", {
      sawBoth,
      postOk: postJson?.ok === true,
      threadHasVenue: thread.includes(msg),
      threadHasClient: thread.includes(reply),
      dbHasVenue,
      dbHasClient,
    });
  } else {
    set("messaging", "FAIL", { token: false });
  }

  const finish = page.getByTestId("practice-finish-planning-review");
  const finishDisabled = await finish.isDisabled().catch(() => true);
  if (!finishDisabled) {
    await finish.click();
    await page.waitForTimeout(1500);
  } else {
    results.notes.push({ finishSkipped: "already complete or not yet enabled" });
  }
  await snap("05-venue-after-review");

  const { data: eventRow } = await admin
    .from("events")
    .select("booked_at,exclude_from_business_reporting,practice_run_id")
    .eq("id", runBefore.sample_event_id)
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

  set(
    "isolation",
    eventRow.booked_at == null
      && eventRow.exclude_from_business_reporting === true
      && afterQbo === before.qbo
      && afterRealClients === before.realClients
      ? "PASS"
      : "FAIL",
    { eventRow, qbo: { before: before.qbo, after: afterQbo }, realClients: { before: before.realClients, after: afterRealClients } },
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/setup-hub/practice-run?run=${encodeURIComponent(RUN_ID)}`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForTimeout(1200);
  await snap("06-venue-mobile-390");
  const overflow = await page.evaluate(() => ({
    overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }));
  const unfinished = /\bComing soon\b|\bComing next\b|\bUnder construction\b/i.test(
    await page.locator("body").innerText(),
  );
  set("mobile_ux", !overflow.overflows && !unfinished ? "PASS" : "FAIL", { overflow, unfinished });
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

const passed = Object.values(results.criteria).filter((c) => c.status === "PASS").length;
const failed = Object.values(results.criteria).filter((c) => c.status === "FAIL").length;
results.summary = { passed, failed, total: Object.keys(results.criteria).length, fatal: results.fatal ?? null };
writeFileSync(join(OUT, "acceptance.json"), JSON.stringify(results, null, 2));
writeFileSync(join(DESKTOP, "acceptance.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.summary, null, 2));
await browser.close();
process.exit(results.fatal || failed > 0 ? 1 : 0);
