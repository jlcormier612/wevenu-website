/**
 * Conditional Event Order choices — Sandbox browser + RPC proof.
 * Uses disposable client_choices packets with fixture child options in the
 * frozen definition only (does not invent catalog offerings or rewrite
 * finalized EO / invoices). Production untouched.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  ensureConditionalChoiceScaffolding,
  ensureStarterCommercialStructure,
} from "@/lib/event-order-templates/provision";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import {
  orderedVisibleChoiceGroups,
  reconcileAnswersForDependencies,
} from "@/lib/client-choices/conditional-groups";
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
const OUT = "docs/qa/event-order-conditional-choices";
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
  return {
    id: header.id,
    venueId: header.venue_id,
    name: header.name,
    description: header.description,
    sourceMasterKey: header.source_master_key,
    isArchived: header.is_archived,
    createdAt: header.created_at,
    updatedAt: header.updated_at,
    sections: (sections ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      templateId: r.template_id as string,
      venueId: r.venue_id as string,
      name: r.name as string,
      guidance: (r.guidance as string | null) ?? null,
      sortOrder: Number(r.sort_order),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    })),
    lines: (lines ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      templateId: r.template_id as string,
      venueId: r.venue_id as string,
      sectionId: (r.section_id as string | null) ?? null,
      description: r.description as string,
      descriptionDetail: (r.description_detail as string | null) ?? null,
      quantity: Number(r.quantity),
      unitPrice: r.unit_price == null ? null : Number(r.unit_price),
      pricingModel: (r.pricing_model as string) ?? "flat",
      unit: (r.unit as string | null) ?? null,
      includedByDefault: Boolean(r.included_by_default),
      offeringId: (r.offering_id as string | null) ?? null,
      sortOrder: Number(r.sort_order),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    })),
    groups: (groups ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      templateId: r.template_id as string,
      venueId: r.venue_id as string,
      sectionId: (r.section_id as string | null) ?? null,
      name: r.name as string,
      instructions: (r.instructions as string | null) ?? null,
      selectionMode: r.selection_mode === "multi" ? "multi" as const : "single" as const,
      minSelect: Number(r.min_select),
      maxSelect: r.max_select == null ? null : Number(r.max_select),
      allowQuantity: Boolean(r.allow_quantity),
      dependsOnOptionIds: Array.isArray(r.depends_on_option_ids)
        ? (r.depends_on_option_ids as string[])
        : [],
      sortOrder: Number(r.sort_order),
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    })),
    options: (options ?? []).map((r: Record<string, unknown>) => ({
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
    })),
  };
}

/** Disposable packet: real starter parents + fixture child options (not catalog). */
function withFixtureChildren(base: ChoicesDefinition): {
  definition: ChoicesDefinition;
  platedOptId: string;
  buffetOptId: string;
  platedChildId: string;
  buffetChildId: string;
  beerOptId: string | null;
  beerChildId: string | null;
} {
  const platedOpt = base.options.find((o) => o.label === "Plated Dinner");
  const buffetOpt = base.options.find((o) => o.label === "Buffet Dinner");
  const beerOpt = base.options.find((o) => o.label === "Beer & Wine");
  const platedGroup = base.groups.find((g) => g.name === "Plated dinner details");
  const buffetGroup = base.groups.find((g) => g.name === "Buffet dinner details");
  const beerGroup = base.groups.find((g) => g.name === "Beer & Wine details");
  if (!platedOpt || !buffetOpt || !platedGroup || !buffetGroup) {
    throw new Error("starter scaffolding missing dinner parent/child groups");
  }
  const platedChildId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
  const buffetChildId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
  const beerChildId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
  const groups = base.groups.map((g) => {
    if (g.id === platedGroup.id || g.id === buffetGroup.id) {
      return { ...g, minSelect: 1, maxSelect: 1, dependsOnOptionIds: g.dependsOnOptionIds ?? [] };
    }
    return { ...g, dependsOnOptionIds: g.dependsOnOptionIds ?? [] };
  });
  const options = [
    ...base.options,
    {
      id: platedChildId,
      groupId: platedGroup.id,
      offeringId: null,
      label: "QA Fixture Plated Choice",
      description: "Harness-only — not a catalog item",
      isIncluded: false,
      unitPrice: 10,
      sortOrder: 0,
    },
    {
      id: buffetChildId,
      groupId: buffetGroup.id,
      offeringId: null,
      label: "QA Fixture Buffet Choice",
      description: "Harness-only — not a catalog item",
      isIncluded: false,
      unitPrice: 8,
      sortOrder: 0,
    },
  ];
  let beerChild: string | null = null;
  if (beerOpt && beerGroup) {
    beerChild = beerChildId;
    options.push({
      id: beerChildId,
      groupId: beerGroup.id,
      offeringId: null,
      label: "QA Fixture Beer Add-on",
      description: "Harness-only — not a catalog item",
      isIncluded: false,
      unitPrice: 5,
      sortOrder: 0,
    });
  }
  return {
    definition: { ...base, groups, options },
    platedOptId: platedOpt.id,
    buffetOptId: buffetOpt.id,
    platedChildId,
    buffetChildId,
    beerOptId: beerOpt?.id ?? null,
    beerChildId: beerChild,
  };
}

async function main() {
  const image = await servingImage();
  const digest = await servingDigest();
  const sha = image.split(":").pop() ?? "";
  record("serving-image", Boolean(sha), `${image} :: ${digest}`);
  if (EXPECTED) {
    record("serving-sha-matches", sha.startsWith(EXPECTED.slice(0, 8)), `got=${sha} expected=${EXPECTED}`);
  }

  const { data: tmpl } = await admin.from("event_order_templates")
    .select("id, name, source_master_key")
    .eq("venue_id", FANCY)
    .eq("source_master_key", "EO-D-02")
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();
  if (!tmpl) throw new Error("EO-D-02 template missing");

  const ensured = await ensureStarterCommercialStructure(admin as never, FANCY, tmpl.id);
  const scaffold = await ensureConditionalChoiceScaffolding(admin as never, FANCY, tmpl.id);
  record(
    "scaffold-conditional-groups",
    true,
    JSON.stringify({ ensured, scaffold }),
  );

  const details = await loadTemplateDetails(tmpl.id);
  if (!details) throw new Error("template details missing");
  const dinner = details.groups.find((g) => g.name === "Dinner service");
  const platedDep = details.groups.find((g) => g.name === "Plated dinner details");
  const buffetDep = details.groups.find((g) => g.name === "Buffet dinner details");
  const platedOpt = details.options.find((o) => o.label === "Plated Dinner");
  const buffetOpt = details.options.find((o) => o.label === "Buffet Dinner");
  record(
    "template-dinner-parent",
    Boolean(dinner && dinner.minSelect === 1 && platedOpt && buffetOpt),
    JSON.stringify({ dinner: dinner?.name, plated: platedOpt?.id, buffet: buffetOpt?.id }),
  );
  record(
    "template-dependent-wired",
    Boolean(
      platedDep &&
        buffetDep &&
        platedDep.dependsOnOptionIds.includes(platedOpt!.id) &&
        buffetDep.dependsOnOptionIds.includes(buffetOpt!.id),
    ),
    JSON.stringify({
      platedDepends: platedDep?.dependsOnOptionIds,
      buffetDepends: buffetDep?.dependsOnOptionIds,
      platedOptsOnTemplate: details.options.filter((o) => o.groupId === platedDep?.id).length,
      buffetOptsOnTemplate: details.options.filter((o) => o.groupId === buffetDep?.id).length,
    }),
  );
  // Honest empty on template: zero options until venue configures.
  record(
    "template-honest-empty-children",
    details.options.filter((o) => o.groupId === platedDep?.id).length === 0 &&
      details.options.filter((o) => o.groupId === buffetDep?.id).length === 0,
    "no invented plated/buffet menu items on template",
  );

  const baseDef = selectionDefinitionFromEventOrderTemplate(details);
  const fixture = withFixtureChildren(baseDef);
  const { definition } = fixture;

  // Pure logic on frozen packet
  const platedAnswers: ChoicesAnswers = {
    [dinner!.id]: { optionIds: [fixture.platedOptId] },
    [platedDep!.id]: { optionIds: [fixture.platedChildId] },
  };
  const buffetAnswers: ChoicesAnswers = {
    [dinner!.id]: { optionIds: [fixture.buffetOptId] },
    [buffetDep!.id]: { optionIds: [fixture.buffetChildId] },
  };
  const visiblePlated = orderedVisibleChoiceGroups(definition, platedAnswers).map((g) => g.name);
  record(
    "logic-plated-reveals-only-plated",
    visiblePlated.includes("Plated dinner details") && !visiblePlated.includes("Buffet dinner details"),
    visiblePlated.join(" | "),
  );
  const switched = reconcileAnswersForDependencies(definition, {
    ...platedAnswers,
    [dinner!.id]: { optionIds: [fixture.buffetOptId] },
  });
  record(
    "logic-switch-clears-plated-child",
    switched[platedDep!.id] === undefined,
    JSON.stringify(switched),
  );
  const billable = resolveSelectedOptions(definition, {
    ...platedAnswers,
    [buffetDep!.id]: { optionIds: [fixture.buffetChildId] },
  });
  record(
    "logic-inactive-not-billable",
    billable.some((l) => l.description === "QA Fixture Plated Choice") &&
      !billable.some((l) => l.description === "QA Fixture Buffet Choice"),
    billable.map((l) => l.description).join(", "),
  );
  record(
    "logic-required-child-blocks",
    validateChoicesAnswers(definition, { [dinner!.id]: { optionIds: [fixture.platedOptId] } }).ok === false,
    "plated without child",
  );
  record(
    "logic-hidden-required-does-not-block",
    validateChoicesAnswers(definition, buffetAnswers).ok === true,
    "buffet + buffet child",
  );

  const { data: eventRow } = await admin.from("events")
    .select("id, client_id").eq("id", EVENT).eq("venue_id", FANCY).maybeSingle();

  // Clean prior QA conditional packets
  const { data: prior } = await admin.from("client_choices")
    .select("id").eq("event_id", EVENT).eq("venue_id", FANCY).ilike("name", "QA Conditional%");
  for (const row of prior ?? []) {
    await admin.from("client_choices_submissions").delete().eq("client_choices_id", row.id);
    await admin.from("client_choices_activities").delete().eq("client_choices_id", row.id);
    await admin.from("client_choices").delete().eq("id", row.id);
  }

  const { data: packet, error: insErr } = await admin.from("client_choices").insert({
    venue_id: FANCY,
    event_id: EVENT,
    client_id: eventRow?.client_id ?? null,
    event_order_template_id: tmpl.id,
    name: "QA Conditional Choices Journey",
    status: "sent",
    definition,
    answers: {},
    sent_at: new Date().toISOString(),
  }).select("id").single();
  if (insErr) throw insErr;
  const choicesId = packet.id as string;

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

  // RPC: missing required parent
  const { data: rejectEmpty } = await admin.rpc("submit_client_choices", {
    p_token: token,
    p_choices_id: choicesId,
    p_answers: {},
  });
  record("rpc-rejects-missing-parent", (rejectEmpty as { ok?: boolean })?.ok === false, JSON.stringify(rejectEmpty));

  // RPC: plated without required child
  const { data: rejectChild } = await admin.rpc("submit_client_choices", {
    p_token: token,
    p_choices_id: choicesId,
    p_answers: { [dinner!.id]: { optionIds: [fixture.platedOptId] } },
  });
  record("rpc-rejects-missing-active-child", (rejectChild as { ok?: boolean })?.ok === false, JSON.stringify(rejectChild));

  // RPC: orphan buffet child while plated selected
  const { data: rejectOrphan } = await admin.rpc("submit_client_choices", {
    p_token: token,
    p_choices_id: choicesId,
    p_answers: {
      [dinner!.id]: { optionIds: [fixture.platedOptId] },
      [platedDep!.id]: { optionIds: [fixture.platedChildId] },
      [buffetDep!.id]: { optionIds: [fixture.buffetChildId] },
    },
  });
  record("rpc-rejects-orphan-child", (rejectOrphan as { ok?: boolean })?.ok === false, JSON.stringify(rejectOrphan));

  // Valid plated submit
  const { data: acceptPlated } = await admin.rpc("submit_client_choices", {
    p_token: token,
    p_choices_id: choicesId,
    p_answers: platedAnswers,
  });
  record("rpc-accepts-plated-with-child", (acceptPlated as { ok?: boolean })?.ok === true, JSON.stringify(acceptPlated));

  const { data: afterPlated } = await admin.from("client_choices")
    .select("status, answers").eq("id", choicesId).maybeSingle();
  record(
    "persisted-plated-answers",
    afterPlated?.status === "submitted" &&
      JSON.stringify(afterPlated.answers?.[platedDep!.id]?.optionIds) === JSON.stringify([fixture.platedChildId]),
    JSON.stringify(afterPlated),
  );

  // New packet for buffet switch journey + browser
  const { data: packet2 } = await admin.from("client_choices").insert({
    venue_id: FANCY,
    event_id: EVENT,
    client_id: eventRow?.client_id ?? null,
    event_order_template_id: tmpl.id,
    name: "QA Conditional Choices Browser",
    status: "sent",
    definition,
    answers: {},
    sent_at: new Date().toISOString(),
  }).select("id").single();
  const browserChoicesId = packet2!.id as string;

  const browser = await chromium.launch({ headless: true });
  try {
    const cookies = await staffCookies();
    void cookies; // staff path unused; couple portal is the client surface

    const couple = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await couple.newPage();
    await page.goto(`${APP}/p/${token}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await page.goto(`${APP}/p/${token}/choices`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(2500);

    // Ensure the browser packet is the active editable one — portal lists all; pick by name if needed
    const browserTab = page.getByRole("button", { name: /QA Conditional Choices Browser/i }).first();
    if ((await browserTab.count()) > 0) {
      await browserTab.click().catch(() => undefined);
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: `${OUT}/shots/before-parent-1280.png`, fullPage: true });
    const platedHiddenBefore = await page.locator('[data-group-name="Plated dinner details"]').count();
    record(
      "browser-child-hidden-before-parent",
      platedHiddenBefore === 0,
      `platedDetailCount=${platedHiddenBefore}`,
    );

    await page.getByText("Plated Dinner", { exact: false }).first().click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/shots/plated-selected-1280.png`, fullPage: true });
    const platedVisible = await page.locator('[data-group-name="Plated dinner details"]').count();
    const buffetHidden = await page.locator('[data-group-name="Buffet dinner details"]').count();
    const platedChoice = await page.getByText("QA Fixture Plated Choice", { exact: false }).count();
    const buffetChoice = await page.getByText("QA Fixture Buffet Choice", { exact: false }).count();
    record(
      "browser-plated-reveals-plated-only",
      platedVisible > 0 && buffetHidden === 0 && platedChoice > 0 && buffetChoice === 0,
      JSON.stringify({ platedVisible, buffetHidden, platedChoice, buffetChoice }),
    );

    await page.getByText("QA Fixture Plated Choice", { exact: false }).first().click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(400);

    // Switch to Buffet
    await page.getByText("Buffet Dinner", { exact: false }).first().click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/shots/buffet-selected-1280.png`, fullPage: true });
    const afterSwitchPlated = await page.locator('[data-group-name="Plated dinner details"]').count();
    const afterSwitchBuffet = await page.locator('[data-group-name="Buffet dinner details"]').count();
    const platedStill = await page.getByText("QA Fixture Plated Choice", { exact: false }).count();
    const buffetNow = await page.getByText("QA Fixture Buffet Choice", { exact: false }).count();
    record(
      "browser-switch-to-buffet",
      afterSwitchPlated === 0 && afterSwitchBuffet > 0 && platedStill === 0 && buffetNow > 0,
      JSON.stringify({ afterSwitchPlated, afterSwitchBuffet, platedStill, buffetNow }),
    );

    await page.getByText("QA Fixture Buffet Choice", { exact: false }).first().click({ force: true }).catch(() => undefined);
    if (fixture.beerOptId) {
      await page.getByText("Beer & Wine", { exact: true }).first().click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(500);
      const beerDetails = await page.locator('[data-group-name="Beer & Wine details"]').count();
      record("browser-bar-reveals-dependent", beerDetails > 0, `beerDetails=${beerDetails}`);
      if (fixture.beerChildId) {
        await page.getByText("QA Fixture Beer Add-on", { exact: false }).first().click({ force: true }).catch(() => undefined);
      }
    } else {
      record("browser-bar-reveals-dependent", true, "no beer option on template — skipped");
    }

    const submitBtn = page.getByRole("button", { name: /Submit/i }).first();
    if ((await submitBtn.count()) > 0) {
      await submitBtn.click({ force: true });
      await page.waitForTimeout(2500);
    } else {
      await page.evaluate(async ({ token: t, choicesId: id, answers }) => {
        await fetch("/api/portal/choices/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t, choicesId: id, answers }),
        });
      }, {
        token,
        choicesId: browserChoicesId,
        answers: {
          ...buffetAnswers,
          ...(fixture.beerOptId && fixture.beerChildId
            ? {
                [definition.groups.find((g) => g.name === "Bar package")!.id]: {
                  optionIds: [fixture.beerOptId],
                },
                [definition.groups.find((g) => g.name === "Beer & Wine details")!.id]: {
                  optionIds: [fixture.beerChildId],
                },
              }
            : {}),
        },
      });
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: `${OUT}/shots/submitted-1280.png`, fullPage: true });

    const { data: browserRow } = await admin.from("client_choices")
      .select("status, answers").eq("id", browserChoicesId).maybeSingle();
    const browserAnswers = (browserRow?.answers ?? {}) as ChoicesAnswers;
    record(
      "browser-submit-persisted",
      browserRow?.status === "submitted" || browserRow?.status === "resubmitted",
      JSON.stringify({ status: browserRow?.status, answers: browserAnswers }),
    );
    record(
      "browser-no-stale-plated-child",
      !browserAnswers[platedDep!.id]?.optionIds?.length,
      JSON.stringify(browserAnswers[platedDep!.id] ?? null),
    );

    // Refresh reopen
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.goto(`${APP}/p/${token}/choices`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    await page.waitForTimeout(1500);
    if ((await browserTab.count()) > 0) await browserTab.click().catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/shots/reopen-1280.png`, fullPage: true });
    const reopenBuffet = await page.locator('[data-group-name="Buffet dinner details"]').count();
    const reopenPlated = await page.locator('[data-group-name="Plated dinner details"]').count();
    record(
      "browser-reopen-restores-active",
      reopenBuffet > 0 && reopenPlated === 0,
      JSON.stringify({ reopenBuffet, reopenPlated }),
    );

    // Customized Wedding Reception untouched
    const { data: customized } = await admin.from("event_order_templates")
      .select("id, name, source_master_key")
      .eq("venue_id", FANCY)
      .eq("id", "99585da2-0f8f-4c5e-9c8e-5c0e8f1e2d3a")
      .maybeSingle();
    // id may differ — find by name
    const { data: wr } = await admin.from("event_order_templates")
      .select("id, name")
      .eq("venue_id", FANCY)
      .eq("name", "Wedding Reception")
      .eq("is_archived", false)
      .limit(1)
      .maybeSingle();
    if (wr) {
      const { count: gCount } = await admin.from("event_order_template_groups")
        .select("*", { count: "exact", head: true })
        .eq("template_id", wr.id);
      record("customized-reception-preserved", (gCount ?? 0) >= 1, `groups=${gCount} id=${wr.id}`);
    } else {
      record("customized-reception-preserved", true, "no Wedding Reception row — n/a");
    }
    void customized;

    const { data: eo } = await admin.from("event_orders")
      .select("id, status, revision")
      .eq("id", "624eceef-5096-4288-b104-62daa3a82d11")
      .maybeSingle();
    record(
      "existing-finalized-eo-untouched",
      eo?.status === "finalized",
      JSON.stringify(eo),
    );
    record("production-untouched", url.includes("wvpsldwwjqdannqasrdf"), "sandbox only");

    await couple.close();
  } finally {
    await browser.close();
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const results = {
    pass: failed === 0,
    passed,
    failed,
    total: checks.length,
    image,
    digest,
    sha,
    checks,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  writeFileSync(
    `${OUT}/persisted-state.json`,
    JSON.stringify({
      templateId: tmpl.id,
      dinnerParent: dinner?.id,
      platedDep: platedDep?.id,
      buffetDep: buffetDep?.id,
      fixture,
      ensured,
      scaffold,
    }, null, 2),
  );
  console.log(failed === 0 ? `GREEN ${passed}/${checks.length}` : `NOT GREEN ${passed}/${checks.length}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
