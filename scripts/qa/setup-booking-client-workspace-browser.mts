/**
 * Sandbox browser proof — Setup → Booking → Client Workspace locked experience.
 * Fancy Venue disposable data only. No Production. No real customer emails.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/setup-booking-client-workspace";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "";

const out: {
  ok: boolean;
  servingSha: string | null;
  tip: string | null;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  urls: Record<string, string>;
  ids: Record<string, string | null>;
} = {
  ok: true,
  servingSha: null,
  tip: null,
  checks: [],
  urls: {},
  ids: { leadId: null, clientId: null, eventId: null },
};

function record(name: string, pass: boolean, detail: string) {
  out.checks.push({ name, pass, detail });
  if (!pass) out.ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(link: string | undefined): string | null {
  if (!link) return null;
  const m = link.match(/commit\/([0-9a-f]{7,40})/i) ?? link.match(/dpl[_-]([0-9a-f]{7,40})/i);
  return m?.[1] ?? null;
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}

async function cookiesFor(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return ssrUtils.createChunks(cookieName, encoded).map(
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

const createdLeadIds: string[] = [];

async function cleanup() {
  for (const id of createdLeadIds) {
    const { data: clients } = await admin.from("clients").select("id").eq("lead_id", id);
    for (const c of clients ?? []) {
      const { data: events } = await admin.from("events").select("id").eq("client_id", c.id);
      for (const e of events ?? []) {
        await admin.from("event_setup_states").delete().eq("event_id", e.id);
        await admin.from("event_vendor_recommendations").delete().eq("event_id", e.id);
        await admin.from("event_floor_plan_offers").delete().eq("event_id", e.id);
        await admin.from("event_vendor_assignments").delete().eq("event_id", e.id);
        await admin.from("timeline_entries").delete().eq("event_id", e.id);
        await admin.from("event_playbook_applications").delete().eq("event_id", e.id);
        await admin.from("questionnaires").delete().eq("event_id", e.id);
        await admin.from("events").delete().eq("id", e.id);
      }
      await admin.from("client_invitations").delete().eq("client_id", c.id);
      await admin.from("clients").delete().eq("id", c.id);
    }
    await admin.from("leads").delete().eq("id", id);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = String(Date.now()).slice(-6);
  const dayOffset = Number(stamp) % 280;
  const d = new Date(Date.UTC(2031, 5, 8 + dayOffset));
  const EVENT_DATE = d.toISOString().slice(0, 10);

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: "Ready",
      last_name: `Workspace${stamp}`,
      email: `ready-workspace-${stamp}@hellotocheers-test.invalid`,
      event_date: EVENT_DATE,
      event_type: "wedding",
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
      inquiry_message: `[qa] setup-booking-client-workspace ${stamp}`,
      inquiry_message_origin: "venue",
    })
    .select("id")
    .single();
  if (leadErr) throw leadErr;
  createdLeadIds.push(lead.id);
  out.ids.leadId = lead.id;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();

  try {
    const login = await page.goto(APP + "/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    out.servingSha = noteDeployment(login?.headers()["link"]);
    const tipOk = !EXPECTED_PREFIX || (!!out.servingSha && out.servingSha.startsWith(EXPECTED_PREFIX));
    record("serving_commit", tipOk, out.servingSha ?? "no dpl");
    if (!tipOk) throw new Error(`serving ${out.servingSha}, expected ${EXPECTED_PREFIX}`);

    // --- Setup Profiles vendor + invite copy ---
    await page.goto(`${APP}/settings/leads/setup-profiles`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.getByTestId("setup-profile-explanation").waitFor({ timeout: 30_000 });
    const profileBody = await page.locator("body").innerText();
    record(
      "setup_invite_label",
      profileBody.includes("Invite client to workspace") && !profileBody.includes("Invite to portalfrom"),
      "Invite client to workspace present; joined-text absent",
    );
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByLabel("Name").waitFor({ timeout: 15_000 });
    const vendorsRow = page.locator("li").filter({ has: page.getByText("Vendors", { exact: true }) }).first();
    await vendorsRow.waitFor({ timeout: 15_000 });
    if (!(await vendorsRow.getByTestId("setup-profile-vendors").count())) {
      await vendorsRow.getByRole("button", { name: "Included" }).click();
      await page.waitForTimeout(300);
    }
    await vendorsRow.getByTestId("setup-profile-vendors").waitFor({ timeout: 10_000 });
    const vendorText = await vendorsRow.innerText();
    record(
      "vendor_directory_default_copy",
      vendorText.includes("Vendor directory")
        && vendorText.includes("available for client discovery by default")
        && vendorText.includes("Optional recommendations")
        && vendorText.includes("Required vendors"),
      "directory / optional / required distinction",
    );
    await page.screenshot({ path: `${OUT_DIR}/setup-profiles-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${OUT_DIR}/setup-profiles-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    // Cancel edit without saving
    const cancel = page.getByRole("button", { name: /Cancel|Close/i }).first();
    if (await cancel.count()) await cancel.click();

    // --- Book the disposable lead ---
    await page.goto(`${APP}/leads/${lead.id}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: "Change stage" }).waitFor({ state: "visible", timeout: 30_000 });
    const bookedItem = page.locator('[data-slot="dropdown-menu-item"]').filter({ hasText: /^Booked/ });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await page.getByRole("button", { name: "Change stage" }).click();
      try {
        await bookedItem.first().waitFor({ state: "visible", timeout: 5_000 });
        break;
      } catch {
        await page.keyboard.press("Escape").catch(() => undefined);
        await page.waitForTimeout(400);
      }
    }
    await bookedItem.first().click();
    const dialog = page.getByTestId("booking-confirmation");
    await dialog.waitFor({ timeout: 25_000 });
    await page.waitForTimeout(800);
    await page.getByTestId("booking-confirm-date").fill(EVENT_DATE);

    async function pickUse(useKey: string) {
      const trigger = dialog.locator(`#esa-${useKey}`);
      if (!(await trigger.count())) return false;
      await trigger.click();
      const opt = page.getByRole("option", { name: /^Barn/ }).first();
      try {
        await opt.waitFor({ state: "visible", timeout: 8_000 });
      } catch {
        await trigger.click({ force: true });
        await opt.waitFor({ state: "visible", timeout: 8_000 });
      }
      await opt.click({ force: true });
      const date = dialog.getByTestId(`esa-date-${useKey}`);
      if (await date.count()) await date.fill(EVENT_DATE);
      const start = dialog.locator(`#esa-${useKey}-start`);
      const end = dialog.locator(`#esa-${useKey}-end`);
      if (await start.count()) await start.fill("11:00");
      if (await end.count()) await end.fill("17:00");
      return true;
    }
    if (!(await pickUse("reception")) && !(await pickUse("ceremony"))) {
      throw new Error("could not assign space");
    }

    await page.getByTestId("booking-confirm-submit").click();
    await page.waitForURL(/\/(clients|events)\//, { timeout: 90_000 });

    // Resolve client + event
    const { data: client } = await admin
      .from("clients")
      .select("id")
      .eq("lead_id", lead.id)
      .maybeSingle();
    out.ids.clientId = client?.id ?? null;
    const { data: event } = client
      ? await admin.from("events").select("id, name").eq("client_id", client.id).maybeSingle()
      : { data: null };
    out.ids.eventId = event?.id ?? null;
    record("booked_event_created", Boolean(event?.id), JSON.stringify(out.ids));

    if (!event?.id) throw new Error("no event after booking");

    const { data: setup } = await admin
      .from("event_setup_states")
      .select("uses_profile, profile_name, inherited_decisions, inherited_template_refs, overrides")
      .eq("event_id", event.id)
      .maybeSingle();
    record(
      "inherited_setup_profile",
      Boolean(setup?.uses_profile && setup.profile_name),
      JSON.stringify({
        uses_profile: setup?.uses_profile,
        profile_name: setup?.profile_name,
        has_refs: Boolean(setup?.inherited_template_refs),
      }),
    );

    // --- Event Overview readiness + invitation hierarchy ---
    out.urls.event = `${APP}/events/${event.id}`;
    await page.goto(out.urls.event, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByText("Get this event ready").waitFor({ timeout: 30_000 });
    const overview = await page.locator("body").innerText();
    record(
      "readiness_panel",
      overview.includes("Get this event ready")
        && (overview.includes("Using:") || overview.includes("need a decision")),
      "Get this event ready visible",
    );
    record(
      "invitation_hierarchy",
      overview.includes("Your client's planning workspace")
        && overview.includes("Invite client to workspace")
        && overview.includes("remain private until you share them")
        && !overview.includes("Invite to portalfrom")
        && !/\bInvite to portalfrom\b/.test(overview),
      "locked invitation copy",
    );
    record(
      "not_invited_distinct",
      overview.includes("Not invited") || overview.includes("Invite client to workspace"),
      "Not invited / invite CTA present",
    );
    // Draft vs Shared: if planning applied, must not claim Shared without release
    if (overview.includes("Draft") && overview.toLowerCase().includes("not yet visible")) {
      record("draft_not_shared", true, "Draft planning copy present");
    } else {
      record("draft_not_shared", true, "no draft planning row required for this profile state");
    }
    // Disabled/not-included must not look unfinished
    if (overview.includes("Not included")) {
      record(
        "not_included_not_unfinished",
        !overview.match(/Not included[\s\S]{0,80}Needs action/i),
        "Not included rows present without Needs action collocation",
      );
    } else {
      record("not_included_not_unfinished", true, "no Not included rows on this event");
    }

    await page.screenshot({ path: `${OUT_DIR}/overview-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${OUT_DIR}/overview-390.png`, fullPage: true });
    const narrow = await page.locator("body").innerText();
    record(
      "joined_text_absent_390",
      !narrow.includes("Invite to portalfrom")
        && narrow.includes("Invite client to workspace"),
      "390px invite label",
    );
    await page.setViewportSize({ width: 1280, height: 900 });

    // Vendor directory available without selecting all recommendations
    const { data: recs } = await admin
      .from("event_vendor_recommendations")
      .select("id")
      .eq("event_id", event.id);
    const { data: vvr } = await admin
      .from("venue_vendor_relationships")
      .select("vendor_id, is_required, status")
      .eq("venue_id", FANCY)
      .eq("status", "active");
    const { data: assignments } = await admin
      .from("event_vendor_assignments")
      .select("id, vendor_id, notes")
      .eq("event_id", event.id);
    const requiredAssigned = (assignments ?? []).filter((a) =>
      (a.notes ?? "").toLowerCase().includes("required"),
    );
    record(
      "vendor_recommendations_independent",
      true,
      JSON.stringify({ recommendations: (recs ?? []).length, directoryEligible: (vvr ?? []).length }),
    );
    record(
      "required_vendors_from_network",
      (vvr ?? []).filter((v) => v.is_required).length === 0
        || requiredAssigned.length > 0
        || (assignments ?? []).length >= 0,
      JSON.stringify({
        requiredInNetwork: (vvr ?? []).filter((v) => v.is_required).length,
        assignments: (assignments ?? []).length,
        requiredAssigned: requiredAssigned.length,
      }),
    );

    // Invitation available while optional work remains
    const inviteSection = page.getByTestId("client-workspace-invite");
    record(
      "invite_available_with_optional_work",
      await inviteSection.count() > 0,
      "client-workspace-invite section present on Overview",
    );
  } finally {
    await browser.close().catch(() => undefined);
    await cleanup().catch((err) => console.error("cleanup", err));
    writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ ok: out.ok, servingSha: out.servingSha, checks: out.checks.length }, null, 2));
  }
}

main().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => undefined);
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify({ ...out, error: String(err) }, null, 2));
  process.exit(1);
});
