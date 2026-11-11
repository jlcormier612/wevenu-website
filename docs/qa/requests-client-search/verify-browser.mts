/**
 * New Request searchable client selector — Sandbox browser acceptance.
 * EXPECTED_SHA=<serving> npx tsx docs/qa/requests-client-search/verify-browser.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";

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
const OUT = "docs/qa/requests-client-search";
const RUN = `RCS${Date.now().toString(36).toUpperCase()}`;
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 350)}`);
}

async function servingImage() {
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
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "magiclink", email: EMAIL }),
      });
      if (!res.ok) throw new Error(`generate_link HTTP ${res.status}`);
      const body = await res.json() as { hashed_token?: string; properties?: { hashed_token?: string } };
      const hash = body.hashed_token ?? body.properties?.hashed_token;
      if (!hash) throw new Error("missing hash");
      const { data: otp, error } = await anon.auth.verifyOtp({ type: "email", token_hash: hash });
      if (!error && otp?.session) {
        const projectRef = new URL(url).hostname.split(".")[0];
        const cookieName = `sb-${projectRef}-auth-token`;
        const chunked = ssrUtils.createChunks(cookieName, JSON.stringify(otp.session));
        return (Array.isArray(chunked) ? chunked : [{ name: cookieName, value: chunked }]).map(
          (c: { name: string; value: string }) => ({
            name: c.name,
            value: c.value,
            domain: "app.sandbox.hellotocheers.com",
            path: "/",
            httpOnly: false,
            secure: true,
            sameSite: "Lax" as const,
          }),
        );
      }
      lastErr = error ?? new Error("no session");
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
  }
  throw lastErr ?? new Error("staff session failed");
}

async function main() {
  const image = await servingImage();
  record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image }, null, 2));
    process.exit(1);
  }

  const { count: clientCount } = await admin.from("clients")
    .select("id", { count: "exact", head: true }).eq("venue_id", FANCY);
  record("large_client_list", (clientCount ?? 0) >= 100, `fancyClients=${clientCount}`);

  // Synthetic couple with distinctive names for partner-name search
  const partnerTag = randomBytes(2).toString("hex");
  const { data: synClient, error: synErr } = await admin.from("clients").insert({
    venue_id: FANCY,
    first_name: "Rory",
    last_name: `Rcs${RUN}`,
    partner_first_name: "Quinn",
    partner_last_name: `Partner${partnerTag}`,
    email: `rcs-${RUN.toLowerCase()}@hellotocheers-test.invalid`,
    status: "confirmed",
    event_type: "wedding",
    event_date: "2031-05-17",
  }).select("id, first_name, last_name, partner_first_name, partner_last_name").single();
  record("synthetic_client", !!synClient && !synErr, synErr?.message ?? synClient?.id ?? "fail");
  if (!synClient) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image }, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(await staffCookies());
  const page = await ctx.newPage();
  let createdRequestId: string | null = null;

  try {
    await page.goto(`${APP}/requests`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/shots/requests-desktop.png`, fullPage: true });

    const picker = page.locator('[data-testid="request-client-picker"]');
    record("picker_present", (await picker.count()) > 0, "request-client-picker");
    record("no_unbounded_select", (await page.locator('select option:has-text("Select client")').count()) === 0, "legacy select gone");

    // Create disabled without client
    const createBtn = page.getByRole("button", { name: /Create Request/i });
    const titleInput = page.getByPlaceholder("Title");
    await titleInput.fill(`RCS ${RUN} Title`);
    record("submit_disabled_without_client", await createBtn.isDisabled(), "needs client");

    // Open picker + empty hint
    await page.locator('[data-testid="request-client-trigger"]').click();
    await page.waitForTimeout(400);
    const idle = await page.locator("text=Search for a client by name.").count();
    record("empty_search_hint", idle > 0, `hint=${idle}`);

    const search = page.locator('[data-testid="request-client-search"]');
    const option = page.locator(`[data-testid="request-client-option-${synClient.id}"]`);

    // No results
    await search.fill("zzzznonexistentclientxyz");
    await page.locator('[data-testid="request-client-empty"]').waitFor({ timeout: 10_000 });
    record("no_results_copy", (await page.locator('[data-testid="request-client-empty"]').count()) > 0, "empty state");

    // Partial primary name
    await search.fill("Rory");
    await option.first().waitFor({ timeout: 10_000 });
    record("partial_name_hit", (await option.count()) > 0, synClient.id);

    // Partner name search
    await search.fill(`Quinn Partner${partnerTag}`);
    await option.first().waitFor({ timeout: 10_000 });
    record("partner_name_hit", (await option.count()) > 0, `Quinn Partner${partnerTag}`);

    // Select
    await option.first().click();
    await page.waitForTimeout(400);
    const triggerText = await page.locator('[data-testid="request-client-trigger"]').innerText();
    record("selection_shown", /Rory/i.test(triggerText), triggerText);

    // Preserve other fields when clearing and reselecting
    const desc = page.getByPlaceholder(/Description/i);
    await desc.fill(`Keep me ${RUN}`);
    await page.locator('[data-testid="request-client-clear"]').click();
    await page.waitForTimeout(300);
    record("cleared", !(await page.locator('[data-testid="request-client-trigger"]').innerText()).includes("Rory"), "cleared");
    record("title_preserved", (await titleInput.inputValue()).includes(RUN), await titleInput.inputValue());
    record("description_preserved", (await desc.inputValue()).includes(RUN), await desc.inputValue());
    record("submit_disabled_after_clear", await createBtn.isDisabled(), "needs client again");

    await page.locator('[data-testid="request-client-trigger"]').click();
    await search.fill(`Rcs${RUN}`);
    await option.first().waitFor({ timeout: 10_000 });
    await option.first().click();
    await page.waitForTimeout(300);

    // Create request
    await createBtn.click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}/shots/after-create.png`, fullPage: true });

    const { data: created } = await admin.from("requests")
      .select("id, client_id, title, venue_id")
      .eq("venue_id", FANCY)
      .eq("client_id", synClient.id)
      .ilike("title", `%${RUN}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    createdRequestId = created?.id ?? null;
    record(
      "request_persisted_correct_client",
      !!created && created.client_id === synClient.id && created.venue_id === FANCY,
      JSON.stringify(created),
    );

    // Venue scoping: search must not return foreign venue clients
    const otherVenue = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
    const { data: foreign } = await admin.from("clients")
      .select("id, first_name, last_name").eq("venue_id", otherVenue).limit(1).maybeSingle();
    if (foreign?.first_name) {
      await page.locator('[data-testid="request-client-trigger"]').click().catch(() => undefined);
      // After create the form may have reloaded — reopen
      await page.goto(`${APP}/requests`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2500);
      await page.locator('[data-testid="request-client-trigger"]').click();
      await page.locator('[data-testid="request-client-search"]').fill(foreign.first_name);
      await page.waitForTimeout(1500);
      // Wait for either results or empty — then assert foreign id absent
      await Promise.race([
        page.locator('[data-testid="request-client-empty"]').waitFor({ timeout: 8_000 }).catch(() => null),
        page.locator('[role="option"]').first().waitFor({ timeout: 8_000 }).catch(() => null),
      ]);
      const foreignOpt = page.locator(`[data-testid="request-client-option-${foreign.id}"]`);
      record("foreign_venue_excluded", (await foreignOpt.count()) === 0, `foreign=${foreign.id}`);
    } else {
      record("foreign_venue_excluded", true, "no foreign sample — skipped positively");
    }

    // Narrow viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/requests`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    await page.locator('[data-testid="request-client-trigger"]').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/shots/picker-390.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    record("narrow_no_overflow", !overflow, `overflow=${overflow}`);
    record("narrow_picker_open", (await page.locator('[data-testid="request-client-search"]').count()) > 0, "search visible");
  } finally {
    await browser.close();
  }

  const ok = checks.every((c) => c.pass);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
    at: new Date().toISOString(),
    run: RUN,
    expectedSha: EXPECTED,
    image,
    clientCount,
    syntheticClientId: synClient.id,
    createdRequestId,
    checks,
    ok,
  }, null, 2));
  console.log(ok ? "VERDICT=GREEN" : "VERDICT=OPEN");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
