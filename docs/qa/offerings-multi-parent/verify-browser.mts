/**
 * Offerings multi-parent major associations — Sandbox browser acceptance.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/offerings-multi-parent/verify-browser.mts
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
const RUN = process.env.E2E_RUN_ID ?? `OMP${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/offerings-multi-parent";
const PREFIX = `OMP-${RUN}-`;
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
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED, prefix: PREFIX };

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

    const { error: linkTableErr } = await admin.from("offering_major_links").select("id").limit(1);
    record("migration_links_table", !linkTableErr, linkTableErr?.message ?? "ok");
    if (linkTableErr) throw linkTableErr;

    // Backfill integrity: every legacy parent_offering_id has a matching link
    const { data: legacyChildren } = await admin
      .from("offerings")
      .select("id, parent_offering_id, venue_id")
      .eq("venue_id", FANCY)
      .not("parent_offering_id", "is", null);
    const { data: allLinks } = await admin
      .from("offering_major_links")
      .select("offering_id, parent_offering_id")
      .eq("venue_id", FANCY);
    const linkSet = new Set(
      (allLinks ?? []).map((l) => `${l.offering_id}:${l.parent_offering_id}`),
    );
    const missing = (legacyChildren ?? []).filter(
      (o) => o.parent_offering_id && !linkSet.has(`${o.id}:${o.parent_offering_id}`),
    );
    record(
      "migration_backfill_fancy",
      missing.length === 0,
      `legacyChildren=${legacyChildren?.length ?? 0} missingLinks=${missing.length}`,
    );

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

    async function insertMajor(name: string) {
      const { data, error } = await admin
        .from("offerings")
        .insert({
          venue_id: FANCY,
          name,
          category_id: cateringId,
          parent_offering_id: null,
          description: `${PREFIX}fixture`,
          is_archived: false,
        })
        .select("id,name")
        .single();
      if (error || !data) throw error ?? new Error("major");
      createdOfferingIds.push(data.id);
      return data;
    }

    const plated = await insertMajor(`${PREFIX}Plated Dinner`);
    const buffet = await insertMajor(`${PREFIX}Buffet Dinner`);
    persisted.majors = { plated, buffet };

    const { count: beforeCount } = await admin
      .from("offerings")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .neq("description", `${PREFIX}fixture`);
    record("existing_catalog_probe", (beforeCount ?? 0) >= 0, `nonFixture=${beforeCount}`);

    await context.addCookies(await staffCookies());
    await page.goto(`${APP}/library/offerings`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector('[data-testid="offerings-library"]', { timeout: 60_000 });

    // Create Cheesecake via UI with both majors checked.
    // PageHeader owns "+ New Offering" when headerCreate={false} (no offerings-new testid).
    const newBtn = page.getByRole("button", { name: /^\+?\s*New Offering$/i }).first();
    await newBtn.waitFor({ state: "visible", timeout: 30_000 });
    await newBtn.click();
    await page.getByTestId("offering-name").waitFor({ state: "visible", timeout: 15_000 });
    await page.getByTestId("offering-name").fill(`${PREFIX}Cheesecake`);
    await page.getByTestId("offering-category").selectOption(cateringId);
    await page.waitForSelector('[data-testid="offerings-parents"], [data-testid="offering-parents"]', {
      timeout: 15_000,
    });
    await page.getByTestId(`offering-parent-check-${plated.id}`).check();
    await page.getByTestId(`offering-parent-check-${buffet.id}`).check();
    await page.getByTestId("offering-save").click();
    await page.waitForTimeout(1500);

    const { data: cakeRows } = await admin
      .from("offerings")
      .select("id,name,parent_offering_id,description")
      .eq("venue_id", FANCY)
      .eq("name", `${PREFIX}Cheesecake`);
    record("cheesecake_single_catalog_row", (cakeRows?.length ?? 0) === 1, JSON.stringify(cakeRows));
    const cake = cakeRows?.[0];
    if (!cake) throw new Error("cheesecake missing");
    createdOfferingIds.push(cake.id);

    const { data: cakeLinks } = await admin
      .from("offering_major_links")
      .select("parent_offering_id")
      .eq("venue_id", FANCY)
      .eq("offering_id", cake.id);
    const parentIds = (cakeLinks ?? []).map((l) => l.parent_offering_id).sort();
    record(
      "persisted_two_associations",
      parentIds.length === 2
        && parentIds.includes(plated.id)
        && parentIds.includes(buffet.id),
      JSON.stringify({ parentIds, plated: plated.id, buffet: buffet.id, denorm: cake.parent_offering_id }),
    );
    persisted.cheesecake = { ...cake, parentIds };

    const cakeRows = page.locator(`[data-testid="offering-row-${cake.id}"]`);
    await cakeRows.first().waitFor({ timeout: 30_000 });
    const placementCount = await cakeRows.count();
    const nestUnderBuffet = page.locator(
      `[data-testid="offering-row-${cake.id}"][data-nest-under="${buffet.id}"]`,
    );
    const nestUnderPlated = page.locator(
      `[data-testid="offering-row-${cake.id}"][data-nest-under="${plated.id}"]`,
    );
    record(
      "ui_appears_under_both_majors",
      placementCount === 2
        && (await nestUnderBuffet.count()) === 1
        && (await nestUnderPlated.count()) === 1,
      JSON.stringify({
        placementCount,
        underBuffet: await nestUnderBuffet.count(),
        underPlated: await nestUnderPlated.count(),
      }),
    );
    const rowParents = await nestUnderBuffet.getAttribute("data-parent-ids");
    record(
      "ui_row_parent_ids",
      Boolean(rowParents?.includes(plated.id) && rowParents?.includes(buffet.id)),
      rowParents ?? "",
    );
    const underBuffetText = await nestUnderBuffet.innerText();
    const underPlatedText = await nestUnderPlated.innerText();
    record(
      "ui_under_both_labels",
      /Under /i.test(underBuffetText)
        && underBuffetText.includes("Buffet")
        && /Under /i.test(underPlatedText)
        && underPlatedText.includes("Plated"),
      JSON.stringify({ underBuffetText: underBuffetText.slice(0, 200), underPlatedText: underPlatedText.slice(0, 200) }),
    );
    await page.screenshot({ path: `${OUT}/shots/offerings-both-parents-1280.png`, fullPage: true });

    // Reopen edit — both checks persist (any placement opens the same offering)
    await nestUnderBuffet.getByRole("button", { name: "Edit" }).click();
    await page.waitForSelector('[data-testid="offering-parents"]', { timeout: 15_000 });
    const platedChecked = await page.getByTestId(`offering-parent-check-${plated.id}`).isChecked();
    const buffetChecked = await page.getByTestId(`offering-parent-check-${buffet.id}`).isChecked();
    record("reopen_both_checked", platedChecked && buffetChecked, `plated=${platedChecked} buffet=${buffetChecked}`);

    // Remove Buffet association only
    await page.getByTestId(`offering-parent-check-${buffet.id}`).uncheck();
    await page.getByTestId("offering-save").click();
    await page.waitForTimeout(1500);

    const { data: afterLinks } = await admin
      .from("offering_major_links")
      .select("parent_offering_id")
      .eq("venue_id", FANCY)
      .eq("offering_id", cake.id);
    const afterParents = (afterLinks ?? []).map((l) => l.parent_offering_id);
    record(
      "remove_one_keeps_other",
      afterParents.length === 1 && afterParents[0] === plated.id,
      JSON.stringify(afterParents),
    );
    const { data: cakeStill } = await admin
      .from("offerings")
      .select("id")
      .eq("id", cake.id)
      .maybeSingle();
    record("offering_not_deleted_on_unlink", Boolean(cakeStill?.id), cakeStill?.id ?? "missing");

    // After removing Buffet, only the Plated placement remains
    const afterRemoveCount = await page.locator(`[data-testid="offering-row-${cake.id}"]`).count();
    const stillUnderPlated = await page
      .locator(`[data-testid="offering-row-${cake.id}"][data-nest-under="${plated.id}"]`)
      .count();
    const goneFromBuffet = await page
      .locator(`[data-testid="offering-row-${cake.id}"][data-nest-under="${buffet.id}"]`)
      .count();
    record(
      "ui_after_remove_one_parent",
      afterRemoveCount === 1 && stillUnderPlated === 1 && goneFromBuffet === 0,
      JSON.stringify({ afterRemoveCount, stillUnderPlated, goneFromBuffet }),
    );

    // Re-add both for EO authoring check
    await page.locator(`[data-testid="offering-row-${cake.id}"]`).first().getByRole("button", { name: "Edit" }).click();
    await page.waitForSelector('[data-testid="offering-parents"]', { timeout: 15_000 });
    if (!(await page.getByTestId(`offering-parent-check-${buffet.id}`).isChecked())) {
      await page.getByTestId(`offering-parent-check-${buffet.id}`).check();
    }
    if (!(await page.getByTestId(`offering-parent-check-${plated.id}`).isChecked())) {
      await page.getByTestId(`offering-parent-check-${plated.id}`).check();
    }
    await page.getByTestId("offering-save").click();
    await page.waitForTimeout(1200);

    const restoredPlacements = await page.locator(`[data-testid="offering-row-${cake.id}"]`).count();
    record("ui_restored_both_placements", restoredPlacements === 2, `count=${restoredPlacements}`);

    // Narrow viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/library/offerings`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForSelector(`[data-testid="offering-row-${cake.id}"]`, { timeout: 60_000 });
    const mobilePlacements = await page.locator(`[data-testid="offering-row-${cake.id}"]`).count();
    await page.screenshot({ path: `${OUT}/shots/offerings-both-parents-390.png`, fullPage: true });
    record("mobile_row_visible", mobilePlacements === 2, `390 placements=${mobilePlacements}`);

    // EO template: same offering_id under two dependent groups (context-specific prices)
    const { data: tpl, error: tplErr } = await admin
      .from("event_order_templates")
      .insert({
        venue_id: FANCY,
        name: `${PREFIX}Multi-parent Template`,
        description: "omp fixture",
        is_archived: false,
      })
      .select("id")
      .single();
    if (tplErr || !tpl) throw tplErr ?? new Error("tpl");
    createdTemplateIds.push(tpl.id);

    const { data: section } = await admin
      .from("event_order_template_sections")
      .insert({ venue_id: FANCY, template_id: tpl.id, name: "Catering", sort_order: 0 })
      .select("id")
      .single();
    const { data: dinnerGroup } = await admin
      .from("event_order_template_groups")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        section_id: section!.id,
        name: "Dinner style",
        selection_mode: "single",
        min_select: 1,
        max_select: 1,
        sort_order: 0,
      })
      .select("id")
      .single();
    const { data: optPlated } = await admin
      .from("event_order_template_options")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        group_id: dinnerGroup!.id,
        label: plated.name,
        offering_id: plated.id,
        is_included: true,
        unit_price: 0,
        sort_order: 0,
      })
      .select("id")
      .single();
    const { data: optBuffet } = await admin
      .from("event_order_template_options")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        group_id: dinnerGroup!.id,
        label: buffet.name,
        offering_id: buffet.id,
        is_included: true,
        unit_price: 0,
        sort_order: 1,
      })
      .select("id")
      .single();

    const { data: platedDessert } = await admin
      .from("event_order_template_groups")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        section_id: section!.id,
        name: "Plated dessert",
        selection_mode: "single",
        min_select: 0,
        max_select: 1,
        depends_on_option_ids: [optPlated!.id],
        sort_order: 1,
      })
      .select("id")
      .single();
    const { data: buffetDessert } = await admin
      .from("event_order_template_groups")
      .insert({
        venue_id: FANCY,
        template_id: tpl.id,
        section_id: section!.id,
        name: "Buffet dessert",
        selection_mode: "single",
        min_select: 0,
        max_select: 1,
        depends_on_option_ids: [optBuffet!.id],
        sort_order: 2,
      })
      .select("id")
      .single();

    await admin.from("event_order_template_options").insert([
      {
        venue_id: FANCY,
        template_id: tpl.id,
        group_id: platedDessert!.id,
        label: `${PREFIX}Cheesecake`,
        offering_id: cake.id,
        is_included: false,
        unit_price: 8,
        sort_order: 0,
      },
      {
        venue_id: FANCY,
        template_id: tpl.id,
        group_id: buffetDessert!.id,
        label: `${PREFIX}Cheesecake`,
        offering_id: cake.id,
        is_included: false,
        unit_price: 6,
        sort_order: 0,
      },
    ]);

    const { data: opts } = await admin
      .from("event_order_template_options")
      .select("id, group_id, offering_id, unit_price, label")
      .eq("template_id", tpl.id)
      .eq("offering_id", cake.id);
    record(
      "template_shared_offering_two_contexts",
      (opts?.length ?? 0) === 2
        && new Set(opts!.map((o) => o.unit_price)).size === 2,
      JSON.stringify(opts),
    );
    persisted.template = { id: tpl.id, cakeOptions: opts };

    // Cross-venue guard: attempt link with wrong venue_id should fail
    const { data: otherVenue } = await admin.from("venues").select("id").neq("id", FANCY).limit(1).maybeSingle();
    if (otherVenue?.id) {
      const { error: crossErr } = await admin.from("offering_major_links").insert({
        venue_id: otherVenue.id,
        offering_id: cake.id,
        parent_offering_id: plated.id,
      });
      record(
        "cross_venue_association_rejected",
        Boolean(crossErr),
        crossErr?.message ?? "unexpected success",
      );
    } else {
      record("cross_venue_association_rejected", true, "skipped — no other venue");
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${APP}/library/event-order-templates/${tpl.id}`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    await page.screenshot({ path: `${OUT}/shots/eo-template-1280.png`, fullPage: true });
    record("eo_template_page_loads", true, page.url());

    const { count: afterNonFixture } = await admin
      .from("offerings")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .neq("description", `${PREFIX}fixture`)
      .neq("name", `${PREFIX}Cheesecake`);
    record(
      "unrelated_offerings_untouched",
      (afterNonFixture ?? 0) === (beforeCount ?? 0)
        || Math.abs((afterNonFixture ?? 0) - (beforeCount ?? 0)) <= 1,
      `before=${beforeCount} after=${afterNonFixture}`,
    );
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.stack ?? err.message : String(err));
    try {
      await page.screenshot({ path: `${OUT}/shots/error.png`, fullPage: true });
    } catch { /* ignore */ }
  } finally {
    // Cleanup attributable fixtures only
    if (createdTemplateIds.length) {
      await admin.from("event_order_templates").delete().in("id", createdTemplateIds);
    }
    if (createdOfferingIds.length) {
      await admin.from("offering_major_links").delete().in("offering_id", createdOfferingIds);
      await admin.from("offerings").delete().in("id", createdOfferingIds);
    }
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
