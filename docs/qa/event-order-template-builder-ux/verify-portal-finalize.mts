/**
 * Live portal submit + venue finalizeClientChoices click path — Sandbox.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/event-order-template-builder-ux/verify-portal-finalize.mts
 *
 * Covers the OPEN gap left by builder UX STATUS: actual portal UI submit and
 * staff UI finalize (choices-create-event-order → finalizeClientChoicesAction),
 * not isolated validators alone.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `EOPF${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/event-order-template-builder-ux";
const PREFIX = `EOPF-${RUN}-`;
const EVENT_DATE = `2028-${String((Date.now() % 11) + 1).padStart(2, "0")}-${String((Date.now() % 27) + 1).padStart(2, "0")}`;
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string; kind?: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string, kind = "check") {
  checks.push({ name, pass, detail: String(detail).slice(0, 2500), kind });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
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
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: EMAIL,
      });
      if (linkErr || !link?.properties?.hashed_token) throw linkErr ?? new Error("no link");
      const { data: otp, error } = await anon.auth.verifyOtp({
        type: "email",
        token_hash: link.properties.hashed_token,
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
          name: c.name,
          value: c.value,
          domain: "app.sandbox.hellotocheers.com",
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "Lax" as const,
        })),
        {
          name: "htc_active_venue_id",
          value: FANCY,
          domain: "app.sandbox.hellotocheers.com",
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "Lax" as const,
        },
      ];
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function passLegal(page: {
  getByRole: Function;
  locator: Function;
  waitForTimeout: Function;
}) {
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

async function openCoupleChoices(page: {
  goto: Function;
  waitForTimeout: Function;
  locator: Function;
  getByText: Function;
  getByRole: Function;
}, token: string) {
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
  await page.waitForTimeout(800);
}

function buildDefinition(): ChoicesDefinition {
  return {
    sections: [{ id: "s-catering", name: "Catering", guidance: null, sortOrder: 0 }],
    groups: [
      {
        id: "g-dinner", sectionId: "s-catering", name: "Dinner style", instructions: null,
        selectionMode: "single", minSelect: 1, maxSelect: 1, allowQuantity: false, sortOrder: 0,
      },
      {
        id: "g-sides", sectionId: "s-catering", name: "Sides", instructions: null,
        selectionMode: "multi", minSelect: 1, maxSelect: 2, allowQuantity: false, sortOrder: 1,
        dependsOnOptionIds: ["o-buffet"],
      },
      {
        id: "g-entree", sectionId: "s-catering", name: "Entrées", instructions: null,
        selectionMode: "single", minSelect: 1, maxSelect: 1, allowQuantity: false, sortOrder: 2,
        dependsOnOptionIds: ["o-plated"],
      },
    ],
    options: [
      {
        id: "o-buffet", groupId: "g-dinner", offeringId: null, label: `${PREFIX}Buffet Dinner`,
        description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
      },
      {
        id: "o-plated", groupId: "g-dinner", offeringId: null, label: `${PREFIX}Plated Dinner`,
        description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
      },
      {
        id: "o-caesar", groupId: "g-sides", offeringId: null, label: `${PREFIX}Caesar salad`,
        description: null, isIncluded: false, unitPrice: 8, sortOrder: 0,
      },
      {
        id: "o-roast", groupId: "g-sides", offeringId: null, label: `${PREFIX}Roasted Vegetables`,
        description: null, isIncluded: false, unitPrice: 6, sortOrder: 1,
      },
      {
        id: "o-potato", groupId: "g-sides", offeringId: null, label: `${PREFIX}Mashed Potatoes`,
        description: null, isIncluded: false, unitPrice: 5, sortOrder: 2,
      },
      {
        id: "o-chicken", groupId: "g-entree", offeringId: null, label: `${PREFIX}Chicken Marsala`,
        description: null, isIncluded: false, unitPrice: 42, sortOrder: 0,
      },
      {
        id: "o-steak", groupId: "g-entree", offeringId: null, label: `${PREFIX}Filet`,
        description: null, isIncluded: false, unitPrice: 68, sortOrder: 1,
      },
    ],
  };
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  let clientId: string | null = null;
  let eventId: string | null = null;
  let eoId: string | null = null;
  let sectionId: string | null = null;
  let markerLineId: string | null = null;
  let choicesId: string | null = null;
  let portalToken: string | null = null;
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED, prefix: PREFIX };

  const browser = await chromium.launch({ headless: true });
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const staff = await staffCtx.newPage();
  const couple = await coupleCtx.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`, "deploy");
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    await staffCtx.addCookies(await staffCookies());

    const definition = buildDefinition();
    const incomplete: ChoicesAnswers = { "g-dinner": { optionIds: ["o-plated"] } };
    record(
      "server_incomplete_rejected",
      !validateChoicesAnswers(definition, incomplete).ok,
      validateChoicesAnswers(definition, incomplete).ok
        ? "ok"
        : validateChoicesAnswers(definition, incomplete).message ?? "rejected",
      "validation",
    );
    const overMax: ChoicesAnswers = {
      "g-dinner": { optionIds: ["o-buffet"] },
      "g-sides": { optionIds: ["o-caesar", "o-roast", "o-potato"] },
    };
    record(
      "server_overmax_rejected",
      !validateChoicesAnswers(definition, overMax).ok,
      validateChoicesAnswers(definition, overMax).message ?? "rejected",
      "validation",
    );

    const { data: space } = await admin.from("venue_spaces").select("id").eq("venue_id", FANCY).limit(1).maybeSingle();
    if (!space?.id) throw new Error("no space");

    const { data: client, error: cErr } = await admin.from("clients").insert({
      venue_id: FANCY,
      first_name: "EOPF",
      last_name: RUN,
      email: `eopf-${RUN.toLowerCase()}@hellotocheers-test.invalid`,
      status: "confirmed",
    }).select("id").single();
    if (cErr || !client) throw cErr ?? new Error("client");
    clientId = client.id;

    const { data: event, error: eErr } = await admin.from("events").insert({
      venue_id: FANCY,
      client_id: clientId,
      name: `${PREFIX}Wedding`,
      event_type: "wedding",
      event_date: EVENT_DATE,
      event_end_date: EVENT_DATE,
      status: "confirmed",
      booked_at: new Date().toISOString(),
      space_id: space.id,
    }).select("id").single();
    if (eErr || !event) throw eErr ?? new Error("event");
    eventId = event.id;

    const { data: eo, error: eoErr } = await admin.from("event_orders").insert({
      venue_id: FANCY,
      event_id: eventId,
      status: "open",
      revision: 1,
    }).select("id").single();
    if (eoErr || !eo) throw eoErr ?? new Error("eo");
    eoId = eo.id;

    const { data: section } = await admin.from("event_order_sections").insert({
      venue_id: FANCY,
      event_order_id: eoId,
      name: "Venue fixed",
      sort_order: 0,
    }).select("id").single();
    sectionId = section?.id ?? null;

    const markerDesc = `${PREFIX}MARKER-venue-fixed-line`;
    const { data: marker } = await admin.from("event_order_lines").insert({
      venue_id: FANCY,
      event_order_id: eoId,
      section_id: sectionId,
      provenance: "custom",
      description: markerDesc,
      quantity: 1,
      unit_price: 25,
      amount: 25,
      is_included: false,
      sort_order: 0,
    }).select("id,description,unit_price,is_included").single();
    markerLineId = marker?.id ?? null;
    persisted.marker = marker;

    portalToken = `eopf_${RUN.toLowerCase()}_${randomBytes(2).toString("hex")}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: clientId,
      event_id: eventId,
      access_token: portalToken,
      access_level: "couple",
      label: "EOPF couple",
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    });

    const { data: choices, error: chErr } = await admin.from("client_choices").insert({
      venue_id: FANCY,
      event_id: eventId,
      client_id: clientId,
      name: `${PREFIX}Dinner Selections`,
      status: "sent",
      access_key: `eopf-key-${RUN.toLowerCase()}`,
      definition,
      answers: {},
      sent_at: new Date().toISOString(),
    }).select("id").single();
    if (chErr || !choices) throw chErr ?? new Error("choices");
    choicesId = choices.id;
    persisted.choicesId = choicesId;
    persisted.eventId = eventId;
    persisted.eoId = eoId;
    persisted.portalToken = portalToken;

    // ---- Portal: incomplete reject (no EO mutation) ----
    await openCoupleChoices(couple, portalToken);
    await couple.getByText(`${PREFIX}Plated Dinner`).click();
    await couple.waitForTimeout(500);
    const beforeIncomplete = await admin
      .from("event_order_lines")
      .select("id", { count: "exact", head: true })
      .eq("event_order_id", eoId);
    await couple.getByTestId("portal-choices-submit").click();
    await couple.waitForTimeout(1000);
    const incompleteErr = couple.getByTestId("portal-choices-error");
    const incompleteText = (await incompleteErr.count())
      ? await incompleteErr.innerText()
      : await couple.locator("body").innerText();
    record(
      "portal_rejects_incomplete_followup",
      /Entrée|at least|Choose|select/i.test(incompleteText),
      incompleteText.slice(0, 400),
      "portal",
    );
    const afterIncomplete = await admin
      .from("event_order_lines")
      .select("id", { count: "exact", head: true })
      .eq("event_order_id", eoId);
    record(
      "portal_incomplete_no_eo_mutation",
      (beforeIncomplete.count ?? 0) === (afterIncomplete.count ?? 0)
        && (afterIncomplete.count ?? 0) === 1,
      `before=${beforeIncomplete.count} after=${afterIncomplete.count}`,
      "persisted",
    );
    await couple.screenshot({ path: `${OUT}/shots/portal-incomplete-reject-1280.png`, fullPage: true });

    // ---- Portal: over-max blocked on Sides (buffet path) — do not submit a valid 2-of-2 ----
    await couple.getByText(`${PREFIX}Buffet Dinner`).click();
    await couple.waitForTimeout(600);
    await couple.locator('input[value="o-caesar"]').check({ force: true });
    await couple.locator('input[value="o-roast"]').check({ force: true });
    await couple.waitForTimeout(400);
    const potato = couple.locator('input[value="o-potato"]');
    const potatoDisabled = await potato.isDisabled().catch(() => false);
    let overText = potatoDisabled ? "third side disabled at max" : "";
    if (!potatoDisabled) {
      await potato.check({ force: true }).catch(() => undefined);
      await couple.getByTestId("portal-choices-submit").click();
      await couple.waitForTimeout(900);
      const overErr = couple.getByTestId("portal-choices-error");
      overText = (await overErr.count())
        ? await overErr.innerText()
        : await couple.locator("body").innerText();
    }
    record(
      "portal_rejects_or_blocks_overmax",
      potatoDisabled || /at most 2|limited to 2|Deselect|maximum|Sides/i.test(overText),
      `disabled=${potatoDisabled} text=${overText.slice(0, 300)}`,
      "portal",
    );
    const { data: statusAfterOver } = await admin
      .from("client_choices")
      .select("status")
      .eq("id", choicesId)
      .single();
    record(
      "portal_overmax_not_submitted",
      statusAfterOver?.status === "sent" || statusAfterOver?.status === "in_progress",
      statusAfterOver?.status ?? "missing",
      "persisted",
    );

    // ---- Portal: valid plated path ----
    // Clear buffet sides by switching primary answer (dependents hide)
    await couple.getByText(`${PREFIX}Plated Dinner`).click({ force: true });
    await couple.waitForTimeout(700);
    await couple.locator('input[value="o-chicken"]').check({ force: true });
    await couple.waitForTimeout(400);
    await couple.getByTestId("portal-choices-submit").click();
    let afterSubmit: { status: string; answers: ChoicesAnswers | null; applied_line_ids: string[] | null } | null = null;
    for (let i = 0; i < 20; i++) {
      const { data } = await admin
        .from("client_choices")
        .select("status,answers,applied_line_ids")
        .eq("id", choicesId)
        .single();
      afterSubmit = data as typeof afterSubmit;
      if (data?.status === "submitted" || data?.status === "resubmitted") break;
      await couple.waitForTimeout(500);
    }
    const submitBody = await couple.locator("body").innerText();
    record(
      "portal_valid_submit_success",
      afterSubmit?.status === "submitted"
        || afterSubmit?.status === "resubmitted"
        || /Submitted|waiting for your venue|Client Submitted/i.test(submitBody),
      `status=${afterSubmit?.status} ui=${submitBody.slice(0, 300)}`,
      "portal",
    );
    await couple.screenshot({ path: `${OUT}/shots/portal-submitted-1280.png`, fullPage: true });

    const ans = (afterSubmit?.answers ?? {}) as ChoicesAnswers;
    record(
      "persisted_submitted_status",
      afterSubmit?.status === "submitted" || afterSubmit?.status === "resubmitted",
      afterSubmit?.status ?? "missing",
      "persisted",
    );
    record(
      "persisted_plated_path_answers",
      (ans["g-dinner"]?.optionIds ?? []).includes("o-plated")
        && (ans["g-entree"]?.optionIds ?? []).includes("o-chicken")
        && !(ans["g-sides"]?.optionIds?.length),
      JSON.stringify(ans),
      "persisted",
    );
    const linesBeforeFinalize = await admin
      .from("event_order_lines")
      .select("id,description")
      .eq("event_order_id", eoId);
    record(
      "submit_does_not_create_choice_lines",
      (linesBeforeFinalize.data ?? []).length === 1
        && (linesBeforeFinalize.data ?? []).every((l) => l.description === markerDesc),
      JSON.stringify(linesBeforeFinalize.data),
      "persisted",
    );

    // Playwright auto-dismisses native confirm as cancel unless accepted here.
    staff.on("dialog", async (dialog) => {
      try {
        await dialog.accept();
      } catch { /* already handled */ }
    });

    async function clickFinalizeAndWait(label: string) {
      // Refresh staff session before venue mutations (portal work can be long).
      await staffCtx.clearCookies();
      await staffCtx.addCookies(await staffCookies());
      await staff.goto(`${APP}/events/${eventId}`, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await staff.waitForTimeout(2000);
      await staff.evaluate(() => {
        window.location.hash = "event-order-choices";
      });
      await staff.waitForTimeout(2000);
      const panel = staff.locator('[data-testid="client-choices-panel"], [data-testid="event-order-choices"], #event-order-choices').first();
      await panel.waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
      const btn = staff.getByTestId("choices-create-event-order");
      await btn.waitFor({ state: "visible", timeout: 60_000 });
      await btn.scrollIntoViewIfNeeded();
      const btnText = await btn.innerText();

      for (let attempt = 0; attempt < 3; attempt++) {
        await btn.click({ force: true });
        for (let i = 0; i < 20; i++) {
          const { data } = await admin
            .from("client_choices")
            .select("status,applied_line_ids,answers")
            .eq("id", choicesId)
            .single();
          if (data?.status === "finalized" && (data.applied_line_ids?.length ?? 0) > 0) {
            return data;
          }
          const toast = staff.locator("[data-sonner-toast]").filter({
            hasText: /Could not update|Selections are incomplete|Choose an option/i,
          });
          if (await toast.count()) {
            return { ...data, _uiError: await toast.first().innerText(), _btnText: btnText };
          }
          await staff.waitForTimeout(500);
        }
      }
      const { data: last } = await admin
        .from("client_choices")
        .select("status,applied_line_ids,answers")
        .eq("id", choicesId)
        .single();
      await staff.screenshot({ path: `${OUT}/shots/finalize-stuck-${label.replace(/\s+/g, "-")}.png`, fullPage: true }).catch(() => undefined);
      const body = await staff.locator("body").innerText().catch(() => "");
      throw new Error(
        `${label} did not settle (btn=${btnText}): ${JSON.stringify(last)} body=${body.slice(0, 800)}`,
      );
    }

    // ---- Staff finalize via real UI (finalizeClientChoices) ----
    await staff.screenshot({ path: `${OUT}/shots/venue-before-finalize-1280.png`, fullPage: true }).catch(() => undefined);
    const finalizedRow = await clickFinalizeAndWait("initial finalize") as {
      status: string;
      applied_line_ids: string[] | null;
      answers: ChoicesAnswers | null;
    };
    record(
      "finalize_sets_status_finalized",
      finalizedRow?.status === "finalized",
      JSON.stringify(finalizedRow),
      "finalization",
    );
    const appliedIds = finalizedRow?.applied_line_ids ?? [];
    record(
      "finalize_records_applied_line_ids",
      appliedIds.length >= 2,
      JSON.stringify(appliedIds),
      "finalization",
    );

    const { data: eoLines } = await admin
      .from("event_order_lines")
      .select("id,description,unit_price,is_included,quantity,amount,offering_id")
      .eq("event_order_id", eoId);
    const choiceLines = (eoLines ?? []).filter((l) => appliedIds.includes(l.id));
    const markerStill = (eoLines ?? []).find((l) => l.id === markerLineId);
    record(
      "finalize_creates_expected_choice_lines",
      choiceLines.some((l) => /Plated Dinner/i.test(l.description))
        && choiceLines.some((l) => /Chicken Marsala/i.test(l.description) && Number(l.unit_price) === 42)
        && !choiceLines.some((l) => /Buffet|Caesar|Roasted|Filet/i.test(l.description)),
      JSON.stringify(choiceLines),
      "finalization",
    );
    record(
      "finalize_preserves_unrelated_marker_line",
      Boolean(markerStill)
        && markerStill!.description === markerDesc
        && Number(markerStill!.unit_price) === 25
        && markerStill!.is_included === false,
      JSON.stringify(markerStill),
      "finalization",
    );
    record(
      "finalize_line_count_exact",
      (eoLines ?? []).length === 1 + choiceLines.length
        && choiceLines.length === appliedIds.length,
      `total=${eoLines?.length} choice=${choiceLines.length} applied=${appliedIds.length}`,
      "finalization",
    );
    persisted.eoLinesAfterFinalize = eoLines;
    persisted.appliedIds = appliedIds;
    await staff.screenshot({ path: `${OUT}/shots/venue-after-finalize-1280.png`, fullPage: true });

    // ---- Duplicate finalize via Amend → submitted → Update (product revision path) ----
    const validAnswers = {
      "g-dinner": { optionIds: ["o-plated"] },
      "g-entree": { optionIds: ["o-chicken"] },
    };
    await staff.goto(`${APP}/events/${eventId}#event-order-choices`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await staff.waitForTimeout(2000);
    const amendBtn = staff.getByRole("button", { name: /^Amend$/i });
    if (await amendBtn.count()) {
      await amendBtn.click();
      await staff.waitForTimeout(2000);
    }
    // Keep applied_line_ids; restore a submitted packet with the same answers.
    await admin.from("client_choices").update({
      status: "submitted",
      answers: validAnswers,
      applied_line_ids: appliedIds,
      sent_at: new Date().toISOString(),
    }).eq("id", choicesId);
    const afterDup = await clickFinalizeAndWait("duplicate finalize") as {
      status: string;
      applied_line_ids: string[] | null;
    };
    const dupApplied = afterDup?.applied_line_ids ?? [];
    const { data: eoLinesDup } = await admin
      .from("event_order_lines")
      .select("id,description")
      .eq("event_order_id", eoId);
    const chickenCount = (eoLinesDup ?? []).filter((l) => /Chicken Marsala/i.test(l.description)).length;
    const platedCount = (eoLinesDup ?? []).filter((l) => /Plated Dinner/i.test(l.description)).length;
    const markerCount = (eoLinesDup ?? []).filter((l) => l.description === markerDesc).length;
    record(
      "duplicate_finalize_no_duplicate_lines",
      afterDup?.status === "finalized"
        && chickenCount === 1
        && platedCount === 1
        && markerCount === 1
        && dupApplied.length === 2,
      JSON.stringify({
        chickenCount,
        platedCount,
        markerCount,
        total: eoLinesDup?.length,
        priorApplied: appliedIds,
        dupApplied,
        replaced: JSON.stringify([...dupApplied].sort()) !== JSON.stringify([...appliedIds].sort()),
      }),
      "finalization",
    );
    persisted.eoLinesAfterDup = eoLinesDup;

    // ---- Rejected finalize with incomplete answers creates no EO mutation ----
    const linesSnapshot = (eoLinesDup ?? []).map((l) => l.id).sort();
    const { error: incompleteUpdateErr } = await admin.from("client_choices").update({
      status: "submitted",
      answers: incomplete,
      applied_line_ids: dupApplied,
    }).eq("id", choicesId);
    if (incompleteUpdateErr) throw incompleteUpdateErr;
    const { data: preReject } = await admin
      .from("client_choices")
      .select("status,answers,applied_line_ids")
      .eq("id", choicesId)
      .single();
    record(
      "reject_setup_incomplete_answers",
      preReject?.status === "submitted"
        && JSON.stringify(preReject.answers) === JSON.stringify(incomplete)
        && !validateChoicesAnswers(definition, (preReject.answers ?? {}) as ChoicesAnswers).ok,
      JSON.stringify(preReject),
      "finalization",
    );

    await staffCtx.clearCookies();
    await staffCtx.addCookies(await staffCookies());
    await staff.goto(`${APP}/events/${eventId}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await staff.waitForTimeout(2000);
    await staff.evaluate(() => {
      window.location.hash = "event-order-choices";
    });
    await staff.waitForTimeout(2000);
    const rejectBtn = staff.getByTestId("choices-create-event-order");
    await rejectBtn.waitFor({ state: "visible", timeout: 45_000 });
    await rejectBtn.click({ force: true });
    await staff.waitForTimeout(3000);
    const rejectBody = await staff.locator("body").innerText();
    const { data: afterRejectRow } = await admin
      .from("client_choices")
      .select("status,applied_line_ids,answers")
      .eq("id", choicesId)
      .single();
    const { data: eoAfterReject } = await admin
      .from("event_order_lines")
      .select("id,description")
      .eq("event_order_id", eoId);
    const afterRejectIds = (eoAfterReject ?? []).map((l) => l.id).sort();
    record(
      "rejected_finalize_no_partial_mutation",
      afterRejectRow?.status === "submitted"
        && JSON.stringify(afterRejectIds) === JSON.stringify(linesSnapshot)
        && JSON.stringify(afterRejectRow.applied_line_ids ?? []) === JSON.stringify(dupApplied),
      JSON.stringify({
        status: afterRejectRow?.status,
        uiHint: rejectBody.slice(0, 400),
        before: linesSnapshot,
        after: afterRejectIds,
        answers: afterRejectRow?.answers,
      }),
      "finalization",
    );
    await staff.screenshot({ path: `${OUT}/shots/venue-rejected-finalize-1280.png`, fullPage: true });

    await openCoupleChoices(couple, portalToken);
    await couple.screenshot({ path: `${OUT}/shots/portal-after-flow-1280.png`, fullPage: true });
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.stack ?? err.message
        : typeof err === "object" && err
          ? JSON.stringify(err)
          : String(err);
    record("harness_error", false, detail, "error");
    try {
      await couple.screenshot({ path: `${OUT}/shots/portal-finalize-error-couple.png`, fullPage: true });
      await staff.screenshot({ path: `${OUT}/shots/portal-finalize-error-staff.png`, fullPage: true });
    } catch { /* ignore */ }
  } finally {
    if (choicesId) {
      await admin.from("client_choices_submissions").delete().eq("client_choices_id", choicesId);
      await admin.from("client_choices_activities").delete().eq("client_choices_id", choicesId);
      await admin.from("client_choices").delete().eq("id", choicesId);
    }
    if (eoId) {
      await admin.from("event_order_lines").delete().eq("event_order_id", eoId);
      await admin.from("event_order_sections").delete().eq("event_order_id", eoId);
      await admin.from("event_orders").delete().eq("id", eoId);
    }
    if (portalToken) await admin.from("client_portal_sessions").delete().eq("access_token", portalToken);
    if (eventId) {
      try {
        await admin.from("tasks").delete().eq("event_id", eventId);
      } catch { /* optional cleanup */ }
      await admin.from("events").delete().eq("id", eventId);
    }
    if (clientId) await admin.from("clients").delete().eq("id", clientId);
    await browser.close();
  }

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(`${OUT}/portal-finalize-results.json`, JSON.stringify({ checks, failed: failed.length, persisted }, null, 2));
  writeFileSync(`${OUT}/portal-finalize-persisted.json`, JSON.stringify(persisted, null, 2));
  writeFileSync(
    `${OUT}/portal-finalize-run.log`,
    checks.map((c) => `${c.pass ? "PASS" : "FAIL"} [${c.kind}] ${c.name} — ${c.detail}`).join("\n") + "\n",
  );
  console.log(`\n${failed.length === 0 ? "GREEN" : "NOT GREEN"} — ${checks.length - failed.length} pass / ${failed.length} fail`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
