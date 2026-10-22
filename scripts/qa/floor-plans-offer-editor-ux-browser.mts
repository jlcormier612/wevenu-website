/**
 * Venue Sandbox: prove Floor Plans Change editor omits client-selection status.
 * Uses an existing Fancy booked event with offers. No Production.
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
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "REPLACE_AFTER_DEPLOY";
const OUT = "docs/qa/booking-to-portal-simplification";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 240)}`);
}

async function cookies() {
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
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: FANCY,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function main() {
  let servingSha: string | null = null;
  let eventId: string | null = null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();

  try {
    const res = await page.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const link = res?.headers()["link"] ?? "";
    const html = await page.content();
    servingSha =
      link.match(/[0-9a-f]{40}/)?.[0]
      ?? html.match(/data-dpl-id="([a-f0-9]{40})"/)?.[1]
      ?? html.match(/dpl=([a-f0-9]{40})/)?.[1]
      ?? null;
    record(
      "serving_sha",
      !!servingSha && servingSha.startsWith(EXPECTED_SHA.slice(0, 8)),
      `serving=${servingSha} expected=${EXPECTED_SHA}`,
    );
    if (!servingSha?.startsWith(EXPECTED_SHA.slice(0, 8))) {
      throw new Error(`serving mismatch`);
    }

    const { data: events } = await admin
      .from("events")
      .select("id,name")
      .eq("venue_id", FANCY)
      .not("booked_at", "is", null)
      .order("booked_at", { ascending: false })
      .limit(15);
    for (const ev of events ?? []) {
      const { count } = await admin
        .from("event_floor_plan_offers")
        .select("id", { count: "exact", head: true })
        .eq("event_id", ev.id)
        .eq("is_offered", true);
      if ((count ?? 0) >= 1) {
        eventId = ev.id;
        break;
      }
    }
    record("found_booked_event_with_offers", Boolean(eventId), `eventId=${eventId}`);
    if (!eventId) throw new Error("no booked event with offers");

    await page.goto(`${APP}/events/${eventId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 60_000 });
    await page.getByTestId("event-setup-change-floor_plans").click();
    await page.waitForSelector('[data-testid="event-floor-plans-setup-editor"]', { timeout: 15_000 });
    const editor = page.getByTestId("event-floor-plans-setup-editor");
    const text = await editor.innerText();
    record(
      "offer_editor_open",
      (await editor.count()) === 1 && (await page.getByTestId("floor-plans-setup-offers-path").count()) === 1,
      text.slice(0, 200),
    );
    record(
      "offer_editor_omits_client_selection_status",
      (await page.getByTestId("floor-plans-setup-selection-state").count()) === 0
        && (await page.getByTestId("floor-plans-setup-no-client-selection").count()) === 0
        && !/The client has not selected a layout yet/i.test(text)
        && !/Client'?s selected layout/i.test(text),
      text.slice(0, 280),
    );
    record(
      "offer_editor_still_lists_offers",
      /Layouts offered to the client/i.test(text) || (await page.locator('[data-testid^="floor-plans-setup-offer-"]').count()) >= 1,
      `offerRows=${await page.locator('[data-testid^="floor-plans-setup-offer-"]').count()}`,
    );
    await page.screenshot({ path: `${OUT}/03h-floor-plans-setup-editor-no-selection-status-1280.png`, fullPage: true });
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : JSON.stringify(err));
  } finally {
    await browser.close();
    const failed = checks.filter((c) => !c.pass).length;
    const passed = checks.filter((c) => c.pass).length;
    const payload = {
      workflow: "floor-plans-offer-editor-ux",
      status: failed === 0 ? "GREEN" : "NOT_GREEN",
      expectedSha: EXPECTED_SHA,
      servingSha,
      eventId,
      passed,
      failed,
      checks,
    };
    writeFileSync(`${OUT}/floor-offer-editor-ux-results.json`, JSON.stringify(payload, null, 2));
    console.log(JSON.stringify({ passed, failed, servingSha, eventId, status: payload.status }, null, 2));
    process.exitCode = failed === 0 ? 0 : 1;
  }
}

main();
