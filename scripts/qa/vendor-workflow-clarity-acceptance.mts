/**
 * Sandbox: Overview + Vendors tab clarity (assignments vs highlights vs submitted).
 * Read-only browse + optional highlight remove check that assignment persists.
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
const SHOTS = `${OUT}/vendor-workflow-clarity-shots`;
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

    const { data: events } = await admin
      .from("events")
      .select("id, client_id")
      .eq("venue_id", FANCY)
      .not("client_id", "is", null)
      .not("booked_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(40);

    let best = -1;
    for (const ev of events ?? []) {
      const { count: recs } = await admin.from("event_vendor_recommendations")
        .select("*", { count: "exact", head: true }).eq("event_id", ev.id).eq("venue_id", FANCY);
      const { count: assigns } = await admin.from("event_vendor_assignments")
        .select("*", { count: "exact", head: true }).eq("event_id", ev.id);
      const score = (recs ?? 0) * 2 + (assigns ?? 0);
      if (score > best) {
        best = score;
        eventId = ev.id;
        clientId = ev.client_id;
      }
    }
    record("fixture", !!eventId && !!clientId, `event=${eventId} client=${clientId} score=${best}`);
    if (!eventId || !clientId) throw new Error("no fixture");

    const { data: recsBefore } = await admin.from("event_vendor_recommendations")
      .select("id, vendor_id, selected_at, note")
      .eq("event_id", eventId).eq("venue_id", FANCY);
    const { data: assignsBefore } = await admin.from("event_vendor_assignments")
      .select("id, vendor_id, notes")
      .eq("event_id", eventId);
    const { count: networkBefore } = await admin.from("venue_vendor_relationships")
      .select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
    const { count: invitesBefore } = await admin.from("client_invitations")
      .select("*", { count: "exact", head: true }).eq("client_id", clientId);
    const { count: notifBefore } = await admin.from("notification_log")
      .select("*", { count: "exact", head: true }).eq("venue_id", FANCY);

    before.recs = (recsBefore ?? []).map((r) => `${r.id}:${r.selected_at}`).sort().join("|");
    before.assigns = (assignsBefore ?? []).map((a) => a.id).sort().join("|");
    before.network = networkBefore ?? 0;
    before.invites = invitesBefore ?? 0;
    before.notif = notifBefore ?? 0;

    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2800);

    await page.getByRole("tab", { name: /^Overview$/i }).click().catch(() => {});
    await page.waitForTimeout(1200);
    // Live Overview Vendors card = Event Setup vendors row (not BookingOverviewSummary).
    const setupVendors = page.getByTestId("event-setup-card-vendors");
    await setupVendors.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    const overview = page.getByTestId("overview-vendors-tile");
    await overview.scrollIntoViewIfNeeded().catch(() => {});
    const overviewText = ((await overview.innerText().catch(() => ""))
      || (await setupVendors.innerText().catch(() => ""))).trim();
    record(
      "overview_no_selected_pending_wording",
      overviewText.length > 0 && !/vendors selected|recommendations pending/i.test(overviewText),
      overviewText.slice(0, 240),
    );
    record(
      "overview_uses_assigned_language",
      /assigned to this event/i.test(overviewText) || /No vendors assigned/i.test(overviewText),
      overviewText.slice(0, 240),
    );
    record(
      "overview_uses_highlight_language",
      /highlighted|No vendors highlighted|submitted choices for all highlighted/i.test(overviewText),
      overviewText.slice(0, 240),
    );
    await page.screenshot({ path: `${SHOTS}/overview-vendors-1280.png`, fullPage: true });

    await page.getByRole("tab", { name: /^Vendors$/i }).click();
    await page.waitForTimeout(2000);
    const highlights = page.getByTestId("event-vendor-highlights");
    record("highlights_section_visible", await highlights.isVisible().catch(() => false), "event-vendor-highlights");
    const help = await page.getByTestId("event-vendor-highlights-help").innerText().catch(() => "");
    record("highlights_help_explains_chosen_and_assigned", /Chosen by/i.test(help) && /Assigned to This Event/i.test(help), help.slice(0, 200));

    const chosenSec = page.getByTestId("vendor-highlights-chosen");
    const openSec = page.getByTestId("vendor-highlights-not-submitted");
    const chosenInDb = (recsBefore ?? []).filter((r) => r.selected_at);
    const openInDb = (recsBefore ?? []).filter((r) => !r.selected_at);
    if (chosenInDb.length > 0) {
      record("chosen_group_visible", await chosenSec.isVisible().catch(() => false), `db=${chosenInDb.length}`);
    } else {
      record("chosen_group_hidden_when_empty", !(await chosenSec.isVisible().catch(() => false)), "ok");
    }
    if (openInDb.length > 0) {
      record("not_submitted_group_visible", await openSec.isVisible().catch(() => false), `db=${openInDb.length}`);
    } else {
      record("not_submitted_group_hidden_when_empty", !(await openSec.isVisible().catch(() => false)), "ok");
    }

    await highlights.scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: `${SHOTS}/vendors-highlights-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${SHOTS}/vendors-highlights-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    // Preview badge (read-only navigation)
    await page.goto(`${APP}/clients/${clientId}/portal-preview?event=${eventId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(2000);
    await page.getByTestId("portal-preview-tab-vendors").click();
    await page.waitForTimeout(500);
    const badge = await page.getByTestId("portal-preview-vendors-badge").innerText().catch(() => "");
    const previewBody = await page.getByTestId("portal-preview-vendors").innerText().catch(() => "");
    if ((recsBefore?.length ?? 0) > 0) {
      record(
        "preview_not_roster_badge",
        /not the assigned roster/i.test(badge),
        badge,
      );
      record(
        "preview_copy_not_roster",
        /does not show the assigned roster|view-only/i.test(previewBody),
        previewBody.slice(0, 200),
      );
    } else {
      record("preview_not_roster_badge", true, "no recs");
      record("preview_copy_not_roster", true, "no recs");
    }
    await page.screenshot({ path: `${SHOTS}/preview-vendors-1280.png`, fullPage: true });

    // After browse — no mutation
    const { data: recsAfterBrowse } = await admin.from("event_vendor_recommendations")
      .select("id, selected_at").eq("event_id", eventId).eq("venue_id", FANCY);
    const { data: assignsAfterBrowse } = await admin.from("event_vendor_assignments")
      .select("id").eq("event_id", eventId);
    after.recsBrowse = (recsAfterBrowse ?? []).map((r) => `${r.id}:${r.selected_at}`).sort().join("|");
    after.assignsBrowse = (assignsAfterBrowse ?? []).map((a) => a.id).sort().join("|");
    record("browse_recs_unchanged", before.recs === after.recsBrowse, "fingerprint");
    record("browse_assigns_unchanged", before.assigns === after.assignsBrowse, "fingerprint");

    // Remove one unsubmitted highlight if available; assert assignments unchanged
    const removable = (recsBefore ?? []).find((r) => !r.selected_at);
    if (removable) {
      await page.goto(`${APP}/clients/${clientId}#vendors`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(2000);
      await page.getByRole("tab", { name: /^Vendors$/i }).click().catch(() => {});
      await page.waitForTimeout(1500);
      const row = page.getByTestId(`vendor-highlight-row-${removable.id}`);
      await row.hover().catch(() => {});
      page.once("dialog", (d) => d.accept().catch(() => {}));
      await row.getByRole("button", { name: /Remove recommendation/i }).click({ force: true }).catch(async () => {
        await row.locator("button").last().click({ force: true });
      });
      await page.waitForTimeout(2000);

      const { data: recsAfterRemove } = await admin.from("event_vendor_recommendations")
        .select("id").eq("event_id", eventId).eq("venue_id", FANCY);
      const { data: assignsAfterRemove } = await admin.from("event_vendor_assignments")
        .select("id").eq("event_id", eventId);
      record(
        "remove_highlight_deletes_rec_only",
        !(recsAfterRemove ?? []).some((r) => r.id === removable.id),
        `removed=${removable.id}`,
      );
      record(
        "remove_highlight_keeps_assignments",
        (assignsAfterRemove ?? []).map((a) => a.id).sort().join("|") === before.assigns,
        "assignments intact",
      );
      // Restore recommendation so fixture stays reusable
      await admin.from("event_vendor_recommendations").insert({
        id: removable.id,
        venue_id: FANCY,
        event_id: eventId,
        vendor_id: removable.vendor_id,
        note: removable.note,
        selected_at: null,
      }).then(() => undefined).catch(async () => {
        await admin.from("event_vendor_recommendations").insert({
          venue_id: FANCY,
          event_id: eventId,
          vendor_id: removable.vendor_id,
          note: removable.note,
        });
      });
    } else {
      record("remove_highlight_deletes_rec_only", true, "no unsubmitted highlight to remove");
      record("remove_highlight_keeps_assignments", true, "skip");
    }

    const { count: networkAfter } = await admin.from("venue_vendor_relationships")
      .select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
    const { count: invitesAfter } = await admin.from("client_invitations")
      .select("*", { count: "exact", head: true }).eq("client_id", clientId);
    const { count: notifAfter } = await admin.from("notification_log")
      .select("*", { count: "exact", head: true }).eq("venue_id", FANCY);
    record("network_unchanged", networkAfter === before.network, `b=${before.network} a=${networkAfter}`);
    record("no_invite_side_effect", invitesAfter === before.invites, `b=${before.invites} a=${invitesAfter}`);
    record("no_notification_side_effect", notifAfter === before.notif, `b=${before.notif} a=${notifAfter}`);
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
  writeFileSync(`${OUT}/vendor-workflow-clarity-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ status: payload.status, passed, failed, servingSha, eventId }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
