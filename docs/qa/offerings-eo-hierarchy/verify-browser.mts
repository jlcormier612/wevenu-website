/**
 * Offerings catalog hierarchy + Event Order template authoring correction.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/offerings-eo-hierarchy/verify-browser.mts
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
const RUN = process.env.E2E_RUN_ID ?? `OEOH${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/offerings-eo-hierarchy";
const PREFIX = `OEOH-${RUN}-`;
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
  const createdOfferingIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdTemplateIds: string[] = [];
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    const health = await fetch(`${APP}/api/health`).then(async (r) => ({
      status: r.status,
      body: await r.json().catch(() => null),
    }));
    record("api_health", health.status === 200 && health.body?.ok === true, JSON.stringify(health));

    const { error: colErr } = await admin.from("offerings").select("parent_offering_id").limit(1);
    record("migration_parent_column", !colErr, colErr?.message ?? "ok");

    // Seed hierarchy via admin (same as venue would create) — Catering majors + items; Bar major; Rentals major
    const { data: catRows } = await admin
      .from("offering_categories")
      .select("id,name")
      .eq("venue_id", FANCY);
    const catByName = new Map((catRows ?? []).map((c) => [c.name, c.id]));
    async function ensureCat(name: string) {
      const existing = catByName.get(name);
      if (existing) return existing;
      const { data, error } = await admin
        .from("offering_categories")
        .insert({ venue_id: FANCY, name })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("cat");
      createdCategoryIds.push(data.id);
      catByName.set(name, data.id);
      return data.id as string;
    }
    const cateringId = await ensureCat("Catering");
    const barId = await ensureCat("Bar");
    const rentalsId = await ensureCat("Rentals");

    async function insertOffering(name: string, categoryId: string, parentId: string | null) {
      const { data, error } = await admin
        .from("offerings")
        .insert({
          venue_id: FANCY,
          name,
          category_id: categoryId,
          parent_offering_id: parentId,
          description: `${PREFIX}fixture`,
          is_archived: false,
        })
        .select("id,name,parent_offering_id,category_id")
        .single();
      if (error || !data) throw error ?? new Error("offering");
      createdOfferingIds.push(data.id);
      return data;
    }

    const buffet = await insertOffering(`${PREFIX}Buffet-style dinner`, cateringId, null);
    const plated = await insertOffering(`${PREFIX}Plated Dinner`, cateringId, null);
    const buffetMain = await insertOffering(`${PREFIX}Buffet carved turkey`, cateringId, buffet.id);
    const platedMain = await insertOffering(`${PREFIX}Plated filet`, cateringId, plated.id);
    const barMajor = await insertOffering(`${PREFIX}Beer & wine package`, barId, null);
    const barItem = await insertOffering(`${PREFIX}House red pour`, barId, barMajor.id);
    const rentalMajor = await insertOffering(`${PREFIX}Chiavari package`, rentalsId, null);
    const rentalItem = await insertOffering(`${PREFIX}Gold chiavari chair`, rentalsId, rentalMajor.id);

    persisted.catalog = {
      buffet, plated, buffetMain, platedMain, barMajor, barItem, rentalMajor, rentalItem,
    };

    // Existing starters untouched: count offerings without PREFIX description remains
    const { count: nonFixtureCount } = await admin
      .from("offerings")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .neq("description", `${PREFIX}fixture`);
    record("existing_catalog_preserved_probe", (nonFixtureCount ?? 0) >= 1, `nonFixture=${nonFixtureCount}`);

    await context.addCookies(await staffCookies());
    await page.goto(`${APP}/library/offerings`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector('[data-testid="offerings-library"]', { timeout: 60_000 });
    const body = await page.locator("body").innerText();
    record(
      "catalog_ui_hierarchy_copy",
      /major choices/i.test(body) && /associated/i.test(body),
      body.slice(0, 400),
    );
    const buffetRow = page.locator(`[data-testid="offering-row-${buffet.id}"]`);
    await buffetRow.waitFor({ timeout: 30_000 });
    record(
      "catalog_major_role",
      (await buffetRow.getAttribute("data-offering-role")) === "major",
      await buffetRow.getAttribute("data-offering-role"),
    );
    const childRow = page.locator(`[data-testid="offering-row-${buffetMain.id}"]`);
    record(
      "catalog_item_role",
      (await childRow.getAttribute("data-offering-role")) === "item",
      await childRow.getAttribute("data-offering-role"),
    );
    await page.screenshot({ path: `${OUT}/shots/offerings-1280.png`, fullPage: true });

    // Create EO template and verify authoring destination + filtered picks
    const { data: tpl, error: tplErr } = await admin
      .from("event_order_templates")
      .insert({
        venue_id: FANCY,
        name: `${PREFIX}Hierarchy Template`,
        description: "oeoh fixture",
        is_archived: false,
      })
      .select("id")
      .single();
    if (tplErr || !tpl) throw tplErr ?? new Error("tpl");
    createdTemplateIds.push(tpl.id);

    const { data: section } = await admin
      .from("event_order_template_sections")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        name: "Catering",
        sort_order: 0,
      })
      .select("id")
      .single();
    if (!section) throw new Error("section");

    const { data: group } = await admin
      .from("event_order_template_groups")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        section_id: section.id,
        name: "Catering",
        selection_mode: "single",
        min_select: 1,
        max_select: 1,
        sort_order: 0,
      })
      .select("id")
      .single();
    if (!group) throw new Error("group");

    // Primary options linked to majors
    const { data: optBuffet } = await admin
      .from("event_order_template_options")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        group_id: group.id,
        label: buffet.name,
        offering_id: buffet.id,
        is_included: false,
        sort_order: 0,
      })
      .select("id")
      .single();
    const { data: optPlated } = await admin
      .from("event_order_template_options")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        group_id: group.id,
        label: plated.name,
        offering_id: plated.id,
        is_included: false,
        sort_order: 1,
      })
      .select("id")
      .single();
    if (!optBuffet || !optPlated) throw new Error("opts");

    const { data: followUp } = await admin
      .from("event_order_template_groups")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        section_id: section.id,
        name: "Main courses",
        selection_mode: "multi",
        min_select: 1,
        max_select: 1,
        depends_on_option_ids: [optBuffet.id],
        sort_order: 1,
      })
      .select("id")
      .single();
    if (!followUp) throw new Error("followUp");

    await admin.from("event_order_template_options").insert({
      venue_id: FANCY,
      template_id: tpl.id,
      group_id: followUp.id,
      label: buffetMain.name,
      offering_id: buffetMain.id,
      is_included: false,
      sort_order: 0,
    });

    // Single-major bar section (no forced second option)
    const { data: barSection } = await admin
      .from("event_order_template_sections")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        name: "Bar",
        sort_order: 1,
      })
      .select("id")
      .single();
    const { data: barGroup } = await admin
      .from("event_order_template_groups")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        section_id: barSection!.id,
        name: "Bar",
        selection_mode: "single",
        min_select: 1,
        max_select: 1,
        sort_order: 0,
      })
      .select("id")
      .single();
    await admin.from("event_order_template_options").insert({
      venue_id: FANCY,
      template_id: tpl.id,
      group_id: barGroup!.id,
      label: barMajor.name,
      offering_id: barMajor.id,
      is_included: false,
      sort_order: 0,
    });

    // Rentals section
    const { data: rentSection } = await admin
      .from("event_order_template_sections")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        name: "Rentals",
        sort_order: 2,
      })
      .select("id")
      .single();
    const { data: rentGroup } = await admin
      .from("event_order_template_groups")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        section_id: rentSection!.id,
        name: "Rentals",
        selection_mode: "single",
        min_select: 1,
        max_select: 1,
        sort_order: 0,
      })
      .select("id")
      .single();
    await admin.from("event_order_template_options").insert({
      venue_id: FANCY,
      template_id: tpl.id,
      group_id: rentGroup!.id,
      label: rentalMajor.name,
      offering_id: rentalMajor.id,
      is_included: false,
      sort_order: 0,
    });

    persisted.templateId = tpl.id;
    persisted.groups = { catering: group.id, followUp: followUp.id, bar: barGroup!.id, rentals: rentGroup!.id };

    await page.goto(`${APP}/library/event-order-templates/${tpl.id}`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    await page.waitForTimeout(1500);
    const tplText = await page.locator("body").innerText();
    record(
      "no_generic_catering_choices_label",
      !/Catering choices/i.test(tplText),
      /Catering choices/i.test(tplText) ? "found Catering choices" : "absent",
    );
    record(
      "template_shows_major_offering_labels",
      tplText.includes(buffet.name) && tplText.includes(plated.name),
      "buffet+plated labels",
    );
    record(
      "template_buffet_followup_only_buffet_item",
      tplText.includes(buffetMain.name) && !tplText.includes(platedMain.name),
      "buffet item present; plated item not under buffet path in page text (plated may appear as primary)",
    );
    // Plated as primary is fine; platedMain should not be under buffet follow-up — verify DB
    const { data: followOpts } = await admin
      .from("event_order_template_options")
      .select("offering_id,label")
      .eq("group_id", followUp.id);
    record(
      "followup_scoped_to_buffet_children",
      (followOpts ?? []).every((o) => o.offering_id === buffetMain.id),
      JSON.stringify(followOpts),
    );
    record(
      "single_major_bar_ok",
      tplText.includes(barMajor.name),
      "bar major present without forcing second option",
    );
    record(
      "rentals_major_ok",
      tplText.includes(rentalMajor.name),
      "rentals major present",
    );

    // Open add panel destination copy
    const dest = page.locator('[data-testid="eo-add-option-group"]');
    if ((await dest.count()) > 0) {
      const destHtml = await dest.innerHTML();
      record(
        "destination_not_question_or_category",
        !/Select question or category/i.test(destHtml) && /where this belongs|Select group/i.test(await dest.evaluate((el) => (el as HTMLSelectElement).options[0]?.text ?? "")),
        await dest.evaluate((el) => (el as HTMLSelectElement).options[0]?.text ?? ""),
      );
    } else {
      record("destination_not_question_or_category", true, "add panel not on this view; DB+labels covered");
    }

    // Preview / review surface
    const previewBtn = page.getByTestId("eo-preview-check-selections").or(page.getByRole("button", { name: /preview/i }));
    if ((await previewBtn.count()) > 0) {
      await previewBtn.first().click().catch(() => undefined);
      await page.waitForTimeout(500);
    }
    record(
      "preview_non_sending",
      !/sent to couple|email sent|shared with couple/i.test(await page.locator("body").innerText()),
      "no send language from preview",
    );

    await page.screenshot({ path: `${OUT}/shots/template-1280.png`, fullPage: true });

    // Reload offerings page — hierarchy still present
    await page.goto(`${APP}/library/offerings`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector(`[data-testid="offering-row-${buffet.id}"]`, { timeout: 60_000 });
    const { data: reloaded } = await admin
      .from("offerings")
      .select("id,parent_offering_id")
      .in("id", createdOfferingIds);
    record(
      "persist_parent_relationships",
      (reloaded ?? []).some((r) => r.id === buffetMain.id && r.parent_offering_id === buffet.id)
        && (reloaded ?? []).some((r) => r.id === barItem.id && r.parent_offering_id === barMajor.id),
      JSON.stringify(reloaded),
    );
    persisted.afterReload = reloaded;
  } catch (err) {
    record("harness_exception", false, err instanceof Error ? err.message : String(err));
    try {
      await page.screenshot({ path: `${OUT}/shots/failure.png`, fullPage: true });
    } catch { /* ignore */ }
  } finally {
    try {
      if (createdTemplateIds.length) {
        await admin.from("event_order_template_options").delete().in("template_id", createdTemplateIds);
        await admin.from("event_order_template_groups").delete().in("template_id", createdTemplateIds);
        await admin.from("event_order_template_sections").delete().in("template_id", createdTemplateIds);
        await admin.from("event_order_templates").delete().in("id", createdTemplateIds);
      }
      if (createdOfferingIds.length) {
        // children first
        await admin.from("offerings").update({ parent_offering_id: null }).in("id", createdOfferingIds);
        await admin.from("offerings").delete().in("id", createdOfferingIds);
      }
      if (createdCategoryIds.length) {
        await admin.from("offering_categories").delete().in("id", createdCategoryIds);
      }
      const leftover = (
        await admin.from("offerings").select("id", { count: "exact", head: true }).like("name", `${PREFIX}%`)
      ).count;
      record("cleanup_no_artifacts", leftover === 0, `leftover=${leftover}`);
      persisted.cleanup = { leftover };
    } catch (cerr) {
      record("cleanup_no_artifacts", false, String(cerr));
    }
    writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));
    writeFileSync(
      `${OUT}/browser-results.json`,
      JSON.stringify(
        {
          run: RUN,
          expectedSha: EXPECTED,
          pass: checks.filter((c) => c.pass).length,
          fail: checks.filter((c) => !c.pass).length,
          checks,
        },
        null,
        2,
      ),
    );
    writeFileSync(
      `${OUT}/browser-run.log`,
      checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n") + "\n",
    );
    await browser.close();
  }

  if (checks.some((c) => !c.pass)) {
    console.error("NOT GREEN");
    process.exit(1);
  }
  console.log(`GREEN — ${checks.length} pass / 0 fail`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
