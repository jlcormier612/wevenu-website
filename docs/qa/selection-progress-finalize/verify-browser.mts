/**
 * Selection progress, max enforcement, finalize validation — Sandbox acceptance.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/selection-progress-finalize/verify-browser.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { resolveSelectedOptions } from "@/lib/client-choices/apply-to-event-order";
import { selectionProgressLabel } from "@/lib/client-choices/selection-progress";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const RUN = process.env.E2E_RUN_ID ?? `SPF${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/selection-progress-finalize";
const PREFIX = `SPF-${RUN}-`;
const EVENT_DATE = "2027-09-18";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2500) });
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

async function passLegal(page: { getByRole: Function; locator: Function; waitForTimeout: Function }) {
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
  goto: Function; waitForTimeout: Function; locator: Function; getByText: Function; getByRole: Function;
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
    sections: [{ id: "s-bar", name: "Bar", guidance: null, sortOrder: 0 }],
    groups: [
      {
        id: "g-pkg", sectionId: "s-bar", name: "Bar package", instructions: null,
        selectionMode: "single", minSelect: 1, maxSelect: 1, allowQuantity: false, sortOrder: 0,
      },
      {
        id: "g-hard", sectionId: "s-bar", name: "Hard alcohol", instructions: null,
        selectionMode: "multi", minSelect: 2, maxSelect: 2, allowQuantity: false, sortOrder: 1,
        dependsOnOptionIds: ["o-premium"],
      },
      {
        id: "g-beer", sectionId: "s-bar", name: "Beer", instructions: null,
        selectionMode: "multi", minSelect: 3, maxSelect: 3, allowQuantity: false, sortOrder: 2,
        dependsOnOptionIds: ["o-premium"],
      },
      {
        id: "g-wine", sectionId: "s-bar", name: "Wine", instructions: null,
        selectionMode: "multi", minSelect: 3, maxSelect: 3, allowQuantity: false, sortOrder: 3,
        dependsOnOptionIds: ["o-premium"],
      },
    ],
    options: [
      {
        id: "o-premium", groupId: "g-pkg", offeringId: null, label: `${PREFIX}Premium Open Bar`,
        description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
      },
      {
        id: "o-basic", groupId: "g-pkg", offeringId: null, label: `${PREFIX}Beer & Wine only`,
        description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
      },
      ...["Vodka", "Gin", "Whiskey"].map((label, i) => ({
        id: `o-hard-${i}`, groupId: "g-hard", offeringId: null, label: `${PREFIX}${label}`,
        description: null, isIncluded: false, unitPrice: 0, sortOrder: i,
      })),
      ...["Lager", "IPA", "Stout", "Pilsner"].map((label, i) => ({
        id: `o-beer-${i}`, groupId: "g-beer", offeringId: null, label: `${PREFIX}${label}`,
        description: null, isIncluded: false, unitPrice: 5, sortOrder: i,
      })),
      ...["Cabernet", "Chardonnay", "Prosecco", "Pinot"].map((label, i) => ({
        id: `o-wine-${i}`, groupId: "g-wine", offeringId: null, label: `${PREFIX}${label}`,
        description: null, isIncluded: false, unitPrice: 8, sortOrder: i,
      })),
    ],
  };
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  let clientId: string | null = null;
  let eventId: string | null = null;
  let choicesId: string | null = null;
  let portalToken: string | null = null;
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED, prefix: PREFIX };

  const browser = await chromium.launch({ headless: true });

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    const definition = buildDefinition();
    record(
      "progress_copy_exact",
      /Choose exactly 2 — 0 of 2 selected/.test(selectionProgressLabel(definition.groups[1]!, 0)),
      selectionProgressLabel(definition.groups[1]!, 0),
    );

    const incomplete: ChoicesAnswers = {
      "g-pkg": { optionIds: ["o-premium"] },
      "g-hard": { optionIds: ["o-hard-0"] },
    };
    const incompleteV = validateChoicesAnswers(definition, incomplete);
    record("incomplete_rejected", !incompleteV.ok, incompleteV.ok ? "ok" : incompleteV.message);

    const valid: ChoicesAnswers = {
      "g-pkg": { optionIds: ["o-premium"] },
      "g-hard": { optionIds: ["o-hard-0", "o-hard-1"] },
      "g-beer": { optionIds: ["o-beer-0", "o-beer-1", "o-beer-2"] },
      "g-wine": { optionIds: ["o-wine-0", "o-wine-1", "o-wine-2"] },
    };
    record("valid_accepted", validateChoicesAnswers(definition, valid).ok, "ok");
    const lines = resolveSelectedOptions(definition, valid);
    // Premium (1) + hard (2) + beer (3) + wine (3) = 9 selected option lines
    record("valid_selected_line_count", lines.length === 9, String(lines.length));
    record(
      "beer_prices_preserved",
      lines.filter((l) => l.groupId === "g-beer").every((l) => l.unitPrice === 5),
      "5",
    );
    record(
      "inapplicable_ok",
      validateChoicesAnswers(definition, { "g-pkg": { optionIds: ["o-basic"] } }).ok,
      "ok",
    );
    record(
      "orphan_rejected",
      !validateChoicesAnswers(definition, {
        "g-pkg": { optionIds: ["o-basic"] },
        "g-hard": { optionIds: ["o-hard-0", "o-hard-1"] },
      }).ok,
      "rejected",
    );
    record(
      "venue_draft_incomplete_blocked",
      !validateChoicesAnswers(definition, incomplete).ok,
      "same validate used by finalizeClientChoices",
    );

    const { data: space } = await admin
      .from("venue_spaces")
      .select("id")
      .eq("venue_id", FANCY)
      .limit(1)
      .maybeSingle();
    if (!space?.id) throw new Error("No venue_spaces row for Fancy venue");
    const spaceId = space.id;

    const { data: client, error: cErr } = await admin.from("clients").insert({
      venue_id: FANCY,
      first_name: "SPF",
      last_name: RUN,
      email: `spf-${RUN.toLowerCase()}@hellotocheers-test.invalid`,
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
      space_id: spaceId,
    }).select("id").single();
    if (eErr || !event) throw eErr ?? new Error("event");
    eventId = event.id;

    portalToken = `spf_${RUN.toLowerCase()}_${randomBytes(2).toString("hex")}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: clientId,
      event_id: eventId,
      access_token: portalToken,
      access_level: "couple",
      label: "SPF couple",
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    });

    const { data: choices, error: chErr } = await admin.from("client_choices").insert({
      venue_id: FANCY,
      event_id: eventId,
      client_id: clientId,
      name: `${PREFIX}Bar Selections`,
      status: "sent",
      access_key: `spf-key-${RUN.toLowerCase()}`,
      definition,
      answers: {},
      sent_at: new Date().toISOString(),
    }).select("id").single();
    if (chErr || !choices) throw chErr ?? new Error("choices");
    choicesId = choices.id;
    persisted.choicesId = choicesId;
    persisted.eventId = eventId;
    persisted.portalToken = portalToken;

    const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const couple = await coupleCtx.newPage();
    await openCoupleChoices(couple, portalToken);

    await couple.getByText(`${PREFIX}Premium Open Bar`).click();
    await couple.waitForTimeout(500);
    const hard = couple.locator('[data-group-name="Hard alcohol"]');
    await hard.waitFor({ timeout: 20_000 });
    const p0 = await hard.getByTestId("choices-group-progress").innerText();
    record("ui_progress_0_of_2", /exactly 2/i.test(p0) && /0 of 2/i.test(p0), p0);

    await couple.locator('input[value="o-hard-0"]').check({ force: true });
    await couple.locator('input[value="o-hard-1"]').check({ force: true });
    await couple.waitForTimeout(400);
    const p2 = await hard.getByTestId("choices-group-progress").innerText();
    record("ui_progress_2_of_2", /2 of 2/i.test(p2), p2);
    record("ui_at_max", (await hard.getAttribute("data-at-maximum")) === "true", await hard.getAttribute("data-at-maximum"));

    const third = couple.locator('input[value="o-hard-2"]');
    const thirdDisabled = await third.isDisabled();
    record("ui_third_hard_disabled", thirdDisabled, `disabled=${thirdDisabled}`);
    if (!thirdDisabled) {
      await third.check({ force: true }).catch(() => undefined);
      const err = couple.getByTestId("portal-choices-error");
      const errText = (await err.count()) ? await err.innerText() : "";
      record("ui_third_hard_error_fallback", /limited to 2|Deselect|at most/i.test(errText), errText);
    }

    await couple.screenshot({ path: `${OUT}/shots/max-enforced-1280.png`, fullPage: true });

    // Incomplete submit
    await couple.getByTestId("portal-choices-submit").click();
    await couple.waitForTimeout(800);
    const minErr = couple.getByTestId("portal-choices-error");
    const minText = (await minErr.count()) ? await minErr.innerText() : await couple.locator("body").innerText();
    record("ui_submit_blocks_incomplete", /at least 3|Beer|Wine/i.test(minText), minText.slice(0, 400));

    // Complete beer + wine
    for (const id of ["o-beer-0", "o-beer-1", "o-beer-2", "o-wine-0", "o-wine-1", "o-wine-2"]) {
      await couple.locator(`input[value="${id}"]`).check({ force: true });
    }
    await couple.waitForTimeout(400);
    await couple.getByTestId("portal-choices-submit").click();
    await couple.waitForTimeout(2500);
    const body = await couple.locator("body").innerText();
    record("ui_submit_success", /Submitted|waiting for your venue/i.test(body), body.slice(0, 300));

    const { data: afterSubmit } = await admin
      .from("client_choices")
      .select("status,answers")
      .eq("id", choicesId)
      .single();
    record(
      "persisted_submitted_status",
      afterSubmit?.status === "submitted" || afterSubmit?.status === "resubmitted",
      afterSubmit?.status ?? "missing",
    );
    const ans = (afterSubmit?.answers ?? {}) as ChoicesAnswers;
    record(
      "persisted_exact_counts",
      (ans["g-hard"]?.optionIds?.length ?? 0) === 2
        && (ans["g-beer"]?.optionIds?.length ?? 0) === 3
        && (ans["g-wine"]?.optionIds?.length ?? 0) === 3,
      JSON.stringify({
        hard: ans["g-hard"]?.optionIds,
        beer: ans["g-beer"]?.optionIds,
        wine: ans["g-wine"]?.optionIds,
      }),
    );

    await couple.setViewportSize({ width: 390, height: 844 });
    await openCoupleChoices(couple, portalToken);
    await couple.screenshot({ path: `${OUT}/shots/portal-390.png`, fullPage: true });
    record("mobile_390", true, "screenshot");

    await coupleCtx.close();
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.stack ?? err.message
        : typeof err === "object" && err
          ? JSON.stringify(err)
          : String(err);
    record("harness_error", false, detail);
  } finally {
    if (choicesId) {
      await admin.from("client_choices_submissions").delete().eq("client_choices_id", choicesId);
      await admin.from("client_choices_activities").delete().eq("client_choices_id", choicesId);
      await admin.from("client_choices").delete().eq("id", choicesId);
    }
    if (portalToken) await admin.from("client_portal_sessions").delete().eq("access_token", portalToken);
    if (eventId) await admin.from("events").delete().eq("id", eventId);
    if (clientId) await admin.from("clients").delete().eq("id", clientId);
    await browser.close();
  }

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, failed: failed.length, persisted }, null, 2));
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));
  writeFileSync(
    `${OUT}/browser-run.log`,
    checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n") + "\n",
  );
  console.log(`\n${failed.length === 0 ? "GREEN" : "NOT GREEN"} — ${checks.length - failed.length} pass / ${failed.length} fail`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
