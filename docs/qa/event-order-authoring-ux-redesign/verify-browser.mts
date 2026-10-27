/**
 * Event Order authoring UX redesign (S0–S2) — Sandbox browser + persistence.
 *
 * EXPECTED_SHA=<full sha> \
 *   npx tsx docs/qa/event-order-authoring-ux-redesign/verify-browser.mts
 *
 * Disposable fixtures: EOAR-{RUN}-* on Fancy venue only.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
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
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `EOAR${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/event-order-authoring-ux-redesign";
const PREFIX = `EOAR-${RUN}-`;
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

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
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
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

async function staffCookies(venueId = FANCY) {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  await admin.from("venue_staff_active_context").upsert({
    user_id: otp.session.user.id,
    active_venue_id: venueId,
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
      value: venueId,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function snapshot(templateId: string) {
  const [sections, groups, options, lines] = await Promise.all([
    admin.from("event_order_template_sections").select("id,name,sort_order,venue_id").eq("template_id", templateId).order("sort_order"),
    admin.from("event_order_template_groups").select("id,section_id,name,selection_mode,min_select,max_select,depends_on_option_ids,venue_id").eq("template_id", templateId),
    admin.from("event_order_template_options").select("id,group_id,label,unit_price,is_included,offering_id,venue_id").eq("template_id", templateId),
    admin.from("event_order_template_lines").select("id,section_id,description,included_by_default,unit_price,offering_id,venue_id").eq("template_id", templateId),
  ]);
  return {
    sections: sections.data ?? [],
    groups: groups.data ?? [],
    options: options.data ?? [],
    lines: lines.data ?? [],
  };
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  let templateId: string | null = null;
  const beforeGlobal = {
    fancyTemplateCount: (
      await admin.from("event_order_templates").select("id", { count: "exact", head: true }).eq("venue_id", FANCY)
    ).count,
  };
  writeFileSync(`${OUT}/before-state.json`, JSON.stringify(beforeGlobal, null, 2));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
    if (!image.includes(EXPECTED.slice(0, 12))) {
      throw new Error(`Serving ${image}, expected ${EXPECTED}`);
    }

    const health = await fetch(`${APP}/api/health`).then(async (r) => ({
      status: r.status,
      body: await r.json().catch(() => null),
    }));
    record("api_health", health.status === 200 && health.body?.ok === true, JSON.stringify(health));

    const html = await fetch(`${APP}/login`).then((r) => r.text());
    const dpl = html.match(/data-dpl-id="([^"]+)"/)?.[1] ?? "";
    record("html_dpl", dpl.startsWith(EXPECTED.slice(0, 12)), `dpl=${dpl}`);

    await context.addCookies(await staffCookies(FANCY));
    await page.goto(`${APP}/library/event-order-templates`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/shots/00-landing-1280.png`, fullPage: true });
    const landingText = await page.locator("body").innerText();
    record(
      "landing_plain_english",
      /Reusable packages for a wedding/i.test(landingText)
        && /included automatically/i.test(landingText)
        && /Preview shows the couple experience without sending/i.test(landingText),
      landingText.slice(0, 500),
    );
    record(
      "landing_example_present",
      (await page.getByTestId("eo-templates-landing-example").count()) === 1,
      "example block",
    );

    const tplName = `${PREFIX}AuthoringRedesign`;
    const { data: tpl, error: tplErr } = await admin
      .from("event_order_templates")
      .insert({
        venue_id: FANCY,
        name: tplName,
        description: "Disposable EO authoring UX redesign fixture",
        source_master_key: null,
        is_archived: false,
      })
      .select("id")
      .single();
    if (tplErr || !tpl) throw tplErr ?? new Error("create template");
    templateId = tpl.id as string;
    record("fixture_created", true, `id=${templateId}`);

    await page.goto(`${APP}/library/event-order-templates/${templateId}`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    await page.waitForTimeout(800);
    record(
      "detail_intro_plain",
      (await page.getByTestId("eo-template-detail-intro").count()) === 1,
      "detail orientation",
    );

    await page.getByTestId("eo-guided-category-catering").click();
    await page.getByTestId("eo-guided-categories-continue").click();
    await page.waitForSelector('[data-testid="eo-guided-step-workspace"]', { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/shots/01-workspace-1280.png`, fullPage: true });

    record(
      "no_pattern_quiz",
      (await page.getByTestId("eo-guided-step-patterns").count()) === 0
        && (await page.locator('[data-testid^="eo-guided-pattern-"]').count()) === 0,
      "pattern quiz absent on ordinary path",
    );
    record(
      "no_false_step_of_seven",
      !(await page.getByTestId("eo-guided-progress").innerText()).match(/Step 1 of 7/i),
      await page.getByTestId("eo-guided-progress").innerText(),
    );

    const choicesText = await page.getByTestId("eo-guided-step-choices").innerText();
    record(
      "ux_primary_question_framing",
      /Dinner service|main question|couples answer first|Add a primary question/i.test(choicesText),
      "primary question framing in workspace",
    );
    record(
      "ux_how_many_control",
      /How many can the couple select\?/.test(choicesText)
        || (await page.locator('[data-testid^="eo-select-count-"]').count()) >= 1
        || (await page.getByTestId("eo-add-primary-question").count()) >= 1,
      "select-count control present",
    );
    record(
      "included_and_choices_same_workspace",
      (await page.getByTestId("eo-guided-step-fixed").count()) === 1
        && (await page.getByTestId("eo-guided-step-choices").count()) === 1,
      "included + choices co-located",
    );

    // Ensure a primary group exists (ensureRootGroupForPatterns usually creates one)
    let groupCount = await page.locator('[data-testid^="eo-choice-group-"]').count();
    if (groupCount === 0) {
      const workspace = page.getByTestId("eo-guided-step-workspace");
      await workspace.getByTestId("eo-add-group-name").fill("Dinner service");
      await workspace.getByTestId("eo-add-primary-question").or(workspace.getByTestId("eo-add-choice-group")).first().click();
      await page.waitForTimeout(2000);
      groupCount = await page.locator('[data-testid^="eo-choice-group-"]').count();
    }
    record("primary_group_ready", groupCount >= 1, `groups=${groupCount}`);

    async function findOptionGroupSelect() {
      const selects = page.locator("select");
      const n = await selects.count();
      for (let i = 0; i < n; i++) {
        const html = await selects.nth(i).innerHTML();
        if (/Select (group|question or category)/i.test(html)) return selects.nth(i);
      }
      return selects.last();
    }

    async function addTemplateOption(label: string, price: string) {
      const groupSelectEl = await findOptionGroupSelect();
      const groupOptions = await groupSelectEl.locator("option").evaluateAll((opts: HTMLOptionElement[]) =>
        opts.map((o) => ({ value: o.value, label: o.textContent ?? "" })),
      );
      const firstGroup = groupOptions.find((o) => o.value && !/follow-up/i.test(o.label));
      if (!firstGroup) throw new Error("no primary group for options");
      await groupSelectEl.selectOption(firstGroup.value);
      await page.getByRole("button", { name: /Add template-only option/i }).first().click();
      await page.getByPlaceholder(/Option label|Customer-facing label/i).fill(label);
      const incl = page.locator('label:has-text("Included ($0)") input').last();
      if (await incl.isChecked()) await incl.uncheck();
      await page.getByPlaceholder("Unit price").fill(price);
      await page.getByRole("button", { name: /^Add template-only option$/i }).click();
      await page.waitForTimeout(1800);
    }

    await addTemplateOption("Buffet", "65");
    await addTemplateOption("Plated dinner", "85");
    await page.screenshot({ path: `${OUT}/shots/02-service-options-1280.png`, fullPage: true });
    record(
      "service_options_added",
      (await page.getByText("Buffet").count()) >= 1 && (await page.getByText("Plated dinner").count()) >= 1,
      "Buffet + Plated dinner on primary question",
    );

    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/shots/03-under-option-1280.png`, fullPage: true });
    const workspaceText = await page.getByTestId("eo-guided-step-workspace").innerText();
    record(
      "ux_under_option_cta",
      /Add choices for couples who select/i.test(workspaceText)
        || (await page.locator('[data-testid^="eo-add-choices-for-"]').count()) >= 1,
      "under-option add-choices CTA in same workspace",
    );
    record(
      "ux_if_couple_chooses",
      /If the couple chooses/i.test(workspaceText),
      "parent-child relationship copy",
    );
    record(
      "no_duplicate_branch_step",
      (await page.getByTestId("eo-guided-step-branches").count()) === 0,
      "separate branches step removed",
    );

    // Add Buffet categories via under-option form
    const snap0 = await snapshot(templateId!);
    const buffetOpt = snap0.options.find((o: { label: string }) => o.label === "Buffet");
    const platedOpt = snap0.options.find((o: { label: string }) => o.label === "Plated dinner");
    record("options_persisted", Boolean(buffetOpt && platedOpt), JSON.stringify({ buffet: buffetOpt?.id, plated: platedOpt?.id }));

    async function addCategoryUnder(optionId: string, name: string, count: string) {
      const btn = page.getByTestId(`eo-add-choices-for-${optionId}`);
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForSelector(`[data-testid="eo-followup-form-${optionId}"]`, { timeout: 10000 });
      await page.getByTestId(`eo-followup-name-${optionId}`).fill(name);
      await page.getByTestId(`eo-followup-count-${optionId}`).fill(count);
      await page.getByTestId(`eo-followup-save-${optionId}`).click();
      await page.waitForTimeout(2200);
    }

    if (buffetOpt) {
      await addCategoryUnder(buffetOpt.id, "Main dishes", "2");
      await addCategoryUnder(buffetOpt.id, "Side dishes", "3");
    }
    if (platedOpt) {
      await addCategoryUnder(platedOpt.id, "Entrée", "1");
      await addCategoryUnder(platedOpt.id, "Dessert", "1");
    }
    await page.screenshot({ path: `${OUT}/shots/04-categories-added-1280.png`, fullPage: true });

    const afterCats = await snapshot(templateId!);
    const buffetDeps = afterCats.groups.filter((g: { depends_on_option_ids: string[] | null }) =>
      (g.depends_on_option_ids ?? []).includes(buffetOpt?.id ?? "___"),
    );
    const platedDeps = afterCats.groups.filter((g: { depends_on_option_ids: string[] | null }) =>
      (g.depends_on_option_ids ?? []).includes(platedOpt?.id ?? "___"),
    );
    record(
      "buffet_has_own_categories",
      buffetDeps.length >= 2
        && buffetDeps.every((g: { depends_on_option_ids: string[] | null }) =>
          !(g.depends_on_option_ids ?? []).includes(platedOpt?.id ?? "___"),
        ),
      JSON.stringify(buffetDeps.map((g: { name: string; min_select: number; max_select: number | null; selection_mode: string }) => ({
        name: g.name, min: g.min_select, max: g.max_select, mode: g.selection_mode,
      }))),
    );
    record(
      "plated_has_own_categories",
      platedDeps.length >= 2
        && platedDeps.every((g: { depends_on_option_ids: string[] | null }) =>
          !(g.depends_on_option_ids ?? []).includes(buffetOpt?.id ?? "___"),
        ),
      JSON.stringify(platedDeps.map((g: { name: string; min_select: number; max_select: number | null }) => ({
        name: g.name, min: g.min_select, max: g.max_select,
      }))),
    );
    const sides = buffetDeps.find((g: { name: string }) => /Side dishes/i.test(g.name));
    record(
      "choose_exactly_three_sides",
      Boolean(sides) && sides!.min_select === 3 && sides!.max_select === 3 && sides!.selection_mode === "multi",
      JSON.stringify(sides),
    );
    const entree = platedDeps.find((g: { name: string }) => /Entrée|Entree/i.test(g.name));
    record(
      "choose_one_entree",
      Boolean(entree) && entree!.min_select === 1 && entree!.max_select === 1,
      JSON.stringify(entree),
    );

    // Add menu items to Side dishes and Entrée
    async function addItemToGroup(groupId: string, label: string) {
      const selects = page.locator("select");
      const n = await selects.count();
      for (let i = 0; i < n; i++) {
        const vals = await selects.nth(i).locator("option").evaluateAll((opts: HTMLOptionElement[]) =>
          opts.map((o) => o.value),
        );
        if (vals.includes(groupId)) {
          await selects.nth(i).selectOption(groupId);
          await page.getByRole("button", { name: /Add template-only option/i }).first().click();
          await page.getByPlaceholder(/Option label|Customer-facing label/i).fill(label);
          await page.getByRole("button", { name: /^Add template-only option$/i }).click();
          await page.waitForTimeout(1600);
          return true;
        }
      }
      // Fallback: per-group add button
      const addBtn = page.getByTestId(`eo-add-item-to-group-${groupId}`);
      if ((await addBtn.count()) > 0) {
        await addBtn.click();
        await page.getByPlaceholder(/Option label|Customer-facing label/i).fill(label);
        await page.getByRole("button", { name: /^Add template-only option$/i }).click();
        await page.waitForTimeout(1600);
        return true;
      }
      return false;
    }

    if (sides) {
      await addItemToGroup(sides.id, "Roasted potatoes");
      await addItemToGroup(sides.id, "Green beans");
      await addItemToGroup(sides.id, "Mac and cheese");
      await addItemToGroup(sides.id, "Salad");
    }
    if (entree) {
      await addItemToGroup(entree.id, "Chicken entrée");
      await addItemToGroup(entree.id, "Steak entrée");
    }

    // Narrow width smoke
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/shots/05-workspace-390.png`, fullPage: true });
    record(
      "narrow_workspace_usable",
      (await page.getByTestId("eo-guided-step-workspace").count()) === 1,
      "workspace at 390",
    );
    await page.setViewportSize({ width: 1280, height: 900 });

    // Advance to review + preview (single workspace continue)
    for (let i = 0; i < 8; i++) {
      if (await page.getByTestId("eo-guided-step-review").isVisible().catch(() => false)) break;
      if (await page.getByTestId("eo-guided-continue").isVisible().catch(() => false)) {
        await page.getByTestId("eo-guided-continue").click();
        await page.waitForTimeout(1400);
        continue;
      }
      break;
    }
    await page.waitForSelector('[data-testid="eo-guided-step-review"]', { timeout: 60000 });
    await page.screenshot({ path: `${OUT}/shots/06-review-1280.png`, fullPage: true });
    const reviewText = await page.getByTestId("eo-guided-step-review").innerText();
    record(
      "review_nests_buffet_and_plated",
      /Buffet/i.test(reviewText) && /Plated/i.test(reviewText) && (/Side dishes|Entrée|Dessert|Main dishes/i.test(reviewText)),
      reviewText.slice(0, 500),
    );

    await page.getByTestId("eo-guided-goto-preview").click();
    await page.waitForSelector('[data-testid="eo-guided-step-preview"]', { timeout: 20000 });
    await page.screenshot({ path: `${OUT}/shots/07-preview-1280.png`, fullPage: true });
    const previewWrap = page.getByTestId("eo-guided-step-preview");
    record(
      "preview_non_sending",
      (await page.getByTestId("eo-guided-preview-non-sending").count()) === 1,
      "non-sending banner",
    );

    const platedBtn = page.locator('[data-testid^="eo-preview-parent-"]').filter({ hasText: "Plated dinner" });
    const buffetBtn = page.locator('[data-testid^="eo-preview-parent-"]').filter({ hasText: "Buffet" });
    if ((await platedBtn.count()) > 0) {
      await platedBtn.first().click();
      await page.waitForTimeout(500);
      const afterPlated = await page.getByTestId("eo-template-choices-preview").innerText().catch(() => "");
      record(
        "preview_plated_shows_entree_not_buffet_sides",
        /Chicken|Steak|Entrée|Dessert/i.test(afterPlated) && !/Roasted potatoes/i.test(afterPlated),
        afterPlated.slice(0, 500),
      );
    } else {
      record("preview_plated_shows_entree_not_buffet_sides", false, "no plated preview parent");
    }
    if ((await buffetBtn.count()) > 0) {
      await buffetBtn.first().click();
      await page.waitForTimeout(500);
      const afterBuffet = await page.getByTestId("eo-template-choices-preview").innerText().catch(() => "");
      record(
        "preview_buffet_shows_sides_not_plated_entree",
        /Roasted potatoes|Side dishes|Main dishes/i.test(afterBuffet) && !/Chicken entrée/i.test(afterBuffet),
        afterBuffet.slice(0, 500),
      );

      // Exact-three under-selection: pick only 2 sides, then Check selections
      const sideLabels = ["Roasted potatoes", "Green beans", "Mac and cheese", "Salad"];
      let clicked = 0;
      for (const label of sideLabels) {
        if (clicked >= 2) break;
        const optBtn = page.locator('[data-testid^="eo-preview-option-"]').filter({ hasText: label });
        if ((await optBtn.count()) > 0) {
          await optBtn.first().click();
          clicked += 1;
          await page.waitForTimeout(200);
        }
      }
      record("exact_three_underselect_picked_two", clicked === 2, `clicked=${clicked}`);
      await page.getByTestId("eo-preview-check-selections").click();
      await page.waitForTimeout(400);
      const validation = await page.getByTestId("eo-preview-validation-message").innerText().catch(() => "");
      record(
        "exact_three_underselect_validation",
        /Side dishes/i.test(validation) && /at least 3|requires at least 3/i.test(validation),
        validation || "(no validation message)",
      );
    } else {
      record("preview_buffet_shows_sides_not_plated_entree", false, "no buffet preview parent");
      record("exact_three_underselect_picked_two", false, "skipped");
      record("exact_three_underselect_validation", false, "skipped");
    }
    record(
      "preview_commercial_guidance_intact",
      /Catering/i.test(await previewWrap.innerText()),
      "commercial category still in preview",
    );
    record(
      "specialist_hidden_on_preview",
      (await page.getByTestId("eo-specialist-selection-rules").count()) === 0,
      "specialist not on preview path",
    );

    const persisted = await snapshot(templateId!);
    writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));
    const pBuffet = persisted.options.find((o: { label: string }) => o.label === "Buffet");
    const pPlated = persisted.options.find((o: { label: string }) => o.label === "Plated dinner");
    const pBuffetDeps = persisted.groups.filter((g: { depends_on_option_ids: string[] | null }) =>
      (g.depends_on_option_ids ?? []).includes(pBuffet?.id ?? "___"),
    );
    const pPlatedDeps = persisted.groups.filter((g: { depends_on_option_ids: string[] | null }) =>
      (g.depends_on_option_ids ?? []).includes(pPlated?.id ?? "___"),
    );
    record(
      "persist_scoped_dependencies",
      pBuffetDeps.length >= 2 && pPlatedDeps.length >= 2
        && !pBuffetDeps.some((g: { depends_on_option_ids: string[] | null }) =>
          (g.depends_on_option_ids ?? []).includes(pPlated?.id ?? "___"),
        ),
      JSON.stringify({
        buffetDeps: pBuffetDeps.map((g: { name: string; min_select: number; max_select: number | null }) => g),
        platedDeps: pPlatedDeps.map((g: { name: string; min_select: number; max_select: number | null }) => g),
      }),
    );
    record(
      "persist_fancy_ownership",
      [...persisted.sections, ...persisted.groups, ...persisted.options, ...persisted.lines].every(
        (r: { venue_id: string }) => r.venue_id === FANCY,
      ),
      "all rows Fancy",
    );

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    record(
      "reopen_wizard_present",
      (await page.getByTestId("eo-guided-setup-wizard").count()) === 1,
      "wizard after refresh",
    );
    await page.screenshot({ path: `${OUT}/shots/08-reopen-1280.png`, fullPage: true });
  } catch (err) {
    record("harness_uncaught", false, err instanceof Error ? err.message : String(err));
    await page.screenshot({ path: `${OUT}/shots/error.png`, fullPage: true }).catch(() => undefined);
  } finally {
    if (templateId) {
      await admin.from("event_order_template_options").delete().eq("template_id", templateId);
      await admin.from("event_order_template_groups").delete().eq("template_id", templateId);
      await admin.from("event_order_template_lines").delete().eq("template_id", templateId);
      await admin.from("event_order_template_sections").delete().eq("template_id", templateId);
      await admin.from("event_order_templates").delete().eq("id", templateId).eq("venue_id", FANCY);
    }
    const leftovers = (
      await admin.from("event_order_templates").select("id,name").eq("venue_id", FANCY).ilike("name", `${PREFIX}%`)
    ).data ?? [];
    const afterCount = (
      await admin.from("event_order_templates").select("id", { count: "exact", head: true }).eq("venue_id", FANCY)
    ).count;
    writeFileSync(
      `${OUT}/after-cleanup.json`,
      JSON.stringify({ leftovers, afterCount, beforeCount: beforeGlobal.fancyTemplateCount }, null, 2),
    );
    record(
      "cleanup_complete",
      leftovers.length === 0 && afterCount === beforeGlobal.fancyTemplateCount,
      `leftovers=${leftovers.length} before=${beforeGlobal.fancyTemplateCount} after=${afterCount}`,
    );

    await browser.close();
    const pass = checks.filter((c) => c.pass).length;
    const fail = checks.filter((c) => !c.pass).length;
    const summary = { expectedSha: EXPECTED, pass, fail, checks };
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
    console.log(`\n${fail === 0 ? "GREEN" : "NOT GREEN"} — ${pass} pass / ${fail} fail`);
    process.exit(fail === 0 ? 0 : 1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
