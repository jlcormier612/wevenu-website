/**
 * Sandbox acceptance: Event Order completeness + read-only client portal preview.
 * Production untouched. Isolated Fancy fixtures only.
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
  let templateId: string | null = null;
  const before: Record<string, unknown> = {};

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
      throw new Error(`serving mismatch serving=${servingSha}`);
    }

    const { data: tmpl } = await admin
      .from("event_order_templates")
      .select("id, name, source_master_key")
      .eq("venue_id", FANCY)
      .eq("source_master_key", "EO-D-02")
      .eq("is_archived", false)
      .maybeSingle();
    templateId = tmpl?.id ?? null;
    record("eo_d02_template_present", !!templateId, JSON.stringify(tmpl));

    const { count: tmplLinesBefore } = await admin
      .from("event_order_template_lines")
      .select("*", { count: "exact", head: true })
      .eq("template_id", templateId!);
    before.templateLines = tmplLinesBefore ?? 0;

    // Prefer a booked Fancy event whose EO is empty or tied to EO-D-02.
    const { data: events } = await admin
      .from("events")
      .select("id, client_id, name, booked_at")
      .eq("venue_id", FANCY)
      .not("client_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(40);

    for (const ev of events ?? []) {
      const { data: eo } = await admin
        .from("event_orders")
        .select("id, template_id, shared_at, status")
        .eq("event_id", ev.id)
        .eq("venue_id", FANCY)
        .maybeSingle();
      if (eo?.shared_at) continue;
      if (eo && eo.status !== "open") continue;
      const { count: lineCount } = eo
        ? await admin.from("event_order_lines").select("*", { count: "exact", head: true }).eq("event_order_id", eo.id)
        : { count: 0 };
      const matchesTpl = !eo || eo.template_id === templateId || (lineCount ?? 0) === 0;
      if (matchesTpl) {
        eventId = ev.id;
        clientId = ev.client_id;
        before.eventOrderId = eo?.id ?? null;
        before.eventLineCount = lineCount ?? 0;
        break;
      }
    }
    record("fixture_event", !!eventId && !!clientId, `event=${eventId} client=${clientId} beforeLines=${before.eventLineCount}`);
    if (!eventId || !clientId) throw new Error("no fixture event");

    const { count: invBefore } = await admin.from("invoices").select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
    const { count: portalBefore } = await admin
      .from("portal_sessions")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);
    before.invoices = invBefore ?? 0;
    before.portalSessions = portalBefore ?? 0;

    const { data: otherEvents } = await admin
      .from("events")
      .select("id")
      .eq("venue_id", FANCY)
      .neq("id", eventId)
      .limit(1);
    const otherEventId = otherEvents?.[0]?.id ?? null;
    let otherEoLinesBefore = 0;
    if (otherEventId) {
      const { data: otherEo } = await admin
        .from("event_orders")
        .select("id")
        .eq("event_id", otherEventId)
        .maybeSingle();
      if (otherEo) {
        const { count } = await admin
          .from("event_order_lines")
          .select("*", { count: "exact", head: true })
          .eq("event_order_id", otherEo.id);
        otherEoLinesBefore = count ?? 0;
      }
    }

    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);

    const previewBtn = page.getByTestId("preview-client-portal");
    const changeEo = page.getByTestId("event-setup-change-event_order");
    // Fallback: text match if testid naming differs
    const changeVisible = await changeEo.isVisible().catch(() => false)
      || await page.getByRole("button", { name: /Change.*Event Order|Edit Event Order/i }).first().isVisible().catch(() => false);
    record("setup_panel_loaded", await page.getByTestId("event-setup-panel").isVisible().catch(() => false)
      || await page.locator("#event-setup").isVisible().catch(() => false), "event-setup");

    if (await previewBtn.isVisible().catch(() => false)) {
      record("preview_entry_visible", true, "preview-client-portal");
    } else {
      record("preview_entry_visible", false, "missing preview button");
    }

    // Open EO Change editor to trigger ensure/heal
    if (await changeEo.isVisible().catch(() => false)) {
      await changeEo.click();
    } else {
      const btn = page.getByRole("button", { name: /Change for this event/i }).first();
      // Prefer the Event Order row Change control
      const eoRow = page.locator('[data-testid="event-setup-step-event_order"], [data-testid*="event_order"]').first();
      if (await eoRow.isVisible().catch(() => false)) {
        await eoRow.getByRole("button", { name: /Change/i }).click().catch(() => {});
      } else if (await btn.isVisible().catch(() => false)) {
        await btn.click();
      }
    }

    const editor = page.getByTestId("event-order-setup-editor");
    await editor.waitFor({ state: "visible", timeout: 20_000 }).catch(() => null);
    record("eo_editor_open", await editor.isVisible().catch(() => false), "event-order-setup-editor");

    // Wait for heal/refresh
    await page.waitForTimeout(4000);
    if (await editor.isVisible().catch(() => false)) {
      // Re-open after refresh if sheet closed
      const linesHost = page.getByTestId("event-order-setup-lines");
      if (!(await linesHost.isVisible().catch(() => false))) {
        await page.waitForTimeout(3000);
      }
      const lineCountUi = await page.locator('[data-testid="event-order-setup-lines"] li').count().catch(() => 0);
      record("eo_editor_shows_lines", lineCountUi >= 5, `uiLines=${lineCountUi}`);
      await page.screenshot({ path: `${OUT}/eo-completeness-editor-1280.png`, fullPage: true });
      await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
    } else {
      record("eo_editor_shows_lines", false, "editor never opened");
    }

    // DB: template repaired + event lines populated
    const { count: tmplLinesAfter } = await admin
      .from("event_order_template_lines")
      .select("*", { count: "exact", head: true })
      .eq("template_id", templateId!);
    record(
      "template_offerings_repaired_or_present",
      (tmplLinesAfter ?? 0) >= 5,
      `before=${before.templateLines} after=${tmplLinesAfter}`,
    );

    const { data: eoAfter } = await admin
      .from("event_orders")
      .select("id, template_id, shared_at, status")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .maybeSingle();
    const { data: eventLines } = eoAfter
      ? await admin.from("event_order_lines").select("id, description, is_included, section_id").eq("event_order_id", eoAfter.id)
      : { data: [] };
    const descriptions = (eventLines ?? []).map((l) => l.description);
    record(
      "event_order_lines_complete",
      (eventLines?.length ?? 0) >= 5,
      `count=${eventLines?.length} sample=${descriptions.slice(0, 8).join(" | ")}`,
    );
    record(
      "optional_not_forced_included",
      (eventLines ?? []).some((l) => l.is_included === false) || (eventLines?.length ?? 0) === 0,
      `included=${(eventLines ?? []).filter((l) => l.is_included).length} additional=${(eventLines ?? []).filter((l) => !l.is_included).length}`,
    );
    record("eo_not_shared_by_preview_or_edit", !eoAfter?.shared_at, `shared_at=${eoAfter?.shared_at}`);

    // Portal preview
    await page.goto(`${APP}/clients/${clientId}/portal-preview?event=${eventId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(2500);
    const previewRoot = page.getByTestId("client-portal-preview");
    record("preview_page_loaded", await previewRoot.isVisible().catch(() => false), await page.title());
    const draftBadge = await page.getByText("Preview — not yet released").first().isVisible().catch(() => false);
    record("preview_draft_badge", draftBadge, "Preview — not yet released");

    await page.getByTestId("portal-preview-tab-event-order").click().catch(() => {});
    await page.waitForTimeout(500);
    const eoSection = page.getByTestId("portal-preview-event-order");
    const previewText = await eoSection.innerText().catch(() => "");
    const previewShowsOffering = descriptions.slice(0, 3).some((d) => previewText.includes(d));
    record("preview_shows_event_order_lines", previewShowsOffering || (eventLines?.length ?? 0) === 0, previewText.slice(0, 240));
    await page.screenshot({ path: `${OUT}/portal-preview-event-order-1280.png`, fullPage: true });

    await page.getByTestId("portal-preview-tab-floor-plans").click().catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/portal-preview-floor-plans-1280.png`, fullPage: true });
    record(
      "preview_floor_plans_section",
      await page.getByTestId("portal-preview-floor-plans").isVisible().catch(() => false),
      "floor-plans tab",
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${OUT}/portal-preview-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByTestId("portal-preview-back").click().catch(() => {});
    await page.waitForTimeout(1500);
    record(
      "preview_return_to_booking",
      page.url().includes(`/clients/${clientId}`) && !page.url().includes("portal-preview"),
      page.url(),
    );

    // Side effects
    const { count: invAfter } = await admin.from("invoices").select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
    const { count: portalAfter } = await admin
      .from("portal_sessions")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);
    record("no_invoice_side_effect", invAfter === before.invoices, `before=${before.invoices} after=${invAfter}`);
    record("no_portal_session_side_effect", portalAfter === before.portalSessions, `before=${before.portalSessions} after=${portalAfter}`);

    if (otherEventId) {
      const { data: otherEo } = await admin.from("event_orders").select("id").eq("event_id", otherEventId).maybeSingle();
      let otherAfter = 0;
      if (otherEo) {
        const { count } = await admin.from("event_order_lines").select("*", { count: "exact", head: true }).eq("event_order_id", otherEo.id);
        otherAfter = count ?? 0;
      }
      record("cross_event_isolation", otherAfter === otherEoLinesBefore, `otherBefore=${otherEoLinesBefore} after=${otherAfter}`);
    } else {
      record("cross_event_isolation", true, "no other event to compare");
    }

    // Library template not wiped / still EO-D-02
    const { data: tmplAfter } = await admin
      .from("event_order_templates")
      .select("id, name, source_master_key, is_archived")
      .eq("id", templateId!)
      .single();
    record(
      "library_template_intact",
      tmplAfter?.source_master_key === "EO-D-02" && tmplAfter?.is_archived === false,
      JSON.stringify(tmplAfter),
    );

    // Re-open editor: no duplicate explosion
    const lineCount1 = eventLines?.length ?? 0;
    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    if (await page.getByTestId("event-setup-change-event_order").isVisible().catch(() => false)) {
      await page.getByTestId("event-setup-change-event_order").click();
      await page.waitForTimeout(3500);
      await page.keyboard.press("Escape").catch(() => {});
    }
    const { data: eoReload } = await admin.from("event_orders").select("id").eq("event_id", eventId).maybeSingle();
    const { count: lineCount2 } = eoReload
      ? await admin.from("event_order_lines").select("*", { count: "exact", head: true }).eq("event_order_id", eoReload.id)
      : { count: 0 };
    record("no_duplicate_on_reopen", lineCount2 === lineCount1 || lineCount1 === 0, `first=${lineCount1} reopen=${lineCount2}`);

  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err));
    await page.screenshot({ path: `${OUT}/eo-preview-harness-error.png`, fullPage: true }).catch(() => {});
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
    templateId,
    before,
    passed,
    failed,
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/eo-portal-preview-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ status: payload.status, passed, failed, servingSha, eventId }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
