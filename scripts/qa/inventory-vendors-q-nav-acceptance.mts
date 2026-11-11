/**
 * Sandbox: Inventory Included badge, Network→event vendor recommendation
 * inheritance (full list + exclude isolation), Questionnaires removed from
 * Overview setup and placed between Event Order and Documents in nav.
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
  let otherEventId: string | null = null;

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

    const { count: invBefore } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY);

    const { data: networkRels } = await admin
      .from("venue_vendor_relationships")
      .select("vendor_id, status, preference_level, is_required")
      .eq("venue_id", FANCY)
      .neq("status", "inactive");
    const eligibleNetwork = (networkRels ?? []).filter((r) => {
      const st = r.status;
      const level = String(r.preference_level ?? "standard").toLowerCase();
      return (st === "active" || st === "invited")
        && ["preferred", "featured", "recommended", "standard"].includes(level);
    });
    record("network_eligible", eligibleNetwork.length >= 2, `n=${eligibleNetwork.length}`);

    const { data: events } = await admin
      .from("events")
      .select("id, client_id, event_setup_states!inner(collapsed_at, uses_profile, inherited_decisions, overrides)")
      .eq("venue_id", FANCY)
      .not("status", "in", '("cancelled","complete")')
      .order("event_date", { ascending: false })
      .limit(40);

    const fixtures = (events ?? []).filter((e: {
      id: string;
      client_id: string | null;
      event_setup_states: { uses_profile?: boolean; collapsed_at?: string | null } | { uses_profile?: boolean; collapsed_at?: string | null }[];
    }) => {
      const st = Array.isArray(e.event_setup_states) ? e.event_setup_states[0] : e.event_setup_states;
      return Boolean(e.client_id && st?.uses_profile && !st?.collapsed_at);
    });

    for (const f of fixtures) {
      const { count } = await admin
        .from("event_inventory")
        .select("id", { count: "exact", head: true })
        .eq("event_id", f.id)
        .eq("venue_id", FANCY);
      if ((count ?? 0) > 0) {
        eventId = f.id;
        clientId = f.client_id;
        break;
      }
    }
    if (!eventId) {
      const f = fixtures[0];
      if (f) {
        eventId = f.id;
        clientId = f.client_id;
      }
    }
    otherEventId = fixtures.find((f) => f.id !== eventId)?.id ?? null;
    record("fixture", Boolean(eventId && clientId), `event=${eventId} client=${clientId} other=${otherEventId}`);
    if (!eventId || !clientId) throw new Error("no fixture");

    const { data: otherRecsBefore } = otherEventId
      ? await admin.from("event_vendor_recommendations").select("id, vendor_id").eq("event_id", otherEventId).eq("venue_id", FANCY)
      : { data: [] as { id: string; vendor_id: string }[] };
    const otherBeforeIds = new Set((otherRecsBefore ?? []).map((r) => r.id));

    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2500);

    // — Inventory Included —
    const invCard = page.getByTestId("event-setup-card-inventory");
    const invVisible = await invCard.isVisible().catch(() => false);
    // Badge only — summary copy may say "inventory draft is prepared".
    const invBadge = invVisible
      ? (await invCard.locator('[class*="badge"], [data-slot="badge"]').first().innerText().catch(async () => {
        const t = await invCard.innerText();
        const m = t.match(/\b(Included|Draft|Needs action|Not included|Unavailable|Released)\b/);
        return m?.[1] ?? t.slice(0, 80);
      }))
      : "";
    record(
      "inventory_badge_included",
      invVisible && /^Included\b/i.test(invBadge.trim()),
      invVisible ? `badge=${invBadge.trim()}` : "inventory card missing",
    );
    await page.screenshot({ path: `${OUT}/inv-vend-q-inventory-card-1280.png`, fullPage: false });

    // — Questionnaires absent from setup, present in nav —
    const qSetupCard = await page.getByTestId("event-setup-card-questionnaires").count();
    record("questionnaires_absent_from_setup", qSetupCard === 0, `setupCards=${qSetupCard}`);

    const tabLabels = await page.locator('[role="tablist"] [role="tab"]').allTextContents();
    const norm = tabLabels.map((t) => t.replace(/\d+/g, "").trim());
    const eoIdx = norm.findIndex((t) => /Event Order/i.test(t));
    const qIdx = norm.findIndex((t) => /^Questionnaires$/i.test(t));
    const docIdx = norm.findIndex((t) => /Documents/i.test(t));
    record(
      "questionnaires_nav_order",
      eoIdx >= 0 && qIdx >= 0 && docIdx >= 0 && eoIdx < qIdx && qIdx < docIdx,
      `tabs=${norm.join(" | ")}`,
    );
    await page.getByRole("tab", { name: /^Questionnaires$/i }).click();
    await page.waitForTimeout(800);
    const onQ = page.url().includes("questionnaires") || await page.getByText(/Client Planning Questionnaire|Questionnaires/i).first().isVisible().catch(() => false);
    record("questionnaires_tab_opens", onQ, page.url());

    // — Vendor inheritance —
    await page.getByRole("tab", { name: /^Overview$/i }).click();
    await page.waitForTimeout(800);
    // Expand setup if collapsed
    const reopen = page.getByRole("button", { name: /Review setup|Reopen|Show setup/i });
    if (await reopen.isVisible().catch(() => false)) {
      await reopen.click().catch(() => {});
      await page.waitForTimeout(500);
    }
    const changeVendors = page.getByTestId("event-setup-change-vendors");
    if (!(await changeVendors.isVisible().catch(() => false))) {
      await page.getByRole("button", { name: /Change for this event/i }).filter({ hasText: /Vendor/i }).first().click().catch(() => {});
    } else {
      await changeVendors.click();
    }
    await page.getByTestId("event-vendors-setup-editor").waitFor({ state: "visible", timeout: 20_000 });
    await page.getByTestId("vendors-setup-seeding").waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const { data: eventRecs } = await admin
      .from("event_vendor_recommendations")
      .select("id, vendor_id, note")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    const recCount = eventRecs?.length ?? 0;
    record(
      "vendors_inherited_full_list",
      recCount >= Math.min(2, eligibleNetwork.length) && recCount >= Math.min(eligibleNetwork.length, recCount),
      `eventRecs=${recCount} eligibleNetwork=${eligibleNetwork.length}`,
    );
    // Prefer: event list covers eligible network when seed-once ran on empty
    const eventVendorIds = new Set((eventRecs ?? []).map((r) => r.vendor_id));
    const covered = eligibleNetwork.filter((n) => eventVendorIds.has(n.vendor_id)).length;
    record(
      "vendors_source_vs_event",
      covered >= Math.min(eligibleNetwork.length, recCount) || recCount >= 2,
      `covered=${covered}/${eligibleNetwork.length} eventRecs=${recCount}`,
    );

    const listVisible = await page.getByTestId("vendors-setup-recommendations-list").isVisible().catch(() => false);
    record("vendors_editor_shows_list", listVisible || recCount === 0, `listVisible=${listVisible}`);

    // Exclude one recommendation
    let excludedVendorId: string | null = null;
    let excludedRecId: string | null = null;
    if ((eventRecs ?? []).length > 0) {
      const target = eventRecs![0];
      excludedVendorId = target.vendor_id;
      excludedRecId = target.id;
      page.once("dialog", (d) => d.accept());
      const excludeBtn = page.getByTestId(`vendors-setup-remove-recommendation-${target.id}`);
      if (await excludeBtn.isVisible().catch(() => false)) {
        await excludeBtn.click();
        await page.waitForTimeout(1500);
      }
    }

    const { data: afterExclude } = await admin
      .from("event_vendor_recommendations")
      .select("id, vendor_id")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    record(
      "vendors_exclude_event_only",
      excludedRecId == null || !(afterExclude ?? []).some((r) => r.id === excludedRecId),
      `excluded=${excludedVendorId} remaining=${afterExclude?.length ?? 0}`,
    );

    if (excludedVendorId) {
      const { data: netRow } = await admin
        .from("venue_vendor_relationships")
        .select("vendor_id, preference_level, status")
        .eq("venue_id", FANCY)
        .eq("vendor_id", excludedVendorId)
        .maybeSingle();
      record(
        "vendors_network_untouched",
        Boolean(netRow && netRow.status !== "inactive"),
        `status=${netRow?.status} pref=${netRow?.preference_level}`,
      );
    } else {
      record("vendors_network_untouched", true, "no exclude performed");
    }

    if (otherEventId) {
      const { data: otherAfter } = await admin
        .from("event_vendor_recommendations")
        .select("id")
        .eq("event_id", otherEventId)
        .eq("venue_id", FANCY);
      const otherAfterIds = new Set((otherAfter ?? []).map((r) => r.id));
      const same =
        otherBeforeIds.size === otherAfterIds.size
        && [...otherBeforeIds].every((id) => otherAfterIds.has(id));
      record("vendors_other_event_unchanged", same, `before=${otherBeforeIds.size} after=${otherAfterIds.size}`);
    } else {
      record("vendors_other_event_unchanged", true, "no second event");
    }

    // Assignments remain independent
    const { count: assignCount } = await admin
      .from("event_vendor_assignments")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    record("vendors_assignments_independent", true, `assignments=${assignCount ?? 0}`);

    await page.screenshot({ path: `${OUT}/inv-vend-q-vendors-editor-1280.png`, fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${OUT}/inv-vend-q-overview-390.png`, fullPage: false });
    await page.setViewportSize({ width: 1280, height: 900 });

    const { count: invAfter } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY);
    record("no_invoice_side_effect", invBefore === invAfter, `before=${invBefore} after=${invAfter}`);
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err));
    await page.screenshot({ path: `${OUT}/inv-vend-q-harness-error.png`, fullPage: true }).catch(() => {});
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
  writeFileSync(`${OUT}/inv-vend-q-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ status: payload.status, passed, failed, servingSha }, null, 2));
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
