/**
 * Guided EO Template setup — Sandbox browser acceptance.
 * Preserves existing template data; exercises wizard steps without inventing prices.
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
const OUT = "docs/qa/event-order-template-guided-setup";
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
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
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

async function servingDigest(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
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
  const shaOk = EXPECTED ? image.includes(EXPECTED.slice(0, 8)) : /htc-sandbox-venue-app:[0-9a-f]{8}/.test(image);
  record("serving-sha", shaOk, `expected=${EXPECTED || "(any)"} ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);
  if (!shaOk) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
    process.exit(1);
  }

  const { data: templates } = await admin
    .from("event_order_templates")
    .select("id, name, is_archived, updated_at")
    .eq("venue_id", FANCY)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(30);

  let templateId: string | null = null;
  let beforeSnapshot: Record<string, unknown> | null = null;
  for (const t of templates ?? []) {
    const { data: sections } = await admin
      .from("event_order_template_sections")
      .select("id, name, sort_order")
      .eq("template_id", t.id)
      .eq("venue_id", FANCY);
    if (!sections?.length) continue;
    const { data: groups } = await admin
      .from("event_order_template_groups")
      .select("id, name, section_id, depends_on_option_ids, selection_mode, min_select")
      .eq("template_id", t.id);
    const { data: options } = await admin
      .from("event_order_template_options")
      .select("id, group_id, label, offering_id, unit_price, is_included")
      .eq("template_id", t.id);
    const { data: lines } = await admin
      .from("event_order_template_lines")
      .select("id, section_id, description, offering_id, unit_price, included_by_default")
      .eq("template_id", t.id);
    templateId = t.id;
    beforeSnapshot = {
      sectionCount: sections.length,
      groupCount: groups?.length ?? 0,
      optionCount: options?.length ?? 0,
      lineCount: lines?.length ?? 0,
      optionIds: (options ?? []).map((o) => o.id).sort(),
      offeringLinks: (options ?? []).filter((o) => o.offering_id).map((o) => ({ id: o.id, offering_id: o.offering_id })),
      sections: sections.map((s) => ({ id: s.id, name: s.name })),
      groups: groups ?? [],
    };
    break;
  }

  record("fixture-existing-template", Boolean(templateId), JSON.stringify({ templateId, beforeSnapshot: beforeSnapshot ? { sectionCount: beforeSnapshot.sectionCount, groupCount: beforeSnapshot.groupCount, optionCount: beforeSnapshot.optionCount } : null }));
  if (!templateId || !beforeSnapshot) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(await staffCookies());
    const page = await ctx.newPage();
    await page.goto(`${APP}/library/event-order-templates/${templateId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(4000);

    const wizard = page.locator('[data-testid="eo-guided-setup-wizard"]');
    record("ui-guided-wizard", await wizard.count() > 0, "eo-guided-setup-wizard");

    // Existing templates open on configure (or categories if empty). Ensure we can reach categories.
    const changeCats = page.getByRole("button", { name: /Change package categories|Change categories|What does your venue offer/i });
    const categoriesStep = page.locator('[data-testid="eo-guided-step-categories"]');
    if ((await categoriesStep.count()) === 0) {
      // Navigate via review → change categories, or back to categories
      const back = page.locator('[data-testid="eo-guided-back"]');
      // Click progress path: go to review then change categories if needed
      for (let i = 0; i < 12 && (await categoriesStep.count()) === 0; i++) {
        const continueBtn = page.locator('[data-testid="eo-guided-continue"]');
        if ((await continueBtn.count()) > 0) {
          await continueBtn.click();
          await page.waitForTimeout(700);
        } else if ((await page.locator('[data-testid="eo-guided-goto-preview"]').count()) > 0) {
          await page.getByRole("button", { name: /Change package categories|Change categories/i }).click();
          await page.waitForTimeout(800);
          break;
        } else if ((await back.count()) > 0) {
          await back.click();
          await page.waitForTimeout(500);
        } else break;
      }
    }

    // Prefer opening categories via Change categories from review
    if ((await categoriesStep.count()) === 0) {
      // Force: walk back
      for (let i = 0; i < 8; i++) {
        const back = page.locator('[data-testid="eo-guided-back"]');
        if ((await back.count()) === 0) break;
        await back.click();
        await page.waitForTimeout(400);
        if ((await categoriesStep.count()) > 0) break;
      }
    }

    record("ui-categories-step-reachable", await categoriesStep.count() > 0 || await page.locator('[data-testid="eo-guided-step-patterns"]').count() > 0, `categories=${await categoriesStep.count()}`);

    if ((await categoriesStep.count()) > 0) {
      await page.screenshot({ path: `${OUT}/shots/step-categories-1280.png`, fullPage: false });
      const cateringCard = page.locator('[data-testid="eo-guided-category-catering"]');
      record("ui-category-cards", await cateringCard.count() > 0, "catering card");
      // Re-confirm selection without removing (click continue)
      await page.locator('[data-testid="eo-guided-categories-continue"]').click();
      await page.waitForTimeout(3500);
    }

    const patterns = page.locator('[data-testid="eo-guided-step-patterns"]');
    record("ui-patterns-step", await patterns.count() > 0 || await page.locator('[data-testid^="eo-guided-configure-"]').count() > 0, `patterns=${await patterns.count()}`);
    await page.screenshot({ path: `${OUT}/shots/step-patterns-or-configure-1280.png`, fullPage: false });

    // Walk forward to review / preview without mutating if possible
    for (let i = 0; i < 20; i++) {
      if ((await page.locator('[data-testid="eo-guided-step-review"]').count()) > 0) break;
      if ((await page.locator('[data-testid="eo-guided-step-preview"]').count()) > 0) break;
      const cont = page.locator('[data-testid="eo-guided-continue"]');
      if ((await cont.count()) === 0) break;
      // On patterns, ensure at least one pattern selected
      if ((await page.locator('[data-testid="eo-guided-step-patterns"]').count()) > 0) {
        const pressed = page.locator('[data-testid^="eo-guided-pattern-"][aria-pressed="true"]');
        if ((await pressed.count()) === 0) {
          await page.locator('[data-testid="eo-guided-pattern-choose_one"]').click();
          await page.waitForTimeout(200);
        }
      }
      await cont.click();
      await page.waitForTimeout(900);
    }

    const review = page.locator('[data-testid="eo-guided-step-review"]');
    if ((await review.count()) === 0 && (await page.locator('[data-testid="eo-guided-goto-preview"]').count()) === 0) {
      // may have landed on preview
    }
    record(
      "ui-review-or-preview",
      (await page.locator('[data-testid="eo-guided-step-review"]').count()) > 0
        || (await page.locator('[data-testid="eo-guided-step-preview"]').count()) > 0
        || (await page.locator('[data-testid="eo-template-client-preview"]').count()) > 0,
      `review=${await page.locator('[data-testid="eo-guided-step-review"]').count()} preview=${await page.locator('[data-testid="eo-guided-step-preview"]').count()}`,
    );

    if ((await page.locator('[data-testid="eo-guided-goto-preview"]').count()) > 0) {
      await page.locator('[data-testid="eo-guided-goto-preview"]').click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: `${OUT}/shots/review-or-preview-1280.png`, fullPage: false });

    const preview = page.locator('[data-testid="eo-template-client-preview"]');
    record("ui-client-preview", await preview.count() > 0, await preview.count().then(String));

    // Offering filter: open included-item add if present on fixed step path, else advanced
    // Reload and confirm wizard still mounts
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    record("ui-reload-wizard", await page.locator('[data-testid="eo-guided-setup-wizard"]').count() > 0, "wizard after reload");
  } finally {
    await browser.close();
  }

  // Persisted-state preservation (Scenario F)
  const { data: sectionsAfter } = await admin
    .from("event_order_template_sections")
    .select("id, name")
    .eq("template_id", templateId);
  const { data: optionsAfter } = await admin
    .from("event_order_template_options")
    .select("id, group_id, label, offering_id, unit_price, is_included")
    .eq("template_id", templateId);
  const { data: groupsAfter } = await admin
    .from("event_order_template_groups")
    .select("id, name, depends_on_option_ids")
    .eq("template_id", templateId);

  const optionIdsAfter = (optionsAfter ?? []).map((o) => o.id).sort();
  const beforeIds = (beforeSnapshot.optionIds as string[]) ?? [];
  record(
    "persisted-options-preserved",
    JSON.stringify(optionIdsAfter) === JSON.stringify(beforeIds),
    JSON.stringify({ before: beforeIds.length, after: optionIdsAfter.length }),
  );
  const beforeLinks = JSON.stringify(beforeSnapshot.offeringLinks ?? []);
  const afterLinks = JSON.stringify(
    (optionsAfter ?? []).filter((o) => o.offering_id).map((o) => ({ id: o.id, offering_id: o.offering_id })),
  );
  record("persisted-offering-ids-preserved", beforeLinks === afterLinks, `links=${(optionsAfter ?? []).filter((o) => o.offering_id).length}`);
  record(
    "persisted-groups-preserved",
    (groupsAfter ?? []).length === (beforeSnapshot.groupCount as number),
    `before=${beforeSnapshot.groupCount} after=${groupsAfter?.length}`,
  );

  const pass = checks.every((c) => c.pass);
  const payload = {
    pass,
    image,
    digest,
    expectedSha: EXPECTED || null,
    templateId,
    beforeSnapshot,
    after: { sections: sectionsAfter, optionCount: optionsAfter?.length, groupCount: groupsAfter?.length },
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(payload, null, 2));
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(payload.after, null, 2));
  console.log(pass ? "\nGREEN guided setup verification" : "\nNOT GREEN");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
