/**
 * Option A — catalog choice groups under a parent Offering, then EO builder include.
 *
 * EXPECTED_SHA=<serving> npx tsx docs/qa/event-order-template-builder-ux/verify-catalog-groups.mts
 *
 * Seeds a disposable parent + children, creates/assigns a group in the Offerings UI,
 * includes that group by id in the Event Order template builder, and checks persisted
 * offering_choice_group_id plus snapshot stability after a catalog membership change.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
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
const RUN = process.env.E2E_RUN_ID ?? `OGA${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/event-order-template-builder-ux";
const PREFIX = `OGA-${RUN}-`;
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
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
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

async function insertOffering(name: string): Promise<string> {
  const { data, error } = await admin
    .from("offerings")
    .insert({
      venue_id: FANCY,
      name,
      default_unit_price: null,
      unit: "each",
      is_archived: false,
      sort_order: 0,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error(name);
  return data.id;
}

async function main() {
  const image = await servingImage();
  record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

  const parentName = `${PREFIX}Plated Dinner`;
  const childA = `${PREFIX}Chicken`;
  const childB = `${PREFIX}Cake`;
  const groupName = `${PREFIX}Entrees`;
  const renamed = `${PREFIX}Entrées`;

  const parentId = await insertOffering(parentName);
  const childAId = await insertOffering(childA);
  const childBId = await insertOffering(childB);
  const { error: linkErr } = await admin.from("offering_major_links").insert([
    { venue_id: FANCY, offering_id: childAId, parent_offering_id: parentId },
    { venue_id: FANCY, offering_id: childBId, parent_offering_id: parentId },
  ]);
  if (linkErr) throw linkErr;
  await admin.from("offerings").update({ parent_offering_id: parentId }).in("id", [childAId, childBId]);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(await staffCookies());
  const page = await ctx.newPage();
  let groupId = "";
  let templateId = "";

  try {
    await page.goto(`${APP}/library/offerings`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.getByTestId("offerings-library").waitFor({ state: "visible", timeout: 60_000 });
    const row = page.locator(
      `[data-testid="offering-row-${parentId}"][data-offering-role="major"]`,
    );
    await row.waitFor({ state: "visible", timeout: 30_000 });
    await row.scrollIntoViewIfNeeded();
    const role = await row.getAttribute("data-offering-role");
    record("catalog_parent_row_is_major", role === "major", `role=${role}`);
    await page.getByTestId("offerings-new").waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(1000);
    const manageBtn = page.getByTestId(`offering-manage-groups-${parentId}`);
    await manageBtn.waitFor({ state: "visible", timeout: 20_000 });
    for (let i = 0; i < 4; i++) {
      await manageBtn.click({ force: true });
      if (await page.getByTestId("offering-choice-groups-editor").isVisible().catch(() => false)) {
        break;
      }
      await page.waitForTimeout(700);
    }
    const editor = page.getByTestId("offering-choice-groups-editor");
    await editor.waitFor({ state: "visible", timeout: 20_000 });
    await page.screenshot({ path: `${OUT}/shots/oga-edit-sheet-1280.png`, fullPage: false });
    const dialogText = await page.locator("[role=dialog]").first().innerText().catch(() => "no-dialog");
    record(
      "choice_groups_sheet_opened",
      /Choice groups|Add group|Entrées|New group/i.test(dialogText),
      dialogText.slice(0, 400),
    );
    await page.getByTestId("offering-choice-group-new-name").fill(groupName);
    await page.getByTestId("offering-choice-group-create").click();

    for (let i = 0; i < 30 && !groupId; i++) {
      const { data } = await admin
        .from("offering_choice_groups")
        .select("id,name,parent_offering_id,venue_id")
        .eq("venue_id", FANCY)
        .eq("parent_offering_id", parentId)
        .eq("name", groupName)
        .maybeSingle();
      if (data?.id) groupId = data.id;
      else await page.waitForTimeout(400);
    }
    record(
      "catalog_group_created",
      Boolean(groupId),
      JSON.stringify({ groupId, parentId }),
    );
    if (!groupId) throw new Error("group not created");

    const add = page.getByTestId(`offering-choice-group-add-member-${groupId}`);
    await add.waitFor({ state: "visible", timeout: 20_000 });
    await add.selectOption(childAId);
    await page.waitForTimeout(500);
    await add.selectOption(childBId);

    let members: { offering_id: string; sort_order: number }[] = [];
    for (let i = 0; i < 30; i++) {
      const { data } = await admin
        .from("offering_choice_group_members")
        .select("offering_id,sort_order")
        .eq("group_id", groupId)
        .order("sort_order");
      members = data ?? [];
      if (members.length >= 2) break;
      await page.waitForTimeout(400);
    }
    record(
      "catalog_members_assigned",
      members.map((m) => m.offering_id).sort().join(",") === [childAId, childBId].sort().join(","),
      JSON.stringify(members),
    );

    const nameInput = page.getByTestId(`offering-choice-group-name-${groupId}`);
    await nameInput.fill(renamed);
    await nameInput.blur();
    let renamedOk = false;
    for (let i = 0; i < 20; i++) {
      const { data } = await admin
        .from("offering_choice_groups")
        .select("name")
        .eq("id", groupId)
        .maybeSingle();
      if (data?.name === renamed) {
        renamedOk = true;
        break;
      }
      await page.waitForTimeout(300);
    }
    record("catalog_group_renamed", renamedOk, renamed);
    await page.screenshot({ path: `${OUT}/shots/oga-catalog-group-1280.png`, fullPage: false });

    // Close the Choice groups sheet and confirm the Offerings list shows
    // Major → group heading → members (not a flat major→item list).
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page.goto(`${APP}/library/offerings`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.getByTestId("offerings-library").waitFor({ state: "visible", timeout: 60_000 });
    const groupRow = page.getByTestId(`offering-choice-group-row-${groupId}`);
    await groupRow.waitFor({ state: "visible", timeout: 30_000 });
    const memberANest = await page
      .locator(`[data-testid="offering-row-${childAId}"]`)
      .first()
      .getAttribute("data-nest-under-group");
    const memberBNest = await page
      .locator(`[data-testid="offering-row-${childBId}"]`)
      .first()
      .getAttribute("data-nest-under-group");
    record(
      "catalog_list_shows_group_hierarchy",
      (await groupRow.isVisible()) &&
        memberANest === groupId &&
        memberBNest === groupId,
      JSON.stringify({
        groupVisible: await groupRow.isVisible(),
        memberANest,
        memberBNest,
        groupText: (await groupRow.innerText()).slice(0, 200),
      }),
    );
    await page.screenshot({ path: `${OUT}/shots/oga-catalog-list-hierarchy-1280.png`, fullPage: false });

    const { data: tpl, error: tplErr } = await admin
      .from("event_order_templates")
      .insert({
        venue_id: FANCY,
        name: `${PREFIX}Builder`,
        description: "option A catalog group acceptance",
        is_archived: false,
      })
      .select("id")
      .single();
    if (tplErr || !tpl) throw tplErr ?? new Error("tpl");
    templateId = tpl.id;

    await page.goto(`${APP}/library/event-order-templates/${templateId}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForSelector('[data-testid="eo-guided-setup-wizard"]', { timeout: 90_000 });
    const cat = page.getByTestId("eo-guided-category-catering");
    for (let i = 0; i < 6 && (await cat.getAttribute("aria-pressed")) !== "true"; i++) {
      await cat.click({ force: true });
      await page.waitForTimeout(200);
    }
    await page.getByTestId("eo-guided-categories-continue").click();
    await page.waitForSelector('[data-testid="eo-guided-step-workspace"]', { timeout: 60_000 });

    const list = page.getByTestId("eo-couple-choice-offering-select-list");
    const filter = page.getByTestId("eo-couple-choice-offering-select-filter");
    if (await filter.count()) {
      for (let i = 0; i < 40 && (await filter.isDisabled().catch(() => true)); i++) {
        await page.waitForTimeout(250);
      }
      await filter.selectOption("all");
    }
    await list.waitFor({ state: "visible", timeout: 30_000 });
    await list.selectOption(parentId);
    await page.getByText(parentName).first().waitFor({ state: "visible", timeout: 30_000 });

    let parentOptId = "";
    for (let i = 0; i < 30 && !parentOptId; i++) {
      const { data } = await admin
        .from("event_order_template_options")
        .select("id")
        .eq("template_id", templateId)
        .eq("offering_id", parentId)
        .maybeSingle();
      if (data?.id) parentOptId = data.id;
      else await page.waitForTimeout(400);
    }
    record("template_parent_selected", Boolean(parentOptId), parentOptId);

    const include = page.getByTestId(`eo-include-catalog-group-${parentOptId}`);
    await include.waitFor({ state: "visible", timeout: 30_000 });
    const optionValues = await include.locator("option").evaluateAll(
      (opts: HTMLOptionElement[]) => opts.map((o) => o.value),
    );
    record(
      "builder_dropdown_lists_catalog_group",
      optionValues.includes(groupId),
      JSON.stringify(optionValues),
    );
    await include.selectOption(groupId);
    await page.getByTestId(`eo-add-child-group-${parentOptId}`).click();

    let tplGroup: { id: string; name: string; offering_choice_group_id: string | null } | null = null;
    for (let i = 0; i < 30; i++) {
      const { data } = await admin
        .from("event_order_template_groups")
        .select("id,name,offering_choice_group_id")
        .eq("template_id", templateId)
        .eq("offering_choice_group_id", groupId)
        .maybeSingle();
      if (data?.id) {
        tplGroup = data;
        break;
      }
      await page.waitForTimeout(400);
    }
    record(
      "template_group_persists_catalog_id",
      tplGroup?.offering_choice_group_id === groupId && tplGroup.name === renamed,
      JSON.stringify(tplGroup),
    );

    let snapOpts: { id: string; label: string; offering_id: string | null; group_id: string }[] = [];
    const expectedSnap = [childAId, childBId].sort().join(",");
    for (let i = 0; i < 30; i++) {
      const { data } = await admin
        .from("event_order_template_options")
        .select("id,label,offering_id,group_id")
        .eq("template_id", templateId)
        .eq("group_id", tplGroup?.id ?? "none");
      snapOpts = data ?? [];
      const snapIds = snapOpts.map((o) => o.offering_id).filter(Boolean).sort();
      if (snapIds.join(",") === expectedSnap) break;
      await page.waitForTimeout(400);
    }
    const snapIds = snapOpts.map((o) => o.offering_id).filter(Boolean).sort();
    record(
      "template_options_snapshot_members",
      snapIds.join(",") === expectedSnap,
      JSON.stringify(snapOpts),
    );

    await page.goto(`${APP}/library/event-order-templates/${templateId}`, {
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
    await page.getByText(parentName).first().waitFor({ state: "visible", timeout: 30_000 });
    const includedName = page.locator('[data-testid^="eo-child-group-name-"]').first();
    await includedName.waitFor({ state: "attached", timeout: 30_000 });
    await includedName.scrollIntoViewIfNeeded();
    const nameVal = await includedName.inputValue();
    const optText = await page.locator('[data-testid^="eo-child-group-options-"]').first().innerText();
    record(
      "reopen_shows_included_group",
      nameVal === renamed && optText.includes(childA) && optText.includes(childB),
      JSON.stringify({ nameVal, optText: optText.slice(0, 500) }),
    );
    await page.screenshot({ path: `${OUT}/shots/oga-builder-included-1280.png`, fullPage: false });

    // Catalog membership change must not rewrite the saved template snapshot.
    await admin.from("offering_choice_group_members").delete().eq("group_id", groupId).eq("offering_id", childBId);
    const { data: after } = await admin
      .from("event_order_template_options")
      .select("offering_id")
      .eq("group_id", tplGroup?.id ?? "none");
    const afterIds = (after ?? []).map((o) => o.offering_id).filter(Boolean).sort();
    record(
      "snapshot_stable_after_catalog_membership_change",
      afterIds.join(",") === [childAId, childBId].sort().join(","),
      JSON.stringify(afterIds),
    );
  } finally {
    await browser.close();
    if (templateId) {
      await admin.from("event_order_template_options").delete().eq("template_id", templateId);
      await admin.from("event_order_template_groups").delete().eq("template_id", templateId);
      await admin.from("event_order_template_sections").delete().eq("template_id", templateId);
      await admin.from("event_order_templates").delete().eq("id", templateId);
    }
    if (groupId) {
      await admin.from("offering_choice_group_members").delete().eq("group_id", groupId);
      await admin.from("offering_choice_groups").delete().eq("id", groupId);
    }
    const ids = [parentId, childAId, childBId];
    await admin.from("offering_major_links").delete().in("offering_id", ids);
    await admin.from("offerings").delete().in("id", ids);
  }

  const failed = checks.filter((c) => !c.pass).length;
  const payload = { ok: failed === 0, run: RUN, expectedSha: EXPECTED, passed: checks.length - failed, failed, checks };
  writeFileSync(`${OUT}/catalog-groups-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ ok: payload.ok, passed: payload.passed, failed }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
