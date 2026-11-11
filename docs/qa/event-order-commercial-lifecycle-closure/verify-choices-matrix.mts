/**
 * Event Order Choices — multi-select + conditional dependency matrix (live UI).
 *
 * Forces Ceremony + Reception template (has multi groups + dependsOnOptionIds).
 * Outcomes (answers, submit) via couple UI only — never seeded.
 *
 * EXPECTED_SHA=<serving> npx tsx docs/qa/event-order-commercial-lifecycle-closure/verify-choices-matrix.mts
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
const RUN = process.env.E2E_RUN_ID ?? `EOCM${Date.now().toString(36).toUpperCase()}`;
const PREFIX = `EOCM-${RUN}-`;
const OUT = "docs/qa/event-order-commercial-lifecycle-closure";
const DAY = String((Number.parseInt(RUN.replace(/\D/g, "").slice(-2) || "14", 10) % 27) + 1).padStart(2, "0");
const EVENT_DATE = `2027-12-${DAY}`;
mkdirSync(`${OUT}/choices-matrix`, { recursive: true });

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

async function cleanup(ids: {
  clientId: string | null; eventId: string | null; portalToken: string | null; eoId: string | null;
}) {
  const { clientId, eventId, portalToken, eoId } = ids;
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
}

function answerIds(answers: unknown): string[] {
  return Object.values((answers ?? {}) as Record<string, { optionIds?: string[] }>)
    .flatMap((a) => a?.optionIds ?? []);
}

async function main() {
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED };
  let clientId: string | null = null;
  let eventId: string | null = null;
  let eoId: string | null = null;
  let portalToken: string | null = null;
  let choicesId: string | null = null;

  const browser = await chromium.launch({ headless: true });
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  staffCtx.on("dialog", async (d: { accept: () => Promise<void> }) => { await d.accept(); });
  await staffCtx.addCookies(await staffCookies());
  const page = await staffCtx.newPage();

  try {
    const image = await servingImage();
    persisted.serving = image;
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`, "serving");
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving mismatch ${image}`);
    const health = await fetch(`${APP}/api/health`).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    record("api_health", health.status === 200 && health.body?.ok === true, JSON.stringify(health), "serving");

    // Capability inventory from Fancy Ceremony+Reception template groups (fixture shape, not outcome)
    const { data: tmpl } = await admin.from("event_order_templates")
      .select("id,name").eq("venue_id", FANCY).eq("name", "Ceremony + Reception").maybeSingle();
    record("matrix_template_present", Boolean(tmpl?.id), JSON.stringify(tmpl), "fixture");
    if (!tmpl?.id) throw new Error("Ceremony + Reception template missing on Fancy");

    const { data: tmplGroups } = await admin.from("event_order_template_groups")
      .select("id,name,selection_mode,min_select,max_select,depends_on_option_ids")
      .eq("template_id", tmpl.id);
    const multiGroups = (tmplGroups ?? []).filter((g) => g.selection_mode === "multi");
    const depGroups = (tmplGroups ?? []).filter((g) => (g.depends_on_option_ids ?? []).length > 0);
    record(
      "capability_inventory_multi_and_conditional",
      multiGroups.length >= 1 && depGroups.length >= 2,
      JSON.stringify({
        multi: multiGroups.map((g) => g.name),
        conditional: depGroups.map((g) => ({ name: g.name, deps: g.depends_on_option_ids })),
        all: (tmplGroups ?? []).map((g) => ({ name: g.name, mode: g.selection_mode, deps: g.depends_on_option_ids })),
      }),
      "fixture",
    );
    persisted.capabilityInventory = { multiGroups, depGroups };

    const { data: client, error: cErr } = await admin.from("clients").insert({
      venue_id: FANCY, first_name: "EOCM", last_name: RUN,
      email: `eocm-${RUN.toLowerCase()}@hellotocheers-test.invalid`, status: "confirmed",
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
    portalToken = `eocm_${RUN.toLowerCase()}_${randomBytes(2).toString("hex")}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY, client_id: clientId, event_id: eventId,
      access_token: portalToken, access_level: "couple", label: "EOCM couple",
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

    // Venue: open commercial Event Order workspace (hash alone can race before hydrate)
    async function openChoicesWorkspace() {
      await page.goto(`${APP}/events/${eventId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2000);
      const openEo = page.getByRole("button", { name: /Open Event Order/i }).first();
      if (await openEo.count()) {
        await openEo.click();
        await page.waitForTimeout(2500);
      }
      await page.evaluate(() => {
        window.location.hash = "event-order-choices";
      });
      await page.waitForTimeout(1500);
      const panel = page.locator('[data-testid="client-choices-panel"], [data-testid="event-order-choices"], [data-testid="event-commercial-workflow"]');
      await panel.first().waitFor({ timeout: 45_000 });
      await page.locator("#event-order-choices").scrollIntoViewIfNeeded().catch(() => undefined);
      await page.waitForTimeout(800);
    }

    await openChoicesWorkspace();
    await page.screenshot({ path: `${OUT}/choices-matrix/00-eo-workspace-1280.png`, fullPage: true });

    const tmplSelect = page.locator('[data-testid="choices-template-select"]');
    if (await tmplSelect.count()) {
      await tmplSelect.selectOption({ label: "Ceremony + Reception" });
      await page.waitForTimeout(800);
      const selectedLabel = await tmplSelect.evaluate((el: HTMLSelectElement) =>
        el.options[el.selectedIndex]?.text ?? "");
      record("venue_selected_ceremony_reception_template", /Ceremony \+ Reception/i.test(selectedLabel), selectedLabel, "live-ui");
    } else {
      record("venue_selected_ceremony_reception_template", false, "template select missing", "live-ui");
    }

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
      await page.screenshot({ path: `${OUT}/choices-matrix/send-missing-1280.png`, fullPage: true });
      throw new Error("Send selection request missing after Prepare");
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
      groups?: Array<{ id: string; name: string; selectionMode: string; minSelect: number; dependsOnOptionIds?: string[] }>;
      options?: Array<{ id: string; groupId: string; label: string }>;
    } | null;
    const defMulti = (def?.groups ?? []).filter((g) => g.selectionMode === "multi");
    const defDeps = (def?.groups ?? []).filter((g) => (g.dependsOnOptionIds ?? []).length > 0);
    record(
      "packet_definition_has_multi_and_conditional",
      Boolean(choicesId) && defMulti.length >= 1 && defDeps.length >= 2,
      JSON.stringify({
        name: choiceRows?.[0]?.name,
        multi: defMulti.map((g) => g.name),
        deps: defDeps.map((g) => g.name),
      }),
      "persisted",
    );
    if (!choicesId) throw new Error("no choices packet");
    persisted.choicesId = choicesId;
    persisted.packetName = choiceRows?.[0]?.name;
    await page.screenshot({ path: `${OUT}/choices-matrix/01-venue-sent-1280.png`, fullPage: true });

    const dinnerGroup = (def?.groups ?? []).find((g) => /Dinner service/i.test(g.name));
    const platedDep = (def?.groups ?? []).find((g) => /Plated dinner details/i.test(g.name));
    const buffetDep = (def?.groups ?? []).find((g) => /Buffet dinner details/i.test(g.name));
    const multiGroup = defMulti[0];
    const dinnerOpts = (def?.options ?? []).filter((o) => o.groupId === dinnerGroup?.id);
    const platedOpt = dinnerOpts.find((o) => /Plated/i.test(o.label));
    const buffetOpt = dinnerOpts.find((o) => /Buffet/i.test(o.label));
    const multiOpts = (def?.options ?? []).filter((o) => o.groupId === multiGroup?.id);
    const platedChildOpts = (def?.options ?? []).filter((o) => o.groupId === platedDep?.id);
    const buffetChildOpts = (def?.options ?? []).filter((o) => o.groupId === buffetDep?.id);

    // Couple portal
    const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const couple = await coupleCtx.newPage();
    await openCoupleChoices(couple, portalToken!);
    await couple.screenshot({ path: `${OUT}/choices-matrix/02-couple-entry-1280.png`, fullPage: true });
    const entry = await couple.locator("body").innerText();
    noteUx(
      "Couple Choices matrix entry",
      entry,
      /Pick many|Pick one|based on your selection|not a payment/i.test(entry)
        ? "Mode labels and payment disclaimer present."
        : "Missing pick-many / dependency / payment guidance.",
      /Pick many|not a payment/i.test(entry) ? "ok" : "p2",
    );

    const radios = couple.locator('input[type="radio"]');
    const boxes = couple.locator('fieldset input[type="checkbox"]');
    const radioN = await radios.count();
    const boxN = await boxes.count();
    record("couple_sees_radios_and_checkboxes", radioN >= 2 && boxN >= 2, `radios=${radioN} checkboxes=${boxN}`, "live-ui");
    if (boxN < 2) throw new Error(`Expected multi checkboxes, got ${boxN}`);

    // ── Multi-select: pick two, change set ───────────────────────────────────
    const c0 = boxes.nth(0);
    const c1 = boxes.nth(1);
    await c0.check({ force: true });
    await couple.waitForTimeout(400);
    await c1.check({ force: true });
    await couple.waitForTimeout(400);
    const bothChecked = (await c0.isChecked()) && (await c1.isChecked());
    record("multi_select_two_options", bothChecked, "checked first two multi options", "live-ui");
    // Change: uncheck first
    await c0.uncheck({ force: true });
    await couple.waitForTimeout(400);
    const changed = !(await c0.isChecked()) && (await c1.isChecked());
    record("multi_select_change_before_submit", changed, "unchecked first, kept second", "live-ui");
    // Re-check first so final set is two
    await c0.check({ force: true });
    await couple.waitForTimeout(300);
    const finalMulti = (await c0.isChecked()) && (await c1.isChecked());
    record("multi_select_final_set_two", finalMulti, "restored two-option set", "live-ui");

    // ── Conditional: Plated reveals plated child; switch clears ──────────────
    const dependentBefore = await couple.locator('[data-testid="choices-dependent-group"]').count();
    // Select Plated dinner
    if (platedOpt) {
      const platedInput = couple.locator(`input[value="${platedOpt.id}"]`).first();
      if (await platedInput.count()) await platedInput.check({ force: true });
      else await couple.getByText(platedOpt.label, { exact: false }).first().click({ force: true }).catch(() => undefined);
    } else {
      // fallback: first dinner radio that says Plated
      await couple.getByText(/Plated/i).first().click({ force: true }).catch(() => undefined);
    }
    await couple.waitForTimeout(900);
    const dependentAfterPlated = await couple.locator('[data-testid="choices-dependent-group"]').count();
    const platedVisible = /Plated dinner details/i.test(await couple.locator("body").innerText());
    record(
      "conditional_plated_reveals_child",
      dependentAfterPlated > dependentBefore || platedVisible,
      `before=${dependentBefore} after=${dependentAfterPlated} platedVisible=${platedVisible}`,
      "live-ui",
    );
    noteUx(
      "Conditional dependent group",
      await couple.locator('[data-testid="choices-dependent-group"]').first().innerText().catch(() => ""),
      platedVisible
        ? "Dependent group appears with based-on-selection copy."
        : "Dependent group did not appear after Plated.",
      platedVisible ? "ok" : "blocker",
    );

    // Answer required plated child if present
    if (platedChildOpts[0]) {
      const child = couple.locator(`input[value="${platedChildOpts[0].id}"]`).first();
      if (await child.count()) await child.check({ force: true });
      else await couple.locator('[data-testid="choices-dependent-group"] input[type="radio"]').first()
        .check({ force: true }).catch(() => undefined);
      await couple.waitForTimeout(400);
    }

    // Switch to Buffet — plated child should hide; buffet child appear
    if (buffetOpt) {
      const buffetInput = couple.locator(`input[value="${buffetOpt.id}"]`).first();
      if (await buffetInput.count()) await buffetInput.check({ force: true });
      else await couple.getByText(buffetOpt.label, { exact: false }).first().click({ force: true }).catch(() => undefined);
    } else {
      await couple.getByText(/Buffet/i).first().click({ force: true }).catch(() => undefined);
    }
    await couple.waitForTimeout(1000);
    const bodyAfterBuffet = await couple.locator("body").innerText();
    const buffetVisible = /Buffet dinner details/i.test(bodyAfterBuffet);
    // Plated details should not remain as an active required fieldset (may linger in inactive answers reconciled on save)
    const platedStillRequired = await couple.locator('[data-testid="choices-dependent-group"]')
      .filter({ hasText: /Plated dinner details/i }).count();
    record(
      "conditional_switch_buffet_hides_plated_shows_buffet",
      buffetVisible && platedStillRequired === 0,
      JSON.stringify({ buffetVisible, platedStillRequired }),
      "live-ui",
    );

    if (buffetChildOpts[0]) {
      const child = couple.locator(`input[value="${buffetChildOpts[0].id}"]`).first();
      if (await child.count()) await child.check({ force: true });
      else await couple.locator('[data-testid="choices-dependent-group"] input[type="radio"]').first()
        .check({ force: true }).catch(() => undefined);
      await couple.waitForTimeout(400);
    } else {
      const depRadio = couple.locator('[data-testid="choices-dependent-group"] input[type="radio"]').first();
      if (await depRadio.count()) await depRadio.check({ force: true });
    }

    // ── Validation: incomplete required — clear dinner and try submit ────────
    // Snapshot current valid path first via Save (draft), then test validation message if possible
    const saveBtn = couple.locator('[data-testid="portal-choices-save"]')
      .or(couple.getByRole("button", { name: /^Save$/i })).first();
    if (await saveBtn.count()) {
      await saveBtn.click();
      await couple.waitForTimeout(1500);
    }
    const { data: draftRow } = await admin.from("client_choices")
      .select("status,answers").eq("id", choicesId).maybeSingle();
    record(
      "draft_save_persists_without_submit",
      draftRow?.status === "sent" || draftRow?.status === "opened" || Boolean(draftRow?.answers),
      JSON.stringify({ status: draftRow?.status, ids: answerIds(draftRow?.answers) }),
      "live-ui+persisted",
    );

    // Submit valid matrix
    const selectedDom = await couple.locator('input[type="radio"]:checked, fieldset input[type="checkbox"]:checked')
      .evaluateAll((els: HTMLInputElement[]) => els.map((el) => ({
        name: el.name, value: el.value,
        label: el.closest("label")?.innerText?.slice(0, 120) ?? "",
      })));
    persisted.selectedDom = selectedDom;

    const submitBtn = couple.locator('[data-testid="portal-choices-submit"]')
      .or(couple.getByRole("button", { name: /^Submit$/i })).first();
    await submitBtn.click();
    await couple.waitForTimeout(2000);
    // If validation error, capture it
    const afterSubmitBody = await couple.locator("body").innerText();
    const validationBlocked = /requires|at least|allows at most|not available|Select/i.test(afterSubmitBody)
      && !(await couple.getByText(/Submitted — waiting for your venue|Submitted — your venue will review/i).count());
    if (validationBlocked) {
      noteUx("Submit validation", afterSubmitBody.slice(0, 600), "Submit blocked with message — attempting recovery.", "ok");
      // Ensure buffet child + dinner selected and retry
      if (buffetOpt) {
        await couple.locator(`input[value="${buffetOpt.id}"]`).first().check({ force: true }).catch(() => undefined);
      }
      const depRadio = couple.locator('[data-testid="choices-dependent-group"] input[type="radio"]').first();
      if (await depRadio.count()) await depRadio.check({ force: true });
      await couple.waitForTimeout(400);
      await submitBtn.click();
      await couple.waitForTimeout(2500);
    }

    await couple.getByText(/Submitted — waiting for your venue|Submitted — your venue will review/i)
      .first().waitFor({ timeout: 30_000 }).catch(() => undefined);
    await couple.screenshot({ path: `${OUT}/choices-matrix/03-couple-submitted-1280.png`, fullPage: true });

    let submitted: { status: string; answers: unknown; submitted_at: string | null } | null = null;
    for (let i = 0; i < 24; i++) {
      const { data } = await admin.from("client_choices")
        .select("status,answers,submitted_at").eq("id", choicesId).maybeSingle();
      submitted = data as typeof submitted;
      if (data?.status === "submitted") break;
      await couple.waitForTimeout(500);
    }
    const ids = answerIds(submitted?.answers);
    const multiSelectedCount = multiOpts.filter((o) => ids.includes(o.id)).length;
    const hasBuffetParent = buffetOpt ? ids.includes(buffetOpt.id) : false;
    const hasPlatedOrphan = platedChildOpts.some((o) => ids.includes(o.id));
    const hasBuffetChild = buffetChildOpts.some((o) => ids.includes(o.id))
      || (platedChildOpts.length === 0 && ids.length > 0);

    record("matrix_submit_status", submitted?.status === "submitted", JSON.stringify(submitted), "live-ui+persisted");
    record(
      "matrix_multi_options_persisted",
      multiSelectedCount >= 1,
      JSON.stringify({ multiSelectedCount, multiOpts: multiOpts.map((o) => o.id), ids }),
      "live-ui+persisted",
    );
    record(
      "matrix_conditional_buffet_path_persisted",
      hasBuffetParent && !hasPlatedOrphan,
      JSON.stringify({ hasBuffetParent, hasPlatedOrphan, hasBuffetChild, ids }),
      "live-ui+persisted",
    );
    record(
      "matrix_no_stale_plated_child_after_buffet",
      !hasPlatedOrphan,
      JSON.stringify({ platedChildOpts: platedChildOpts.map((o) => o.id), ids }),
      "live-ui+persisted",
    );

    // Refresh + return
    await couple.reload({ waitUntil: "domcontentloaded" });
    await passLegal(couple);
    await couple.waitForTimeout(1200);
    const { data: refreshRow } = await admin.from("client_choices")
      .select("status,answers").eq("id", choicesId).maybeSingle();
    record(
      "matrix_refresh_preserves_answers",
      refreshRow?.status === "submitted"
        && JSON.stringify(answerIds(refreshRow.answers).sort()) === JSON.stringify([...ids].sort()),
      JSON.stringify({ status: refreshRow?.status, ids: answerIds(refreshRow?.answers) }),
      "live-ui+persisted",
    );

    // Duplicate submit attempt
    const submitAgain = couple.locator('[data-testid="portal-choices-submit"]')
      .or(couple.getByRole("button", { name: /^Submit$/i }));
    if ((await submitAgain.count()) > 0 && await submitAgain.first().isVisible().catch(() => false)) {
      await submitAgain.first().click().catch(() => undefined);
      await couple.waitForTimeout(1500);
    }
    const { count: packets } = await admin.from("client_choices")
      .select("id", { count: "exact", head: true }).eq("event_id", eventId);
    record("matrix_no_duplicate_packets", (packets ?? 0) === 1, `packets=${packets}`, "persisted");

    // Venue interpretation
    await page.goto(`${APP}/events/${eventId}#event-order-choices`, {
      waitUntil: "domcontentloaded", timeout: 90_000,
    });
    await page.waitForTimeout(2800);
    await page.screenshot({ path: `${OUT}/choices-matrix/04-venue-review-1280.png`, fullPage: true });
    const summary = page.locator('[data-testid="choices-submission-summary"]');
    const summaryOk = (await summary.count()) > 0 && await summary.isVisible().catch(() => false);
    const summaryText = summaryOk ? await summary.innerText() : "";
    const { data: venueRow } = await admin.from("client_choices")
      .select("status,answers").eq("id", choicesId).maybeSingle();
    record(
      "venue_matches_matrix_answers",
      venueRow?.status === "submitted"
        && JSON.stringify(answerIds(venueRow.answers).sort()) === JSON.stringify([...ids].sort()),
      JSON.stringify({ venueIds: answerIds(venueRow?.answers), ids, summaryOk }),
      "live-ui+persisted",
    );
    record(
      "venue_summary_visible_without_raw_ids_only",
      summaryOk && !/^[0-9a-f-]{36}$/m.test(summaryText.trim()),
      summaryText.slice(0, 500),
      "live-ui",
    );
    noteUx(
      "Venue matrix receipt",
      summaryText,
      summaryOk ? "Venue can read submitted multi/conditional choices." : "Summary missing.",
      summaryOk ? "ok" : "p2",
    );

    const { data: eoFinal } = await admin.from("event_orders")
      .select("shared_at,finalized_at,client_agreed_at,status").eq("id", eoId).maybeSingle();
    record(
      "matrix_submit_does_not_mutate_eo",
      eoFinal?.shared_at == null && eoFinal?.finalized_at == null && eoFinal?.client_agreed_at == null,
      JSON.stringify(eoFinal),
      "persisted",
    );

    await coupleCtx.close();
    persisted.finalAnswers = submitted?.answers ?? null;
    persisted.usability = usability;
  } catch (err) {
    let detail = err instanceof Error ? (err.stack ?? err.message) : "";
    if (!detail) try { detail = JSON.stringify(err); } catch { detail = String(err); }
    record("harness_error", false, detail, "harness");
    try { await page.screenshot({ path: `${OUT}/choices-matrix/harness-error.png`, fullPage: true }); } catch { /* */ }
  } finally {
    await browser.close();
    if (!process.env.KEEP_FIXTURE) await cleanup({ clientId, eventId, portalToken, eoId });
    const pass = checks.every((c) => c.pass);
    const blockers = usability.filter((u) => u.severity === "blocker" || u.severity === "p2");
    writeFileSync(`${OUT}/choices-matrix-results.json`, JSON.stringify({
      pass, run: RUN, expectedSha: EXPECTED, checks, usability,
      blockers: blockers.length, persisted,
    }, null, 2));
    writeFileSync(`${OUT}/choices-matrix-persisted.json`, JSON.stringify(persisted, null, 2));
    console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} passed; UX blockers/p2=${blockers.length}`);
    process.exitCode = pass && blockers.length === 0 ? 0 : 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
