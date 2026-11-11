/**
 * Sandbox: Questionnaires delivery guidance note — read-only browser check.
 * Does not send questionnaires, invites, or emails.
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
const OUT = "docs/qa/questionnaire-delivery-guidance";
const SHOTS = `${OUT}/shots`;
mkdirSync(SHOTS, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 900) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 280)}`);
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
  let clientId: string | null = null;
  let eventId: string | null = null;

  const { count: qSentBefore } = await admin
    .from("event_questionnaires")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", FANCY)
    .not("sent_at", "is", null);
  const { count: invitesBefore } = await admin
    .from("client_invitations")
    .select("*", { count: "exact", head: true });
  const { count: notifBefore } = await admin
    .from("notification_log")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", FANCY);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const html = await page.content();
    servingSha =
      html.match(/data-dpl-id="([a-f0-9]{40})"/)?.[1]
      ?? html.match(/dpl=([a-f0-9]{40})/)?.[1]
      ?? null;
    record(
      "serving_sha",
      !!servingSha && servingSha.startsWith(EXPECTED_SHA.slice(0, 8)),
      `serving=${servingSha} expected=${EXPECTED_SHA}`,
    );

    const { data: events } = await admin
      .from("events")
      .select("id, client_id")
      .eq("venue_id", FANCY)
      .not("client_id", "is", null)
      .not("booked_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(25);
    const pick = (events ?? []).find((e) => e.client_id) ?? null;
    clientId = pick?.client_id ?? null;
    eventId = pick?.id ?? null;
    record("fixture", !!clientId && !!eventId, `client=${clientId} event=${eventId}`);
    if (!clientId) throw new Error("no booked client");

    const { data: qBefore } = await admin
      .from("event_questionnaires")
      .select("id, kind, status, sent_at, updated_at")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    const beforeFp = (qBefore ?? [])
      .map((q) => `${q.id}:${q.status}:${q.sent_at ?? ""}:${q.updated_at}`)
      .sort()
      .join("|");

    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    await page.getByRole("tab", { name: /^Questionnaires$/i }).click();
    await page.waitForTimeout(1500);

    const guidance = page.getByTestId("questionnaire-delivery-guidance");
    await guidance.scrollIntoViewIfNeeded().catch(() => {});
    const guidanceText = await guidance.innerText().catch(() => "");
    record("guidance_visible", await guidance.isVisible().catch(() => false), guidanceText.slice(0, 200));
    record(
      "guidance_avoids_duplicate_copy",
      /Questionnaire delivery/i.test(guidanceText)
        && /don't need to send a separate questionnaire request here/i.test(guidanceText)
        && /planning tasks or automated messages where supported/i.test(guidanceText),
      guidanceText.slice(0, 280),
    );
    record(
      "guidance_does_not_claim_auto_send",
      !/automatically sends|already been sent through planning/i.test(guidanceText),
      "ok",
    );

    const tabs = page.getByTestId("questionnaire-kind-tabs");
    record("kind_tabs_visible", await tabs.isVisible().catch(() => false), "tabs");
    await page.getByTestId("questionnaire-kind-tab-final_details").click();
    await page.waitForTimeout(600);
    record(
      "tab_switch_final_details",
      await page.getByRole("heading", { name: /Final Details/i }).first().isVisible().catch(() => false)
        || (await page.locator("text=Final Details").first().isVisible().catch(() => false)),
      "final_details",
    );
    await page.getByTestId("questionnaire-kind-tab-client_planning").click();
    await page.waitForTimeout(600);

    await page.screenshot({ path: `${SHOTS}/questionnaires-guidance-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await guidance.scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: `${SHOTS}/questionnaires-guidance-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    // Preview as client — open if present; do not send
    const preview = page.getByRole("link", { name: /Preview as client/i });
    if (await preview.isVisible().catch(() => false)) {
      const [popup] = await Promise.all([
        context.waitForEvent("page", { timeout: 8000 }).catch(() => null),
        preview.click({ modifiers: [] }).catch(() => preview.click()),
      ]);
      const previewPage = popup ?? page;
      await previewPage.waitForTimeout(1500);
      const previewUrl = previewPage.url();
      record("preview_opened", /questionnaire-preview/.test(previewUrl), previewUrl);
      if (popup) await popup.close().catch(() => {});
      else await page.goBack().catch(() => {});
    } else {
      record("preview_opened", true, "link not on draft — skipped");
    }

    const { data: qAfter } = await admin
      .from("event_questionnaires")
      .select("id, kind, status, sent_at, updated_at")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    const afterFp = (qAfter ?? [])
      .map((q) => `${q.id}:${q.status}:${q.sent_at ?? ""}:${q.updated_at}`)
      .sort()
      .join("|");
    record("questionnaires_unchanged", beforeFp === afterFp, "fingerprint");
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err));
    await page.screenshot({ path: `${SHOTS}/harness-error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const { count: qSentAfter } = await admin
    .from("event_questionnaires")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", FANCY)
    .not("sent_at", "is", null);
  const { count: invitesAfter } = await admin
    .from("client_invitations")
    .select("*", { count: "exact", head: true });
  const { count: notifAfter } = await admin
    .from("notification_log")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", FANCY);

  record("no_new_sent_questionnaires", (qSentAfter ?? 0) === (qSentBefore ?? 0), `b=${qSentBefore} a=${qSentAfter}`);
  record("no_invite_side_effect", (invitesAfter ?? 0) === (invitesBefore ?? 0), `b=${invitesBefore} a=${invitesAfter}`);
  record("no_notification_side_effect", (notifAfter ?? 0) === (notifBefore ?? 0), `b=${notifBefore} a=${notifAfter}`);

  const failed = checks.filter((c) => !c.pass).length;
  const passed = checks.filter((c) => c.pass).length;
  const payload = {
    status: failed === 0 ? "GREEN" : "NOT_GREEN",
    servingSha,
    expectedSha: EXPECTED_SHA,
    clientId,
    eventId,
    passed,
    failed,
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ status: payload.status, passed, failed, servingSha }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
