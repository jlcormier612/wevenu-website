/**
 * Client Documents must show the completed questionnaire with submitted answers.
 * Safe Sandbox fixture. No real email/SMS/payment.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const QID = "e055c612-ed2c-4180-a34c-03414fece3ed";
const MARKER = `Docs visibility proof ${Date.now()}`;
const OUT = "docs/qa/questionnaire-documents-visibility";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

function servingImage(): { image: string; digest: string } {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  const image = execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
  const digest = execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
    { encoding: "utf8" },
  ).trim();
  return { image, digest };
}

async function ensureCoupleToken(): Promise<string> {
  const { data: existing } = await admin
    .from("portal_sessions")
    .select("access_token")
    .eq("client_id", CLIENT)
    .eq("access_level", "couple")
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.access_token) return existing.access_token;

  const token = `qa-docs-q-${Date.now().toString(36)}`;
  const { error } = await admin.from("portal_sessions").insert({
    venue_id: FANCY,
    client_id: CLIENT,
    access_token: token,
    access_level: "couple",
    label: "QA Docs Questionnaire",
  });
  if (error) throw new Error(error.message);
  return token;
}

async function main() {
  const expected = process.env.EXPECTED_SHA?.slice(0, 8);
  const { image, digest } = servingImage();
  record("serving-image", Boolean(image), `${image} ${digest}`);
  if (expected) {
    record("serving-sha-matches", image.includes(expected), `expected=${expected} image=${image}`);
  }

  // Seed a known submitted answer onto the canonical questionnaire (Sandbox demo).
  const { data: before } = await admin
    .from("event_questionnaires")
    .select("id,kind,status,submitted_at,additional,venue_id,event_id")
    .eq("id", QID)
    .single();
  record(
    "fixture-questionnaire-returned",
    before?.status === "complete" || before?.status === "submitted" || before?.status === "resubmitted",
    JSON.stringify({ status: before?.status, kind: before?.kind, submitted_at: before?.submitted_at }),
  );
  const family = {
    ...((before?.additional as { family?: Record<string, string> } | null)?.family ?? {}),
    excited_about: MARKER,
  };
  await admin
    .from("event_questionnaires")
    .update({ additional: { family } })
    .eq("id", QID)
    .eq("venue_id", FANCY);

  const { count: qCountBefore } = await admin
    .from("event_questionnaires")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY);

  const token = await ensureCoupleToken();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${APP}/p/${encodeURIComponent(token)}?view=documents#documents`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(1500);
    const accept = page.getByRole("button", { name: /I agree|Accept|Continue/i }).first();
    if ((await accept.count()) > 0) await accept.click().catch(() => undefined);
    await page.waitForTimeout(800);

    // Navigate to Documents if not already there.
    const docsNav = page.getByRole("button", { name: /^Docs$/i }).or(page.getByText("Documents", { exact: true })).first();
    if ((await docsNav.count()) > 0) await docsNav.click().catch(() => undefined);
    await page.waitForTimeout(1200);

    const section = page.locator('[data-testid="portal-documents-questionnaires"]');
    await section.waitFor({ timeout: 30_000 }).catch(() => undefined);
    const card = page.locator('[data-testid="portal-documents-questionnaire"]').first();
    const cardText = (await card.innerText().catch(() => "")) || (await page.locator("body").innerText());
    record(
      "documents-shows-questionnaire-card",
      (await card.count()) > 0 && /Client Planning/i.test(cardText),
      cardText.slice(0, 400),
    );
    await page.screenshot({ path: `${OUT}/shots/documents-1280.png`, fullPage: false });

    if ((await card.count()) > 0) {
      await card.click();
      await page.waitForTimeout(1500);
    }
    const review = page.locator('[data-testid="questionnaire-submitted-review"]');
    await review.waitFor({ timeout: 25_000 }).catch(() => undefined);
    const reviewText = await page.locator("body").innerText();
    record(
      "submitted-review-visible",
      (await review.count()) > 0 && /Read-only/i.test(reviewText),
      reviewText.slice(0, 500),
    );
    record(
      "submitted-answers-include-marker",
      reviewText.includes(MARKER),
      reviewText.includes(MARKER) ? "marker present" : reviewText.slice(0, 500),
    );
    record(
      "title-is-client-planning",
      /Client Planning Questionnaire/i.test(reviewText) || /Client Planning/i.test(reviewText),
      reviewText.slice(0, 300),
    );
    await page.screenshot({ path: `${OUT}/shots/submitted-review-1280.png`, fullPage: false });

    // Reload Documents and re-open.
    await page.goto(`${APP}/p/${encodeURIComponent(token)}?view=documents#documents`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(1200);
    const card2 = page.locator('[data-testid="portal-documents-questionnaire"]').first();
    record("documents-card-persists-reload", (await card2.count()) > 0, `count=${await card2.count()}`);
    if ((await card2.count()) > 0) {
      await card2.click();
      await page.waitForTimeout(1200);
    }
    const review2 = page.locator('[data-testid="questionnaire-submitted-review"]');
    record(
      "submitted-review-persists-reload",
      (await review2.count()) > 0 && (await page.locator("body").innerText()).includes(MARKER),
      "reload",
    );
    await page.screenshot({ path: `${OUT}/shots/submitted-review-reload-1280.png`, fullPage: false });

    // Tenant isolation — other venue/client token must not see this questionnaire id.
    const foreignToken = `qa-foreign-${Date.now().toString(36)}`;
    // Use a non-matching token string (invalid) — API should return empty/error.
    const foreign = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const fp = await foreign.newPage();
    await fp.goto(`${APP}/p/${encodeURIComponent(foreignToken)}?view=documents#documents`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await fp.waitForTimeout(1500);
    const foreignBody = await fp.locator("body").innerText();
    record(
      "foreign-token-no-fixture-questionnaire",
      !foreignBody.includes(MARKER) && !(await fp.locator(`[data-questionnaire-id="${QID}"]`).count()),
      foreignBody.slice(0, 300),
    );
    await foreign.close();

    // Narrow width
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`${APP}/p/${encodeURIComponent(token)}?view=documents#documents`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/shots/documents-390.png`, fullPage: false });
    record(
      "narrow-documents-card",
      (await page.locator('[data-testid="portal-documents-questionnaire"]').count()) > 0,
      "390",
    );

    await ctx.close();
  } finally {
    await browser.close();
  }

  const { count: qCountAfter } = await admin
    .from("event_questionnaires")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY);
  record(
    "no-duplicate-questionnaire-rows",
    qCountBefore === qCountAfter,
    `before=${qCountBefore} after=${qCountAfter}`,
  );

  const { data: after } = await admin
    .from("event_questionnaires")
    .select("status,submitted_at,venue_id,event_id")
    .eq("id", QID)
    .single();
  record(
    "canonical-row-unchanged-status",
    after?.status === before?.status && after?.event_id === EVENT && after?.venue_id === FANCY,
    JSON.stringify(after),
  );

  const persisted = { image, digest, marker: MARKER, questionnaireId: QID, checks };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(persisted, null, 2));
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify({ before, after, marker: MARKER }, null, 2));
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length === 0 ? "GREEN" : "NOT GREEN"} ${checks.length - failed.length}/${checks.length}`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
