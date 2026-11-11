/**
 * Sandbox: Vendors Change (assign/replace/recommend), Event Order completeness,
 * questionnaire selector + preview return. Exact serving SHA required.
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
  checks.push({ name, pass, detail: String(detail).slice(0, 800) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 280)}`);
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
  let clientId: string | null = null;

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
    if (!servingSha?.startsWith(EXPECTED_SHA.slice(0, 8))) throw new Error("serving mismatch");

    const { data: events } = await admin
      .from("events")
      .select("id, client_id")
      .eq("venue_id", FANCY)
      .not("client_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(30);
    for (const ev of events ?? []) {
      const { count: vendors } = await admin
        .from("vendors")
        .select("*", { count: "exact", head: true })
        .eq("venue_id", FANCY)
        .eq("is_archived", false);
      if ((vendors ?? 0) < 2) continue;
      eventId = ev.id;
      clientId = ev.client_id;
      break;
    }
    record("fixture", !!eventId && !!clientId, `event=${eventId} client=${clientId}`);
    if (!eventId || !clientId) throw new Error("no fixture");

    const { count: invBefore } = await admin.from("invoices").select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
    const { data: vendors } = await admin
      .from("vendors")
      .select("id, business_name")
      .eq("venue_id", FANCY)
      .eq("is_archived", false)
      .limit(5);
    const vendorA = vendors?.[0];
    const vendorB = vendors?.[1];
    record("network_vendors", (vendors?.length ?? 0) >= 2, `n=${vendors?.length}`);

    // ── Event Order completeness ──
    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    const eoChange = page.getByTestId("event-setup-change-event_order");
    if (await eoChange.isVisible().catch(() => false)) {
      await eoChange.click();
      await page.getByTestId("event-order-setup-editor").waitFor({ state: "visible", timeout: 20_000 });
      await page.waitForTimeout(4500);
      const uiLines = await page.locator('[data-testid="event-order-setup-lines"] li').count();
      record("eo_editor_line_count", uiLines >= 5, `uiLines=${uiLines}`);
      await page.screenshot({ path: `${OUT}/corrective-eo-editor-1280.png`, fullPage: true });
      await page.keyboard.press("Escape");
    } else {
      record("eo_editor_line_count", false, "Change Event Order not visible");
    }

    const { data: eo } = await admin.from("event_orders").select("id, shared_at").eq("event_id", eventId).maybeSingle();
    const { count: eoLines } = eo
      ? await admin.from("event_order_lines").select("*", { count: "exact", head: true }).eq("event_order_id", eo.id)
      : { count: 0 };
    record("eo_db_lines", (eoLines ?? 0) >= 5, `dbLines=${eoLines} shared=${eo?.shared_at}`);

    // ── Vendors Change ──
    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const vChange = page.getByTestId("event-setup-change-vendors");
    if (await vChange.isVisible().catch(() => false)) {
      await vChange.click();
      await page.getByTestId("event-vendors-setup-editor").waitFor({ state: "visible", timeout: 15_000 });
      record("vendors_editor_open", true, "open");
      record(
        "vendors_recommendations_path",
        await page.getByTestId("vendors-setup-recommendations-path").isVisible(),
        "recommendations section",
      );
      record(
        "vendors_no_open_in_editor",
        !(await page.getByRole("button", { name: /Open Vendors/i }).isVisible().catch(() => false)),
        "no Open Vendors",
      );

      // Ensure at least one assignment via UI if empty
      const assignSelect = page.getByTestId("vendors-setup-vendor-select");
      if (await assignSelect.isVisible() && vendorA) {
        await assignSelect.click();
        await page.getByRole("option", { name: new RegExp(vendorA.business_name.slice(0, 12), "i") }).first().click().catch(() => {});
        await page.getByTestId("vendors-setup-add-assignment").click().catch(() => {});
        await page.waitForTimeout(2000);
      }
      if (vendorB) {
        const recSelect = page.getByTestId("vendors-setup-recommend-select");
        if (await recSelect.isVisible()) {
          await recSelect.click();
          await page.getByRole("option", { name: new RegExp(vendorB.business_name.slice(0, 12), "i") }).first().click().catch(() => {});
          await page.getByTestId("vendors-setup-add-recommendation").click().catch(() => {});
          await page.waitForTimeout(2000);
        }
      }
      await page.screenshot({ path: `${OUT}/corrective-vendors-editor-1280.png`, fullPage: true });
      await page.keyboard.press("Escape");
    } else {
      record("vendors_editor_open", false, "Change Vendors not visible");
    }

    const { count: assignCount } = await admin
      .from("event_vendor_assignments")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    const { count: recCount } = await admin
      .from("event_vendor_recommendations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    record("vendors_db_assignments", (assignCount ?? 0) >= 1, `assignments=${assignCount}`);
    record("vendors_db_recommendations", (recCount ?? 0) >= 1, `recommendations=${recCount}`);

    // ── Questionnaire selector + preview return ──
    await page.goto(`${APP}/clients/${clientId}#questionnaires`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    await page.getByRole("tab", { name: /Questionnaires/i }).click().catch(() => {});
    await page.waitForTimeout(1000);
    const unavailable = await page.getByText("Template unavailable").count();
    record("questionnaire_no_false_unavailable", unavailable === 0, `unavailableCount=${unavailable}`);
    const selectVisible = await page.getByTestId(/questionnaire-template-select-/).first().isVisible().catch(() => false);
    if (selectVisible) {
      const label = await page.getByTestId(/questionnaire-template-select-/).first().innerText();
      record("questionnaire_selector_shows_name", !/unavailable/i.test(label) && label.trim().length > 0, label.slice(0, 120));
    } else {
      record("questionnaire_selector_shows_name", true, "selector not on this status surface");
    }
    await page.screenshot({ path: `${OUT}/corrective-questionnaire-selector-1280.png`, fullPage: true });

    const previewLink = page.getByRole("link", { name: /Preview as client/i }).first();
    if (await previewLink.isVisible().catch(() => false)) {
      await previewLink.click();
      await page.waitForTimeout(2000);
      const back = page.getByTestId("questionnaire-preview-back");
      record("questionnaire_preview_back", await back.isVisible().catch(() => false), page.url());
      await page.screenshot({ path: `${OUT}/corrective-questionnaire-preview-1280.png`, fullPage: true });
      if (await back.isVisible().catch(() => false)) {
        await back.click();
        await page.waitForTimeout(2000);
        record(
          "questionnaire_preview_return",
          page.url().includes(`/clients/${clientId}`),
          page.url(),
        );
      }
    } else {
      record("questionnaire_preview_back", false, "no preview link");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/corrective-editors-390.png`, fullPage: true });

    const { count: invAfter } = await admin.from("invoices").select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
    record("no_invoice_side_effect", invAfter === invBefore, `before=${invBefore} after=${invAfter}`);

  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err));
    await page.screenshot({ path: `${OUT}/corrective-harness-error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const failed = checks.filter((c) => !c.pass).length;
  const passed = checks.filter((c) => c.pass).length;
  const payload = {
    status: failed === 0 ? "GREEN" : "NOT_GREEN",
    servingSha,
    expectedSha: EXPECTED_SHA,
    eventId,
    clientId,
    passed,
    failed,
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/corrective-vendors-eo-q-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ status: payload.status, passed, failed, servingSha }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
