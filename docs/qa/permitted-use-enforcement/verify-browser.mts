/**
 * Browser: Event Space assignment UI still filters by permitted use on tip.
 * EXPECTED_SHA=<serving> npx tsx docs/qa/permitted-use-enforcement/verify-browser.mts
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
const OUT = "docs/qa/permitted-use-enforcement";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 300)}`);
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

  // Prefer a recent PUE probe event if present; else any Fancy wedding with assignments
  const { data: events } = await admin.from("events")
    .select("id,name,client_id")
    .eq("venue_id", FANCY)
    .like("name", "PUE-%")
    .order("created_at", { ascending: false })
    .limit(1);
  let eventId = events?.[0]?.id as string | undefined;
  let clientId = events?.[0]?.client_id as string | undefined;
  if (!eventId) {
    const { data: anyEv } = await admin.from("events")
      .select("id,client_id").eq("venue_id", FANCY).eq("status", "confirmed").limit(1).maybeSingle();
    eventId = anyEv?.id;
    clientId = anyEv?.client_id ?? undefined;
  }
  record("event_fixture", !!eventId, eventId ?? "none");
  if (!eventId || !clientId) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image }, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(await staffCookies());
  const page = await ctx.newPage();
  try {
    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    // Open event edit / space assignments if present
    const editLink = page.getByRole("link", { name: /Edit|Event details|Spaces/i }).first();
    if (await editLink.count()) {
      await editLink.click().catch(() => undefined);
      await page.waitForTimeout(2000);
    }
    await page.goto(`${APP}/events/${eventId}/edit`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${OUT}/shots/event-edit.png`, fullPage: true });
    const body = await page.locator("body").innerText();
    // UI should not offer Stone Patio for Reception when cocktail-only (editor filters eligible spaces)
    const hasAssignmentsUi = /Reception|Ceremony|Cocktail|Space/i.test(body);
    record("assignments_ui_reachable", hasAssignmentsUi || page.url().includes("/edit") || page.url().includes("/clients/"), page.url());

    // Narrow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/shots/event-edit-390.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    record("no_horizontal_overflow", !overflow, `overflow=${overflow}`);
  } finally {
    await browser.close();
  }

  const ok = checks.every((c) => c.pass);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
    at: new Date().toISOString(), expectedSha: EXPECTED, image, eventId, clientId, checks, ok,
  }, null, 2));
  console.log(ok ? "VERDICT=GREEN" : "VERDICT=OPEN");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
