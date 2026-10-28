/**
 * Event Order Choices — live min/max rejection UX + venue option change during unsent draft.
 *
 * Outcomes via couple/venue UI only. Disposable EO template is fixture structure only.
 *
 * EXPECTED_SHA=<serving> npx tsx docs/qa/event-order-commercial-lifecycle-closure/verify-choices-edge.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const BARN = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `EOCE${Date.now().toString(36).toUpperCase()}`;
const PREFIX = `EOCE-${RUN}-`;
const OUT = "docs/qa/event-order-commercial-lifecycle-closure";
const DAY = String((Number.parseInt(RUN.replace(/\D/g, "").slice(-2) || "14", 10) % 27) + 1).padStart(2, "0");
const EVENT_DATE = `2027-11-${DAY}`;
mkdirSync(`${OUT}/choices-edge`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string; evidence: string };
const checks: Check[] = [];
const usability: Array<{ screen: string; text: string; assessment: string; severity: "ok" | "confusing" | "blocker" | "p2" }> = [];

function record(name: string, pass: boolean, detail: string, evidence = "live-ui") {
  checks.push({ name, pass, detail: String(detail).slice(0, 2500), evidence });
  console.log(`${pass ? "PASS" : "FAIL"} [${evidence}] ${name} — ${String(detail).slice(0, 400)}`);
}
function noteUx(screen: string, text: string, assessment: string, severity: (typeof usability)[0]["severity"]) {
  usability.push({ screen, text: text.slice(0, 1200), assessment, severity });
  console.log(`UX[${severity}] ${screen} — ${assessment.slice(0, 200)}`);
}

async function servingImage() {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  await admin.from("venue_staff_active_context").upsert({
    user_id: otp.session.user.id,
    active_venue_id: FANCY,
  });
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: FANCY,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function passLegal(page: any) {
  for (let i = 0; i < 5; i++) {
    const t = await page.locator("body").innerText().catch(() => "");
    if (!/End User Terms|I have reviewed and agree/i.test(t)) return;
    const box = page.locator('input[type="checkbox"]');
    if (await box.count()) await box.first().check({ force: true }).catch(() => undefined);
    const btn = page.getByRole("button", { name: /Continue|Accept/i }).first();
    if (await btn.count()) await btn.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(900);
  }
}

async function openCoupleChoices(page: any, token: string) {
  await page.goto(`${APP}/p/${encodeURIComponent(token)}?view=choices`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await passLegal(page);
  await page.waitForTimeout(1000);
  const nav = page.locator('button[title="Choices"], button[title="Your Choices"]').first();
  if (await nav.count()) await nav.click().catch(() => undefined);
  await page.getByText(/Your Choices|Select options|Awaiting Client/i).first()
    .waitFor({ timeout: 45_000 }).catch(() => undefined);
  await page.waitForTimeout(1200);
}

function answerIds(answers: unknown): string[] {
  return Object.values((answers ?? {}) as Record<string, { optionIds?: string[] }>)
    .flatMap((a) => a?.optionIds ?? []);
}

async function cleanup(ids: {
  clientId: string | null;
  eventId: string | null;
  portalToken: string | null;
  eoId: string | null;
  templateId: string | null;
  groupId: string | null;
}) {
  const { clientId, eventId, portalToken, eoId, templateId, groupId } = ids;
  if (eventId) {
    const { data: choices } = await admin.from("client_choices").select("id").eq("event_id", eventId);
    const cids = (choices ?? []).map((c) => c.id);
    if (cids.length) await admin.from("client_choices_submissions").delete().in("choices_id", cids);
    await admin.from("client_choices").delete().eq("event_id", eventId);
  }
  if (eoId) {
    await admin.from("event_order_share_snapshots").delete().eq("event_order_id", eoId);
    await admin.from("event_order_lines").delete().eq("event_order_id", eoId);
    await admin.from("event_order_sections").delete().eq("event_order_id", eoId);
    await admin.from("event_orders").delete().eq("id", eoId);
  }
  if (portalToken) await admin.from("client_portal_sessions").delete().eq("access_token", portalToken);
  if (eventId) {
    await admin.from("event_space_assignments").delete().eq("event_id", eventId);
    await admin.from("events").delete().eq("id", eventId);
  }
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
  if (groupId) {
    await admin.from("event_order_template_options").delete().eq("group_id", groupId);
    await admin.from("event_order_template_groups").delete().eq("id", groupId);
  }
  if (templateId) {
    await admin.from("event_order_template_options").delete().eq("template_id", templateId);
    await admin.from("event_order_template_groups").delete().eq("template_id", templateId);
    await admin.from("event_order_template_lines").delete().eq("template_id", templateId);
    await admin.from("event_order_template_sections").delete().eq("template_id", templateId);
    await admin.from("event_order_templates").delete().eq("id", templateId);
  }
}

async function main() {
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED };
  let clientId: string | null = null;
  let eventId: string | null = null;
  let eoId: string | null = null;
  let portalToken: string | null = null;
  let choicesId: string | null = null;
  let templateId: string | null = null;
  let groupId: string | null = null;
  let optionIds: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  staffCtx.on("dialog", async (d: { accept: () => Promise<void> }) => { await d.accept(); });
  await staffCtx.addCookies(await staffCookies());
  const page = await staffCtx.newPage();

  try {
    const image = await servingImage();
    persisted.serving = image;
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`, "serving");
    if (!image.includes(EXPECTED.slice(0, 12))) {
      // Tip may move after deploy of this fix — allow override via EXPECTED_SHA only
      throw new Error(`Serving mismatch ${image}`);
    }
    const health = await fetch(`${APP}/api/health`).then(async (r) => ({
      status: r.status, body: await r.json().catch(() => null),
    }));
    record("api_health", health.status === 200 && health.body?.ok === true, JSON.stringify(health), "serving");

    // Fixture: disposable EO template with multi min=2 max=2 and 3 options (structure only)
    const tmplName = `${PREFIX}Sides`;
    const { data: tmpl, error: tErr } = await admin.from("event_order_templates").insert({
      venue_id: FANCY,
      name: tmplName,
      description: "Disposable edge-case sides template",
    }).select("id").single();
    if (tErr || !tmpl) throw tErr ?? new Error("template insert");
    templateId = tmpl.id;

    const { data: section } = await admin.from("event_order_template_sections").insert({
      template_id: templateId, venue_id: FANCY, name: "Food", sort_order: 0,
    }).select("id").single();

    const { data: group, error: gErr } = await admin.from("event_order_template_groups").insert({
      template_id: templateId,
      venue_id: FANCY,
      section_id: section?.id ?? null,
      name: "Side dishes",
      instructions: "Choose exactly 2 sides.",
      selection_mode: "multi",
      min_select: 2,
      max_select: 2,
      allow_quantity: false,
      sort_order: 0,
    }).select("id").single();
    if (gErr || !group) throw gErr ?? new Error("group");
    groupId = group.id;

    const labels = [`${PREFIX}A`, `${PREFIX}B`, `${PREFIX}C`];
    for (let i = 0; i < labels.length; i++) {
      const { data: opt, error: oErr } = await admin.from("event_order_template_options").insert({
        template_id: templateId,
        venue_id: FANCY,
        group_id: groupId,
        label: labels[i],
        description: null,
        is_included: false,
        unit_price: 10 + i,
        is_default: false,
        sort_order: i,
      }).select("id").single();
      if (oErr || !opt) throw oErr ?? new Error("option");
      optionIds.push(opt.id);
    }
    persisted.templateId = templateId;
    persisted.groupId = groupId;
    persisted.optionIds = optionIds;
    record(
      "fixture_multi_min2_max2_three_options",
      optionIds.length === 3,
      JSON.stringify({ templateId, groupId, optionIds, labels }),
      "fixture",
    );

    const { data: client, error: cErr } = await admin.from("clients").insert({
      venue_id: FANCY, first_name: "EOCE", last_name: RUN,
      email: `eoce-${RUN.toLowerCase()}@hellotocheers-test.invalid`, status: "confirmed",
    }).select("id").single();
    if (cErr || !client) throw cErr ?? new Error("client");
    clientId = client.id;
    const { data: event, error: eErr } = await admin.from("events").insert({
      venue_id: FANCY, client_id: clientId, name: `${PREFIX}Wedding`,
      event_type: "wedding", event_date: EVENT_DATE, event_end_date: EVENT_DATE,
      status: "confirmed", booked_at: new Date().toISOString(), space_id: BARN,
    }).select("id").single();
    if (eErr || !event) throw eErr ?? new Error("event");
    eventId = event.id;
    await admin.rpc("replace_event_space_assignments", {
      p_venue_id: FANCY, p_event_id: eventId, p_primary_space_id: BARN,
      p_assignments: [
        { useKey: "ceremony", useLabel: "Ceremony", spaceId: BARN, startTime: null, endTime: null, scheduledDate: null, sortOrder: 0 },
        { useKey: "reception", useLabel: "Reception", spaceId: BARN, startTime: null, endTime: null, scheduledDate: null, sortOrder: 1 },
      ],
    });
    portalToken = `eoce_${RUN.toLowerCase()}_${randomBytes(2).toString("hex")}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY, client_id: clientId, event_id: eventId,
      access_token: portalToken, access_level: "couple", label: "EOCE couple",
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    });
    const { data: eo, error: eoErr } = await admin.from("event_orders").insert({
      venue_id: FANCY, event_id: eventId, status: "open", revision: 1,
    }).select("id").single();
    if (eoErr || !eo) throw new Error(`eo: ${JSON.stringify(eoErr)}`);
    eoId = eo.id;
    persisted.clientId = clientId;
    persisted.eventId = eventId;
    persisted.eoId = eoId;

    async function openChoicesWorkspace() {
      await page.goto(`${APP}/events/${eventId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2000);
      const openEo = page.getByRole("button", { name: /Open Event Order/i }).first();
      if (await openEo.count()) {
        await openEo.click();
        await page.waitForTimeout(2500);
      }
      await page.evaluate(() => { window.location.hash = "event-order-choices"; });
      await page.waitForTimeout(1500);
      await page.locator('[data-testid="client-choices-panel"], [data-testid="event-order-choices"], [data-testid="event-commercial-workflow"]')
        .first().waitFor({ timeout: 45_000 });
      await page.locator("#event-order-choices").scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(800);
    }

    await openChoicesWorkspace();
    const tmplSelect = page.locator('[data-testid="choices-template-select"]');
    if (!(await tmplSelect.count())) throw new Error("template select missing");
    await tmplSelect.selectOption({ label: tmplName });
    await page.waitForTimeout(800);
    record("venue_selected_disposable_sides_template", true, tmplName, "live-ui");

    const prepareBtn = page.locator('[data-testid="choices-start-selections"]')
      .or(page.getByRole("button", { name: /Prepare selection request|Start selections/i }))
      .first();
    if (await prepareBtn.count()) {
      await prepareBtn.click();
      await page.waitForTimeout(4000);
      await openChoicesWorkspace();
    }

    let sendSel = page.locator('[data-testid="choices-send-selection-request"]').first();
    for (let i = 0; i < 6 && !(await sendSel.count()); i++) {
      await page.waitForTimeout(1000);
      const prepareAgain = page.getByRole("button", { name: /Prepare selection request/i }).first();
      if (await prepareAgain.count()) {
        await prepareAgain.click();
        await page.waitForTimeout(3500);
        await openChoicesWorkspace();
      }
      sendSel = page.locator('[data-testid="choices-send-selection-request"]').first();
    }
    if (!(await sendSel.count())) {
      await page.screenshot({ path: `${OUT}/choices-edge/send-missing-1280.png`, fullPage: true });
      throw new Error("Send selection request missing");
    }
    await sendSel.click();
    await page.waitForTimeout(700);
    const sheet = page.locator('[role="dialog"]').filter({ hasText: /selection request/i });
    const sendInSheet = sheet.getByRole("button", { name: /^(Send|Resend)$/ }).first();
    if (await sendInSheet.count()) {
      await sendInSheet.click();
      await page.waitForTimeout(3000);
    }

    const { data: choiceRows } = await admin.from("client_choices")
      .select("id,status,definition,name")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1);
    choicesId = choiceRows?.[0]?.id ?? null;
    const def = choiceRows?.[0]?.definition as {
      groups?: Array<{ id: string; name: string; minSelect: number; maxSelect: number | null; selectionMode: string }>;
      options?: Array<{ id: string; groupId: string; label: string }>;
    } | null;
    const sides = (def?.groups ?? []).find((g) => /Side dishes/i.test(g.name));
    const sidesOpts = (def?.options ?? []).filter((o) => o.groupId === sides?.id);
    record(
      "packet_has_min2_max2_sides",
      Boolean(choicesId) && sides?.minSelect === 2 && sides?.maxSelect === 2 && sidesOpts.length === 3,
      JSON.stringify({ choicesId, sides, optCount: sidesOpts.length }),
      "persisted",
    );
    if (!choicesId || !sides) throw new Error("choices packet missing sides group");
    persisted.choicesId = choicesId;
    await page.screenshot({ path: `${OUT}/choices-edge/01-venue-sent-1280.png`, fullPage: true });

    // ── Couple: min/max rejection UX ─────────────────────────────────────────
    const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const couple = await coupleCtx.newPage();
    await openCoupleChoices(couple, portalToken!);
    await couple.screenshot({ path: `${OUT}/choices-edge/02-couple-entry-1280.png`, fullPage: true });
    const entryRules = await couple.locator('[data-testid="choices-group-rules"]').first().innerText().catch(() => "");
    noteUx(
      "Couple sides rules",
      entryRules,
      /exactly 2|at least 2|up to 2/i.test(entryRules)
        ? "Min/max selection rules visible on group."
        : "Rules copy missing exact/at-least/up-to guidance.",
      /exactly 2|at least 2|up to 2/i.test(entryRules) ? "ok" : "p2",
    );
    record("couple_sees_min_max_rules_copy", /exactly 2|at least 2|up to 2/i.test(entryRules), entryRules, "live-ui");

    const submitBtn = couple.locator('[data-testid="portal-choices-submit"]').first();
    // Below minimum: zero selections
    await submitBtn.click();
    await couple.waitForTimeout(800);
    let err = couple.locator('[data-testid="portal-choices-error"]');
    let errText = (await err.count()) ? await err.innerText() : await couple.locator("body").innerText();
    const minZeroOk = /at least 2|Side dishes/i.test(errText)
      && !(await couple.getByText(/Submitted — your venue will review/i).count());
    record("live_min_reject_zero_selections", minZeroOk, errText.slice(0, 500), "live-ui");
    noteUx("Min reject (0)", errText, minZeroOk ? "Actionable min message; submit blocked." : "Min reject unclear.", minZeroOk ? "ok" : "blocker");
    await couple.screenshot({ path: `${OUT}/choices-edge/03-min-zero-1280.png`, fullPage: true });

    // Below minimum: one selection
    const optA = sidesOpts.find((o) => o.label === labels[0]) ?? sidesOpts[0]!;
    const optB = sidesOpts.find((o) => o.label === labels[1]) ?? sidesOpts[1]!;
    const optC = sidesOpts.find((o) => o.label === labels[2]) ?? sidesOpts[2]!;
    await couple.locator(`input[value="${optA.id}"]`).first().check({ force: true });
    await couple.waitForTimeout(400);
    await submitBtn.click();
    await couple.waitForTimeout(800);
    errText = (await err.count()) ? await err.innerText() : await couple.locator('[data-testid="portal-choices-error"]').innerText().catch(() => "");
    if (!errText) errText = await couple.locator("body").innerText();
    const minOneOk = /at least 2/i.test(errText);
    record("live_min_reject_one_selection", minOneOk, errText.slice(0, 500), "live-ui");
    await couple.screenshot({ path: `${OUT}/choices-edge/04-min-one-1280.png`, fullPage: true });

    // Above maximum: select all three
    await couple.locator(`input[value="${optB.id}"]`).first().check({ force: true });
    await couple.locator(`input[value="${optC.id}"]`).first().check({ force: true });
    await couple.waitForTimeout(400);
    const threeChecked =
      (await couple.locator(`input[value="${optA.id}"]`).isChecked())
      && (await couple.locator(`input[value="${optB.id}"]`).isChecked())
      && (await couple.locator(`input[value="${optC.id}"]`).isChecked());
    record("ui_allows_selecting_above_max_before_submit", threeChecked, "three checkboxes checked", "live-ui");
    await submitBtn.click();
    await couple.waitForTimeout(800);
    err = couple.locator('[data-testid="portal-choices-error"]');
    errText = (await err.count()) ? await err.innerText() : "";
    if (!errText) errText = await couple.locator("body").innerText();
    const maxOk = /at most 2/i.test(errText)
      && !(await couple.getByText(/Submitted — your venue will review/i).count());
    record("live_max_reject_three_selections", maxOk, errText.slice(0, 500), "live-ui");
    noteUx("Max reject (3)", errText, maxOk ? "Actionable max message; submit blocked." : "Max reject unclear.", maxOk ? "ok" : "blocker");
    await couple.screenshot({ path: `${OUT}/choices-edge/05-max-three-1280.png`, fullPage: true });

    // Correct to exactly 2 (A+C) and save draft — do not submit yet
    await couple.locator(`input[value="${optB.id}"]`).first().uncheck({ force: true });
    await couple.waitForTimeout(300);
    const saveBtn = couple.locator('[data-testid="portal-choices-save"]').first();
    await saveBtn.click();
    await couple.waitForTimeout(1500);
    const { data: draftRow } = await admin.from("client_choices")
      .select("status,answers").eq("id", choicesId).maybeSingle();
    const draftIds = answerIds(draftRow?.answers);
    record(
      "draft_saved_with_ac_including_soon_removed",
      draftIds.includes(optA.id) && draftIds.includes(optC.id) && !draftIds.includes(optB.id),
      JSON.stringify({ status: draftRow?.status, draftIds }),
      "live-ui+persisted",
    );
    await couple.screenshot({ path: `${OUT}/choices-edge/06-draft-ac-1280.png`, fullPage: true });

    // ── Venue: remove option C through template UI, then Resend to re-freeze ─
    await page.goto(`${APP}/library/event-order-templates/${templateId}`, {
      waitUntil: "domcontentloaded", timeout: 90_000,
    });
    await page.waitForTimeout(2500);
    const removeCBtn = page.getByRole("button", { name: `Remove ${labels[2]}` }).first();
    if (await removeCBtn.count()) {
      await removeCBtn.click({ force: true });
      await page.waitForTimeout(2000);
    } else {
      const trashNearC = page.locator(`[data-testid="eo-option-${optC.id}"]`).locator("button").last();
      if (await trashNearC.count()) {
        await trashNearC.click({ force: true });
        await page.waitForTimeout(2000);
      }
    }
    await page.screenshot({ path: `${OUT}/choices-edge/07-venue-removed-c-1280.png`, fullPage: true });

    const { data: optsAfter } = await admin.from("event_order_template_options")
      .select("id,label").eq("group_id", groupId!);
    const cGone = !(optsAfter ?? []).some((o) => o.id === optC.id);
    record("venue_removed_option_c_via_ui", cGone, JSON.stringify(optsAfter), cGone ? "live-ui+persisted" : "live-ui");
    if (!cGone) {
      // Last-resort supported path: still use venue-owned remove action outcome via service-role
      // only if UI trash missed — mark as fail for UI path but continue hydrate proof via admin delete
      await admin.from("event_order_template_options").delete().eq("id", optC.id);
      record("venue_option_c_removed_fallback_db", true, "UI trash missed; fixture deleted option for hydrate path", "fixture");
    }

    // Venue opens choices workspace → hydrate on list; also Resend
    await openChoicesWorkspace();
    await page.waitForTimeout(2000);
    sendSel = page.locator('[data-testid="choices-send-selection-request"]').first();
    if (await sendSel.count()) {
      await sendSel.click();
      await page.waitForTimeout(700);
      const sheet2 = page.locator('[role="dialog"]').filter({ hasText: /selection request/i });
      const resend = sheet2.getByRole("button", { name: /^(Send|Resend)$/ }).first();
      if (await resend.count()) {
        await resend.click();
        await page.waitForTimeout(3000);
      }
    }
    // Force hydrate by reading via staff path — listClientChoices hydrates
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const { data: afterHydrate } = await admin.from("client_choices")
      .select("definition,answers,status").eq("id", choicesId).maybeSingle();
    const defAfter = afterHydrate?.definition as {
      options?: Array<{ id: string; label: string }>;
    } | null;
    const defHasC = (defAfter?.options ?? []).some((o) => o.id === optC.id);
    const answersHaveC = answerIds(afterHydrate?.answers).includes(optC.id);
    record(
      "hydrate_pruned_removed_option_from_definition_and_answers",
      !defHasC && !answersHaveC,
      JSON.stringify({
        defOptCount: defAfter?.options?.length,
        answers: answerIds(afterHydrate?.answers),
        status: afterHydrate?.status,
      }),
      "persisted",
    );
    persisted.afterHydrate = {
      defOptIds: (defAfter?.options ?? []).map((o) => o.id),
      answers: afterHydrate?.answers,
    };

    // Couple returns to unsent draft
    await openCoupleChoices(couple, portalToken!);
    await couple.waitForTimeout(1500);
    await couple.screenshot({ path: `${OUT}/choices-edge/08-couple-after-venue-change-1280.png`, fullPage: true });
    const bodyAfter = await couple.locator("body").innerText();
    const cLabelGone = !bodyAfter.includes(labels[2]!);
    const staleBanner = await couple.locator('[data-testid="portal-choices-error"]').innerText().catch(() => "");
    const staleMsg = /no longer available|review the options/i.test(staleBanner) || /no longer available/i.test(bodyAfter);
    record("couple_no_longer_sees_removed_option_c", cLabelGone, `label=${labels[2]} staleMsg=${staleMsg}`, "live-ui");
    noteUx(
      "Stale draft after venue option remove",
      `${staleBanner}\n${bodyAfter.slice(0, 800)}`,
      cLabelGone
        ? (staleMsg ? "Removed option gone; actionable review message present." : "Removed option gone; review message optional.")
        : "Removed option still visible to couple.",
      cLabelGone ? "ok" : "blocker",
    );

    // Attempt submit with only A (below min after prune) — should reject
    // Ensure only A checked
    for (const o of sidesOpts) {
      const input = couple.locator(`input[value="${o.id}"]`);
      if (!(await input.count())) continue;
      if (o.id === optA.id) await input.check({ force: true });
      else await input.uncheck({ force: true }).catch(() => undefined);
    }
    await submitBtn.click();
    await couple.waitForTimeout(800);
    errText = await couple.locator('[data-testid="portal-choices-error"]').innerText().catch(() => "");
    if (!errText) errText = await couple.locator("body").innerText();
    const staleSubmitBlocked = /at least 2|not part of this selection|no longer available/i.test(errText)
      && !(await couple.getByText(/Submitted — your venue will review/i).count());
    record("stale_or_below_min_submit_blocked", staleSubmitBlocked, errText.slice(0, 500), "live-ui");

    // Resolve: select A+B (remaining), submit
    const inputB = couple.locator(`input[value="${optB.id}"]`);
    if (await inputB.count()) await inputB.check({ force: true });
    await couple.waitForTimeout(400);
    await submitBtn.click();
    await couple.waitForTimeout(2500);
    await couple.getByText(/Submitted — waiting for your venue|Submitted — your venue will review/i)
      .first().waitFor({ timeout: 30_000 }).catch(() => undefined);
    await couple.screenshot({ path: `${OUT}/choices-edge/09-couple-submitted-1280.png`, fullPage: true });

    let submitted: { status: string; answers: unknown } | null = null;
    for (let i = 0; i < 24; i++) {
      const { data } = await admin.from("client_choices")
        .select("status,answers").eq("id", choicesId).maybeSingle();
      submitted = data as typeof submitted;
      if (data?.status === "submitted") break;
      await couple.waitForTimeout(500);
    }
    const finalIds = answerIds(submitted?.answers);
    record(
      "final_submit_without_removed_option",
      submitted?.status === "submitted"
        && finalIds.includes(optA.id)
        && finalIds.includes(optB.id)
        && !finalIds.includes(optC.id)
        && finalIds.length === 2,
      JSON.stringify({ status: submitted?.status, finalIds }),
      "live-ui+persisted",
    );

    await couple.reload({ waitUntil: "domcontentloaded" });
    await passLegal(couple);
    await couple.waitForTimeout(1200);
    const { data: refreshRow } = await admin.from("client_choices")
      .select("status,answers").eq("id", choicesId).maybeSingle();
    record(
      "refresh_preserves_valid_final_answers",
      refreshRow?.status === "submitted"
        && JSON.stringify(answerIds(refreshRow.answers).sort()) === JSON.stringify([...finalIds].sort()),
      JSON.stringify({ status: refreshRow?.status, ids: answerIds(refreshRow?.answers) }),
      "live-ui+persisted",
    );

    const { count: packets } = await admin.from("client_choices")
      .select("id", { count: "exact", head: true }).eq("event_id", eventId);
    record("no_duplicate_packets", (packets ?? 0) === 1, `packets=${packets}`, "persisted");

    // Venue summary
    await openChoicesWorkspace();
    await page.screenshot({ path: `${OUT}/choices-edge/10-venue-review-1280.png`, fullPage: true });
    const summary = page.locator('[data-testid="choices-submission-summary"]');
    const summaryText = (await summary.count()) ? await summary.innerText() : "";
    record(
      "venue_summary_shows_remaining_sides",
      /Side dishes|SELECTED|A|B/i.test(summaryText) && !summaryText.includes(labels[2]!),
      summaryText.slice(0, 600),
      "live-ui",
    );

    await coupleCtx.close();
    persisted.finalAnswers = submitted?.answers ?? null;
    persisted.usability = usability;
  } catch (err) {
    let detail = err instanceof Error ? (err.stack ?? err.message) : "";
    if (!detail) try { detail = JSON.stringify(err); } catch { detail = String(err); }
    record("harness_error", false, detail, "harness");
    try { await page.screenshot({ path: `${OUT}/choices-edge/harness-error.png`, fullPage: true }); } catch { /* */ }
  } finally {
    await browser.close();
    if (!process.env.KEEP_FIXTURE) {
      await cleanup({ clientId, eventId, portalToken, eoId, templateId, groupId });
    }
    const pass = checks.every((c) => c.pass);
    const blockers = usability.filter((u) => u.severity === "blocker" || u.severity === "p2");
    writeFileSync(`${OUT}/choices-edge-results.json`, JSON.stringify({
      pass, run: RUN, expectedSha: EXPECTED, checks, usability,
      blockers: blockers.length, persisted,
    }, null, 2));
    writeFileSync(`${OUT}/choices-edge-persisted.json`, JSON.stringify(persisted, null, 2));
    console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} passed; UX blockers/p2=${blockers.length}`);
    process.exitCode = pass && blockers.length === 0 ? 0 : 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
