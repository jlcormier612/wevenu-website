/**
 * Sandbox: staff Client Portal Preview fidelity vs couple portal + read-only proof.
 * Production untouched. Fancy venue only. No invites/emails sent.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
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
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "afbd0dff516dbda3057dc056475ea96b0c9adcc5";
const OUT = "docs/qa/booking-to-portal-simplification";
const SHOTS = `${OUT}/portal-preview-fidelity-shots`;
mkdirSync(SHOTS, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 900) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 320)}`);
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("staff session");
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

const TABS = ["event-order", "floor-plans", "planning", "inventory", "vendors"] as const;

async function snapTab(page: import("playwright").Page, tab: string, width: number) {
  await page.getByTestId(`portal-preview-tab-${tab}`).click();
  await page.waitForTimeout(600);
  const path = `${SHOTS}/preview-${tab}-${width}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function main() {
  let servingSha: string | null = null;
  let eventId: string | null = null;
  let clientId: string | null = null;
  let portalToken: string | null = null;
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  const browser = await chromium.launch({ headless: true });
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await staffCtx.addCookies(await staffCookies());
  const page = await staffCtx.newPage();

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

    // Prefer booked Fancy event with the most client-visible surface area.
    const { data: events } = await admin
      .from("events")
      .select("id, client_id, name, booked_at")
      .eq("venue_id", FANCY)
      .not("client_id", "is", null)
      .not("booked_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(60);

    let bestScore = -1;
    for (const ev of events ?? []) {
      let score = 0;
      const { data: eo } = await admin
        .from("event_orders")
        .select("id, shared_at")
        .eq("event_id", ev.id)
        .eq("venue_id", FANCY)
        .maybeSingle();
      if (eo) score += 1;
      if (eo?.shared_at) score += 2;
      const { count: invCount } = await admin
        .from("event_inventory")
        .select("*", { count: "exact", head: true })
        .eq("event_id", ev.id);
      if ((invCount ?? 0) > 0) score += 1;
      const { count: recCount } = await admin
        .from("event_vendor_recommendations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", ev.id)
        .eq("venue_id", FANCY);
      if ((recCount ?? 0) > 0) score += 3;
      const { count: coupleTasks } = await admin
        .from("event_tasks")
        .select("*", { count: "exact", head: true })
        .eq("event_id", ev.id)
        .eq("owner_type", "couple");
      if ((coupleTasks ?? 0) > 0) score += 2;
      const { count: sharedFp } = await admin
        .from("floor_plans")
        .select("*", { count: "exact", head: true })
        .eq("event_id", ev.id)
        .eq("shared_with_couple", true);
      if ((sharedFp ?? 0) > 0) score += 2;
      const { count: offers } = await admin
        .from("event_floor_plan_offers")
        .select("*", { count: "exact", head: true })
        .eq("event_id", ev.id);
      if ((offers ?? 0) > 0) score += 1;
      if (score > bestScore) {
        bestScore = score;
        eventId = ev.id;
        clientId = ev.client_id;
      }
    }
    record("fixture_event", !!eventId && !!clientId, `event=${eventId} client=${clientId} score=${bestScore}`);
    if (!eventId || !clientId) throw new Error("no fixture");

    // Before snapshot — read-only proof
    const { count: invBefore } = await admin.from("invoices").select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
    const { count: portalSessBefore } = await admin
      .from("client_portal_sessions")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);
    const { count: invitesBefore } = await admin
      .from("client_invitations")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);
    const { count: notifBefore } = await admin
      .from("notification_log")
      .select("*", { count: "exact", head: true })
      .eq("venue_id", FANCY);
    const { data: eoBefore } = await admin
      .from("event_orders")
      .select("id, shared_at, revision, status")
      .eq("event_id", eventId)
      .maybeSingle();
    const { data: invRowBefore } = await admin
      .from("event_inventory")
      .select("id, status, shared_at, finalized_at")
      .eq("event_id", eventId)
      .maybeSingle();
    const { count: recsBefore } = await admin
      .from("event_vendor_recommendations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    const { count: tasksBefore } = await admin
      .from("event_tasks")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    const { count: tmplBefore } = await admin
      .from("event_order_templates")
      .select("*", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("is_archived", false);
    before.invoices = invBefore ?? 0;
    before.portalSessions = portalSessBefore ?? 0;
    before.invites = invitesBefore ?? 0;
    before.notificationLog = notifBefore ?? 0;
    before.eo = eoBefore;
    before.inventory = invRowBefore;
    before.recs = recsBefore ?? 0;
    before.tasks = tasksBefore ?? 0;
    before.templates = tmplBefore ?? 0;

    // Venue-owned tasks must never appear in preview copy
    const { data: venueTasks } = await admin
      .from("event_tasks")
      .select("id, title")
      .eq("event_id", eventId)
      .eq("owner_type", "venue")
      .limit(20);
    const venueTaskTitles = (venueTasks ?? []).map((t) => t.title).filter(Boolean);

    const { data: coupleTasks } = await admin
      .from("event_tasks")
      .select("id, title, due_date, status, visibility")
      .eq("event_id", eventId)
      .eq("owner_type", "couple")
      .in("visibility", ["client_visible", "client_owned"])
      .limit(40);

    const { data: recRows } = await admin
      .from("event_vendor_recommendations")
      .select("id, vendor_id, vendors(business_name)")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .limit(20);

    await page.goto(`${APP}/clients/${clientId}/portal-preview?event=${eventId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(2500);

    const previewRoot = page.getByTestId("client-portal-preview");
    record("preview_loaded", await previewRoot.isVisible().catch(() => false), await page.title());
    record(
      "preview_banner_safety",
      (await page.getByTestId("portal-preview-safety-note").innerText().catch(() => "")).includes("Preview only"),
      "safety note",
    );
    record(
      "preview_back_link",
      await page.getByTestId("portal-preview-back").isVisible().catch(() => false),
      "portal-preview-back",
    );

    // Shared presentation markers
    for (const tab of TABS) {
      await page.getByTestId(`portal-preview-tab-${tab}`).click();
      await page.waitForTimeout(500);
      const section = page.getByTestId(`portal-preview-${tab}`);
      record(`tab_${tab}_section`, await section.isVisible().catch(() => false), `portal-preview-${tab}`);
      await snapTab(page, tab, 1280);
    }

    // Event Order presentation
    await page.getByTestId("portal-preview-tab-event-order").click();
    await page.waitForTimeout(400);
    const eoEmpty = await page.getByTestId("event-order-portal-empty").isVisible().catch(() => false);
    const eoView = await page.getByTestId("event-order-portal-view").isVisible().catch(() => false);
    record("eo_uses_portal_view", eoEmpty || eoView, `empty=${eoEmpty} view=${eoView}`);

    // Inventory
    await page.getByTestId("portal-preview-tab-inventory").click();
    await page.waitForTimeout(400);
    const invEmpty = await page.getByTestId("inventory-portal-empty").isVisible().catch(() => false);
    const invView = await page.getByTestId("inventory-portal-view").isVisible().catch(() => false);
    record("inventory_uses_portal_view", invEmpty || invView, `empty=${invEmpty} view=${invView}`);

    // Floor plans — must not show unshared operational-only as released
    await page.getByTestId("portal-preview-tab-floor-plans").click();
    await page.waitForTimeout(400);
    const fpEmpty = await page.getByTestId("floor-plan-portal-empty").isVisible().catch(() => false);
    const fpView = await page.getByTestId("floor-plan-portal-view").isVisible().catch(() => false);
    record("floor_uses_portal_view", fpEmpty || fpView, `empty=${fpEmpty} view=${fpView}`);
    const fpBody = await page.getByTestId("portal-preview-floor-plans").innerText().catch(() => "");
    const chooseMutating = /Choose this layout(?! \(preview only\))/i.test(fpBody.replace(/Choose this layout \(preview only\)/gi, ""));
    record("floor_no_mutating_choose", !chooseMutating, fpBody.slice(0, 200));

    // Planning — couple tasks + due labels; never venue titles
    await page.getByTestId("portal-preview-tab-planning").click();
    await page.waitForTimeout(400);
    const planEmpty = await page.getByTestId("planning-portal-empty").isVisible().catch(() => false);
    const planView = await page.getByTestId("planning-portal-view").first().isVisible().catch(() => false);
    record("planning_uses_portal_view", planEmpty || planView, `empty=${planEmpty} view=${planView}`);
    const planText = await page.getByTestId("portal-preview-planning").innerText().catch(() => "");
    const leakedVenue = venueTaskTitles.filter((t) => t.length > 3 && planText.includes(t));
    record("planning_no_venue_task_leak", leakedVenue.length === 0, leakedVenue.slice(0, 5).join(" | ") || "none");
    if ((coupleTasks?.length ?? 0) > 0) {
      const sample = coupleTasks![0];
      const showsTitle = planText.includes(sample.title);
      record("planning_shows_couple_task_when_present", showsTitle || planEmpty, sample.title);
    } else {
      record("planning_shows_couple_task_when_present", true, "no couple tasks on fixture");
    }

    // Vendors
    await page.getByTestId("portal-preview-tab-vendors").click();
    await page.waitForTimeout(400);
    const vendEmpty = await page.getByTestId("vendors-portal-empty").isVisible().catch(() => false);
    const vendView = await page.getByTestId("vendors-portal-view").isVisible().catch(() => false);
    record("vendors_uses_portal_view", vendEmpty || vendView, `empty=${vendEmpty} view=${vendView}`);
    const vendText = await page.getByTestId("portal-preview-vendors").innerText().catch(() => "");
    if ((recRows?.length ?? 0) > 0) {
      const names = (recRows ?? []).map((r) => {
        const v = r.vendors as { business_name?: string } | null;
        return v?.business_name ?? "";
      }).filter(Boolean);
      const shown = names.filter((n) => vendText.includes(n));
      record(
        "vendors_show_when_configured",
        shown.length > 0 && !vendEmpty,
        `shown=${shown.slice(0, 3).join("|")} empty=${vendEmpty}`,
      );
    } else {
      record(
        "vendors_intentional_empty",
        vendEmpty && /No preferred vendors yet/i.test(vendText),
        vendText.slice(0, 180),
      );
    }

    // Narrow viewport
    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of TABS) {
      await snapTab(page, tab, 390);
    }
    record("narrow_screenshots", true, "390px all tabs");
    await page.setViewportSize({ width: 1280, height: 900 });

    // Return to booking
    const back = page.getByTestId("portal-preview-back");
    const backHref = await back.getAttribute("href").catch(() => null);
    await Promise.all([
      page.waitForURL(
        (u) => u.pathname === `/clients/${clientId}` || (u.pathname.includes(`/clients/${clientId}`) && !u.pathname.includes("portal-preview")),
        { timeout: 15_000 },
      ).catch(() => null),
      back.click({ force: true }),
    ]);
    await page.waitForTimeout(1500);
    if (page.url().includes("portal-preview") && backHref) {
      await page.goto(`${APP}${backHref}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(1000);
    }
    record(
      "return_to_booking",
      page.url().includes(`/clients/${clientId}`) && !page.url().includes("portal-preview"),
      `href=${backHref} url=${page.url()}`,
    );

    // Side-by-side couple portal (temp session — no invitation email)
    portalToken = `ppfid_${Date.now()}_${randomBytes(3).toString("hex")}`;
    const { error: sessErr } = await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: clientId,
      access_token: portalToken,
      access_level: "couple",
      label: "Portal preview fidelity proof",
      expires_at: new Date(Date.now() + 2 * 864e5).toISOString(),
    });
    record("portal_session_insert_for_compare", !sessErr, sessErr?.message ?? portalToken);

    if (!sessErr && portalToken) {
      const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const couplePage = await coupleCtx.newPage();
      try {
        await couplePage.goto(`${APP}/p/${portalToken}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
        await couplePage.waitForTimeout(1500);
        for (let attempt = 0; attempt < 3; attempt++) {
          const welcome = couplePage.locator('[data-welcome-experience="true"]');
          if (!(await welcome.isVisible().catch(() => false))) break;
          const agree = couplePage.getByRole("checkbox");
          if (await agree.isVisible().catch(() => false)) {
            await agree.check({ force: true }).catch(async () => {
              await agree.click({ force: true });
            });
          }
          const cont = couplePage.getByRole("button", { name: /^(Continue|Saving)/i });
          if (await cont.isVisible().catch(() => false)) {
            const label = await cont.innerText().catch(() => "");
            if (/Continue/i.test(label)) await cont.click().catch(() => undefined);
          }
          await couplePage.waitForTimeout(2000);
        }

        const hashes = ["event_order", "floor_plans", "planning", "inventory", "vendors"] as const;
        for (const hash of hashes) {
          await couplePage.goto(`${APP}/p/${portalToken}#${hash}`, {
            waitUntil: "domcontentloaded",
            timeout: 90_000,
          });
          await couplePage.waitForTimeout(1800);
          await couplePage.screenshot({
            path: `${SHOTS}/couple-${hash}-1280.png`,
            fullPage: true,
          }).catch(() => {});
          const body = await couplePage.locator("body").innerText().catch(() => "");
          const pastWelcome = !/Before continuing, please review/i.test(body);
          record(
            `couple_portal_${hash}_loaded`,
            body.length > 40 && pastWelcome,
            body.slice(0, 160).replace(/\s+/g, " "),
          );
        }

        // Compare EO: if shared, both should show same line descriptions from snapshot
        if (eoBefore?.shared_at) {
          const { data: snap } = await admin
            .from("event_order_share_snapshots")
            .select("payload")
            .eq("event_order_id", eoBefore.id)
            .order("shared_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const lines = (snap?.payload as { lines?: Array<{ description?: string }> } | null)?.lines ?? [];
          const sampleDesc = lines.map((l) => l.description).filter(Boolean).slice(0, 3) as string[];
          await page.goto(`${APP}/clients/${clientId}/portal-preview?event=${eventId}`, {
            waitUntil: "domcontentloaded",
            timeout: 90_000,
          });
          await page.waitForTimeout(1500);
          await page.getByTestId("portal-preview-tab-event-order").click();
          await page.waitForTimeout(400);
          const previewEo = await page.getByTestId("portal-preview-event-order").innerText();
          await couplePage.goto(`${APP}/p/${portalToken}#event_order`, {
            waitUntil: "domcontentloaded",
            timeout: 90_000,
          });
          await couplePage.waitForTimeout(1500);
          const coupleEo = await couplePage.locator("body").innerText();
          const matchCount = sampleDesc.filter((d) => previewEo.includes(d!) && coupleEo.includes(d!)).length;
          record(
            "eo_side_by_side_shared_lines",
            sampleDesc.length === 0 || matchCount === sampleDesc.length,
            `matched=${matchCount}/${sampleDesc.length} samples=${sampleDesc.join(" | ")}`,
          );
        } else {
          record("eo_side_by_side_shared_lines", true, "EO not shared — draft overlay expected in preview only");
        }
      } finally {
        await coupleCtx.close();
      }
    }

    // After snapshot
    const { count: invAfter } = await admin.from("invoices").select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
    const { count: invitesAfter } = await admin
      .from("client_invitations")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);
    const { count: notifAfter } = await admin
      .from("notification_log")
      .select("*", { count: "exact", head: true })
      .eq("venue_id", FANCY);
    const { data: eoAfter } = await admin
      .from("event_orders")
      .select("id, shared_at, revision, status")
      .eq("event_id", eventId)
      .maybeSingle();
    const { data: invRowAfter } = await admin
      .from("event_inventory")
      .select("id, status, shared_at, finalized_at")
      .eq("event_id", eventId)
      .maybeSingle();
    const { count: recsAfter } = await admin
      .from("event_vendor_recommendations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    const { count: tasksAfter } = await admin
      .from("event_tasks")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    const { count: tmplAfter } = await admin
      .from("event_order_templates")
      .select("*", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("is_archived", false);
    const { count: portalSessAfter } = await admin
      .from("client_portal_sessions")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);

    after.invoices = invAfter ?? 0;
    after.invites = invitesAfter ?? 0;
    after.notificationLog = notifAfter ?? 0;
    after.eo = eoAfter;
    after.inventory = invRowAfter;
    after.recs = recsAfter ?? 0;
    after.tasks = tasksAfter ?? 0;
    after.templates = tmplAfter ?? 0;
    after.portalSessions = portalSessAfter ?? 0;

    record("no_invoice_mutation", after.invoices === before.invoices, `b=${before.invoices} a=${after.invoices}`);
    record("no_invite_mutation", after.invites === before.invites, `b=${before.invites} a=${after.invites}`);
    record(
      "no_notification_log_mutation",
      after.notificationLog === before.notificationLog,
      `b=${before.notificationLog} a=${after.notificationLog}`,
    );
    record(
      "no_eo_share_mutation",
      JSON.stringify(after.eo) === JSON.stringify(before.eo),
      `b=${JSON.stringify(before.eo)} a=${JSON.stringify(after.eo)}`,
    );
    record(
      "no_inventory_status_mutation",
      JSON.stringify(after.inventory) === JSON.stringify(before.inventory),
      `b=${JSON.stringify(before.inventory)} a=${JSON.stringify(after.inventory)}`,
    );
    record("no_recs_seed_mutation", after.recs === before.recs, `b=${before.recs} a=${after.recs}`);
    record("no_task_mutation", after.tasks === before.tasks, `b=${before.tasks} a=${after.tasks}`);
    record("library_templates_intact", after.templates === before.templates, `b=${before.templates} a=${after.templates}`);
    // Portal session: allow +1 for our intentional compare insert
    const sessDelta = (after.portalSessions as number) - (before.portalSessions as number);
    record(
      "portal_sessions_only_qa_insert",
      sessDelta === 0 || sessDelta === 1,
      `delta=${sessDelta} (0=no insert path, 1=qa compare token)`,
    );
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err));
    await page.screenshot({ path: `${SHOTS}/harness-error.png`, fullPage: true }).catch(() => {});
  } finally {
    if (portalToken) {
      await admin.from("client_portal_sessions").delete().eq("access_token", portalToken);
    }
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
    before,
    after,
    passed,
    failed,
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/portal-preview-fidelity-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ status: payload.status, passed, failed, servingSha, eventId }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
