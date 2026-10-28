/**
 * EO Template builder — Offering-based package builder Sandbox acceptance.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
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

async function ensureCategory(name: string): Promise<string> {
  const { data: existing } = await admin
    .from("offering_categories")
    .select("id")
    .eq("venue_id", FANCY)
    .eq("name", name)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await admin
    .from("offering_categories")
    .insert({ venue_id: FANCY, name, sort_order: 50 })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error(`category ${name}`);
  return data.id;
}

async function ensureOffering(
  name: string,
  categoryId: string,
  defaultUnitPrice: number | null,
  tracked: string[],
): Promise<string> {
  const { data: existing } = await admin
    .from("offerings")
    .select("id")
    .eq("venue_id", FANCY)
    .eq("name", name)
    .maybeSingle();
  if (existing?.id) {
    await admin
      .from("offerings")
      .update({
        category_id: categoryId,
        default_unit_price: defaultUnitPrice,
        is_archived: false,
      })
      .eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await admin
    .from("offerings")
    .insert({
      venue_id: FANCY,
      name,
      category_id: categoryId,
      default_unit_price: defaultUnitPrice,
      unit: "each",
      is_archived: false,
      sort_order: 0,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error(`offering ${name}`);
  tracked.push(data.id);
  return data.id;
}

async function ensureMajorLink(childId: string, parentId: string) {
  const { data: existing } = await admin
    .from("offering_major_links")
    .select("id")
    .eq("venue_id", FANCY)
    .eq("offering_id", childId)
    .eq("parent_offering_id", parentId)
    .maybeSingle();
  if (existing?.id) return;
  const { error } = await admin.from("offering_major_links").insert({
    venue_id: FANCY,
    offering_id: childId,
    parent_offering_id: parentId,
  });
  if (error) throw error;
  await admin.from("offerings").update({ parent_offering_id: parentId }).eq("id", childId);
}

async function pickOffering(page: {
  getByTestId: (id: string) => {
    count: () => Promise<number>;
    selectOption: (v: string) => Promise<unknown>;
    waitFor: (o: { state: string; timeout: number }) => Promise<unknown>;
  };
  waitForTimeout: (ms: number) => Promise<void>;
}, selectTestId: string, offeringId: string) {
  const filter = page.getByTestId(`${selectTestId}-filter`);
  if (await filter.count()) {
    await filter.selectOption("all").catch(() => undefined);
    await page.waitForTimeout(250);
  }
  const list = page.getByTestId(`${selectTestId}-list`);
  await list.waitFor({ state: "visible", timeout: 20_000 });
  await list.selectOption(offeringId);
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const createdTemplateIds: string[] = [];
  const createdClientIds: string[] = [];
  const createdEventIds: string[] = [];
  const createdChoicesIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdOfferingIds: string[] = [];
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED, prefix: PREFIX };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`, "deploy");
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    await context.addCookies(await staffCookies());

    const cateringCatId = await ensureCategory("Catering");
    const ceremonyCatId = await ensureCategory("Ceremony");

    const buffetId = await ensureOffering("Buffet Style Dinner", cateringCatId, null, createdOfferingIds);
    const platedId = await ensureOffering("Plated Dinner", cateringCatId, null, createdOfferingIds);
    const zitiId = await ensureOffering("Baked Ziti", cateringCatId, null, createdOfferingIds);
    const cheesecakeId = await ensureOffering("Cheesecake", cateringCatId, null, createdOfferingIds);
    const marsalaId = await ensureOffering("Chicken Marsala", cateringCatId, null, createdOfferingIds);
    const vegId = await ensureOffering("Vegetarian entrée", cateringCatId, null, createdOfferingIds);
    const dayOfId = await ensureOffering("Day-of coordination", await ensureCategory("Services"), 0, createdOfferingIds);

    await ensureMajorLink(zitiId, buffetId);
    await ensureMajorLink(cheesecakeId, buffetId);
    await ensureMajorLink(marsalaId, platedId);
    await ensureMajorLink(vegId, platedId);
    await ensureMajorLink(cheesecakeId, platedId);

    const arborId = await ensureOffering("Arbor", ceremonyCatId, 250, createdOfferingIds);
    const archId = await ensureOffering("Arch", ceremonyCatId, 200, createdOfferingIds);
    const runnerId = await ensureOffering("Runner", ceremonyCatId, 75, createdOfferingIds);
    const petalsId = await ensureOffering("White Rose Petal Aisle Path", ceremonyCatId, 175, createdOfferingIds);

    persisted.catalog = {
      buffetId, platedId, zitiId, cheesecakeId, marsalaId, vegId, dayOfId,
      arborId, archId, runnerId, petalsId,
    };
    record(
      "catalog_fixtures_seeded",
      Boolean(buffetId && platedId && arborId && archId),
      JSON.stringify(persisted.catalog),
      "fixture",
    );

    const { data: tpl, error: tplErr } = await admin
      .from("event_order_templates")
      .insert({
        venue_id: FANCY,
        name: `${PREFIX}Offering Builder`,
        description: "offering-based package builder acceptance",
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
    await page.waitForTimeout(1000);

    async function pressCategory(key: string) {
      const el = page.getByTestId(`eo-guided-category-${key}`);
      for (let i = 0; i < 6; i++) {
        if ((await el.getAttribute("aria-pressed")) === "true") return;
        await el.click({ force: true });
        await page.waitForTimeout(250);
      }
      if ((await el.getAttribute("aria-pressed")) !== "true") throw new Error(`${key} not selected`);
    }
    await pressCategory("catering");
    await pressCategory("ceremony");
    await page.getByTestId("eo-guided-categories-continue").click();
    await page.waitForSelector('[data-testid="eo-guided-step-workspace"]', { timeout: 60_000 });
    await page.screenshot({ path: `${OUT}/shots/01-workspace-empty-1280.png`, fullPage: true });

    const workspace = await page.getByTestId("eo-guided-step-workspace").innerText();
    record("ux_always_on_heading", /Always on the package/i.test(workspace), "heading", "usability");
    record("ux_couples_choices_heading", /Couple.?s choices/i.test(workspace), "heading", "usability");
    record("ux_no_included_heading", !/Included in Catering/i.test(workspace), "no Included", "usability");
    record("ux_no_primary_question_cta", (await page.getByTestId("eo-add-primary-question").count()) === 0, "no question CTA", "usability");
    record("ux_offering_choices_panel", (await page.getByTestId("eo-package-choices-panel").count()) === 1, "panel", "usability");
    record("ux_no_question_copy", !/Add a primary question/i.test(workspace), "no question copy", "usability");

    // ---- Always on: catalog covered item ----
    await page.locator('[data-testid^="eo-add-offering-"]').first().click();
    await page.waitForTimeout(600);
    await page.getByTestId("eo-line-offering-picker-filter").selectOption("all").catch(() => undefined);
    await page.waitForTimeout(300);
    const list = page.getByTestId("eo-line-offering-picker-list");
    await list.waitFor({ state: "visible", timeout: 15_000 });
    await list.selectOption(dayOfId);
    await page.waitForTimeout(400);
    const covered = page.getByTestId("eo-line-covered-by-package");
    await covered.waitFor({ state: "visible", timeout: 10_000 });
    if (!(await covered.isChecked())) await covered.check({ force: true });
    await page.getByRole("button", { name: /^(Add package item|Add offering)$/i }).click();
    await page.locator("#offering-name").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
    await page.getByTestId("eo-guided-step-fixed").getByText(/Day-of coordination/i).waitFor({
      state: "visible",
      timeout: 30_000,
    });

    // ---- Always on: template-only additional charge ----
    await page.locator('[data-testid^="eo-add-offering-"]').first().click();
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: /custom \/ template-only/i }).click();
    await page.locator("#offering-name").waitFor({ state: "visible", timeout: 15_000 });
    const toastName = `${PREFIX}Champagne Toast`;
    await page.locator("#offering-name").fill(toastName);
    await page.locator("label").filter({ hasText: /This offering has a price/i }).locator('input[type="checkbox"]').check({ force: true });
    await page.locator("#offering-price").fill("150");
    const covered2 = page.getByTestId("eo-line-covered-by-package");
    if (await covered2.isChecked()) await covered2.uncheck({ force: true });
    await page.getByRole("button", { name: /^(Add package item|Add offering)$/i }).click();
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
    } | undefined;
    let catalogLine: typeof toastLine;
    let lines: typeof toastLine[] | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data } = await admin
        .from("event_order_template_lines")
        .select("id,description,included_by_default,unit_price,offering_id")
        .eq("template_id", tpl.id);
      lines = (data ?? []) as typeof lines;
      catalogLine = (lines ?? []).find((l) => l.offering_id === dayOfId);
      toastLine = (lines ?? []).find((l) => String(l.description).includes("Champagne Toast"));
      if (catalogLine && toastLine) break;
      await page.waitForTimeout(400);
    }
    record(
      "persisted_catalog_always_on_covered",
      Boolean(catalogLine) && catalogLine!.included_by_default === true && catalogLine!.offering_id === dayOfId,
      JSON.stringify(catalogLine),
      "persisted",
    );
    record(
      "persisted_template_only_additional_charge",
      Boolean(toastLine) && toastLine!.included_by_default === false && Number(toastLine!.unit_price) === 150 && toastLine!.offering_id == null,
      JSON.stringify(toastLine ?? { lines }),
      "persisted",
    );
    await page.screenshot({ path: `${OUT}/shots/02-always-on-pricing-1280.png`, fullPage: true });
    persisted.lines = lines;

    // ---- Couple's choices: Buffet + Plated from Offering dropdown (no question first) ----
    await pickOffering(page, "eo-couple-choice-offering-select", buffetId);
    await page.getByText("Buffet Style Dinner").first().waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(800);
    await pickOffering(page, "eo-couple-choice-offering-select-0", platedId);
    await page.getByText("Plated Dinner").first().waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(1000);

    let buffetOpt: { id: string; label: string; group_id: string; offering_id: string | null } | undefined;
    let platedOpt: typeof buffetOpt;
    let rootGroupId: string | undefined;
    for (let attempt = 0; attempt < 12; attempt++) {
      const { data: opts } = await admin
        .from("event_order_template_options")
        .select("id,label,group_id,offering_id")
        .eq("template_id", tpl.id);
      buffetOpt = (opts ?? []).find((o) => o.offering_id === buffetId);
      platedOpt = (opts ?? []).find((o) => o.offering_id === platedId);
      if (buffetOpt && platedOpt && buffetOpt.group_id === platedOpt.group_id) {
        rootGroupId = buffetOpt.group_id;
        break;
      }
      await page.waitForTimeout(500);
    }
    record(
      "persisted_parents_from_offerings_no_question",
      Boolean(buffetOpt && platedOpt && rootGroupId && buffetOpt.offering_id === buffetId && platedOpt.offering_id === platedId),
      JSON.stringify({ buffetOpt, platedOpt, rootGroupId }),
      "persisted",
    );
    record(
      "ui_shows_parent_children_checklists",
      (await page.getByTestId(`eo-parent-children-${buffetOpt!.id}`).count()) === 1
        && (await page.getByTestId(`eo-parent-children-${platedOpt!.id}`).count()) === 1,
      "child panels",
      "usability",
    );

    // Select children under Buffet / Plated
    await page.getByTestId(`eo-child-toggle-${buffetOpt!.id}-${zitiId}`).check({ force: true });
    await page.waitForTimeout(1200);
    await page.getByTestId(`eo-child-toggle-${buffetOpt!.id}-${cheesecakeId}`).check({ force: true });
    await page.waitForTimeout(1200);
    await page.getByTestId(`eo-child-toggle-${platedOpt!.id}-${marsalaId}`).check({ force: true });
    await page.waitForTimeout(1200);
    await page.getByTestId(`eo-child-toggle-${platedOpt!.id}-${vegId}`).check({ force: true });
    await page.waitForTimeout(1500);

    // Instructions + required choose-1 on root set
    const instr = page.getByTestId("eo-choice-instructions-0");
    await instr.fill(
      "Choose either Buffet Style Dinner or Plated Dinner. For the style you select, choose from the available options.",
    );
    await instr.blur();
    await page.waitForTimeout(800);
    const countInput = page.getByTestId("eo-choice-select-count-0");
    await countInput.fill("1");
    await countInput.blur();
    const req = page.getByTestId("eo-choice-required-0");
    if (!(await req.isChecked())) await req.check({ force: true });
    await page.waitForTimeout(1000);

    let zitiOpt: typeof buffetOpt;
    let marsalaOpt: typeof buffetOpt;
    let buffetChildGroup: { id: string; depends_on_option_ids: string[]; min_select: number; max_select: number | null } | undefined;
    let platedChildGroup: typeof buffetChildGroup;
    for (let attempt = 0; attempt < 12; attempt++) {
      const [{ data: opts }, { data: groups }] = await Promise.all([
        admin.from("event_order_template_options").select("id,label,group_id,offering_id").eq("template_id", tpl.id),
        admin.from("event_order_template_groups").select("id,name,depends_on_option_ids,min_select,max_select,instructions").eq("template_id", tpl.id),
      ]);
      zitiOpt = (opts ?? []).find((o) => o.offering_id === zitiId);
      marsalaOpt = (opts ?? []).find((o) => o.offering_id === marsalaId);
      buffetChildGroup = (groups ?? []).find((g) =>
        (g.depends_on_option_ids as string[] | null)?.includes(buffetOpt!.id),
      ) as typeof buffetChildGroup;
      platedChildGroup = (groups ?? []).find((g) =>
        (g.depends_on_option_ids as string[] | null)?.includes(platedOpt!.id),
      ) as typeof platedChildGroup;
      if (zitiOpt && marsalaOpt && buffetChildGroup && platedChildGroup) break;
      await page.waitForTimeout(500);
    }
    record(
      "persisted_selected_children_under_parents",
      Boolean(zitiOpt && marsalaOpt && buffetChildGroup && platedChildGroup),
      JSON.stringify({ zitiOpt, marsalaOpt, buffetChildGroup, platedChildGroup }),
      "persisted",
    );

    // Configure child group counts (choose 1 required)
    if (buffetChildGroup) {
      const childCount = page.getByTestId(`eo-child-select-count-${buffetChildGroup.id}`);
      if (await childCount.count()) {
        await childCount.fill("1");
        await childCount.blur();
        const childReq = page.getByTestId(`eo-child-required-${buffetChildGroup.id}`);
        if (!(await childReq.isChecked())) await childReq.check({ force: true });
        await page.waitForTimeout(800);
      }
    }
    if (platedChildGroup) {
      const childCount = page.getByTestId(`eo-child-select-count-${platedChildGroup.id}`);
      if (await childCount.count()) {
        await childCount.fill("1");
        await childCount.blur();
        const childReq = page.getByTestId(`eo-child-required-${platedChildGroup.id}`);
        if (!(await childReq.isChecked())) await childReq.check({ force: true });
        await page.waitForTimeout(800);
      }
    }

    await page.screenshot({ path: `${OUT}/shots/03-catering-couple-choices-1280.png`, fullPage: true });

    // Always-on offering must not appear in couple picker (Day-of already used as line)
    const coupleListOptions = await page.getByTestId("eo-couple-choice-offering-select-0-list").innerText().catch(() => "");
    record(
      "always_on_not_duplicated_in_couple_picker",
      !coupleListOptions.includes("Day-of coordination"),
      coupleListOptions.slice(0, 400),
      "usability",
    );

    // ---- Continue to Ceremony ----
    await page.getByTestId("eo-guided-continue").click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('[data-testid="eo-guided-step-workspace"]', { timeout: 30_000 });
    const ceremonyWs = await page.getByTestId("eo-guided-step-workspace").innerText();
    record("ceremony_workspace", /Ceremony/i.test(ceremonyWs) && /Couple.?s choices/i.test(ceremonyWs), ceremonyWs.slice(0, 300), "usability");

    await pickOffering(page, "eo-couple-choice-offering-select", arborId);
    await page.getByText("Arbor").first().waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(800);
    await pickOffering(page, "eo-couple-choice-offering-select-0", archId);
    await page.getByText("Arch").first().waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(800);

    await page.getByTestId("eo-add-choice-set").click();
    await page.waitForTimeout(1200);
    await pickOffering(page, "eo-couple-choice-offering-select-1", runnerId);
    await page.getByText("Runner").first().waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(800);
    await pickOffering(page, "eo-couple-choice-offering-select-1", petalsId);
    await page.getByText("White Rose Petal Aisle Path").first().waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(1000);

    const { data: ceremonyOpts } = await admin
      .from("event_order_template_options")
      .select("id,label,group_id,offering_id,unit_price")
      .eq("template_id", tpl.id)
      .in("offering_id", [arborId, archId, runnerId, petalsId]);
    record(
      "persisted_ceremony_standalones",
      (ceremonyOpts ?? []).length === 4
        && (ceremonyOpts ?? []).some((o) => o.offering_id === arborId && Number(o.unit_price) === 250)
        && (ceremonyOpts ?? []).some((o) => o.offering_id === archId),
      JSON.stringify(ceremonyOpts),
      "persisted",
    );
    const ceremonyGroupIds = new Set((ceremonyOpts ?? []).map((o) => o.group_id));
    record("ceremony_two_choice_sets", ceremonyGroupIds.size === 2, `groups=${ceremonyGroupIds.size}`, "persisted");
    await page.screenshot({ path: `${OUT}/shots/04-ceremony-standalones-1280.png`, fullPage: true });
    persisted.ceremonyOptions = ceremonyOpts;

    // ---- Reopen persistence ----
    await page.goto(`${APP}/library/event-order-templates/${tpl.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="eo-guided-setup-wizard"]', { timeout: 90_000 });
    const editCategoryBtn = page.getByRole("button", { name: /^Edit category$/i });
    if (await editCategoryBtn.count()) {
      await editCategoryBtn.first().click();
      await page.waitForTimeout(800);
    }
    await page.waitForSelector('[data-testid="eo-guided-step-workspace"], [data-testid="eo-guided-step-review"]', {
      timeout: 30_000,
    });
    const reopenBody = await page.locator("body").innerText();
    record(
      "reopen_preserves_offering_structure",
      /Buffet Style Dinner/i.test(reopenBody)
        && /Plated Dinner/i.test(reopenBody)
        && (/Baked Ziti|Chicken Marsala/i.test(reopenBody) || /Champagne Toast/i.test(reopenBody)),
      reopenBody.slice(0, 800),
      "persisted",
    );

    // ---- Preview ----
    for (let i = 0; i < 8; i++) {
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
    await page.getByTestId("eo-guided-step-preview").waitFor({ timeout: 45_000 });
    await page.screenshot({ path: `${OUT}/shots/05-preview-initial-1280.png`, fullPage: true });

    await page.getByTestId(`eo-preview-parent-${buffetOpt!.id}`).click();
    await page.waitForTimeout(500);
    const afterBuffet = await page.getByTestId("eo-choice-conditional-preview").innerText();
    record(
      "preview_buffet_shows_only_buffet_children",
      /Baked Ziti|Cheesecake/i.test(afterBuffet) && !/Chicken Marsala|Vegetarian/i.test(afterBuffet),
      afterBuffet.slice(0, 600),
      "preview",
    );
    await page.screenshot({ path: `${OUT}/shots/06-preview-buffet-path-1280.png`, fullPage: true });

    await page.getByTestId(`eo-preview-parent-${platedOpt!.id}`).click();
    await page.waitForTimeout(500);
    const afterPlated = await page.getByTestId("eo-choice-conditional-preview").innerText();
    record(
      "preview_plated_shows_only_plated_children",
      (/Chicken Marsala|Vegetarian/i.test(afterPlated)) && !/Baked Ziti/i.test(afterPlated),
      afterPlated.slice(0, 600),
      "preview",
    );
    await page.screenshot({ path: `${OUT}/shots/07-preview-plated-path-1280.png`, fullPage: true });

    await page.getByTestId("eo-preview-check-selections").click();
    await page.waitForTimeout(400);
    const valMsg = await page.getByTestId("eo-preview-validation-message").innerText().catch(() => "");
    record(
      "preview_rejects_incomplete_child_selection",
      /at least|requires|select|option/i.test(valMsg),
      valMsg || "no validation message",
      "preview",
    );

    if (marsalaOpt) {
      await page.getByTestId(`eo-preview-option-${marsalaOpt.id}`).click().catch(() => undefined);
      await page.waitForTimeout(300);
      await page.getByTestId("eo-preview-check-selections").click();
      await page.waitForTimeout(400);
      const okHint = await page.getByTestId("eo-preview-validation-ok-hint").count();
      const stillErr = await page.getByTestId("eo-preview-validation-message").count();
      record("preview_accepts_complete_plated_path", okHint === 1 && stillErr === 0, `okHint=${okHint} err=${stillErr}`, "preview");
    } else {
      record("preview_accepts_complete_plated_path", false, "marsala option missing", "preview");
    }

    // ---- Server validation / finalize integrity ----
    const details = await loadTemplateDetails(tpl.id);
    const definition = selectionDefinitionFromEventOrderTemplate(details);
    const incomplete: ChoicesAnswers = {
      [rootGroupId!]: { optionIds: [platedOpt!.id] },
    };
    const incompleteV = validateChoicesAnswers(definition, incomplete);
    record("server_rejects_incomplete_before_finalize", !incompleteV.ok, incompleteV.ok ? "ok" : incompleteV.message, "finalization");

    const valid: ChoicesAnswers = {
      [rootGroupId!]: { optionIds: [platedOpt!.id] },
      [platedChildGroup!.id]: { optionIds: [marsalaOpt!.id] },
    };
    // Include ceremony required chooses if minSelect > 0
    for (const g of details.groups) {
      if ((g.dependsOnOptionIds ?? []).length > 0) continue;
      if (g.id === rootGroupId) continue;
      if (g.minSelect <= 0) continue;
      const opts = details.options.filter((o) => o.groupId === g.id);
      if (opts[0] && !valid[g.id]) valid[g.id] = { optionIds: [opts[0].id] };
    }
    const validV = validateChoicesAnswers(definition, valid);
    record("server_accepts_valid_plated_path", validV.ok, validV.ok ? "ok" : validV.message, "finalization");
    const resolved = resolveSelectedOptions(definition, valid);
    record(
      "resolved_lines_include_plated_and_entree_not_all_children",
      resolved.some((l) => /Plated Dinner/i.test(l.description))
        && resolved.some((l) => /Chicken Marsala/i.test(l.description))
        && !resolved.some((l) => /Baked Ziti/i.test(l.description))
        && !resolved.some((l) => /Vegetarian/i.test(l.description)),
      JSON.stringify(resolved.map((l) => ({ d: l.description, p: l.unitPrice, inc: l.isIncluded }))),
      "finalization",
    );

    const buffetPath: ChoicesAnswers = {
      [rootGroupId!]: { optionIds: [buffetOpt!.id] },
      [buffetChildGroup!.id]: { optionIds: [zitiOpt!.id] },
    };
    for (const g of details.groups) {
      if ((g.dependsOnOptionIds ?? []).length > 0) continue;
      if (g.id === rootGroupId) continue;
      if (g.minSelect <= 0) continue;
      const opts = details.options.filter((o) => o.groupId === g.id);
      if (opts[0] && !buffetPath[g.id]) buffetPath[g.id] = { optionIds: [opts[0].id] };
    }
    const buffetResolved = resolveSelectedOptions(definition, buffetPath);
    record(
      "resolved_buffet_path_excludes_plated_children",
      buffetResolved.some((l) => /Buffet Style Dinner/i.test(l.description))
        && buffetResolved.some((l) => /Baked Ziti/i.test(l.description))
        && !buffetResolved.some((l) => /Chicken Marsala/i.test(l.description)),
      JSON.stringify(buffetResolved.map((l) => l.description)),
      "finalization",
    );

    const { data: space } = await admin.from("venue_spaces").select("id").eq("venue_id", FANCY).limit(1).maybeSingle();
    if (!space) throw new Error("space");
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
    const afterReject = await admin.from("event_order_lines").select("id", { count: "exact", head: true }).eq("event_order_id", eo.id);
    record(
      "rejected_finalize_no_partial_lines",
      !incompleteV.ok && (beforeCount.count ?? 0) === 0 && (afterReject.count ?? 0) === 0,
      `before=${beforeCount.count} after=${afterReject.count}`,
      "finalization",
    );

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

    await admin.from("event_order_template_options").update({ label: "Chicken Marsala RENAMED" }).eq("id", marsalaOpt!.id);
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

    await admin.from("event_order_lines").delete().eq("event_order_id", eo.id);
    await insertResolvedLines();
    const { count: reapplied } = await admin
      .from("event_order_lines")
      .select("id", { count: "exact", head: true })
      .eq("event_order_id", eo.id);
    record("no_duplicate_lines_on_reapply", reapplied === resolved.length, `count=${reapplied} expected=${resolved.length}`, "finalization");
    persisted.finalization = { resolved, applied, reapplied };

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
      /Always on the package|Couple.?s choices|Buffet Style Dinner|Arbor/i.test(mobileText),
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
    // Keep seeded catalog Offerings (real Fancy catalog enrichment for acceptance).
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
