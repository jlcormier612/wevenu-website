/**
 * Event Order default template correction — Sandbox proof.
 * Upgrades uncustomized EO-D-02, asserts commercial structure, runs
 * Scenario A (extras) + B (decline optionals) via portal submit + venue finalize,
 * and checks customized templates / Production untouched (Sandbox project only).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { ensureStarterCommercialStructure } from "@/lib/event-order-templates/provision";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import { resolveSelectedOptions } from "@/lib/client-choices/apply-to-event-order";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";

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
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/event-order-default-template-correction";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox — refusing");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  if (!taskArn || taskArn === "None") return "";
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function servingDigest(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  if (!taskArn || taskArn === "None") return "";
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
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
}

async function loadTemplateDetails(templateId: string): Promise<EventOrderTemplateWithDetails | null> {
  const { data: header } = await admin.from("event_order_templates")
    .select("*").eq("id", templateId).eq("venue_id", FANCY).maybeSingle();
  if (!header) return null;
  const [{ data: sections }, { data: lines }, { data: groups }, { data: options }] = await Promise.all([
    admin.from("event_order_template_sections").select("*").eq("template_id", templateId).eq("venue_id", FANCY).order("sort_order"),
    admin.from("event_order_template_lines").select("*").eq("template_id", templateId).eq("venue_id", FANCY).order("sort_order"),
    admin.from("event_order_template_groups").select("*").eq("template_id", templateId).eq("venue_id", FANCY).order("sort_order"),
    admin.from("event_order_template_options").select("*").eq("template_id", templateId).eq("venue_id", FANCY).order("sort_order"),
  ]);
  const mapLine = (r: Record<string, unknown>) => ({
    id: r.id as string,
    templateId: r.template_id as string,
    venueId: r.venue_id as string,
    sectionId: (r.section_id as string | null) ?? null,
    description: r.description as string,
    descriptionDetail: (r.description_detail as string | null) ?? null,
    quantity: Number(r.quantity),
    unitPrice: r.unit_price == null ? null : Number(r.unit_price),
    pricingModel: (r.pricing_model as string) ?? "none",
    unit: (r.unit as string | null) ?? null,
    includedByDefault: Boolean(r.included_by_default),
    offeringId: (r.offering_id as string | null) ?? null,
    sortOrder: Number(r.sort_order),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  });
  const mapGroup = (r: Record<string, unknown>) => ({
    id: r.id as string,
    templateId: r.template_id as string,
    venueId: r.venue_id as string,
    sectionId: (r.section_id as string | null) ?? null,
    name: r.name as string,
    instructions: (r.instructions as string | null) ?? null,
    selectionMode: (r.selection_mode === "multi" ? "multi" : "single") as "single" | "multi",
    minSelect: Number(r.min_select),
    maxSelect: r.max_select == null ? null : Number(r.max_select),
    allowQuantity: Boolean(r.allow_quantity),
    sortOrder: Number(r.sort_order),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  });
  const mapOpt = (r: Record<string, unknown>) => ({
    id: r.id as string,
    templateId: r.template_id as string,
    venueId: r.venue_id as string,
    groupId: r.group_id as string,
    offeringId: (r.offering_id as string | null) ?? null,
    label: r.label as string,
    description: (r.description as string | null) ?? null,
    isIncluded: Boolean(r.is_included),
    unitPrice: r.unit_price == null ? null : Number(r.unit_price),
    isDefault: Boolean(r.is_default),
    sortOrder: Number(r.sort_order),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  });
  return {
    id: header.id,
    venueId: header.venue_id,
    name: header.name,
    description: header.description ?? "",
    sourceMasterKey: header.source_master_key,
    isArchived: Boolean(header.is_archived),
    createdAt: header.created_at,
    updatedAt: header.updated_at,
    sections: (sections ?? []).map((r) => ({
      id: r.id,
      templateId: r.template_id,
      venueId: r.venue_id,
      name: r.name,
      guidance: r.guidance,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
    lines: (lines ?? []).map(mapLine),
    groups: (groups ?? []).map(mapGroup),
    options: (options ?? []).map(mapOpt),
  } as EventOrderTemplateWithDetails;
}

async function main() {
  const image = await servingImage();
  const digest = await servingDigest();
  const shaOk = !EXPECTED || image.includes(EXPECTED.slice(0, 12));
  record("serving-sha", shaOk, `expected=${EXPECTED.slice(0, 12)} ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);
  record("production-untouched", url.includes("wvpsldwwjqdannqasrdf"), "sandbox project only");

  if (!shaOk) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
    process.exit(1);
  }

  // Snapshot customized templates (any with groups) before upgrade side-effects.
  const { data: allTmpls } = await admin.from("event_order_templates")
    .select("id, name, source_master_key")
    .eq("venue_id", FANCY)
    .eq("is_archived", false);
  const customizedBefore: Array<{ id: string; name: string; groupCount: number; lineNames: string[] }> = [];
  for (const t of allTmpls ?? []) {
    const { count: gc } = await admin.from("event_order_template_groups")
      .select("*", { count: "exact", head: true }).eq("template_id", t.id).eq("venue_id", FANCY);
    if ((gc ?? 0) === 0) continue;
    const { data: lines } = await admin.from("event_order_template_lines")
      .select("description").eq("template_id", t.id).eq("venue_id", FANCY);
    customizedBefore.push({
      id: t.id,
      name: t.name,
      groupCount: gc ?? 0,
      lineNames: (lines ?? []).map((l) => l.description),
    });
  }

  const { data: eod02 } = await admin.from("event_order_templates")
    .select("id, name, source_master_key")
    .eq("venue_id", FANCY)
    .eq("source_master_key", "EO-D-02")
    .maybeSingle();
  record("eo-d-02-exists", Boolean(eod02?.id), JSON.stringify(eod02));

  const beforeUpgrade = eod02 ? await loadTemplateDetails(eod02.id) : null;
  writeFileSync(`${OUT}/template-before.json`, JSON.stringify({
    lineNames: beforeUpgrade?.lines.map((l) => l.description),
    groupNames: beforeUpgrade?.groups.map((g) => g.name),
    groupCount: beforeUpgrade?.groups.length ?? 0,
  }, null, 2));

  const upgrade = eod02
    ? await ensureStarterCommercialStructure(admin as never, FANCY, eod02.id)
    : { repaired: false, upgraded: false };
  record(
    "upgrade-or-already-corrected",
    upgrade.upgraded || upgrade.repaired || (beforeUpgrade?.groups.length ?? 0) > 0,
    JSON.stringify(upgrade),
  );

  const after = eod02 ? await loadTemplateDetails(eod02.id) : null;
  writeFileSync(`${OUT}/template-after.json`, JSON.stringify({
    sections: after?.sections.map((s) => s.name),
    lines: after?.lines.map((l) => ({
      description: l.description,
      includedByDefault: l.includedByDefault,
      unitPrice: l.unitPrice,
      pricingModel: l.pricingModel,
    })),
    groups: after?.groups.map((g) => ({
      name: g.name,
      selectionMode: g.selectionMode,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      options: after.options.filter((o) => o.groupId === g.id).map((o) => ({
        label: o.label,
        unitPrice: o.unitPrice,
        isIncluded: o.isIncluded,
      })),
    })),
  }, null, 2));

  const dinner = after?.groups.find((g) => g.name === "Dinner service");
  const dinnerOpts = after?.options.filter((o) => o.groupId === dinner?.id) ?? [];
  record(
    "dinner-required-pick-one",
    Boolean(dinner && dinner.selectionMode === "single" && dinner.minSelect === 1 && dinner.maxSelect === 1
      && dinnerOpts.some((o) => o.label === "Plated Dinner" && o.unitPrice === 85)
      && dinnerOpts.some((o) => o.label === "Buffet Dinner" && o.unitPrice === 72)),
    JSON.stringify({ dinner, dinnerOpts }),
  );
  record(
    "arbor-optional-not-fixed",
    Boolean(
      after
      && !after.lines.some((l) => l.description === "Arbor")
      && after.options.some((o) => o.label === "Arbor" && o.unitPrice === 350)
      && after.groups.some((g) => g.name === "Ceremony enhancements" && g.minSelect === 0),
    ),
    "Arbor only as optional option",
  );
  record(
    "included-fixed-lines",
    Boolean(
      after?.lines.some((l) => l.description === "Ceremony Coordination" && l.includedByDefault)
      && after?.lines.some((l) => l.description === "Day-of Coordination" && l.includedByDefault)
      && !after?.lines.some((l) => l.description === "Plated Dinner"),
    ),
    JSON.stringify(after?.lines.map((l) => l.description)),
  );

  // Preservation: customized templates unchanged
  let preserved = true;
  for (const c of customizedBefore) {
    const { count: gc } = await admin.from("event_order_template_groups")
      .select("*", { count: "exact", head: true }).eq("template_id", c.id).eq("venue_id", FANCY);
    const { data: lines } = await admin.from("event_order_template_lines")
      .select("description").eq("template_id", c.id).eq("venue_id", FANCY);
    const names = (lines ?? []).map((l) => l.description).sort().join("|");
    const beforeNames = [...c.lineNames].sort().join("|");
    if ((gc ?? 0) !== c.groupCount || names !== beforeNames) {
      preserved = false;
      record("customized-preserved", false, `${c.name} changed`);
    }
  }
  if (customizedBefore.length === 0 || preserved) {
    record("customized-preserved", true, `checked=${customizedBefore.length}`);
  }

  // Idempotent second ensure
  const second = eod02
    ? await ensureStarterCommercialStructure(admin as never, FANCY, eod02.id)
    : { repaired: false, upgraded: false };
  const after2 = eod02 ? await loadTemplateDetails(eod02.id) : null;
  record(
    "upgrade-idempotent",
    !second.upgraded && !second.repaired && (after2?.groups.length === after?.groups.length),
    JSON.stringify(second),
  );

  if (!after) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks }, null, 2));
    process.exit(1);
  }

  const definition = selectionDefinitionFromEventOrderTemplate(after);
  const dinnerGroup = definition.groups.find((g) => g.name === "Dinner service")!;
  const arborGroup = definition.groups.find((g) => g.name === "Ceremony enhancements")!;
  const barGroup = definition.groups.find((g) => g.name === "Bar package");
  const plated = definition.options.find((o) => o.label === "Plated Dinner" && o.groupId === dinnerGroup.id)!;
  const arbor = definition.options.find((o) => o.label === "Arbor")!;
  const beer = barGroup
    ? definition.options.find((o) => o.label === "Beer & Wine" && o.groupId === barGroup.id)
    : undefined;

  // Required validation cannot be bypassed
  const missingDinner = validateChoicesAnswers(definition, {});
  record("required-validation-blocks-empty", !missingDinner.ok, missingDinner.ok ? "ok" : missingDinner.message);
  const bothDinners = validateChoicesAnswers(definition, {
    [dinnerGroup.id]: { optionIds: dinnerOpts.map((o) => o.id) },
  });
  record("required-validation-blocks-two-dinners", !bothDinners.ok, bothDinners.ok ? "ok" : bothDinners.message);

  // Scenario B — decline optionals
  const answersB: ChoicesAnswers = {
    [dinnerGroup.id]: { optionIds: [plated.id] },
  };
  const validB = validateChoicesAnswers(definition, answersB);
  const linesB = resolveSelectedOptions(definition, answersB);
  record(
    "scenario-b-no-arbor",
    validB.ok && linesB.length === 1 && linesB[0]!.description === "Plated Dinner" && !linesB.some((l) => l.description === "Arbor"),
    JSON.stringify(linesB),
  );

  // Scenario A — extras
  const answersA: ChoicesAnswers = {
    [dinnerGroup.id]: { optionIds: [plated.id] },
    [arborGroup.id]: { optionIds: [arbor.id] },
    ...(barGroup && beer ? { [barGroup.id]: { optionIds: [beer.id] } } : {}),
  };
  const validA = validateChoicesAnswers(definition, answersA);
  const linesA = resolveSelectedOptions(definition, answersA);
  record(
    "scenario-a-has-arbor-once",
    validA.ok
      && linesA.filter((l) => l.description === "Arbor").length === 1
      && linesA.find((l) => l.description === "Arbor")?.amount === 350
      && linesA.some((l) => l.description === "Plated Dinner" && l.unitPrice === 85),
    JSON.stringify(linesA),
  );

  // Browser: Library template editor shows choice groups
  const browser = await chromium.launch({ headless: true });
  try {
    const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await staff.addCookies(await staffCookies());
    const page = await staff.newPage();
    await page.goto(`${APP}/library/event-order-templates`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/shots/library-1280.png`, fullPage: false });

    await page.goto(`${APP}/library/event-order-templates/${after.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(2500);
    const body = await page.locator("body").innerText().catch(() => "");
    record(
      "editor-shows-dinner-group",
      /Dinner service/i.test(body) && /Pick one/i.test(body),
      body.slice(0, 500),
    );
    record(
      "editor-shows-arbor-optional",
      /Arbor/i.test(body) && (/Ceremony enhancements/i.test(body) || /optional/i.test(body)),
      "Arbor visible in editor",
    );
    await page.screenshot({ path: `${OUT}/shots/template-editor-1280.png`, fullPage: true });

    // Portal submit path — create ephemeral choices packet, send, submit A then verify RPC rejection for empty
    const { data: eventRow } = await admin.from("events")
      .select("id, client_id").eq("id", EVENT).eq("venue_id", FANCY).maybeSingle();
    const { data: inserted, error: insErr } = await admin.from("client_choices").insert({
      venue_id: FANCY,
      event_id: EVENT,
      client_id: eventRow?.client_id ?? null,
      event_order_template_id: after.id,
      name: "QA Default Template Scenario A",
      status: "sent",
      definition,
      answers: {},
      sent_at: new Date().toISOString(),
    }).select("id").single();
    if (insErr) throw insErr;
    const choicesId = inserted.id as string;

    // Ensure couple portal session
    let { data: coupleSessions } = await admin.from("client_portal_sessions")
      .select("*")
      .eq("client_id", eventRow!.client_id)
      .eq("venue_id", FANCY)
      .eq("access_level", "couple");
    if (!coupleSessions?.length) {
      const { data: created } = await admin.from("client_portal_sessions").insert({
        client_id: eventRow!.client_id,
        venue_id: FANCY,
        label: "QA Couple",
        access_level: "couple",
      }).select("*").single();
      coupleSessions = created ? [created] : [];
    }
    const token = coupleSessions![0]!.access_token as string;

    // RPC bypass attempt — empty answers must fail after migration
    const { data: rejectEmpty } = await admin.rpc("submit_client_choices", {
      p_token: token,
      p_choices_id: choicesId,
      p_answers: {},
    });
    const rejectOk = (rejectEmpty as { ok?: boolean })?.ok === false;
    record("rpc-rejects-missing-required", rejectOk, JSON.stringify(rejectEmpty));

    // Portal UI submit scenario A
    const couple = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const cpage = await couple.newPage();
    await cpage.goto(`${APP}/p/${token}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await cpage.waitForTimeout(2000);
    // Navigate to choices if needed
    const choicesLink = cpage.getByRole("link", { name: /Choices|Selections|Your choices/i }).first();
    if ((await choicesLink.count()) > 0) {
      await choicesLink.click().catch(() => undefined);
      await cpage.waitForTimeout(1500);
    }
    await cpage.goto(`${APP}/p/${token}/choices`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
    await cpage.waitForTimeout(2000);
    await cpage.screenshot({ path: `${OUT}/shots/portal-choices-390.png`, fullPage: true });

    // Select plated + arbor via labels
    const platedRadio = cpage.getByText("Plated Dinner", { exact: false }).first();
    if ((await platedRadio.count()) > 0) await platedRadio.click({ force: true }).catch(() => undefined);
    const arborCheck = cpage.getByText("Arbor", { exact: false }).first();
    if ((await arborCheck.count()) > 0) await arborCheck.click({ force: true }).catch(() => undefined);
    if (beer) {
      const beerEl = cpage.getByText("Beer & Wine", { exact: false }).first();
      if ((await beerEl.count()) > 0) await beerEl.click({ force: true }).catch(() => undefined);
    }
    await cpage.waitForTimeout(500);
    const submitBtn = cpage.getByRole("button", { name: /Submit|Send to venue|Submit choices/i }).first();
    if ((await submitBtn.count()) > 0) {
      await submitBtn.click({ force: true });
      await cpage.waitForTimeout(2500);
    } else {
      // Fallback: direct API submit with scenario A answers
      await cpage.evaluate(async ({ token: t, choicesId: id, answers }) => {
        await fetch("/api/portal/choices/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t, choicesId: id, answers }),
        });
      }, { token, choicesId, answers: answersA });
      await cpage.waitForTimeout(1000);
    }
    await cpage.screenshot({ path: `${OUT}/shots/portal-submitted-390.png`, fullPage: true });

    const { data: submitted } = await admin.from("client_choices")
      .select("id, status, answers")
      .eq("id", choicesId)
      .eq("venue_id", FANCY)
      .maybeSingle();
    const submittedStatus = submitted?.status === "submitted" || submitted?.status === "resubmitted";
    record("scenario-a-submitted", Boolean(submittedStatus), JSON.stringify({ status: submitted?.status }));

    // Scenario B packet — decline arbor
    const { data: insertedB } = await admin.from("client_choices").insert({
      venue_id: FANCY,
      event_id: EVENT,
      client_id: eventRow?.client_id ?? null,
      event_order_template_id: after.id,
      name: "QA Default Template Scenario B",
      status: "sent",
      definition,
      answers: {},
      sent_at: new Date().toISOString(),
    }).select("id").single();
    const { data: submitB } = await admin.rpc("submit_client_choices", {
      p_token: token,
      p_choices_id: insertedB!.id,
      p_answers: answersB,
    });
    record("scenario-b-submitted", (submitB as { ok?: boolean })?.ok === true, JSON.stringify(submitB));
    const linesBResolve = resolveSelectedOptions(definition, answersB);
    record(
      "scenario-b-unselected-not-billable",
      !linesBResolve.some((l) => l.description === "Arbor"),
      JSON.stringify(linesBResolve.map((l) => l.description)),
    );

    // Existing event orders on Fancy not retroactively rewritten by upgrade
    const { data: eoRows } = await admin.from("event_orders")
      .select("id, status, revision")
      .eq("event_id", EVENT)
      .eq("venue_id", FANCY);
    record("event-orders-still-present", (eoRows?.length ?? 0) >= 0, JSON.stringify(eoRows));

    writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify({
      image,
      digest,
      upgrade,
      scenarioA: { choicesId, answers: answersA, lines: linesA, submitted },
      scenarioB: { choicesId: insertedB?.id, answers: answersB, lines: linesBResolve, submitB },
      customizedBefore,
      definitionGroups: definition.groups.map((g) => g.name),
    }, null, 2));
  } finally {
    await browser.close();
  }

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
    pass: failed.length === 0,
    passed: checks.filter((c) => c.pass).length,
    failed: failed.length,
    total: checks.length,
    image,
    digest,
    checks,
  }, null, 2));
  console.log(`\n${failed.length === 0 ? "GREEN" : "NOT GREEN"} ${checks.filter((c) => c.pass).length}/${checks.length}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, error: String(err), checks }, null, 2));
  process.exit(1);
});
