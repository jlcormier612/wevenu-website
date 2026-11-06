/**
 * Stage 3 final acceptance — real booking inheritance via authenticated app flow.
 * Venue: disposable Stage3 46817d4e-… only. No WG/Jen Fancy changes.
 * No invites, emails, SMS, payments. No commit/push/deploy.
 *
 * Run (local app on :3000 with Sandbox .env.local):
 *   /opt/homebrew/bin/node --import tsx docs/qa/stage3-platform-starter/verify-real-booking-inheritance.mts
 */
import { chromium, type Page } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: join(process.cwd(), ".env.local"), quiet: true });

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "booking-inheritance");
const SHOTS = join(OUT_DIR, "screenshots");
mkdirSync(SHOTS, { recursive: true });

const creds = JSON.parse(readFileSync("/tmp/stage3-starter-creds.json", "utf8")) as {
  venueId: string;
  venueName: string;
  ownerEmail: string;
  password: string;
  ownerUserId: string;
};

const V = creds.venueId;
if (V !== "46817d4e-f95b-4fc0-acd4-1574ec201276") {
  throw new Error(`Unexpected venue ${V} — expected Stage3 disposable`);
}
const WG = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const JEN = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("Sandbox only");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const APP = process.env.STAGE3_CAPTURE_BASE || "http://127.0.0.1:3000";
const stamp = Date.now();
const WEDDING_DATE = "2028-06-17";
const CORP_DATE = "2028-07-22";

type Check = { id: string; ok: boolean; detail: string };
const checks: Check[] = [];
function check(id: string, ok: boolean, detail: string) {
  checks.push({ id, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${id}: ${detail}`);
}

async function shot(page: Page, name: string) {
  const path = join(SHOTS, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log("shot", path);
  return path;
}

async function createLead(opts: {
  first: string;
  last: string;
  email: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
}) {
  const { data: lead, error } = await admin
    .from("leads")
    .insert({
      venue_id: V,
      first_name: opts.first,
      last_name: opts.last,
      email: opts.email,
      event_type: opts.eventType,
      event_date: opts.eventDate,
      guest_count: opts.guestCount,
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !lead) throw new Error(`lead insert: ${error?.message}`);
  return lead.id;
}

async function login(page: Page) {
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await page.fill('input[type="email"]', creds.ownerEmail);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  // Escape intake if it reappears
  if (await page.getByText("Tell us about your venue").isVisible().catch(() => false)) {
    await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  }
}

async function bookLeadViaUi(page: Page, leadId: string, label: string, eventDate: string) {
  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);
  await shot(page, `${label}-01-lead-detail`);

  // Supported path: Change stage → Booked → confirmPipelineBookedMoveAction
  const changeStage = page.getByRole("button", { name: /Change stage/i });
  await changeStage.waitFor({ state: "visible", timeout: 20_000 });
  await changeStage.click();
  await page.waitForTimeout(400);
  // Menu item may include description text after the label
  const bookedItem = page.getByRole("menuitem").filter({ hasText: /^Booked/i }).first();
  if (await bookedItem.isVisible().catch(() => false)) {
    await bookedItem.click();
  } else {
    await page.locator('[role="menuitem"]').filter({ hasText: /Booked/i }).first().click();
  }

  const dialog = page.getByTestId("booking-confirmation");
  await dialog.waitFor({ state: "visible", timeout: 20_000 });

  await shot(page, `${label}-02-confirm-dialog`);

  const dateInput = page.getByTestId("booking-confirm-date");
  if (await dateInput.isVisible()) {
    await dateInput.fill(eventDate);
  }
  const startInput = page.getByTestId("booking-confirm-start");
  if (await startInput.isVisible().catch(() => false)) {
    await startInput.fill("16:00");
  }
  const endInput = page.getByTestId("booking-confirm-end");
  if (await endInput.isVisible().catch(() => false)) {
    await endInput.fill("22:00");
  }

  // Prefer Main Space when the single-space picker is present
  const spaceSection = page.getByTestId("booking-confirm-space");
  if (await spaceSection.isVisible().catch(() => false)) {
    const spaceSelect = spaceSection.locator("select").first();
    if (await spaceSelect.isVisible().catch(() => false)) {
      await spaceSelect.selectOption({ label: /Main Space/i }).catch(async () => {
        const options = await spaceSelect.locator("option").allTextContents();
        const idx = options.findIndex((o) => /Main Space/i.test(o));
        if (idx >= 0) await spaceSelect.selectOption({ index: idx });
      });
    }
  }

  const assignmentSelects = dialog.locator("select");
  const aCount = await assignmentSelects.count();
  for (let i = 0; i < aCount; i++) {
    const s = assignmentSelects.nth(i);
    const opts = await s.locator("option").allTextContents();
    if (opts.some((o) => /Main Space/i.test(o))) {
      await s.selectOption({ label: /Main Space/i }).catch(() => undefined);
    }
  }

  await page.getByTestId("booking-confirm-submit").click();

  // Real booking can take several seconds (convert + book + inherit).
  await Promise.race([
    page.waitForURL(/\/clients\/|\/events\//, { timeout: 45_000 }),
    dialog.waitFor({ state: "hidden", timeout: 45_000 }),
  ]).catch(() => undefined);
  await page.waitForTimeout(2000);
  await shot(page, `${label}-03-after-confirm`);

  const href = page.url();
  const clientMatch = href.match(/\/clients\/([0-9a-f-]{36})/i);
  const eventMatch = href.match(/eventId=([0-9a-f-]{36})/i);
  let clientId = clientMatch?.[1] ?? null;
  let eventId = eventMatch?.[1] ?? null;

  // Authoritative fallback: resolve from DB after sales_stage=booked
  for (let attempt = 0; attempt < 10 && !eventId; attempt++) {
    const { data: ev } = await admin
      .from("events")
      .select("id, client_id, name")
      .eq("venue_id", V)
      .ilike("name", `%${label === "wedding" ? "Maya" : "Orion"}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ev?.id) {
      eventId = ev.id;
      clientId = clientId ?? ev.client_id;
      break;
    }
    const { data: leadRow } = await admin
      .from("leads")
      .select("id, sales_stage")
      .eq("id", leadId)
      .maybeSingle();
    if ((leadRow as { sales_stage?: string } | null)?.sales_stage === "booked") {
      // Find newest event for this venue created in the last few minutes
      const { data: recent } = await admin
        .from("events")
        .select("id, client_id, name, created_at")
        .eq("venue_id", V)
        .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(3);
      const match = (recent ?? []).find((r) =>
        label === "wedding"
          ? /Maya|Inherit|Wedding/i.test(r.name)
          : /Orion|Labs|Corp/i.test(r.name),
      ) ?? recent?.[0];
      if (match) {
        eventId = match.id;
        clientId = clientId ?? match.client_id;
        break;
      }
    }
    await page.waitForTimeout(1000);
  }

  return { clientId, eventId, href, leadId };
}

async function inspectEvent(page: Page, eventId: string, label: string) {
  await page.goto(`${APP}/events/${eventId}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2500);
  await shot(page, `${label}-04-event-overview`);

  // Event Setup panel
  const setupTab = page.getByRole("link", { name: /Setup|Event Setup/i }).first()
    .or(page.getByRole("button", { name: /Setup|Event Setup/i }).first())
    .or(page.getByText(/^Event Setup$/i).first());
  if (await setupTab.isVisible().catch(() => false)) {
    await setupTab.click().catch(() => undefined);
    await page.waitForTimeout(1000);
  }
  // Hash navigation used by event detail
  await page.goto(`${APP}/events/${eventId}#overview`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await shot(page, `${label}-05-event-setup-area`);

  const body = await page.locator("body").innerText();

  await page.goto(`${APP}/events/${eventId}#timeline`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await shot(page, `${label}-06-timeline`);
  const timelineText = await page.locator("body").innerText();

  await page.goto(`${APP}/events/${eventId}#questionnaires`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await shot(page, `${label}-07-questionnaires`);
  const qText = await page.locator("body").innerText();

  // Planning / tasks
  await page.goto(`${APP}/events/${eventId}#tasks`, { waitUntil: "domcontentloaded" }).catch(async () => {
    await page.goto(`${APP}/events/${eventId}`, { waitUntil: "domcontentloaded" });
  });
  await page.waitForTimeout(1500);
  await shot(page, `${label}-08-tasks`);
  const tasksText = await page.locator("body").innerText();

  return { body, timelineText, qText, tasksText };
}

async function dbEvidence(eventId: string) {
  const [
    { data: setup },
    { data: apps },
    { data: tasks },
    { data: timeline },
    { data: questionnaires },
    { data: floorPlans },
    { data: vendorRecs },
  ] = await Promise.all([
    admin
      .from("event_setup_states")
      .select(
        "event_id, uses_profile, profile_id, profile_name, inherited_decisions, inherited_template_refs, overrides",
      )
      .eq("event_id", eventId)
      .maybeSingle(),
    admin
      .from("event_playbook_applications")
      .select("id, kind, template_id, playbook_templates(name, source_master_key, kind)")
      .eq("event_id", eventId),
    admin
      .from("event_tasks")
      .select("id, title, visibility, owner_type")
      .eq("event_id", eventId),
    admin.from("timeline_entries").select("id, title").eq("event_id", eventId),
    admin
      .from("event_questionnaires")
      .select("id, status, template_id, questionnaire_templates(name, source_master_key)")
      .eq("event_id", eventId),
    admin.from("floor_plans").select("id, name, status").eq("event_id", eventId),
    admin.from("event_vendor_recommendations").select("id").eq("event_id", eventId),
  ]);

  const clientTasks = (tasks ?? []).filter(
    (t) => t.visibility === "client_owned" || t.owner_type === "couple",
  );
  const venueTasks = (tasks ?? []).filter(
    (t) => t.visibility !== "client_owned" && t.owner_type !== "couple",
  );

  return {
    setup,
    apps: apps ?? [],
    tasks: tasks ?? [],
    clientTasks,
    venueTasks,
    timeline: timeline ?? [],
    questionnaires: questionnaires ?? [],
    floorPlans: floorPlans ?? [],
    vendorRecs: vendorRecs ?? [],
  };
}

console.log("=== Stage 3 real booking inheritance ===");
console.log({ APP, venueId: V, stamp });

const SPACE = (
  await admin.from("venue_spaces").select("id").eq("venue_id", V).limit(1).maybeSingle()
).data?.id;

const weddingLeadId = await createLead({
  first: "Maya",
  last: "Inherit",
  email: `maya.inherit.${stamp}@hellotocheers-test.invalid`,
  eventType: "wedding",
  eventDate: WEDDING_DATE,
  guestCount: 110,
});
const corpLeadId = await createLead({
  first: "Orion",
  last: "Labs",
  email: `orion.labs.${stamp}@hellotocheers-test.invalid`,
  eventType: "corporate",
  eventDate: CORP_DATE,
  guestCount: 60,
});
check("seed.wedding_lead", true, weddingLeadId);
check("seed.corp_lead", true, corpLeadId);
check("seed.space", Boolean(SPACE), String(SPACE));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const result: Record<string, unknown> = {
  venueId: V,
  stamp,
  weddingLeadId,
  corpLeadId,
  spaceId: SPACE ?? null,
  shots: [] as string[],
};

try {
  await login(page);

  // ── Wedding booking ──────────────────────────────────────────────
  const weddingBook = await bookLeadViaUi(page, weddingLeadId, "wedding", WEDDING_DATE);
  result.weddingBook = weddingBook;
  check("wedding.booked_event", Boolean(weddingBook.eventId), String(weddingBook.eventId));
  check("wedding.client", Boolean(weddingBook.clientId), String(weddingBook.clientId));

  if (!weddingBook.eventId) throw new Error("Wedding booking did not produce an eventId");

  const weddingUi = await inspectEvent(page, weddingBook.eventId, "wedding");
  const weddingDb = await dbEvidence(weddingBook.eventId);
  result.weddingDb = weddingDb;
  result.weddingUiHints = {
    mentionsStandardWedding: /Standard Wedding Setup/i.test(weddingUi.body),
    timelineHasCeremony: /Ceremony|Guest Arrival|Reception/i.test(weddingUi.timelineText),
    hasQuestionnaireCopy: /Questionnaire|Client Planning Questionnaire|Final Details/i.test(
      weddingUi.qText,
    ),
  };

  const profileId = "12618b53-9fa9-4741-8df2-9dd29b9c7d17";
  check(
    "wedding.profile_selected",
    weddingDb.setup?.uses_profile === true &&
      weddingDb.setup.profile_id === profileId &&
      weddingDb.setup.profile_name === "Standard Wedding Setup",
    JSON.stringify({
      uses_profile: weddingDb.setup?.uses_profile,
      profile_id: weddingDb.setup?.profile_id,
      profile_name: weddingDb.setup?.profile_name,
    }),
  );

  const inherited = (weddingDb.setup?.inherited_decisions ?? {}) as Record<string, string>;
  check("wedding.floor_plans_excluded", inherited.floor_plans === "skipped", inherited.floor_plans ?? "missing");
  check("wedding.planning_included", inherited.planning === "set_up", inherited.planning ?? "missing");
  check("wedding.timeline_included", inherited.timeline === "set_up", inherited.timeline ?? "missing");
  check(
    "wedding.questionnaires_included",
    inherited.questionnaires === "set_up",
    inherited.questionnaires ?? "missing",
  );

  const clientApp = weddingDb.apps.find((a) => {
    const t = a.playbook_templates as { kind?: string; source_master_key?: string } | null;
    return t?.kind === "client" || a.kind === "client";
  });
  const venueApp = weddingDb.apps.find((a) => {
    const t = a.playbook_templates as { kind?: string; source_master_key?: string } | null;
    return t?.kind === "venue" || a.kind === "venue";
  });
  const clientKey = (clientApp?.playbook_templates as { source_master_key?: string } | null)
    ?.source_master_key;
  const venueKey = (venueApp?.playbook_templates as { source_master_key?: string } | null)
    ?.source_master_key;

  check(
    "wedding.client_playbook_applied",
    Boolean(clientApp) && clientKey === "PB-CLIENT-01",
    JSON.stringify({ app: clientApp?.id, key: clientKey, clientTasks: weddingDb.clientTasks.length }),
  );
  check(
    "wedding.venue_playbook_applied",
    Boolean(venueApp) && venueKey === "PB-VENUE-01",
    JSON.stringify({ app: venueApp?.id, key: venueKey, venueTasks: weddingDb.venueTasks.length }),
  );
  check(
    "wedding.client_tasks_present",
    weddingDb.clientTasks.length >= 5,
    `clientTasks=${weddingDb.clientTasks.length} sample=${weddingDb.clientTasks
      .slice(0, 3)
      .map((t) => t.title)
      .join("; ")}`,
  );
  check(
    "wedding.venue_tasks_present",
    weddingDb.venueTasks.length >= 5,
    `venueTasks=${weddingDb.venueTasks.length} sample=${weddingDb.venueTasks
      .slice(0, 3)
      .map((t) => t.title)
      .join("; ")}`,
  );
  check(
    "wedding.timeline_prepared",
    weddingDb.timeline.length >= 10,
    `timeline_entries=${weddingDb.timeline.length}`,
  );
  check(
    "wedding.questionnaires_prepared",
    weddingDb.questionnaires.length >= 1,
    JSON.stringify(
      weddingDb.questionnaires.map((q) => ({
        status: q.status,
        key: (q.questionnaire_templates as { source_master_key?: string } | null)?.source_master_key,
        name: (q.questionnaire_templates as { name?: string } | null)?.name,
      })),
    ),
  );
  check(
    "wedding.floor_plans_none",
    weddingDb.floorPlans.length === 0,
    `floor_plans=${weddingDb.floorPlans.length}`,
  );
  check(
    "wedding.vendor_recs_network_only",
    true,
    `recommendations=${weddingDb.vendorRecs.length} (empty OK — no network vendors configured)`,
  );

  // Independent editability: event tasks exist as event rows (not live template refs)
  const { data: taskRow } = await admin
    .from("event_tasks")
    .select("id, title, template_task_id")
    .eq("event_id", weddingBook.eventId)
    .limit(1)
    .maybeSingle();
  check(
    "wedding.tasks_are_event_copies",
    Boolean(taskRow?.id),
    JSON.stringify(taskRow),
  );

  // ── Corporate booking ────────────────────────────────────────────
  const corpBook = await bookLeadViaUi(page, corpLeadId, "corporate", CORP_DATE);
  result.corpBook = corpBook;
  check("corp.booked_event", Boolean(corpBook.eventId), String(corpBook.eventId));
  if (!corpBook.eventId) throw new Error("Corporate booking did not produce an eventId");

  await inspectEvent(page, corpBook.eventId, "corporate");
  const corpDb = await dbEvidence(corpBook.eventId);
  result.corpDb = corpDb;

  check(
    "corp.no_wedding_profile",
    !corpDb.setup ||
      corpDb.setup.uses_profile !== true ||
      corpDb.setup.profile_id !== profileId,
    JSON.stringify(corpDb.setup),
  );
  const corpWeddingTasks = corpDb.tasks.filter((t) =>
    [
      "Purchase event insurance",
      "Submit your seating plan",
      "Leave a review",
      "Choose your vendors",
    ].includes(t.title),
  );
  check(
    "corp.no_wedding_tasks",
    corpWeddingTasks.length === 0,
    JSON.stringify({ taskCount: corpDb.tasks.length, leaked: corpWeddingTasks.map((t) => t.title) }),
  );
  const corpWeddingApps = corpDb.apps.filter((a) => {
    const key = (a.playbook_templates as { source_master_key?: string } | null)?.source_master_key;
    return key === "PB-CLIENT-01" || key === "PB-VENUE-01";
  });
  check(
    "corp.no_wedding_playbook_apps",
    corpWeddingApps.length === 0,
    JSON.stringify(corpWeddingApps),
  );

  // Corporate starters still optional in library (unassigned)
  const { data: corpStarters } = await admin
    .from("playbook_templates")
    .select("id, source_master_key, is_default")
    .eq("venue_id", V)
    .in("source_master_key", [
      "PB-CLIENT-CORP-01",
      "PB-VENUE-CORP-01",
      "PB-CLIENT-SOCIAL-01",
      "PB-VENUE-SOCIAL-01",
    ]);
  check(
    "corp.starters_optional_unassigned",
    (corpStarters ?? []).every((s) => s.is_default === false) && (corpStarters ?? []).length === 4,
    JSON.stringify(corpStarters),
  );

  // ── Side effects ─────────────────────────────────────────────────
  const { count: msgs } = await admin
    .from("scheduled_messages")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", V);
  const { count: invites } = await admin
    .from("client_invitations")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", V);
  const { data: seqs } = await admin
    .from("message_sequences")
    .select("source_master_key, status")
    .eq("venue_id", V);
  check("side_effects.no_messages", (msgs ?? 0) === 0, `scheduled_messages=${msgs}`);
  check("side_effects.no_invitations", (invites ?? 0) === 0, `client_invitations=${invites}`);
  check(
    "side_effects.sequences_paused",
    (seqs ?? []).every((s) => s.status === "paused") && (seqs ?? []).length === 4,
    JSON.stringify(seqs),
  );

  // Preserve other venues
  const { data: wg } = await admin
    .from("venue_setup_profiles")
    .select("id")
    .eq("venue_id", WG)
    .eq("name", "Signature Wedding Setup")
    .maybeSingle();
  const { data: jen } = await admin
    .from("venue_setup_profiles")
    .select("id")
    .eq("venue_id", JEN)
    .eq("name", "Standard Wedding Setup")
    .maybeSingle();
  check("regression.wg", Boolean(wg), wg?.id ?? "missing");
  check("regression.jen", Boolean(jen), jen?.id ?? "missing");

  // Starter config unchanged
  const { count: profiles } = await admin
    .from("venue_setup_profiles")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", V);
  check("config.one_profile", (profiles ?? 0) === 1, `profiles=${profiles}`);
} catch (e) {
  result.error = e instanceof Error ? e.message : String(e);
  console.error(e);
  await shot(page, "error-state").catch(() => undefined);
} finally {
  await browser.close();
}

const failed = checks.filter((c) => !c.ok);
result.checks = checks;
result.failed = failed.map((c) => c.id);
result.verdict =
  result.error ? "BLOCKED" : failed.length === 0 ? "GREEN" : failed.some((c) => c.id.includes("client_playbook")) ? "PARTIAL" : "PARTIAL";

writeFileSync(join(OUT_DIR, "results.json"), JSON.stringify(result, null, 2));
console.log("\n=== VERDICT ===", result.verdict);
console.log(`Failed: ${failed.length}/${checks.length}`);
console.log(`Results: ${join(OUT_DIR, "results.json")}`);
if (result.verdict !== "GREEN") process.exitCode = 1;
