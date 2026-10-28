/**
 * EO Template builder mental-model UX — Sandbox acceptance.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts
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
const RUN = process.env.E2E_RUN_ID ?? `EOTUX${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/event-order-template-builder-ux";
const PREFIX = `EOTUX-${RUN}-`;
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

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const createdTemplateIds: string[] = [];
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED, prefix: PREFIX };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    await context.addCookies(await staffCookies());

    const { data: tpl, error: tplErr } = await admin
      .from("event_order_templates")
      .insert({
        venue_id: FANCY,
        name: `${PREFIX}Builder UX`,
        description: "eotux fixture",
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
    record(
      "catering_selected",
      (await catering.getAttribute("aria-pressed")) === "true",
      `aria-pressed=${await catering.getAttribute("aria-pressed")}`,
    );
    await page.getByTestId("eo-guided-categories-continue").click();
    await page.waitForSelector('[data-testid="eo-guided-step-workspace"]', { timeout: 60_000 });

    const workspace = await page.getByTestId("eo-guided-step-workspace").innerText();
    record(
      "workspace_package_items_label",
      /Items always on this package/i.test(workspace),
      workspace.slice(0, 400),
    );
    record(
      "workspace_choices_label",
      /Choices couples make/i.test(workspace),
      /Choices couples make/.test(workspace) ? "ok" : workspace.slice(0, 200),
    );
    record(
      "workspace_not_included_in_heading",
      !/Included in Catering/i.test(workspace),
      "no Included in Catering",
    );
    record(
      "workspace_not_major_choices_copy",
      !/major choices from your Offerings catalog/i.test(workspace),
      "no major choices catalog framing",
    );
    record(
      "empty_primary_cta",
      (await page.getByTestId("eo-add-primary-question").count()) === 1
        && (await page.getByTestId("eo-choice-groups-empty").count()) === 1,
      "primary question + empty guidance",
    );

    // Add package item (template-only) with additional charge
    await page.locator('[data-testid^="eo-add-offering-"]').first().click();
    await page.waitForTimeout(600);
    const customBtn = page.getByRole("button", { name: /custom \/ template-only/i });
    if (await customBtn.count()) await customBtn.click();
    await page.locator("#offering-name").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("#offering-name").fill(`${PREFIX}Champagne Toast`);
    // hasPrice checkbox
    await page.locator('label:has-text("This offering has a price") input[type="checkbox"]').check({ force: true });
    await page.locator("#offering-price").fill("150");
    const covered = page.getByTestId("eo-line-covered-by-package");
    if (await covered.isChecked()) await covered.uncheck({ force: true });
    await page.getByRole("button", { name: /^Add package item$/i }).click();
    await page.waitForTimeout(1500);

    const { data: lines } = await admin
      .from("event_order_template_lines")
      .select("id,description,included_by_default,unit_price,offering_id")
      .eq("template_id", tpl.id);
    const toast = (lines ?? []).find((l) => String(l.description).includes("Champagne Toast"));
    record(
      "persisted_package_item_additional_charge",
      Boolean(toast)
        && toast!.included_by_default === false
        && Number(toast!.unit_price) === 150
        && toast!.offering_id == null,
      JSON.stringify(toast),
    );
    persisted.packageItem = toast;

    const listText = await page.getByTestId("eo-guided-step-fixed").innerText();
    record(
      "ui_shows_additional_charge_treatment",
      /Additional charge/i.test(listText) && /Template-only/i.test(listText),
      listText.slice(0, 400),
    );

    // Primary question + Buffet / Plated answers
    await page.getByTestId("eo-add-group-name").fill(`${PREFIX}Dinner style`);
    await page.getByTestId("eo-add-choice-group").click();
    await page.waitForTimeout(1500);

    const { data: groups } = await admin
      .from("event_order_template_groups")
      .select("id,name,depends_on_option_ids")
      .eq("template_id", tpl.id);
    const primary = (groups ?? []).find((g) => String(g.name).includes("Dinner style"));
    record("persisted_primary_question", Boolean(primary?.id), JSON.stringify(primary));
    persisted.primaryGroupId = primary?.id;

    async function addTemplateOnlyAnswer(label: string) {
      await page.getByTestId("eo-add-option-group").selectOption(primary!.id);
      await page.getByTestId("eo-add-option-template-only").click();
      await page.getByPlaceholder("Option label").fill(label);
      await page.getByRole("button", { name: /^Add template-only option$/i }).click();
      await page.waitForTimeout(1200);
    }
    await addTemplateOnlyAnswer(`${PREFIX}Buffet Dinner`);
    await addTemplateOnlyAnswer(`${PREFIX}Plated Dinner`);

    const { data: options } = await admin
      .from("event_order_template_options")
      .select("id,label,group_id,offering_id,is_included,unit_price")
      .eq("template_id", tpl.id);
    const buffet = (options ?? []).find((o) => String(o.label).includes("Buffet Dinner"));
    const plated = (options ?? []).find((o) => String(o.label).includes("Plated Dinner"));
    record(
      "persisted_primary_answers",
      Boolean(buffet && plated)
        && buffet!.offering_id == null
        && plated!.offering_id == null,
      JSON.stringify({ buffet, plated }),
    );
    persisted.options = { buffet, plated };

    // Follow-up under Buffet
    if (buffet) {
      const openFollow = page.getByTestId(`eo-add-choices-for-${buffet.id}`);
      if (await openFollow.count()) {
        await openFollow.click();
        await page.waitForTimeout(400);
      }
      const nameInput = page.getByTestId(`eo-followup-name-${buffet.id}`);
      if (await nameInput.count()) {
        await nameInput.fill(`${PREFIX}Sides`);
        await page.getByTestId(`eo-followup-save-${buffet.id}`).click();
        await page.waitForTimeout(1500);
      }
    }

    const { data: groupsAfter } = await admin
      .from("event_order_template_groups")
      .select("id,name,depends_on_option_ids")
      .eq("template_id", tpl.id);
    const sides = (groupsAfter ?? []).find((g) => String(g.name).includes("Sides"));
    record(
      "persisted_followup_under_buffet",
      Boolean(sides)
        && Array.isArray(sides!.depends_on_option_ids)
        && (sides!.depends_on_option_ids as string[]).includes(buffet!.id),
      JSON.stringify(sides),
    );
    persisted.sidesGroup = sides;

    await page.screenshot({ path: `${OUT}/shots/workspace-1280.png`, fullPage: true });

    // Continue → review / preview labels
    await page.getByTestId("eo-guided-continue").click();
    await page.waitForTimeout(800);
    // may need continue again if still on workspace of next empty category — click until review
    for (let i = 0; i < 4; i++) {
      if (await page.getByTestId("eo-guided-step-review").count()) break;
      if (await page.getByTestId("eo-guided-continue").count()) {
        await page.getByTestId("eo-guided-continue").click();
        await page.waitForTimeout(600);
      }
    }
    await page.getByTestId("eo-guided-step-review").waitFor({ timeout: 30_000 }).catch(() => undefined);
    if (await page.getByTestId("eo-guided-step-review").count()) {
      const review = await page.getByTestId("eo-guided-step-review").innerText();
      record(
        "review_package_items_not_included_heading",
        /Package items/i.test(review) && !/Included items and services/i.test(review),
        review.slice(0, 400),
      );
      await page.getByTestId("eo-guided-goto-preview").click();
      await page.getByTestId("eo-guided-step-preview").waitFor({ timeout: 30_000 });
      const preview = await page.getByTestId("eo-guided-step-preview").innerText();
      record(
        "preview_shows_primary_question",
        preview.includes("Dinner style") || preview.includes("Buffet") || preview.includes("Plated"),
        preview.slice(0, 500),
      );
      await page.screenshot({ path: `${OUT}/shots/preview-1280.png`, fullPage: true });
    } else {
      record("review_package_items_not_included_heading", false, "review step not reached");
      record("preview_shows_primary_question", false, "preview not reached");
    }

    // Reload editability
    await page.goto(`${APP}/library/event-order-templates/${tpl.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="eo-guided-setup-wizard"]', { timeout: 90_000 });
    const editCats = page.getByTestId("eo-guided-edit-package-categories");
    if (await editCats.count()) {
      await editCats.first().click();
      await page.getByTestId("eo-guided-step-categories").waitFor({ timeout: 20_000 });
      record("reopen_can_return_to_categories", true, "Change package categories");
    } else {
      record("reopen_can_return_to_categories", false, "edit control missing");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/library/event-order-templates/${tpl.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="eo-guided-setup-wizard"]', { timeout: 90_000 });
    await page.screenshot({ path: `${OUT}/shots/builder-390.png`, fullPage: true });
    record("mobile_390", true, "screenshot");
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.stack ?? err.message
        : typeof err === "object" && err
          ? JSON.stringify(err)
          : String(err);
    record("harness_error", false, detail);
    try {
      await page.screenshot({ path: `${OUT}/shots/error.png`, fullPage: true });
    } catch { /* ignore */ }
  } finally {
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
    checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n") + "\n",
  );
  console.log(`\n${failed.length === 0 ? "GREEN" : "NOT GREEN"} — ${checks.length - failed.length} pass / ${failed.length} fail`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
