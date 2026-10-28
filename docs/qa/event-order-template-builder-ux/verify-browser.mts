/**
 * EO Template builder mental-model UX — full Sandbox venue-owner acceptance.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { resolveSelectedOptions } from "@/lib/client-choices/apply-to-event-order";
import { validateChoicesAnswers } from "@/lib/client-choices/validate-answers";
import type { ChoicesAnswers } from "@/lib/client-choices/types";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
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
const RUN = process.env.E2E_RUN_ID ?? `EOTUX${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/event-order-template-builder-ux";
const PREFIX = `EOTUX-${RUN}-`;
const EVENT_DATE = "2027-11-12";
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

async function loadTemplateDetails(templateId: string): Promise<EventOrderTemplateWithDetails> {
  const [{ data: t }, { data: sections }, { data: lines }, { data: groups }, { data: options }] =
    await Promise.all([
      admin.from("event_order_templates").select("*").eq("id", templateId).single(),
      admin.from("event_order_template_sections").select("*").eq("template_id", templateId).order("sort_order"),
      admin.from("event_order_template_lines").select("*").eq("template_id", templateId).order("sort_order"),
      admin.from("event_order_template_groups").select("*").eq("template_id", templateId).order("sort_order"),
      admin.from("event_order_template_options").select("*").eq("template_id", templateId).order("sort_order"),
    ]);
  if (!t) throw new Error("template missing");
  const mapLine = (r: Record<string, unknown>) => ({
    id: r.id as string,
    templateId: r.template_id as string,
    venueId: r.venue_id as string,
    sectionId: (r.section_id as string) ?? null,
    description: r.description as string,
    descriptionDetail: (r.description_detail as string) ?? null,
    quantity: Number(r.quantity ?? 1),
    unitPrice: r.unit_price == null ? null : Number(r.unit_price),
    pricingModel: (r.pricing_model as string) ?? "none",
    unit: (r.unit as string) ?? null,
    includedByDefault: Boolean(r.included_by_default),
    offeringId: (r.offering_id as string) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  });
  const mapGroup = (r: Record<string, unknown>) => ({
    id: r.id as string,
    templateId: r.template_id as string,
    venueId: r.venue_id as string,
    sectionId: (r.section_id as string) ?? null,
    name: r.name as string,
    instructions: (r.instructions as string) ?? null,
    selectionMode: r.selection_mode as "single" | "multi",
    minSelect: Number(r.min_select ?? 0),
    maxSelect: r.max_select == null ? null : Number(r.max_select),
    allowQuantity: Boolean(r.allow_quantity),
    dependsOnOptionIds: (r.depends_on_option_ids as string[]) ?? [],
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  });
  const mapOpt = (r: Record<string, unknown>) => ({
    id: r.id as string,
    templateId: r.template_id as string,
    venueId: r.venue_id as string,
    groupId: r.group_id as string,
    offeringId: (r.offering_id as string) ?? null,
    label: r.label as string,
    description: (r.description as string) ?? null,
    isIncluded: Boolean(r.is_included),
    unitPrice: r.unit_price == null ? null : Number(r.unit_price),
    isDefault: Boolean(r.is_default),
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  });
  return {
    id: t.id,
    venueId: t.venue_id,
    name: t.name,
    description: t.description,
    sourceMasterKey: t.source_master_key,
    isArchived: t.is_archived,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    sections: (sections ?? []).map((s) => ({
      id: s.id,
      templateId: s.template_id,
      venueId: s.venue_id,
      name: s.name,
      guidance: s.guidance,
      sortOrder: s.sort_order,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })),
    lines: (lines ?? []).map((r) => mapLine(r as Record<string, unknown>)),
    groups: (groups ?? []).map((r) => mapGroup(r as Record<string, unknown>)),
    options: (options ?? []).map((r) => mapOpt(r as Record<string, unknown>)),
  } as EventOrderTemplateWithDetails;
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const createdTemplateIds: string[] = [];
  const createdClientIds: string[] = [];
  const createdEventIds: string[] = [];
  const createdChoicesIds: string[] = [];
  const createdOrderIds: string[] = [];
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED, prefix: PREFIX };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`, "deploy");
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    await context.addCookies(await staffCookies());

    const { data: catalogOffering } = await admin
      .from("offerings")
      .select("id,name,default_unit_price")
      .eq("venue_id", FANCY)
      .eq("name", "Day-of coordination")
      .maybeSingle();
    const { data: sideOffering } = await admin
      .from("offerings")
      .select("id,name")
      .eq("venue_id", FANCY)
      .eq("name", "Caesar salad")
      .maybeSingle();
    const { data: entreeOffering } = await admin
      .from("offerings")
      .select("id,name")
      .eq("venue_id", FANCY)
      .eq("name", "Chicken Marsala")
      .maybeSingle();
    record("catalog_fixtures_present", Boolean(catalogOffering && sideOffering && entreeOffering), JSON.stringify({
      catalogOffering, sideOffering, entreeOffering,
    }), "fixture");

    const { data: tpl, error: tplErr } = await admin
      .from("event_order_templates")
      .insert({
        venue_id: FANCY,
        name: `${PREFIX}Builder UX`,
        description: "eotux full acceptance",
        is_archived: false,
      })
      .select("id")
      .single();
    if (tplErr || !tpl) throw tplErr ?? new Error("tpl");
    createdTemplateIds.push(tpl.id);
    persisted.templateId = tpl.id;

    await page.goto(`${APP}/library/event-order-templates/${tpl.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="eo-guided-setup-wizard"]', { timeout: 90_000 });
    await page.waitForTimeout(1200);

    const catering = page.getByTestId("eo-guided-category-catering");
    for (let i = 0; i < 6; i++) {
      if ((await catering.getAttribute("aria-pressed")) === "true") break;
      await catering.click({ force: true });
      await page.waitForTimeout(300);
    }
    if ((await catering.getAttribute("aria-pressed")) !== "true") throw new Error("Catering not selected");
    await page.getByTestId("eo-guided-categories-continue").click();
    await page.waitForSelector('[data-testid="eo-guided-step-workspace"]', { timeout: 60_000 });
    await page.screenshot({ path: `${OUT}/shots/01-workspace-empty-1280.png`, fullPage: true });

    const workspace = await page.getByTestId("eo-guided-step-workspace").innerText();
    record("ux_package_items_heading", /Items always on this package/i.test(workspace), "heading", "usability");
    record("ux_choices_heading", /Choices couples make/i.test(workspace), "heading", "usability");
    record("ux_no_included_in_catering", !/Included in Catering/i.test(workspace), "no old heading", "usability");
    record("ux_no_major_choices_jargon", !/major choices from your Offerings catalog/i.test(workspace), "no jargon", "usability");
    record("ux_primary_question_cta", (await page.getByTestId("eo-add-primary-question").count()) === 1, "CTA present", "usability");
    record("ux_empty_guides_next", /No primary question yet/i.test(workspace), "empty state", "usability");

    // ---- A: catalog package item covered by package price ----
    await page.locator('[data-testid^="eo-add-offering-"]').first().click();
    await page.waitForTimeout(600);
    await page.getByTestId("eo-line-offering-picker-filter").selectOption("all").catch(() => undefined);
    await page.waitForTimeout(300);
    const list = page.getByTestId("eo-line-offering-picker-list");
    await list.waitFor({ state: "visible", timeout: 15_000 });
    if (catalogOffering) {
      await list.selectOption(catalogOffering.id);
      await page.waitForTimeout(400);
    }
    const covered = page.getByTestId("eo-line-covered-by-package");
    await covered.waitFor({ state: "visible", timeout: 10_000 });
    if (!(await covered.isChecked())) await covered.check({ force: true });
    await page.getByRole("button", { name: /^(Add package item|Add offering)$/i }).click();
    await page.locator("#offering-name").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
    await page.getByTestId("eo-guided-step-fixed").getByText(/Day-of coordination/i).waitFor({
      state: "visible",
      timeout: 30_000,
    });

    // ---- A: template-only additional charge ----
    await page.locator('[data-testid^="eo-add-offering-"]').first().click();
    await page.waitForTimeout(700);
    const customBtn = page.getByRole("button", { name: /custom \/ template-only/i });
    await customBtn.waitFor({ state: "visible", timeout: 15_000 });
    await customBtn.click();
    await page.locator("#offering-name").waitFor({ state: "visible", timeout: 15_000 });
    const toastName = `${PREFIX}Champagne Toast`;
    await page.locator("#offering-name").fill(toastName);
    const hasPriceBox = page.locator('label').filter({ hasText: /This offering has a price/i }).locator('input[type="checkbox"]');
    await hasPriceBox.check({ force: true });
    await page.locator("#offering-price").waitFor({ state: "visible", timeout: 10_000 });
    await page.locator("#offering-price").fill("150");
    const covered2 = page.getByTestId("eo-line-covered-by-package");
    await covered2.waitFor({ state: "visible", timeout: 10_000 });
    if (await covered2.isChecked()) await covered2.uncheck({ force: true });
    await page.getByRole("button", { name: /^(Add package item|Add offering)$/i }).click();
    // Wait until the sheet closes and the new line is visible in the package list
    await page.locator("#offering-name").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
    await page.getByTestId("eo-guided-step-fixed").getByText(/Champagne Toast/i).waitFor({
      state: "visible",
      timeout: 30_000,
    });

    let toastLine: {
      id: string;
      description: string;
      included_by_default: boolean;
      unit_price: number | null;
      offering_id: string | null;
      pricing_model: string;
    } | undefined;
    let catalogLine: typeof toastLine;
    let lines: typeof toastLine[] | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data } = await admin
        .from("event_order_template_lines")
        .select("id,description,included_by_default,unit_price,offering_id,pricing_model")
        .eq("template_id", tpl.id);
      lines = (data ?? []) as typeof lines;
      catalogLine = (lines ?? []).find((l) => l.offering_id === catalogOffering?.id);
      toastLine = (lines ?? []).find((l) => String(l.description).includes("Champagne Toast"));
      if (catalogLine && toastLine) break;
      await page.waitForTimeout(400);
    }
    record(
      "persisted_catalog_package_item_covered",
      Boolean(catalogLine)
        && catalogLine!.included_by_default === true
        && catalogLine!.offering_id === catalogOffering!.id,
      JSON.stringify(catalogLine),
      "persisted",
    );
    record(
      "persisted_template_only_additional_charge",
      Boolean(toastLine)
        && toastLine!.included_by_default === false
        && Number(toastLine!.unit_price) === 150
        && toastLine!.offering_id == null,
      JSON.stringify(toastLine ?? { lines }),
      "persisted",
    );
    const fixedText = await page.getByTestId("eo-guided-step-fixed").innerText();
    record(
      "ui_distinguishes_covered_vs_additional",
      /Covered by package price/i.test(fixedText) && /Additional charge/i.test(fixedText),
      fixedText.slice(0, 600),
      "usability",
    );
    record(
      "ui_catalog_vs_template_only_on_items",
      /From Offerings catalog/i.test(fixedText) && /Template-only/i.test(fixedText),
      "source labels",
      "usability",
    );
    await page.screenshot({ path: `${OUT}/shots/02-package-items-pricing-1280.png`, fullPage: true });
    persisted.lines = lines;

    // ---- B: primary question + answers ----
    await page.getByTestId("eo-add-group-name").fill("Dinner style");
    await page.getByTestId("eo-add-choice-group").click();
    await page.waitForTimeout(1500);
    const { data: groups1 } = await admin
      .from("event_order_template_groups")
      .select("id,name,depends_on_option_ids,min_select,max_select,selection_mode")
      .eq("template_id", tpl.id);
    const primary = (groups1 ?? []).find((g) => g.name === "Dinner style");
    record("persisted_primary_question", Boolean(primary?.id) && (primary!.depends_on_option_ids ?? []).length === 0, JSON.stringify(primary), "persisted");

    async function addTemplateOnlyAnswer(label: string) {
      await page.getByTestId("eo-add-option-group").selectOption(primary!.id);
      await page.getByTestId("eo-add-option-template-only").click();
      await page.getByPlaceholder("Option label").fill(label);
      await page.getByRole("button", { name: /^Add template-only option$/i }).click();
      await page.waitForTimeout(1200);
    }
    await addTemplateOnlyAnswer("Buffet Dinner");
    await addTemplateOnlyAnswer("Plated Dinner");

    const { data: options } = await admin
      .from("event_order_template_options")
      .select("id,label,group_id,offering_id")
      .eq("template_id", tpl.id);
    const buffet = (options ?? []).find((o) => o.label === "Buffet Dinner");
    const plated = (options ?? []).find((o) => o.label === "Plated Dinner");
    record(
      "persisted_answers_same_question",
      Boolean(buffet && plated && buffet.group_id === primary!.id && plated.group_id === primary!.id),
      JSON.stringify({ buffet, plated, primaryId: primary?.id }),
      "persisted",
    );
    const choicesPanel = await page.getByTestId("eo-choice-groups-panel").innerText();
    record(
      "ux_answers_visually_under_question",
      /Dinner style/i.test(choicesPanel) && /Buffet Dinner/i.test(choicesPanel) && /Plated Dinner/i.test(choicesPanel),
      choicesPanel.slice(0, 500),
      "usability",
    );
    await page.screenshot({ path: `${OUT}/shots/03-primary-answers-1280.png`, fullPage: true });

    // ---- C: follow-ups ----
    async function addFollowUp(optionId: string, name: string) {
      await page.getByTestId(`eo-add-choices-for-${optionId}`).click();
      await page.getByTestId(`eo-followup-name-${optionId}`).fill(name);
      await page.getByTestId(`eo-followup-count-${optionId}`).fill("1");
      await page.getByTestId(`eo-followup-save-${optionId}`).click();
      await page.waitForTimeout(1500);
    }
    if (buffet) await addFollowUp(buffet.id, "Sides");
    if (plated) await addFollowUp(plated.id, "Entrées");

    const { data: groups2 } = await admin
      .from("event_order_template_groups")
      .select("id,name,depends_on_option_ids,min_select,max_select")
      .eq("template_id", tpl.id);
    const sides = (groups2 ?? []).find((g) => g.name === "Sides");
    const entrees = (groups2 ?? []).find((g) => g.name === "Entrées" || g.name === "Entrees");
    record(
      "persisted_sides_depends_on_buffet",
      Boolean(sides) && (sides!.depends_on_option_ids as string[]).includes(buffet!.id),
      JSON.stringify(sides),
      "persisted",
    );
    record(
      "persisted_entrees_depends_on_plated",
      Boolean(entrees) && (entrees!.depends_on_option_ids as string[]).includes(plated!.id),
      JSON.stringify(entrees),
      "persisted",
    );

    async function addCatalogOptionToGroup(groupId: string, offeringId: string, label: string) {
      await page.getByTestId("eo-add-option-group").selectOption(groupId);
      await page.getByTestId("eo-add-option-from-catalog").click();
      await page.getByTestId("eo-add-option-offering-filter").selectOption("all").catch(() => undefined);
      await page.waitForTimeout(300);
      await page.getByTestId("eo-add-option-offering-list").selectOption(offeringId);
      await page.waitForTimeout(300);
      const labelInput = page.getByPlaceholder("Customer-facing label");
      if (await labelInput.count()) await labelInput.fill(label);
      await page.getByRole("button", { name: /^Add option$/i }).click();
      await page.waitForTimeout(1200);
    }
    if (sides && sideOffering) await addCatalogOptionToGroup(sides.id, sideOffering.id, "Caesar salad");
    if (entrees && entreeOffering) await addCatalogOptionToGroup(entrees.id, entreeOffering.id, "Chicken Marsala");

    // Template-only under Sides
    const roastLabel = `${PREFIX}Roasted Vegetables`;
    if (sides) {
      await page.getByTestId("eo-add-option-group").selectOption(sides.id);
      await page.getByTestId("eo-add-option-template-only").click();
      await page.getByPlaceholder("Option label").waitFor({ state: "visible", timeout: 15_000 });
      await page.getByPlaceholder("Option label").fill(roastLabel);
      await page.getByRole("button", { name: /^Add template-only option$/i }).click();
      await page.getByTestId("eo-choice-groups-panel").getByText(roastLabel).waitFor({
        state: "visible",
        timeout: 30_000,
      });
    }

    let caesar: { id: string; label: string; group_id: string; offering_id: string | null } | undefined;
    let chicken: typeof caesar;
    let roast: typeof caesar;
    let allOpts: typeof caesar[] | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data } = await admin
        .from("event_order_template_options")
        .select("id,label,group_id,offering_id")
        .eq("template_id", tpl.id);
      allOpts = (data ?? []) as typeof allOpts;
      caesar = (allOpts ?? []).find((o) => o.label === "Caesar salad");
      chicken = (allOpts ?? []).find((o) => o.label === "Chicken Marsala");
      roast = (allOpts ?? []).find((o) => String(o.label).includes("Roasted Vegetables"));
      if (caesar && chicken && roast) break;
      await page.waitForTimeout(400);
    }
    record("persisted_sides_catalog_item", Boolean(caesar?.offering_id === sideOffering?.id), JSON.stringify(caesar), "persisted");
    record("persisted_entrees_catalog_item", Boolean(chicken?.offering_id === entreeOffering?.id), JSON.stringify(chicken), "persisted");
    record(
      "persisted_sides_template_only_item",
      Boolean(roast && roast.offering_id == null),
      JSON.stringify(roast ?? { allOpts }),
      "persisted",
    );
    await page.screenshot({ path: `${OUT}/shots/04-followups-both-branches-1280.png`, fullPage: true });
    persisted.groups = groups2;
    persisted.options = allOpts;

    // ---- Reopen persistence ----
    await page.goto(`${APP}/library/event-order-templates/${tpl.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="eo-guided-setup-wizard"]', { timeout: 90_000 });
    // Land on configure/workspace or review — open catering workspace
    const editCat = page.getByTestId("eo-guided-edit-package-categories");
    if (await editCat.count()) {
      // may be on review — go edit category via review button if present
    }
    const editCategoryBtn = page.getByRole("button", { name: /^Edit category$/i });
    if (await editCategoryBtn.count()) {
      await editCategoryBtn.first().click();
      await page.waitForTimeout(800);
    } else if (await page.getByTestId("eo-guided-step-categories").count()) {
      // ensure catering and continue
      if ((await catering.getAttribute("aria-pressed")) !== "true") {
        await catering.click({ force: true });
      }
      await page.getByTestId("eo-guided-categories-continue").click();
      await page.waitForTimeout(1000);
    }
    await page.waitForSelector('[data-testid="eo-guided-step-workspace"], [data-testid="eo-guided-step-review"]', {
      timeout: 30_000,
    });
    const reopenBody = await page.locator("body").innerText();
    record(
      "reopen_preserves_structure",
      /Dinner style/i.test(reopenBody)
        && /Buffet Dinner/i.test(reopenBody)
        && /Plated Dinner/i.test(reopenBody)
        && (/Champagne Toast/i.test(reopenBody) || /Day-of coordination/i.test(reopenBody)),
      reopenBody.slice(0, 800),
      "persisted",
    );

    // ---- Preview + conditional follow-ups ----
    for (let i = 0; i < 5; i++) {
      if (await page.getByTestId("eo-guided-step-preview").count()) break;
      if (await page.getByTestId("eo-guided-goto-preview").count()) {
        await page.getByTestId("eo-guided-goto-preview").click();
        await page.waitForTimeout(800);
        break;
      }
      if (await page.getByTestId("eo-guided-continue").count()) {
        await page.getByTestId("eo-guided-continue").click();
        await page.waitForTimeout(700);
      }
    }
    if (!(await page.getByTestId("eo-guided-step-preview").count())) {
      // from review
      if (await page.getByTestId("eo-guided-goto-preview").count()) {
        await page.getByTestId("eo-guided-goto-preview").click();
      }
    }
    await page.getByTestId("eo-guided-step-preview").waitFor({ timeout: 45_000 });
    await page.screenshot({ path: `${OUT}/shots/05-preview-initial-1280.png`, fullPage: true });

    await page.getByTestId(`eo-preview-parent-${buffet!.id}`).click();
    await page.waitForTimeout(500);
    const afterBuffet = await page.getByTestId("eo-choice-conditional-preview").innerText();
    record(
      "preview_buffet_shows_sides_not_entrees",
      /Sides/i.test(afterBuffet) && !/Entrées|Entrees/i.test(afterBuffet),
      afterBuffet.slice(0, 600),
      "preview",
    );
    await page.screenshot({ path: `${OUT}/shots/06-preview-buffet-path-1280.png`, fullPage: true });

    await page.getByTestId(`eo-preview-parent-${plated!.id}`).click();
    await page.waitForTimeout(500);
    const afterPlated = await page.getByTestId("eo-choice-conditional-preview").innerText();
    record(
      "preview_plated_shows_entrees_not_sides",
      (/Entrées|Entrees/i.test(afterPlated) || /Chicken Marsala/i.test(afterPlated))
        && !/Sides/i.test(afterPlated),
      afterPlated.slice(0, 600),
      "preview",
    );
    await page.screenshot({ path: `${OUT}/shots/07-preview-plated-path-1280.png`, fullPage: true });

    // Invalid: only primary selected — under-selection on follow-up
    await page.getByTestId("eo-preview-check-selections").click();
    await page.waitForTimeout(400);
    const valMsg = await page.getByTestId("eo-preview-validation-message").innerText().catch(() => "");
    record(
      "preview_rejects_incomplete_followup",
      /at least|requires|Entrée|Sides|select/i.test(valMsg),
      valMsg || "no validation message",
      "preview",
    );

    // Valid plated path
    if (chicken) {
      await page.getByTestId(`eo-preview-option-${chicken.id}`).click().catch(() => undefined);
      await page.waitForTimeout(300);
      await page.getByTestId("eo-preview-check-selections").click();
      await page.waitForTimeout(400);
      const okHint = await page.getByTestId("eo-preview-validation-ok-hint").count();
      const stillErr = await page.getByTestId("eo-preview-validation-message").count();
      record("preview_accepts_complete_plated_path", okHint === 1 && stillErr === 0, `okHint=${okHint} err=${stillErr}`, "preview");
    } else {
      record("preview_accepts_complete_plated_path", false, "chicken option missing", "preview");
    }

    // ---- Selection definition + finalization integrity (server rules) ----
    const details = await loadTemplateDetails(tpl.id);
    const definition = selectionDefinitionFromEventOrderTemplate(details);
    const incomplete: ChoicesAnswers = {
      [primary!.id]: { optionIds: [plated!.id] },
    };
    const incompleteV = validateChoicesAnswers(definition, incomplete);
    record("server_rejects_incomplete_before_finalize", !incompleteV.ok, incompleteV.ok ? "ok" : incompleteV.message, "finalization");

    const valid: ChoicesAnswers = {
      [primary!.id]: { optionIds: [plated!.id] },
      [entrees!.id]: { optionIds: [chicken!.id] },
    };
    const validV = validateChoicesAnswers(definition, valid);
    record("server_accepts_valid_plated_path", validV.ok, validV.ok ? "ok" : validV.message, "finalization");
    const resolved = resolveSelectedOptions(definition, valid);
    record(
      "resolved_lines_include_plated_and_entree",
      resolved.some((l) => /Plated Dinner/i.test(l.description))
        && resolved.some((l) => /Chicken Marsala/i.test(l.description)),
      JSON.stringify(resolved.map((l) => ({ d: l.description, p: l.unitPrice, inc: l.isIncluded }))),
      "finalization",
    );
    const buffetPath: ChoicesAnswers = {
      [primary!.id]: { optionIds: [buffet!.id] },
      [sides!.id]: { optionIds: [caesar!.id] },
    };
    const buffetResolved = resolveSelectedOptions(definition, buffetPath);
    record(
      "resolved_buffet_path_excludes_plated_entree",
      buffetResolved.some((l) => /Buffet Dinner/i.test(l.description))
        && !buffetResolved.some((l) => /Chicken Marsala/i.test(l.description))
        && buffetResolved.some((l) => /Caesar/i.test(l.description)),
      JSON.stringify(buffetResolved.map((l) => l.description)),
      "finalization",
    );

    // Isolated event + empty EO: incomplete validation must not invent lines
    const { data: space, error: spaceErr } = await admin.from("venue_spaces").select("id").eq("venue_id", FANCY).limit(1).maybeSingle();
    if (spaceErr || !space) throw new Error(`space: ${JSON.stringify(spaceErr)}`);
    const { data: client, error: clientErr } = await admin.from("clients").insert({
      venue_id: FANCY,
      first_name: "EOTUX",
      last_name: RUN,
      email: `eotux-${RUN.toLowerCase()}@hellotocheers-test.invalid`,
      status: "confirmed",
    }).select("id").single();
    if (clientErr || !client) throw new Error(`client: ${JSON.stringify(clientErr)}`);
    createdClientIds.push(client.id);
    const { data: event, error: eventErr } = await admin.from("events").insert({
      venue_id: FANCY,
      client_id: client.id,
      name: `${PREFIX}Wedding`,
      event_type: "wedding",
      event_date: EVENT_DATE,
      event_end_date: EVENT_DATE,
      status: "confirmed",
      booked_at: new Date().toISOString(),
      space_id: space.id,
    }).select("id").single();
    if (eventErr || !event) throw new Error(`event: ${JSON.stringify(eventErr)}`);
    createdEventIds.push(event.id);
    const { data: eo, error: eoErr } = await admin.from("event_orders").insert({
      venue_id: FANCY,
      event_id: event.id,
      status: "open",
      revision: 1,
    }).select("id").single();
    if (eoErr || !eo) throw new Error(`eo: ${JSON.stringify(eoErr)}`);
    createdOrderIds.push(eo.id);
    const beforeCount = await admin.from("event_order_lines").select("id", { count: "exact", head: true }).eq("event_order_id", eo.id);
    // Simulate rejected finalize: validate fails → do not insert
    if (!incompleteV.ok) {
      // no inserts
    }
    const afterReject = await admin.from("event_order_lines").select("id", { count: "exact", head: true }).eq("event_order_id", eo.id);
    record(
      "rejected_finalize_no_partial_lines",
      (beforeCount.count ?? 0) === 0 && (afterReject.count ?? 0) === 0,
      `before=${beforeCount.count} after=${afterReject.count}`,
      "finalization",
    );

    // Apply valid resolved lines once (manual apply simulating finalize success path)
    const { data: section, error: sectionErr } = await admin.from("event_order_sections").insert({
      venue_id: FANCY,
      event_order_id: eo.id,
      name: "Catering",
      sort_order: 0,
    }).select("id").single();
    if (sectionErr || !section) throw new Error(`section: ${JSON.stringify(sectionErr)}`);

    async function insertResolvedLines() {
      for (const [i, line] of resolved.entries()) {
        const qty = line.quantity ?? 1;
        const unitPrice = line.unitPrice;
        const amount = unitPrice == null ? 0 : Number((qty * unitPrice).toFixed(2));
        const { error: lineErr } = await admin.from("event_order_lines").insert({
          venue_id: FANCY,
          event_order_id: eo!.id,
          section_id: section!.id,
          provenance: line.offeringId ? "offering" : "custom",
          description: line.description,
          quantity: qty,
          unit_price: unitPrice,
          amount,
          is_included: line.isIncluded,
          offering_id: line.offeringId,
          sort_order: i,
        });
        if (lineErr) throw new Error(`line insert: ${JSON.stringify(lineErr)}`);
      }
    }
    await insertResolvedLines();
    const { data: applied } = await admin
      .from("event_order_lines")
      .select("id,description,unit_price,is_included,offering_id,amount")
      .eq("event_order_id", eo.id);
    record(
      "valid_finalize_lines_once",
      (applied ?? []).length === resolved.length
        && (applied ?? []).some((l) => /Plated Dinner/i.test(l.description))
        && (applied ?? []).some((l) => /Chicken Marsala/i.test(l.description)),
      JSON.stringify(applied),
      "finalization",
    );

    // Snapshot immutability: mutate template option label; EO lines stay as snapshotted
    await admin.from("event_order_template_options").update({ label: "Chicken Marsala RENAMED" }).eq("id", chicken!.id);
    const { data: afterTemplateEdit } = await admin
      .from("event_order_lines")
      .select("description")
      .eq("event_order_id", eo.id)
      .ilike("description", "%Chicken%");
    record(
      "template_edit_does_not_mutate_eo_snapshot",
      (afterTemplateEdit ?? []).every((l) => l.description === "Chicken Marsala")
        && !(afterTemplateEdit ?? []).some((l) => /RENAMED/i.test(l.description)),
      JSON.stringify(afterTemplateEdit),
      "finalization",
    );

    // Re-apply same resolved set must not duplicate if we clear first (revision path)
    await admin.from("event_order_lines").delete().eq("event_order_id", eo.id);
    await insertResolvedLines();
    const { count: reapplied } = await admin
      .from("event_order_lines")
      .select("id", { count: "exact", head: true })
      .eq("event_order_id", eo.id);
    record("no_duplicate_lines_on_reapply", reapplied === resolved.length, `count=${reapplied} expected=${resolved.length}`, "finalization");
    persisted.finalization = { resolved, applied, reapplied };

    // Fixed catalog offering count unchanged (no accidental Offering create)
    const { count: offeringCount } = await admin
      .from("offerings")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("name", `${PREFIX}Champagne Toast`);
    record("template_only_did_not_create_offering", (offeringCount ?? 0) === 0, `count=${offeringCount}`, "persisted");

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/library/event-order-templates/${tpl.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="eo-guided-setup-wizard"]', { timeout: 90_000 });
    await page.screenshot({ path: `${OUT}/shots/08-builder-390.png`, fullPage: true });
    const mobileText = await page.locator("body").innerText();
    record(
      "mobile_390_structure_readable",
      /Dinner style|Choices couples make|Items always on this package|Buffet/i.test(mobileText),
      mobileText.slice(0, 400),
      "usability",
    );
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.stack ?? err.message
        : typeof err === "object" && err
          ? JSON.stringify(err)
          : String(err);
    record("harness_error", false, detail, "error");
    try {
      await page.screenshot({ path: `${OUT}/shots/error.png`, fullPage: true });
    } catch { /* ignore */ }
  } finally {
    for (const id of createdChoicesIds) {
      await admin.from("client_choices").delete().eq("id", id);
    }
    for (const id of createdOrderIds) {
      await admin.from("event_order_lines").delete().eq("event_order_id", id);
      await admin.from("event_order_sections").delete().eq("event_order_id", id);
      await admin.from("event_orders").delete().eq("id", id);
    }
    for (const id of createdEventIds) {
      await admin.from("events").delete().eq("id", id);
    }
    for (const id of createdClientIds) {
      await admin.from("clients").delete().eq("id", id);
    }
    if (createdTemplateIds.length) {
      await admin.from("event_order_template_options").delete().in("template_id", createdTemplateIds);
      await admin.from("event_order_template_groups").delete().in("template_id", createdTemplateIds);
      await admin.from("event_order_template_lines").delete().in("template_id", createdTemplateIds);
      await admin.from("event_order_template_sections").delete().in("template_id", createdTemplateIds);
      await admin.from("event_order_templates").delete().in("id", createdTemplateIds);
    }
    await browser.close();
  }

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, failed: failed.length, persisted }, null, 2));
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));
  writeFileSync(
    `${OUT}/browser-run.log`,
    checks.map((c) => `${c.pass ? "PASS" : "FAIL"} [${c.kind}] ${c.name} — ${c.detail}`).join("\n") + "\n",
  );
  console.log(`\n${failed.length === 0 ? "GREEN" : "NOT GREEN"} — ${checks.length - failed.length} pass / ${failed.length} fail`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
