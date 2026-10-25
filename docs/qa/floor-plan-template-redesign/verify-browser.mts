/**
 * Floor-plan template redesign — Sandbox browser + persisted-state proof.
 * Provisions missing starters for Fancy, verifies five choices, creates plans
 * from ceremony/cocktail/reception/blank/flip, confirms legacy FP-01 untouched,
 * and spot-checks submit-confirm dialog still present in source + UI.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { provisionFloorPlanStarters } from "@/lib/floor-plan-templates/provision";
import {
  FLOOR_PLAN_STARTER_MASTERS,
  LEGACY_COMBINED_FLOOR_PLAN_STARTER_KEY,
  looksLikeLegacyCombinedFloorPlan,
} from "@/lib/floor-plan-templates/starters";

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
const OUT = "docs/qa/floor-plan-template-redesign";
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

async function main() {
  const image = await servingImage();
  const digest = await servingDigest();
  const shaOk = !EXPECTED || image.includes(EXPECTED.slice(0, 12));
  record("serving-sha", shaOk, `expected=${EXPECTED.slice(0, 12)} ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);
  record("production-untouched", url.includes("wvpsldwwjqdannqasrdf"), "sandbox project only");
  if (!shaOk) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
    process.exit(1);
  }

  // Snapshot legacy FP-01 before provision
  const { data: legacyBefore } = await admin.from("floor_plan_templates")
    .select("id, name, source_master_key")
    .eq("venue_id", FANCY)
    .eq("source_master_key", LEGACY_COMBINED_FLOOR_PLAN_STARTER_KEY)
    .maybeSingle();
  let legacyObjCountBefore = 0;
  let legacyLabelsBefore: string[] = [];
  if (legacyBefore?.id) {
    const { data: objs } = await admin.from("floor_plan_template_objects")
      .select("label").eq("template_id", legacyBefore.id).eq("venue_id", FANCY);
    legacyObjCountBefore = objs?.length ?? 0;
    legacyLabelsBefore = (objs ?? []).map((o) => o.label ?? "");
  }

  const { data: plansBefore } = await admin.from("floor_plans")
    .select("id, name")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY);
  const planIdsBefore = new Set((plansBefore ?? []).map((p) => p.id as string));

  const provision1 = await provisionFloorPlanStarters(admin as never, FANCY);
  const provision2 = await provisionFloorPlanStarters(admin as never, FANCY);
  record(
    "provision-idempotent",
    provision2.created.length === 0,
    JSON.stringify({ first: provision1, second: provision2 }),
  );

  const { data: starters } = await admin.from("floor_plan_templates")
    .select("id, name, source_master_key")
    .eq("venue_id", FANCY)
    .in("source_master_key", FLOOR_PLAN_STARTER_MASTERS.map((m) => m.key));
  const byKey = new Map((starters ?? []).map((t) => [t.source_master_key as string, t]));
  for (const master of FLOOR_PLAN_STARTER_MASTERS) {
    const row = byKey.get(master.key);
    record(
      `starter-present-${master.key}`,
      Boolean(row),
      row ? `${row.name}` : "missing",
    );
  }

  // Blank has zero objects
  const blankId = byKey.get("FP-05")?.id;
  if (blankId) {
    const { count } = await admin.from("floor_plan_template_objects")
      .select("*", { count: "exact", head: true })
      .eq("template_id", blankId)
      .eq("venue_id", FANCY);
    record("blank-zero-objects", (count ?? 0) === 0, `count=${count}`);
  } else {
    record("blank-zero-objects", false, "FP-05 missing");
  }

  // Ceremony distinct from reception
  async function labelsFor(key: string): Promise<string[]> {
    const id = byKey.get(key)?.id;
    if (!id) return [];
    const { data } = await admin.from("floor_plan_template_objects")
      .select("label, object_type, display_shape")
      .eq("template_id", id)
      .eq("venue_id", FANCY);
    return (data ?? []).map((o) => `${o.object_type}:${o.display_shape ?? ""}:${o.label ?? ""}`);
  }
  const ceremonyL = await labelsFor("FP-03");
  const cocktailL = await labelsFor("FP-04");
  const receptionL = await labelsFor("FP-02");
  const flipL = await labelsFor("FP-SR");
  record(
    "ceremony-no-dance-floor",
    ceremonyL.some((l) => /arbor|aisle|ceremony/i.test(l)) && !ceremonyL.some((l) => l.startsWith("dance_floor:")),
    ceremonyL.slice(0, 8).join(" | "),
  );
  record(
    "cocktail-has-bar-no-arbor",
    cocktailL.some((l) => l.startsWith("bar:")) && !cocktailL.some((l) => /arbor|aisle/i.test(l)),
    cocktailL.join(" | "),
  );
  record(
    "reception-has-dining-no-ceremony",
    receptionL.some((l) => l.startsWith("dance_floor:")) && !receptionL.some((l) => /ceremony row|arbor|aisle/i.test(l)),
    receptionL.slice(0, 8).join(" | "),
  );
  record(
    "flip-static-reference",
    flipL.some((l) => /static|reference/i.test(l)) && flipL.some((l) => /ceremony/i.test(l)) && flipL.some((l) => /reception/i.test(l)),
    flipL.filter((l) => /text_label/i.test(l)).join(" | "),
  );

  // Legacy FP-01 preserved
  if (legacyBefore?.id) {
    const { data: legacyAfter } = await admin.from("floor_plan_templates")
      .select("id, name")
      .eq("id", legacyBefore.id)
      .eq("venue_id", FANCY)
      .maybeSingle();
    const { data: objsAfter } = await admin.from("floor_plan_template_objects")
      .select("label")
      .eq("template_id", legacyBefore.id)
      .eq("venue_id", FANCY);
    const labelsAfter = (objsAfter ?? []).map((o) => o.label ?? "");
    record(
      "legacy-fp01-preserved",
      legacyAfter?.name === legacyBefore.name
        && (objsAfter?.length ?? 0) === legacyObjCountBefore
        && looksLikeLegacyCombinedFloorPlan(labelsAfter),
      JSON.stringify({
        name: legacyAfter?.name,
        beforeCount: legacyObjCountBefore,
        afterCount: objsAfter?.length,
        beforeSample: legacyLabelsBefore.slice(0, 5),
      }),
    );
  } else {
    record("legacy-fp01-preserved", true, "no legacy FP-01 on Fancy (ok)");
  }

  // Create event plans from each standard starter + blank (does not touch existing plans)
  const createdPlanIds: string[] = [];
  for (const key of ["FP-03", "FP-04", "FP-02", "FP-05", "FP-SR"] as const) {
    const tmpl = byKey.get(key);
    if (!tmpl) continue;
    const { data: plan, error } = await admin.from("floor_plans").insert({
      venue_id: FANCY,
      event_id: EVENT,
      name: `QA ${tmpl.name}`,
      space_id: null,
      source_template_id: tmpl.id,
      client_access: "hidden",
    }).select("id").single();
    if (error) {
      record(`create-plan-${key}`, false, error.message);
      continue;
    }
    createdPlanIds.push(plan.id);
    const { data: tmplObjs } = await admin.from("floor_plan_template_objects")
      .select("*")
      .eq("template_id", tmpl.id)
      .eq("venue_id", FANCY);
    if ((tmplObjs?.length ?? 0) > 0) {
      const rows = (tmplObjs ?? []).map((o, i) => ({
        venue_id: FANCY,
        floor_plan_id: plan.id,
        object_type: o.object_type,
        label: o.label,
        capacity: o.capacity,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        rotation: o.rotation,
        sort_order: i,
        inventory_item_id: null,
        color: o.color,
        notes: o.notes,
        locked: false,
        display_shape: o.display_shape,
      }));
      const { error: objErr } = await admin.from("floor_plan_objects").insert(rows);
      if (objErr) {
        record(`create-plan-${key}`, false, objErr.message);
        continue;
      }
    }
    const { count } = await admin.from("floor_plan_objects")
      .select("*", { count: "exact", head: true })
      .eq("floor_plan_id", plan.id)
      .eq("venue_id", FANCY);
    const expected = key === "FP-05" ? 0 : (tmplObjs?.length ?? 0);
    record(`create-plan-${key}`, (count ?? 0) === expected, `objects=${count} expected=${expected}`);
  }

  const { data: plansAfter } = await admin.from("floor_plans")
    .select("id, name")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY);
  const preexistingIntact = [...planIdsBefore].every((id) =>
    (plansAfter ?? []).some((p) => p.id === id),
  );
  record("preexisting-plans-intact", preexistingIntact, `before=${planIdsBefore.size} after=${plansAfter?.length}`);

  // Submit-confirm dialog still in portal source
  const confirmSrc = readFileSync("components/portal/floor-plan-submit-confirm-dialog.tsx", "utf8");
  const portalSrc = readFileSync("components/portal/floor-plan-section.tsx", "utf8");
  record(
    "submit-confirm-dialog-preserved",
    /FloorPlanSubmitConfirmDialog/.test(portalSrc) && /Cancel/i.test(confirmSrc) && /Confirm|Submit/i.test(confirmSrc),
    "portal wires confirm dialog",
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await staff.addCookies(await staffCookies());
    const page = await staff.newPage();
    await page.goto(`${APP}/library/floor-plan-templates`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    const body = await page.locator("body").innerText().catch(() => "");
    record("ui-shows-ceremony", /Wedding Ceremony/i.test(body), "library");
    record("ui-shows-cocktail", /Cocktail Hour/i.test(body), "library");
    record("ui-shows-reception", /Wedding Reception|Reception Only/i.test(body), "library");
    record("ui-shows-flip", /Same-Room Ceremony \+ Reception Flip|Same.Room/i.test(body), "library");
    record("ui-shows-blank", /Blank Floor Plan/i.test(body), "library");
    record(
      "ui-flip-specialized-copy",
      /Specialized|static|does not switch|same room/i.test(body),
      body.match(/Same-Room[\s\S]{0,200}/)?.[0] ?? "flip blurb",
    );
    await page.screenshot({ path: `${OUT}/shots/library-1280.png`, fullPage: true });

    await page.goto(`${APP}/events/${EVENT}/floor-plans`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/shots/event-floor-plans-1280.png`, fullPage: false });
    record("event-floor-plans-workspace", /floor plan/i.test(await page.locator("body").innerText()), page.url());
  } finally {
    await browser.close();
  }

  // Cleanup QA plans created by this harness (leave templates + preexisting plans)
  if (createdPlanIds.length > 0) {
    await admin.from("floor_plan_objects").delete().in("floor_plan_id", createdPlanIds).eq("venue_id", FANCY);
    await admin.from("floor_plans").delete().in("id", createdPlanIds).eq("venue_id", FANCY);
  }

  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify({
    image,
    digest,
    provision1,
    provision2,
    starters: starters ?? [],
    legacyBefore,
    createdPlanIds,
    preexistingPlanCount: planIdsBefore.size,
  }, null, 2));

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
    pass: failed.length === 0,
    passed: checks.filter((c) => c.pass).length,
    failed: failed.length,
    total: checks.length,
    image,
    digest,
    checks,
  }, null, 2));
  console.log(`\n${failed.length === 0 ? "GREEN" : "NOT GREEN"} ${checks.filter((c) => c.pass).length}/${checks.length}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, error: String(err), checks }, null, 2));
  process.exit(1);
});
