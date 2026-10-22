/**
 * Sandbox: Planning responsibility groups + Floor Plans workspace nav (no auto-designer redirect).
 * Fancy only. No invites/emails. Production untouched.
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
const SHOTS = `${OUT}/planning-floor-nav-shots`;
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
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
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

    // Prefer booked Fancy event with couple + venue (+ vendor if any) tasks and a floor plan.
    const { data: events } = await admin
      .from("events")
      .select("id, client_id, name, operational_floor_plan_id, couple_selected_floor_plan_id")
      .eq("venue_id", FANCY)
      .not("client_id", "is", null)
      .not("booked_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    let best = -1;
    for (const ev of events ?? []) {
      let score = 0;
      const { count: couple } = await admin.from("event_tasks").select("*", { count: "exact", head: true })
        .eq("event_id", ev.id).eq("owner_type", "couple");
      const { count: venue } = await admin.from("event_tasks").select("*", { count: "exact", head: true })
        .eq("event_id", ev.id).in("owner_type", ["coordinator", "team"]);
      const { count: vendor } = await admin.from("event_tasks").select("*", { count: "exact", head: true })
        .eq("event_id", ev.id).eq("owner_type", "vendor");
      if ((couple ?? 0) > 0) score += 3;
      if ((venue ?? 0) > 0) score += 3;
      if ((vendor ?? 0) > 0) score += 2;
      if (ev.operational_floor_plan_id) score += 2;
      if (score > best) {
        best = score;
        eventId = ev.id;
        clientId = ev.client_id;
      }
    }
    record("fixture", !!eventId && !!clientId, `event=${eventId} client=${clientId} score=${best}`);
    if (!eventId || !clientId) throw new Error("no fixture");

    const { data: taskRows } = await admin
      .from("event_tasks")
      .select("id, title, owner_type, status, due_date, days_offset")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    const byOwner = {
      couple: (taskRows ?? []).filter((t) => t.owner_type === "couple"),
      venue: (taskRows ?? []).filter((t) => t.owner_type === "coordinator" || t.owner_type === "team"),
      vendor: (taskRows ?? []).filter((t) => t.owner_type === "vendor"),
    };
    before.taskCount = taskRows?.length ?? 0;
    before.taskFingerprint = (taskRows ?? [])
      .map((t) => `${t.id}:${t.status}:${t.due_date}:${t.owner_type}`)
      .sort()
      .join("|");

    const { data: evBefore } = await admin
      .from("events")
      .select("operational_floor_plan_id, couple_selected_floor_plan_id")
      .eq("id", eventId)
      .single();
    const { count: plansBefore } = await admin.from("floor_plans").select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    const { count: offersBefore } = await admin.from("event_floor_plan_offers").select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    const { count: invBefore } = await admin.from("invoices").select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
    const { count: invitesBefore } = await admin.from("client_invitations").select("*", { count: "exact", head: true })
      .eq("client_id", clientId);
    before.operational = evBefore?.operational_floor_plan_id ?? null;
    before.coupleSelected = evBefore?.couple_selected_floor_plan_id ?? null;
    before.plans = plansBefore ?? 0;
    before.offers = offersBefore ?? 0;
    before.invoices = invBefore ?? 0;
    before.invites = invitesBefore ?? 0;

    // ── Planning responsibility ──────────────────────────────────────────
    await page.goto(`${APP}/clients/${clientId}#playbook`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2800);
    const planningTab = page.getByRole("tab", { name: /^Planning$/i }).or(page.getByTestId("tab-playbook"));
    if (await page.getByRole("tab", { name: /^Planning$/i }).isVisible().catch(() => false)) {
      await page.getByRole("tab", { name: /^Planning$/i }).click();
    } else {
      await page.goto(`${APP}/clients/${clientId}#playbook`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    }
    await page.waitForTimeout(2000);

    const list = page.getByTestId("planning-task-list");
    record("planning_list_visible", await list.isVisible().catch(() => false), "planning-task-list");

    const clientSec = page.getByTestId("planning-responsibility-client");
    const venueSec = page.getByTestId("planning-responsibility-venue");
    const vendorSec = page.getByTestId("planning-responsibility-vendor");

    if (byOwner.couple.length > 0) {
      record("client_section_visible", await clientSec.isVisible().catch(() => false), `dbCouple=${byOwner.couple.length}`);
      const clientText = await clientSec.innerText().catch(() => "");
      const sample = byOwner.couple[0]?.title ?? "";
      record("client_task_in_client_section", !sample || clientText.includes(sample), sample);
      // Venue section must not contain a couple title that isn't also a venue title
      if (await venueSec.isVisible().catch(() => false)) {
        const venueText = await venueSec.innerText().catch(() => "");
        const leaked = byOwner.couple.filter((t) => t.title && t.title.length > 4 && venueText.includes(t.title)
          && !byOwner.venue.some((v) => v.title === t.title));
        record("couple_not_in_venue_section", leaked.length === 0, leaked.map((t) => t.title).slice(0, 3).join("|") || "ok");
      } else {
        record("couple_not_in_venue_section", true, "no venue section");
      }
    } else {
      record("client_section_visible", !(await clientSec.isVisible().catch(() => false)), "no couple tasks — section hidden");
    }

    if (byOwner.venue.length > 0) {
      record("venue_section_visible", await venueSec.isVisible().catch(() => false), `dbVenue=${byOwner.venue.length}`);
      const venueText = await venueSec.innerText().catch(() => "");
      const sample = byOwner.venue[0]?.title ?? "";
      record("venue_task_in_venue_section", !sample || venueText.includes(sample), sample);
    } else {
      record("venue_section_visible", !(await venueSec.isVisible().catch(() => false)), "no venue tasks — section hidden");
    }

    if (byOwner.vendor.length > 0) {
      record("vendor_section_visible", await vendorSec.isVisible().catch(() => false), `dbVendor=${byOwner.vendor.length}`);
    } else {
      record("vendor_section_absent_ok", !(await vendorSec.isVisible().catch(() => false)), "no vendor tasks");
    }

    const listedAttr = await list.getAttribute("data-total-tasks");
    record(
      "planning_total_matches_db",
      Number(listedAttr) === (taskRows?.length ?? 0),
      `attr=${listedAttr} db=${taskRows?.length}`,
    );

    await page.screenshot({ path: `${SHOTS}/planning-responsibility-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${SHOTS}/planning-responsibility-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    // ── Floor Plans nav ──────────────────────────────────────────────────
    await page.goto(`${APP}/clients/${clientId}#floorplan`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);
    if (await page.getByRole("tab", { name: /Floor Plans/i }).isVisible().catch(() => false)) {
      await page.getByRole("tab", { name: /Floor Plans/i }).click();
      await page.waitForTimeout(2000);
    }

    // Must stay on client booking — not jump to /events/.../floor-plans/:id
    await page.waitForTimeout(2500);
    const afterTabUrl = page.url();
    const stayedOnBooking = afterTabUrl.includes(`/clients/${clientId}`) && !/\/floor-plans\/[0-9a-f-]{36}/i.test(afterTabUrl);
    record("floor_tab_no_auto_designer_redirect", stayedOnBooking, afterTabUrl);

    const workspace = page.getByTestId("floor-plan-operational-workspace");
    record("floor_workspace_visible", await workspace.isVisible().catch(() => false), "floor-plan-operational-workspace");

    const statusStrip = page.getByTestId("floor-plan-selection-status");
    record("floor_selection_status_visible", await statusStrip.isVisible().catch(() => false), await statusStrip.innerText().catch(() => ""));

    if (before.coupleSelected) {
      record(
        "floor_client_selected_truthful",
        await page.getByTestId("floor-plan-client-selected").isVisible().catch(() => false),
        String(before.coupleSelected),
      );
    } else {
      const pending = await page.getByTestId("floor-plan-client-pending").isVisible().catch(() => false);
      const sole = await page.getByTestId("floor-plan-sole-offer-working").isVisible().catch(() => false);
      const none = await page.getByTestId("floor-plan-no-offers-status").isVisible().catch(() => false);
      record("floor_no_false_client_selection", pending || sole || none || !(await statusStrip.isVisible().catch(() => false)), "no couple_selected");
    }

    await page.screenshot({ path: `${SHOTS}/floor-workspace-1280.png`, fullPage: true });

    // Open designer via working card if present, then back
    const workingCard = page.getByTestId("floor-plan-working-card");
    if (await workingCard.isVisible().catch(() => false)) {
      const openLink = workingCard.locator("a").first();
      if (await openLink.isVisible().catch(() => false)) {
        await openLink.click();
        await page.waitForTimeout(2500);
        record(
          "designer_opened_explicitly",
          /\/floor-plans\/[0-9a-f-]{36}/i.test(page.url()),
          page.url(),
        );
        await page.waitForSelector('[data-testid="business-asset-back"], text=Back to Floor Plans', {
          timeout: 15_000,
        }).catch(() => null);
        const back = page.getByTestId("business-asset-back");
        const backFallback = page.locator(`a[href*="#floorplan"]`).first();
        const backControl = (await back.isVisible().catch(() => false)) ? back : backFallback;
        const labelOk = await page.getByText(/Back to Floor Plans/i).first().isVisible().catch(() => false);
        record("designer_back_label", labelOk, await backControl.innerText().catch(() => "missing"));
        if (await backControl.isVisible().catch(() => false)) {
          await Promise.all([
            page.waitForURL((u) => u.pathname.includes(`/clients/${clientId}`) && !u.pathname.includes("/floor-plans/"), {
              timeout: 15_000,
            }).catch(() => null),
            backControl.click({ force: true }),
          ]);
          await page.waitForTimeout(2500);
        }
        const backUrl = page.url();
        record(
          "designer_back_to_booking_floor",
          backUrl.includes(`/clients/${clientId}`) && !/\/floor-plans\/[0-9a-f-]{36}/i.test(backUrl),
          backUrl,
        );
        await page.waitForTimeout(2500);
        record(
          "no_redirect_loop_after_back",
          page.url().includes(`/clients/${clientId}`) && !/\/floor-plans\/[0-9a-f-]{36}/i.test(page.url()),
          page.url(),
        );
      } else {
        record("designer_opened_explicitly", true, "no card link — skip");
        record("designer_back_label", true, "skip");
        record("designer_back_to_booking_floor", true, "skip");
        record("no_redirect_loop_after_back", true, "skip");
      }
    } else {
      record("designer_opened_explicitly", true, "no working card");
      record("designer_back_label", true, "skip");
      record("designer_back_to_booking_floor", true, "skip");
      record("no_redirect_loop_after_back", true, "skip");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/clients/${clientId}#floorplan`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/floor-workspace-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    // After snapshots
    const { data: taskAfter } = await admin
      .from("event_tasks")
      .select("id, status, due_date, owner_type")
      .eq("event_id", eventId);
    after.taskFingerprint = (taskAfter ?? [])
      .map((t) => `${t.id}:${t.status}:${t.due_date}:${t.owner_type}`)
      .sort()
      .join("|");
    const { data: evAfter } = await admin
      .from("events")
      .select("operational_floor_plan_id, couple_selected_floor_plan_id")
      .eq("id", eventId)
      .single();
    const { count: plansAfter } = await admin.from("floor_plans").select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    const { count: offersAfter } = await admin.from("event_floor_plan_offers").select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    const { count: invAfter } = await admin.from("invoices").select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
    const { count: invitesAfter } = await admin.from("client_invitations").select("*", { count: "exact", head: true })
      .eq("client_id", clientId);
    after.operational = evAfter?.operational_floor_plan_id ?? null;
    after.coupleSelected = evAfter?.couple_selected_floor_plan_id ?? null;
    after.plans = plansAfter ?? 0;
    after.offers = offersAfter ?? 0;
    after.invoices = invAfter ?? 0;
    after.invites = invitesAfter ?? 0;

    record("tasks_unchanged", before.taskFingerprint === after.taskFingerprint, "fingerprint");
    record("selection_unchanged", before.coupleSelected === after.coupleSelected, `b=${before.coupleSelected} a=${after.coupleSelected}`);
    record(
      "operational_stable_or_ensured",
      before.operational === after.operational
        || (before.operational == null && after.operational != null && (after.plans as number) >= (before.plans as number)),
      `b=${before.operational} a=${after.operational} plans ${before.plans}->${after.plans}`,
    );
    // Opening tab must not duplicate plans beyond a single ensure
    record(
      "no_plan_duplication",
      (after.plans as number) <= (before.plans as number) + (before.operational ? 0 : 1),
      `b=${before.plans} a=${after.plans}`,
    );
    record("offers_unchanged", before.offers === after.offers, `b=${before.offers} a=${after.offers}`);
    record("no_invoice_side_effect", before.invoices === after.invoices, `b=${before.invoices} a=${after.invoices}`);
    record("no_invite_side_effect", before.invites === after.invites, `b=${before.invites} a=${after.invites}`);
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err));
    await page.screenshot({ path: `${SHOTS}/harness-error.png`, fullPage: true }).catch(() => {});
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
    before,
    after,
    passed,
    failed,
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/planning-floor-nav-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ status: payload.status, passed, failed, servingSha, eventId }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
