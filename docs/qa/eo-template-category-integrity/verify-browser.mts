/**
 * EO Template category integrity + return-to-package-categories.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/eo-template-category-integrity/verify-browser.mts
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
const RUN = process.env.E2E_RUN_ID ?? `ECI${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/eo-template-category-integrity";
const PREFIX = `ECI-${RUN}-`;
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
  const createdCategoryIds: string[] = [];
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED, prefix: PREFIX };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    await context.addCookies(await staffCookies());

    async function openOfferingCategorySelect() {
      // Prefer Edit on an existing row — more reliable than PageHeader imperative create.
      const editBtn = page.locator('[data-testid^="offering-row-"]').first().getByRole("button", { name: /^Edit$/i });
      if (await editBtn.count()) {
        await editBtn.click();
        await page.getByTestId("offering-category").waitFor({ state: "visible", timeout: 15_000 });
        return;
      }
      for (let attempt = 0; attempt < 8; attempt++) {
        await page.getByRole("button", { name: /^\+?\s*New Offering$/i }).first().click({ force: true });
        try {
          await page.getByTestId("offering-category").waitFor({ state: "visible", timeout: 4_000 });
          return;
        } catch {
          await page.waitForTimeout(500);
        }
      }
      throw new Error("Offering category select did not open");
    }

    // ---- A: Offerings dropdown includes Décor (built-in) after page load ensure ----
    await page.goto(`${APP}/library/offerings`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForSelector('[data-testid="offerings-library"]', { timeout: 90_000 });
    await page.waitForTimeout(1200);
    await openOfferingCategorySelect();
    const catOptions = await page.getByTestId("offering-category").locator("option").allTextContents();
    record(
      "offerings_dropdown_has_decor",
      catOptions.some((t) => /d[eé]cor/i.test(t)),
      catOptions.join(" | "),
    );
    record(
      "offerings_dropdown_has_florals",
      catOptions.some((t) => /florals/i.test(t)),
      catOptions.join(" | "),
    );
    await page.screenshot({ path: `${OUT}/shots/offerings-category-dropdown-1280.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    const { data: fancyCats } = await admin
      .from("offering_categories")
      .select("id,name")
      .eq("venue_id", FANCY);
    persisted.offeringsCategories = fancyCats;
    const decorRow = (fancyCats ?? []).find((c) => /d[eé]cor/i.test(c.name));
    record("persisted_decor_category", Boolean(decorRow), JSON.stringify(decorRow ?? null));

    // ---- B: Create template, continue, return, add custom category, verify offerings ----
    const { data: tpl, error: tplErr } = await admin
      .from("event_order_templates")
      .insert({
        venue_id: FANCY,
        name: `${PREFIX}Category Integrity`,
        description: "eci fixture",
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

    // Select Catering on package step (accessible name includes description — use test id)
    const categoriesStep = page.getByTestId("eo-guided-step-categories");
    await categoriesStep.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    const cateringCard = page.getByTestId("eo-guided-category-catering");
    for (let attempt = 0; attempt < 6; attempt++) {
      if ((await cateringCard.getAttribute("aria-pressed")) === "true") break;
      await cateringCard.click({ force: true });
      await page.waitForTimeout(350);
    }
    record(
      "catering_selected",
      (await cateringCard.getAttribute("aria-pressed")) === "true",
      `aria-pressed=${await cateringCard.getAttribute("aria-pressed")}`,
    );
    if ((await cateringCard.getAttribute("aria-pressed")) !== "true") {
      throw new Error("Catering category card did not stay selected");
    }
    await page.getByTestId("eo-guided-categories-continue").click();
    await page.waitForSelector('[data-testid^="eo-guided-configure-"]', { timeout: 60_000 });
    record("configure_after_continue", true, page.url());

    // Return via explicit control
    await page.getByTestId("eo-guided-edit-package-categories").click();
    await page.getByTestId("eo-guided-step-categories").waitFor({ timeout: 30_000 });
    record("return_to_package_categories", true, "Change package categories");

    // Add custom category
    const customName = `${PREFIX}Get Ready Inclusions`;
    await page.getByTestId("eo-guided-custom-category-input").fill(customName);
    await page.getByTestId("eo-guided-custom-category-add").click();
    await page.getByTestId("eo-guided-categories-continue").click();
    await page.waitForSelector('[data-testid^="eo-guided-configure-"]', { timeout: 60_000 });

    const { data: sections } = await admin
      .from("event_order_template_sections")
      .select("id,name")
      .eq("template_id", tpl.id);
    const sectionNames = (sections ?? []).map((s) => s.name).sort();
    record(
      "template_has_catering_and_custom",
      sectionNames.some((n) => /catering/i.test(n)) && sectionNames.some((n) => n === customName),
      sectionNames.join(", "),
    );
    persisted.sections = sections;

    const { data: customCat } = await admin
      .from("offering_categories")
      .select("id,name,venue_id")
      .eq("venue_id", FANCY)
      .eq("name", customName)
      .maybeSingle();
    record(
      "custom_section_created_offering_category",
      Boolean(customCat?.id),
      JSON.stringify(customCat),
    );
    if (customCat?.id) createdCategoryIds.push(customCat.id);
    persisted.customOfferingCategory = customCat;

    // Reload offerings editor — custom category available without manual recreate
    await page.goto(`${APP}/library/offerings`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForSelector('[data-testid="offerings-library"]', { timeout: 90_000 });
    await page.waitForTimeout(1200);
    await openOfferingCategorySelect();
    const catOptions2 = await page.getByTestId("offering-category").locator("option").allTextContents();
    record(
      "offerings_dropdown_has_custom_without_recreate",
      catOptions2.some((t) => t.includes(customName)),
      catOptions2.join(" | "),
    );

    // Selecting existing category: count of rows with that name must remain 1
    const { count: customCount } = await admin
      .from("offering_categories")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("name", customName);
    record("no_duplicate_custom_category_rows", (customCount ?? 0) === 1, `count=${customCount}`);

    // Remove empty custom from template via return + uncheck, keep Catering
    await page.goto(`${APP}/library/event-order-templates/${tpl.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="eo-guided-setup-wizard"]', { timeout: 90_000 });
    // May land on configure — open package categories
    const editBtn = page.getByTestId("eo-guided-edit-package-categories");
    if (await editBtn.count()) await editBtn.first().click();
    else await page.getByTestId("eo-guided-back").click();
    await page.getByTestId("eo-guided-step-categories").waitFor({ timeout: 30_000 });
    // Remove custom badge (state only); Continue confirms destructive section removal.
    const badgeRemove = page.locator(`text=${customName}`).locator("..").getByRole("button", { name: /Remove/i });
    if (await badgeRemove.count()) await badgeRemove.click();
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("eo-guided-categories-continue").click();
    await page.waitForTimeout(1500);

    const { data: sectionsAfter } = await admin
      .from("event_order_template_sections")
      .select("id,name")
      .eq("template_id", tpl.id);
    record(
      "removed_custom_section_from_template",
      !(sectionsAfter ?? []).some((s) => s.name === customName)
        && (sectionsAfter ?? []).some((s) => /catering/i.test(s.name)),
      JSON.stringify(sectionsAfter),
    );

    // Shared category row still exists (not deleted when removed from template)
    const { data: customStill } = await admin
      .from("offering_categories")
      .select("id")
      .eq("venue_id", FANCY)
      .eq("name", customName)
      .maybeSingle();
    record(
      "shared_category_survives_template_removal",
      Boolean(customStill?.id),
      customStill?.id ?? "missing",
    );

    // Narrow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/library/event-order-templates/${tpl.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="eo-guided-setup-wizard"]', { timeout: 90_000 });
    const mobileEdit = page.getByTestId("eo-guided-edit-package-categories");
    if (await mobileEdit.count()) {
      await mobileEdit.first().click();
    } else {
      await page.getByTestId("eo-guided-back").click();
    }
    await page.getByTestId("eo-guided-step-categories").waitFor({ timeout: 30_000 });
    await page.screenshot({ path: `${OUT}/shots/package-categories-390.png`, fullPage: true });
    record("mobile_package_categories_reachable", true, "390");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: `${OUT}/shots/package-categories-1280.png`, fullPage: true });
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.stack ?? err.message : String(err));
    try {
      await page.screenshot({ path: `${OUT}/shots/error.png`, fullPage: true });
    } catch { /* ignore */ }
  } finally {
    if (createdTemplateIds.length) {
      await admin.from("event_order_templates").delete().in("id", createdTemplateIds);
    }
    // Only delete offering categories we created for this run (by PREFIX name)
    if (createdCategoryIds.length) {
      await admin.from("offering_categories").delete().in("id", createdCategoryIds);
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
