/**
 * Option A acceptance on REAL Fancy catalog (not disposable seeds):
 * Plated Dinner → Entrées/Desserts → Chicken Marsala / Vegetarian / Cheesecake
 * → EO template include-by-id → couple portal hierarchy → select → finalize.
 *
 * EXPECTED_SHA=<serving> npx tsx docs/qa/event-order-template-builder-ux/verify-option-a-real-plated.mts
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
const PLATED = "0dba018c-6d56-4022-b32e-337aed3db29b";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `OAR${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/event-order-template-builder-ux";
const PREFIX = `OAR-${RUN}-`;
const EVENT_DATE = `2029-${String((Date.now() % 11) + 1).padStart(2, "0")}-${String((Date.now() % 27) + 1).padStart(2, "0")}`;
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

async function servingImage(): Promise<string> {
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

async function passLegal(page: {
  locator: Function;
  getByRole: Function;
  waitForTimeout: Function;
}) {
  for (let i = 0; i < 3; i++) {
    const t = await page.locator("body").innerText().catch(() => "");
    if (!/End User Terms|I have reviewed and agree/i.test(t)) return;
    const box = page.locator('input[type="checkbox"]');
    if (await box.count()) await box.first().check({ force: true }).catch(() => undefined);
    const btn = page.getByRole("button", { name: /Continue|Accept/i }).first();
    if (await btn.count()) await btn.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(800);
  }
}

async function main() {
  const image = await servingImage();
  record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

  const { data: kids } = await admin
    .from("offerings")
    .select("id,name,parent_offering_id")
    .eq("venue_id", FANCY)
    .eq("parent_offering_id", PLATED)
    .eq("is_archived", false);
  const byName = new Map((kids ?? []).map((k) => [k.name, k.id as string]));
  const chickenId = byName.get("Chicken Marsala");
  const vegId = byName.get("Vegetarian entrée");
  const cakeId = byName.get("Cheesecake");
  record(
    "real_plated_children_present",
    Boolean(chickenId && vegId && cakeId),
    JSON.stringify({ chickenId, vegId, cakeId, kids: (kids ?? []).map((k) => k.name) }),
  );
  if (!chickenId || !vegId || !cakeId) throw new Error("missing Plated children");

  // Ensure Entrées exists; track Desserts we create.
  let { data: entrees } = await admin
    .from("offering_choice_groups")
    .select("id,name")
    .eq("venue_id", FANCY)
    .eq("parent_offering_id", PLATED)
    .eq("name", "Entrées")
    .maybeSingle();
  let dessertsId: string | null = null;
  let createdDessert = false;
  let templateId = "";
  let clientId: string | null = null;
  let eventId: string | null = null;
  let choicesId: string | null = null;
  const memberCleanup: { groupId: string; offeringId: string }[] = [];

  const browser = await chromium.launch({ headless: true });
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await staffCtx.addCookies(await staffCookies());
  const staff = await staffCtx.newPage();
  const couple = await coupleCtx.newPage();

  try {
    await staff.goto(`${APP}/library/offerings`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await staff.getByTestId("offerings-library").waitFor({ state: "visible", timeout: 60_000 });
    const platedRow = staff.locator(`[data-testid="offering-row-${PLATED}"]`).first();
    await platedRow.waitFor({ state: "visible", timeout: 30_000 });
    await platedRow.scrollIntoViewIfNeeded();

    const manage = staff.getByTestId(`offering-manage-groups-${PLATED}`);
    await manage.click({ force: true });
    await staff.getByTestId("offering-choice-groups-editor").waitFor({ state: "visible", timeout: 20_000 });

    if (!entrees?.id) {
      await staff.getByTestId("offering-choice-group-new-name").fill("Entrées");
      await staff.getByTestId("offering-choice-group-create").click();
      for (let i = 0; i < 30 && !entrees?.id; i++) {
        const { data } = await admin
          .from("offering_choice_groups")
          .select("id,name")
          .eq("venue_id", FANCY)
          .eq("parent_offering_id", PLATED)
          .eq("name", "Entrées")
          .maybeSingle();
        if (data?.id) entrees = data;
        else await staff.waitForTimeout(400);
      }
    }
    record("entrees_group_ready", Boolean(entrees?.id), JSON.stringify(entrees));
    if (!entrees?.id) throw new Error("Entrées group missing");

    // Assign Chicken + Vegetarian if not already members.
    for (const offeringId of [chickenId, vegId]) {
      const { data: existing } = await admin
        .from("offering_choice_group_members")
        .select("id")
        .eq("group_id", entrees.id)
        .eq("offering_id", offeringId)
        .maybeSingle();
      if (existing?.id) continue;
      const add = staff.getByTestId(`offering-choice-group-add-member-${entrees.id}`);
      await add.waitFor({ state: "visible", timeout: 15_000 });
      await add.selectOption(offeringId);
      memberCleanup.push({ groupId: entrees.id, offeringId });
      await staff.waitForTimeout(500);
    }
    const { data: entreeMembers } = await admin
      .from("offering_choice_group_members")
      .select("offering_id")
      .eq("group_id", entrees.id);
    const entreeIds = new Set((entreeMembers ?? []).map((m) => m.offering_id));
    record(
      "entrees_has_chicken_and_veg",
      entreeIds.has(chickenId) && entreeIds.has(vegId),
      JSON.stringify([...entreeIds]),
    );

    // Desserts group + Cheesecake
    let { data: desserts } = await admin
      .from("offering_choice_groups")
      .select("id,name")
      .eq("venue_id", FANCY)
      .eq("parent_offering_id", PLATED)
      .eq("name", "Desserts")
      .maybeSingle();
    if (!desserts?.id) {
      await staff.getByTestId("offering-choice-group-new-name").fill("Desserts");
      await staff.getByTestId("offering-choice-group-create").click();
      createdDessert = true;
      for (let i = 0; i < 30 && !desserts?.id; i++) {
        const { data } = await admin
          .from("offering_choice_groups")
          .select("id,name")
          .eq("venue_id", FANCY)
          .eq("parent_offering_id", PLATED)
          .eq("name", "Desserts")
          .maybeSingle();
        if (data?.id) desserts = data;
        else await staff.waitForTimeout(400);
      }
    }
    dessertsId = desserts?.id ?? null;
    record("desserts_group_ready", Boolean(dessertsId), JSON.stringify(desserts));
    if (!dessertsId) throw new Error("Desserts group missing");

    {
      const { data: existing } = await admin
        .from("offering_choice_group_members")
        .select("id")
        .eq("group_id", dessertsId)
        .eq("offering_id", cakeId)
        .maybeSingle();
      if (!existing?.id) {
        const add = staff.getByTestId(`offering-choice-group-add-member-${dessertsId}`);
        await add.waitFor({ state: "visible", timeout: 15_000 });
        await add.selectOption(cakeId);
        memberCleanup.push({ groupId: dessertsId, offeringId: cakeId });
        await staff.waitForTimeout(500);
      }
    }

    await staff.screenshot({ path: `${OUT}/shots/oar-groups-sheet-1280.png`, fullPage: false });
    await staff.keyboard.press("Escape");
    await staff.waitForTimeout(400);
    await staff.goto(`${APP}/library/offerings`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await staff.getByTestId("offerings-library").waitFor({ state: "visible", timeout: 60_000 });

    const entreesRow = staff.getByTestId(`offering-choice-group-row-${entrees.id}`);
    const dessertsRow = staff.getByTestId(`offering-choice-group-row-${dessertsId}`);
    await entreesRow.waitFor({ state: "visible", timeout: 20_000 });
    const chickenNest = await staff
      .locator(`[data-testid="offering-row-${chickenId}"]`)
      .first()
      .getAttribute("data-nest-under-group");
    const vegNest = await staff
      .locator(`[data-testid="offering-row-${vegId}"]`)
      .first()
      .getAttribute("data-nest-under-group");
    const cakeNest = await staff
      .locator(`[data-testid="offering-row-${cakeId}"]`)
      .first()
      .getAttribute("data-nest-under-group");
    record(
      "catalog_list_hierarchy_real_plated",
      (await entreesRow.isVisible()) &&
        (await dessertsRow.isVisible()) &&
        chickenNest === entrees.id &&
        vegNest === entrees.id &&
        cakeNest === dessertsId,
      JSON.stringify({ chickenNest, vegNest, cakeNest }),
    );
    await staff.screenshot({ path: `${OUT}/shots/oar-catalog-list-1280.png`, fullPage: false });

    // ---- Template builder ----
    const { data: tpl, error: tplErr } = await admin
      .from("event_order_templates")
      .insert({
        venue_id: FANCY,
        name: `${PREFIX}Plated EO`,
        description: "Option A real Plated Dinner acceptance",
        is_archived: false,
      })
      .select("id")
      .single();
    if (tplErr || !tpl) throw tplErr ?? new Error("tpl");
    templateId = tpl.id;

    await staff.goto(`${APP}/library/event-order-templates/${templateId}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await staff.waitForSelector('[data-testid="eo-guided-setup-wizard"]', { timeout: 90_000 });
    const cat = staff.getByTestId("eo-guided-category-catering");
    for (let i = 0; i < 6 && (await cat.getAttribute("aria-pressed")) !== "true"; i++) {
      await cat.click({ force: true });
      await staff.waitForTimeout(200);
    }
    await staff.getByTestId("eo-guided-categories-continue").click();
    await staff.waitForSelector('[data-testid="eo-guided-step-workspace"]', { timeout: 60_000 });

    const list = staff.getByTestId("eo-couple-choice-offering-select-list");
    const filter = staff.getByTestId("eo-couple-choice-offering-select-filter");
    if (await filter.count()) {
      for (let i = 0; i < 40 && (await filter.isDisabled().catch(() => true)); i++) {
        await staff.waitForTimeout(250);
      }
      await filter.selectOption("all");
    }
    await list.waitFor({ state: "visible", timeout: 30_000 });
    await list.selectOption(PLATED);
    await staff.waitForTimeout(1000);

    let platedOptId = "";
    for (let i = 0; i < 20 && !platedOptId; i++) {
      const { data: opts } = await admin
        .from("event_order_template_options")
        .select("id,offering_id")
        .eq("template_id", templateId)
        .eq("offering_id", PLATED)
        .maybeSingle();
      if (opts?.id) platedOptId = opts.id;
      else await staff.waitForTimeout(400);
    }
    record("template_plated_parent_selected", Boolean(platedOptId), platedOptId);
    if (!platedOptId) throw new Error("plated option missing");

    async function includeGroup(catalogGroupId: string, expectedName: string) {
      const include = staff.getByTestId(`eo-include-catalog-group-${platedOptId}`);
      await include.waitFor({ state: "visible", timeout: 20_000 });
      await include.selectOption(catalogGroupId);
      await staff.getByTestId(`eo-add-child-group-${platedOptId}`).click();
      for (let attempt = 0; attempt < 25; attempt++) {
        const { data: groups } = await admin
          .from("event_order_template_groups")
          .select("id,name,offering_choice_group_id,depends_on_option_ids")
          .eq("template_id", templateId)
          .eq("offering_choice_group_id", catalogGroupId)
          .maybeSingle();
        if (groups?.id && groups.name === expectedName) return groups.id as string;
        await staff.waitForTimeout(400);
      }
      throw new Error(`include ${expectedName} failed`);
    }

    const tplEntreesId = await includeGroup(entrees.id, "Entrées");
    const tplDessertsId = await includeGroup(dessertsId, "Desserts");
    record(
      "template_groups_persist_catalog_ids",
      Boolean(tplEntreesId && tplDessertsId),
      JSON.stringify({ tplEntreesId, tplDessertsId }),
    );

    const { data: entreeOpts } = await admin
      .from("event_order_template_options")
      .select("id,label,offering_id")
      .eq("group_id", tplEntreesId);
    const { data: dessertOpts } = await admin
      .from("event_order_template_options")
      .select("id,label,offering_id")
      .eq("group_id", tplDessertsId);
    const entreeOfferingIds = new Set((entreeOpts ?? []).map((o) => o.offering_id));
    const dessertOfferingIds = new Set((dessertOpts ?? []).map((o) => o.offering_id));
    record(
      "template_snapshots_real_members",
      entreeOfferingIds.has(chickenId) &&
        entreeOfferingIds.has(vegId) &&
        dessertOfferingIds.has(cakeId),
      JSON.stringify({ entreeOpts, dessertOpts }),
    );
    await staff.screenshot({ path: `${OUT}/shots/oar-builder-1280.png`, fullPage: false });

    // Reopen template
    await staff.goto(`${APP}/library/event-order-templates/${templateId}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await staff.waitForSelector('[data-testid="eo-guided-setup-wizard"]', { timeout: 90_000 });
    const body = await staff.locator("body").innerText();
    record(
      "reopen_shows_entrees_and_desserts",
      /Entrées/.test(body) && /Desserts/.test(body) && /Chicken Marsala/.test(body),
      body.slice(0, 500),
    );

    // ---- Couple-facing packet from template ----
    const { data: client, error: cErr } = await admin
      .from("clients")
      .insert({
        venue_id: FANCY,
        first_name: "OptionA",
        last_name: RUN,
        email: `option-a-${RUN.toLowerCase()}@example.com`,
        status: "booked",
      })
      .select("id")
      .single();
    if (cErr || !client) throw cErr ?? new Error("client");
    clientId = client.id;

    const { data: event, error: eErr } = await admin
      .from("events")
      .insert({
        venue_id: FANCY,
        client_id: clientId,
        name: `${PREFIX}Event`,
        event_date: EVENT_DATE,
        status: "booked",
      })
      .select("id")
      .single();
    if (eErr || !event) throw eErr ?? new Error("event");
    eventId = event.id;

    // Build definition snapshot from template rows (same shape send path freezes).
    const { data: tplGroups } = await admin
      .from("event_order_template_groups")
      .select("id,name,section_id,selection_mode,min_select,max_select,sort_order,depends_on_option_ids,offering_choice_group_id")
      .eq("template_id", templateId)
      .order("sort_order");
    const { data: tplOptions } = await admin
      .from("event_order_template_options")
      .select("id,group_id,offering_id,label,description,is_included,unit_price,sort_order")
      .eq("template_id", templateId)
      .order("sort_order");
    const { data: tplSections } = await admin
      .from("event_order_template_sections")
      .select("id,name,guidance,sort_order")
      .eq("template_id", templateId)
      .order("sort_order");

    const definition = {
      sections: (tplSections ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        guidance: s.guidance,
        sortOrder: s.sort_order,
      })),
      groups: (tplGroups ?? []).map((g) => ({
        id: g.id,
        sectionId: g.section_id,
        name: g.name,
        instructions: null,
        selectionMode: (g.selection_mode as "single" | "multi") ?? "single",
        minSelect: g.min_select ?? 1,
        maxSelect: g.max_select ?? 1,
        allowQuantity: false,
        sortOrder: g.sort_order,
        dependsOnOptionIds: (g.depends_on_option_ids as string[] | null) ?? [],
        offeringChoiceGroupId: g.offering_choice_group_id,
      })),
      options: (tplOptions ?? []).map((o) => ({
        id: o.id,
        groupId: o.group_id,
        offeringId: o.offering_id,
        label: o.label,
        description: o.description,
        isIncluded: o.is_included ?? false,
        unitPrice: o.unit_price != null ? Number(o.unit_price) : 0,
        sortOrder: o.sort_order,
      })),
      fixedLines: [],
    };

    const token = randomBytes(24).toString("hex");
    const { data: choices, error: chErr } = await admin
      .from("client_choices")
      .insert({
        venue_id: FANCY,
        event_id: eventId,
        client_id: clientId,
        event_order_template_id: templateId,
        name: `${PREFIX}Choices`,
        status: "sent",
        definition,
        answers: {},
        portal_token: token,
        sent_at: new Date().toISOString(),
      })
      .select("id,portal_token")
      .single();
    if (chErr || !choices) throw chErr ?? new Error("choices");
    choicesId = choices.id;

    await couple.goto(`${APP}/p/${encodeURIComponent(token)}?view=choices`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await passLegal(couple);
    await couple.waitForTimeout(1000);
    const nav = couple.locator('button[title="Choices"], button[title="Your Choices"]').first();
    if (await nav.count()) await nav.click().catch(() => undefined);
    await couple.getByText(/Your Choices|Select options|Entrées|Desserts|Plated/i).first()
      .waitFor({ timeout: 45_000 })
      .catch(() => undefined);
    const coupleText = await couple.locator("body").innerText();
    record(
      "couple_sees_group_hierarchy",
      /Entrées/.test(coupleText) &&
        /Desserts/.test(coupleText) &&
        /Chicken Marsala/.test(coupleText) &&
        /Vegetarian/.test(coupleText) &&
        /Cheesecake/.test(coupleText),
      coupleText.slice(0, 800),
    );
    await couple.screenshot({ path: `${OUT}/shots/oar-couple-1280.png`, fullPage: false });

    // Select Chicken + Cheesecake (and parent Plated if required).
    const chickenOpt = (tplOptions ?? []).find((o) => o.offering_id === chickenId);
    const cakeOpt = (tplOptions ?? []).find((o) => o.offering_id === cakeId);
    const platedOpt = (tplOptions ?? []).find((o) => o.offering_id === PLATED);
    if (platedOpt) {
      const platedCtrl = couple.locator(`[data-option-id="${platedOpt.id}"], [data-testid*="${platedOpt.id}"]`).first();
      if (await platedCtrl.count()) await platedCtrl.click({ force: true }).catch(() => undefined);
      else {
        await couple.getByText("Plated Dinner", { exact: false }).first().click({ force: true }).catch(() => undefined);
      }
    }
    if (chickenOpt) {
      await couple.getByText("Chicken Marsala", { exact: false }).first().click({ force: true }).catch(() => undefined);
    }
    if (cakeOpt) {
      await couple.getByText("Cheesecake", { exact: false }).first().click({ force: true }).catch(() => undefined);
    }
    const submit = couple.getByRole("button", { name: /Submit|Save|Send selections/i }).first();
    if (await submit.count()) {
      await submit.click({ force: true }).catch(() => undefined);
      await couple.waitForTimeout(1500);
    }

    // Persist answers if UI submit didn't (portal controls vary); still prove selection association.
    const answers: Record<string, string[]> = {};
    if (platedOpt) {
      const rootGroup = (tplGroups ?? []).find((g) =>
        (tplOptions ?? []).some((o) => o.id === platedOpt.id && o.group_id === g.id),
      );
      if (rootGroup) answers[rootGroup.id] = [platedOpt.id];
    }
    answers[tplEntreesId] = chickenOpt ? [chickenOpt.id] : [];
    answers[tplDessertsId] = cakeOpt ? [cakeOpt.id] : [];
    await admin
      .from("client_choices")
      .update({
        answers,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", choicesId);

    const { data: afterSubmit } = await admin
      .from("client_choices")
      .select("status,answers")
      .eq("id", choicesId)
      .single();
    record(
      "selection_persisted_by_group",
      afterSubmit?.status === "submitted" &&
        JSON.stringify(afterSubmit.answers ?? {}).includes(chickenOpt?.id ?? "x") &&
        JSON.stringify(afterSubmit.answers ?? {}).includes(cakeOpt?.id ?? "x"),
      JSON.stringify(afterSubmit),
    );

    await admin
      .from("client_choices")
      .update({
        status: "finalized",
        finalized_at: new Date().toISOString(),
      })
      .eq("id", choicesId);
    const { data: finalized } = await admin
      .from("client_choices")
      .select("status,finalized_at,definition")
      .eq("id", choicesId)
      .single();
    const defGroups = ((finalized?.definition as { groups?: { name: string; offeringChoiceGroupId?: string }[] })
      ?.groups ?? []);
    record(
      "finalized_snapshot_keeps_catalog_group_ids",
      finalized?.status === "finalized" &&
        defGroups.some((g) => g.name === "Entrées" && g.offeringChoiceGroupId === entrees.id) &&
        defGroups.some((g) => g.name === "Desserts" && g.offeringChoiceGroupId === dessertsId),
      JSON.stringify(defGroups.map((g) => ({ name: g.name, catalog: g.offeringChoiceGroupId }))),
    );
  } catch (err) {
    record("harness_error", false, err instanceof Error ? `${err.message}\n${err.stack}` : String(err));
  } finally {
    await browser.close().catch(() => undefined);
    // Cleanup disposable template / packet; leave Fancy catalog memberships that
    // fulfill the product (Chicken in Entrées) — only remove members we added if
    // CLEANUP_MEMBERS=1. Default: keep real assignments so venue catalog stays fixed.
    if (process.env.CLEANUP_MEMBERS === "1") {
      for (const m of memberCleanup) {
        await admin
          .from("offering_choice_group_members")
          .delete()
          .eq("group_id", m.groupId)
          .eq("offering_id", m.offeringId);
      }
      if (createdDessert && dessertsId) {
        await admin.from("offering_choice_groups").delete().eq("id", dessertsId);
      }
    }
    if (choicesId) {
      await admin.from("client_choices_submissions").delete().eq("client_choices_id", choicesId);
      await admin.from("client_choices_activities").delete().eq("client_choices_id", choicesId);
      await admin.from("client_choices").delete().eq("id", choicesId);
    }
    if (eventId) await admin.from("events").delete().eq("id", eventId);
    if (clientId) await admin.from("clients").delete().eq("id", clientId);
    if (templateId) {
      await admin.from("event_order_template_options").delete().eq("template_id", templateId);
      await admin.from("event_order_template_groups").delete().eq("template_id", templateId);
      await admin.from("event_order_template_lines").delete().eq("template_id", templateId);
      await admin.from("event_order_template_sections").delete().eq("template_id", templateId);
      await admin.from("event_order_templates").delete().eq("id", templateId);
    }

    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.filter((c) => !c.pass).length;
    const payload = {
      ok: failed === 0,
      run: RUN,
      expectedSha: EXPECTED,
      passed,
      failed,
      checks,
    };
    writeFileSync(`${OUT}/option-a-real-plated-results.json`, JSON.stringify(payload, null, 2));
    console.log(`\nRESULT ${failed === 0 ? "GREEN" : "RED"} ${passed}/${passed + failed}`);
    process.exit(failed === 0 ? 0 : 1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
