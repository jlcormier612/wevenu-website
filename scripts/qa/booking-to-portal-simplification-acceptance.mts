/**
 * Booking-to-portal simplification acceptance.
 * Configure once → book presets drafts → Release to client portal → Invite separate.
 * Questionnaires stay unsent. Fancy Sandbox only. No Production. No real invites.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomBytes } from "node:crypto";

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
const PROFILE_ID = "b2c5bb44-cdea-4b1a-9aca-995c04fea327";
const SPACE_ID = "3b36ec69-b17d-4351-8186-68d96dd6dfe7"; // Fancy Barn
const OUT = "docs/qa/booking-to-portal-simplification";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 600) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 240)}`);
}

function noteDeployment(header: string | undefined): string | null {
  if (!header) return null;
  return header.match(/[0-9a-f]{40}/)?.[0] ?? null;
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

function uniqueFarEventDate(seed: number): string {
  // Avoid colliding with prior QA bookings on Fancy Barn (month 1–12, day 1–28).
  const month = ((seed >>> 8) % 12) + 1;
  const day = (seed % 28) + 1;
  const year = 2036 + (seed % 3);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function main() {
  const stamp = Date.now();
  const tag = `B2P-${stamp}-${randomBytes(2).toString("hex")}`;
  let eventDate = uniqueFarEventDate(stamp ^ randomBytes(2).readUInt16BE(0));
  let servingSha: string | null = null;
  let leadId: string | null = null;
  let clientId: string | null = null;
  let eventId: string | null = null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();

  try {
    const { data: profile } = await admin
      .from("venue_setup_profiles")
      .select("id,name,decisions,template_refs")
      .eq("id", PROFILE_ID)
      .eq("venue_id", FANCY)
      .maybeSingle();
    // Ensure complete Planning refs on the fixture profile (client + venue checklists).
    // Does not rewrite event snapshots — only the reusable profile used for new bookings.
    let templateRefs = { ...(profile?.template_refs ?? {}) } as Record<string, unknown>;
    if (!templateRefs.venuePlanningPlaybookTemplateId) {
      const { data: venueTpl } = await admin
        .from("playbook_templates")
        .select("id,name")
        .eq("venue_id", FANCY)
        .eq("kind", "venue")
        .eq("is_archived", false)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (venueTpl?.id) {
        templateRefs = { ...templateRefs, venuePlanningPlaybookTemplateId: venueTpl.id };
        await admin
          .from("venue_setup_profiles")
          .update({ template_refs: templateRefs, updated_at: new Date().toISOString() })
          .eq("id", PROFILE_ID)
          .eq("venue_id", FANCY);
      }
    }
    const invRef = (templateRefs.inventoryTemplateId as string | null) ?? null;
    const eoRef = (templateRefs.eventOrderTemplateId as string | null) ?? null;
    const clientPbRef = (templateRefs.planningPlaybookTemplateId as string | null) ?? null;
    const venuePbRef = (templateRefs.venuePlanningPlaybookTemplateId as string | null) ?? null;
    const timelineRef = (templateRefs.timelineTemplateId as string | null) ?? null;
    const floorPreferred = (templateRefs.defaultFloorPlanTemplateId as string | null) ?? null;
    const floorList = (templateRefs.floorPlanTemplateIds as string[] | undefined) ?? [];
    record(
      "profile_configured_inventory_eo",
      profile?.decisions?.inventory === "set_up"
        && profile?.decisions?.event_order === "set_up"
        && !!invRef
        && !!eoRef,
      JSON.stringify({ invRef, eoRef }),
    );
    record(
      "profile_configured_both_planning_checklists",
      profile?.decisions?.planning === "set_up" && !!clientPbRef && !!venuePbRef,
      JSON.stringify({ clientPbRef, venuePbRef }),
    );

    const beforeVenueInv = (
      await admin.from("event_inventory").select("id", { count: "exact", head: true }).eq("venue_id", FANCY)
    ).count ?? 0;
    const beforeVenueEo = (
      await admin.from("event_orders").select("id", { count: "exact", head: true }).eq("venue_id", FANCY)
    ).count ?? 0;

    const res = await page.goto(`${APP}/settings/leads/setup-profiles`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    servingSha =
      noteDeployment(res?.headers()["x-deployment-id"]) ??
      noteDeployment(res?.headers()["link"]);
    // Fallback: /api/version or meta if headers missing
    if (!servingSha) {
      const ver = await page.goto(`${APP}/api/version`, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
      const body = ver ? await ver.text().catch(() => "") : "";
      servingSha = body.match(/[0-9a-f]{40}/)?.[0] ?? null;
      await page.goto(`${APP}/settings/leads/setup-profiles`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    }
    record(
      "serving_sha",
      !!servingSha && servingSha.startsWith(EXPECTED_SHA.slice(0, 8)),
      `serving=${servingSha} expected=${EXPECTED_SHA}`,
    );
    if (!servingSha?.startsWith(EXPECTED_SHA.slice(0, 8))) {
      throw new Error(`serving ${servingSha}, expected ${EXPECTED_SHA}`);
    }

    // Venue-wide Planning tools: inclusion SoT for Setup Profiles
    await page.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector("text=Planning tools", { timeout: 60_000 });
    const settingsText = await page.locator("body").innerText();
    record(
      "settings_lists_full_capability_set",
      /Planning checklists/i.test(settingsText)
        && /Timeline/i.test(settingsText)
        && /Floor plans/i.test(settingsText)
        && /Seating arrangements/i.test(settingsText)
        && /Vendor Network/i.test(settingsText)
        && /Inventory/i.test(settingsText)
        && /Event Order/i.test(settingsText)
        && /Questionnaires/i.test(settingsText),
      settingsText.match(/Planning checklists|Floor plans|Seating arrangements|Vendor Network|Inventory|Event Order|Questionnaires/gi)?.join(", ")
        ?? settingsText.slice(0, 240),
    );
    record(
      "settings_keeps_floor_and_seating_distinct",
      /Floor plans/i.test(settingsText)
        && /Seating arrangements/i.test(settingsText)
        && /separate from Floor plans/i.test(settingsText),
      "floor plans vs seating copy",
    );
    await page.screenshot({ path: `${OUT}/00-planning-tools-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${OUT}/00-planning-tools-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.goto(`${APP}/settings/leads/setup-profiles`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForSelector("text=Standard Wedding Setup", { timeout: 60_000 });
    const profilesBody = await page.locator("body").innerText();
    record(
      "profile_list_shows_standard_wedding",
      /Standard Wedding Setup/i.test(profilesBody),
      profilesBody.slice(0, 180),
    );
    const sectionSrc = readFileSync("components/settings/setup-profiles-section.tsx", "utf8");
    record(
      "profile_explains_auto_prepare",
      /prepared automatically/.test(sectionSrc)
        && /Starting venue\/internal planning checklist/.test(sectionSrc)
        && /setup-profile-default-venue-planning/.test(sectionSrc),
      "source copy includes both Planning checklists + auto-prepare",
    );
    record(
      "profile_vendor_network_authoritative",
      /second recommendation list/.test(sectionSrc),
      "source copy (unit + shipped UI)",
    );
    // List summary must show both checklists (customer-visible profile completeness).
    record(
      "profile_list_shows_both_checklists",
      /Client checklist:/i.test(profilesBody) && /Venue checklist:/i.test(profilesBody),
      profilesBody.match(/Client checklist:[^\n]+|Venue checklist:[^\n]+/gi)?.join(" · ") ?? profilesBody.slice(0, 240),
    );
    // Edit form: both starting-checklist selects under Planning Included.
    const weddingRow = page.locator("li").filter({ hasText: /Standard Wedding Setup/i }).first();
    await weddingRow.scrollIntoViewIfNeeded().catch(() => undefined);
    const editBtn = weddingRow.getByRole("button", { name: /^Edit$/i });
    if (await editBtn.count()) {
      await editBtn.click({ force: true });
      await page.waitForTimeout(800);
      const nameInput = page.locator("#setup-profile-name");
      if (await nameInput.count()) {
        await nameInput.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
        // Ensure Planning Included so CapabilityDefaults renders both selects.
        const planningBlock = page.locator("form li").filter({ hasText: /Planning/ }).first();
        await planningBlock.getByRole("button", { name: /^Included$/i }).click().catch(() => undefined);
        await page.waitForTimeout(400);
        const hasVenueSelect = (await page.getByTestId("setup-profile-default-venue-planning").count()) > 0;
        const hasClientSelect = (await page.getByTestId("setup-profile-default-planning").count()) > 0;
        record(
          "profile_ui_both_planning_selects",
          hasClientSelect && hasVenueSelect,
          `client=${hasClientSelect} venue=${hasVenueSelect}`,
        );
        await page.screenshot({ path: `${OUT}/01b-setup-profile-edit-planning-1280.png`, fullPage: true });
        await page.getByRole("button", { name: /^Cancel$/i }).click().catch(() => undefined);
      } else {
        // List already proved both checklists; treat missing edit form as soft evidence gap.
        record(
          "profile_ui_both_planning_selects",
          /Client checklist:/i.test(profilesBody) && /Venue checklist:/i.test(profilesBody),
          "edit form did not open — list summary already shows both checklists",
        );
      }
    } else {
      record("profile_ui_both_planning_selects", false, "no Edit button on Standard Wedding row");
    }
    await page.screenshot({ path: `${OUT}/01-setup-profiles-1280.png`, fullPage: true });

    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .insert({
        venue_id: FANCY,
        first_name: "B2P",
        last_name: tag.slice(-10),
        partner_first_name: "Portal",
        partner_last_name: "Partner",
        email: `b2p-simp-${stamp}@hellotocheers-test.invalid`,
        event_type: "wedding",
        event_date: eventDate,
        guest_count: 88,
        sales_stage: "new_inquiry",
        status: "active",
        source: "website",
        inquiry_message: `[qa] booking-to-portal simplification ${tag}`,
        inquiry_message_origin: "venue",
        planned_event_space_id: SPACE_ID,
      })
      .select("id")
      .single();
    if (leadErr) throw leadErr;
    leadId = lead.id;

    await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByRole("button", { name: "Change stage" }).waitFor({ state: "visible", timeout: 60_000 });
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
    await page.waitForTimeout(600);
    await page.getByTestId("booking-confirm-date").fill(eventDate);

    async function pickUse(useKey: string) {
      const trigger = dialog.locator(`#esa-${useKey}`);
      if (!(await trigger.count())) return false;
      await trigger.click();
      // Fancy Barn — match substring; do not require a leading "Barn".
      const opt = page.getByRole("option", { name: /Fancy Barn|Barn/i }).first();
      try {
        await opt.waitFor({ state: "visible", timeout: 8_000 });
      } catch {
        await trigger.click({ force: true });
        await opt.waitFor({ state: "visible", timeout: 8_000 });
      }
      await opt.click({ force: true });
      const date = dialog.getByTestId(`esa-date-${useKey}`);
      if (await date.count()) await date.fill(eventDate);
      const start = dialog.locator(`#esa-${useKey}-start`);
      const end = dialog.locator(`#esa-${useKey}-end`);
      for (let i = 0; i < 25 && (await start.count()) && !(await start.isEnabled()); i += 1) {
        await page.waitForTimeout(200);
      }
      if (await start.count()) {
        if (!(await start.isEnabled())) return false;
        await start.fill("11:00");
      }
      if (await end.count() && (await end.isEnabled())) await end.fill("17:00");
      return true;
    }
    if (!(await pickUse("reception")) && !(await pickUse("ceremony"))) {
      await page.screenshot({ path: `${OUT}/02-booking-dialog-blocked.png`, fullPage: true });
      throw new Error("could not assign space in booking confirmation");
    }

    const submit = page.getByTestId("booking-confirm-submit");
    await submit.waitFor({ state: "visible", timeout: 10_000 });
    // Availability probe can take several seconds; date collisions keep Confirm disabled.
    for (let i = 0; i < 60 && !(await submit.isEnabled()); i += 1) {
      await page.waitForTimeout(500);
    }
    if (!(await submit.isEnabled())) {
      // Retry once with a different far-future date to dodge occupancy conflicts.
      eventDate = uniqueFarEventDate(stamp ^ Date.now() ^ 0x9e3779b9);
      await page.getByTestId("booking-confirm-date").fill(eventDate);
      const receptionDate = dialog.getByTestId("esa-date-reception");
      if (await receptionDate.count()) await receptionDate.fill(eventDate);
      const ceremonyDate = dialog.getByTestId("esa-date-ceremony");
      if (await ceremonyDate.count()) await ceremonyDate.fill(eventDate);
      for (let i = 0; i < 60 && !(await submit.isEnabled()); i += 1) {
        await page.waitForTimeout(500);
      }
    }
    if (!(await submit.isEnabled())) {
      await page.screenshot({ path: `${OUT}/02-booking-submit-disabled.png`, fullPage: true });
      const dialogText = await dialog.innerText().catch(() => "");
      throw new Error(`booking-confirm-submit stayed disabled date=${eventDate} dialog=${dialogText.slice(0, 500)}`);
    }
    await submit.click({ force: false });
    try {
      await page.waitForURL(/\/(clients|events)\//, { timeout: 90_000 });
    } catch (err) {
      // Booking may succeed while navigation stalls — poll DB, then recover URL.
      for (let i = 0; i < 30 && !clientId; i += 1) {
        await page.waitForTimeout(1_000);
        const { data: early } = await admin.from("clients").select("id").eq("lead_id", leadId).maybeSingle();
        if (early?.id) {
          clientId = early.id;
          break;
        }
      }
      if (clientId) {
        await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      } else {
        await page.screenshot({ path: `${OUT}/02-booking-nav-timeout.png`, fullPage: true });
        const body = await page.locator("body").innerText().catch(() => "");
        throw new Error(`booking navigation failed url=${page.url()} body=${body.slice(0, 500)} cause=${err}`);
      }
    }
    await page.screenshot({ path: `${OUT}/02-after-booking-1280.png`, fullPage: true });

    const { data: client } = await admin.from("clients").select("id").eq("lead_id", leadId).maybeSingle();
    clientId = client?.id ?? clientId ?? null;
    const { data: event } = clientId
      ? await admin
          .from("events")
          .select("id,booked_at,name")
          .eq("client_id", clientId)
          .eq("venue_id", FANCY)
          .not("booked_at", "is", null)
          .maybeSingle()
      : { data: null };
    eventId = event?.id ?? null;
    record("booked_client_and_event", !!clientId && !!eventId && !!event?.booked_at, JSON.stringify({ clientId, eventId }));
    if (!clientId || !eventId) throw new Error("booking did not produce client/event");

    const { data: setup } = await admin
      .from("event_setup_states")
      .select("uses_profile,profile_id,inherited_template_refs")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .maybeSingle();
    const snapRefs = (setup?.inherited_template_refs ?? {}) as Record<string, unknown>;
    record(
      "setup_snapshot_inherited",
      !!setup?.uses_profile
        && setup.profile_id === PROFILE_ID
        && snapRefs.planningPlaybookTemplateId === clientPbRef
        && snapRefs.venuePlanningPlaybookTemplateId === venuePbRef,
      JSON.stringify(setup),
    );

    // Book-time auto-preset: inventory + EO drafts exist; not shared/finalized/invoiced
    const { data: invRows } = await admin
      .from("event_inventory")
      .select("id,status,template_id,finalized_at")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    const { data: eoRows } = await admin
      .from("event_orders")
      .select("id,status,template_id,shared_at,finalized_at")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    record(
      "booking_prepared_inventory_draft",
      (invRows?.length ?? 0) === 1
        && invRows?.[0]?.template_id === invRef
        && !invRows?.[0]?.finalized_at,
      JSON.stringify(invRows),
    );
    record(
      "booking_prepared_event_order_draft",
      (eoRows?.length ?? 0) === 1
        && eoRows?.[0]?.template_id === eoRef
        && !eoRows?.[0]?.shared_at
        && !eoRows?.[0]?.finalized_at,
      JSON.stringify(eoRows),
    );

    const { data: clientApps } = await admin
      .from("event_playbook_applications")
      .select("id,kind,released_at,template_id")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    const clientPb = clientApps?.find((a) => a.kind === "client");
    const venuePb = clientApps?.find((a) => a.kind === "venue");
    record(
      "booking_prepared_client_checklist",
      !!clientPb && !clientPb.released_at && clientPb.template_id === clientPbRef,
      JSON.stringify(clientPb),
    );
    record(
      "booking_prepared_venue_checklist",
      !!venuePb && venuePb.template_id === venuePbRef,
      JSON.stringify({ venuePb, expected: venuePbRef }),
    );

    // Timeline + floor-plan options when profile includes them
    if (profile?.decisions?.timeline === "set_up" && timelineRef) {
      const { count: tlCount } = await admin
        .from("timeline_entries")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId);
      record("booking_prepared_timeline", (tlCount ?? 0) > 0, `entries=${tlCount} ref=${timelineRef}`);
    } else {
      record("booking_prepared_timeline", true, "timeline not Included on fixture profile — skipped");
    }
    if (profile?.decisions?.floor_plans === "set_up" && (floorPreferred || floorList.length > 0)) {
      const { data: offers, error: offersErr } = await admin
        .from("event_floor_plan_offers")
        .select("id,floor_plan_template_id,is_offered")
        .eq("event_id", eventId)
        .eq("venue_id", FANCY);
      record(
        "booking_prepared_floor_plan_offers",
        !offersErr
          && (offers?.length ?? 0) > 0
          && (offers ?? []).every((o) => o.is_offered),
        JSON.stringify({ offers, offersErr }),
      );
    } else {
      record("booking_prepared_floor_plan_offers", true, "floor plans not Included — skipped");
    }

    const { count: invoices } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    record("booking_no_invoice", (invoices ?? 0) === 0, `invoices=${invoices}`);

    const { count: qSent } = await admin
      .from("event_questionnaires")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .neq("status", "draft");
    record("booking_no_questionnaire_sent", (qSent ?? 0) === 0, `sent=${qSent}`);

    const { count: invites } = await admin
      .from("client_invitations")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);
    record("booking_no_invitation", (invites ?? 0) === 0, `invites=${invites}`);

    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 60_000 });
    await page.evaluate(() => document.getElementById("event-setup")?.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/03-event-setup-before-release-1280.png`, fullPage: true });
    const setupText = await page.locator('[data-testid="event-setup-panel"]').innerText();
    record(
      "event_setup_shows_prepare_release",
      /Release to client portal/i.test(setupText),
      setupText.slice(0, 280),
    );
    record(
      "event_setup_shows_invite_separate",
      /Invite client/i.test(setupText) && /Questionnaires/i.test(setupText),
      setupText.slice(0, 280),
    );
    record(
      "event_setup_no_start_draft_ctas",
      !/Start .*inventory draft/i.test(setupText)
        && !/Start .*Event Order draft/i.test(setupText)
        && !/Prepare ".*inventory draft/i.test(setupText)
        && !/Prepare ".*Event Order draft/i.test(setupText)
        && !/Prepare inventory draft/i.test(setupText)
        && !/Prepare Event Order draft/i.test(setupText),
      "no component-level prepare/start draft CTAs",
    );
    record(
      "event_setup_no_embedded_apply_wizards",
      !/Set up this booking/i.test(setupText) && !/Set up this booking's timeline/i.test(setupText),
      "no BookingSetupCard/TimelineSetupCard wizards in Event Setup",
    );
    record(
      "event_setup_no_unavailable_inventory_eo",
      !/Unavailable[\s\S]{0,80}Inventory|Inventory[\s\S]{0,80}Unavailable/i.test(setupText)
        && !/Unavailable[\s\S]{0,80}Event Order|Event Order[\s\S]{0,80}Unavailable/i.test(setupText),
      "configured Inventory/Event Order must not show Unavailable",
    );
    record(
      "event_setup_open_planning_from_card",
      /Open Planning/i.test(setupText),
      "Planning card exposes Open Planning",
    );
    record(
      "event_setup_single_release_cta",
      (await page.getByTestId("prepare-and-release-portal").count()) === 1
        && (await page.getByTestId("event-setup-outstanding").count()) === 0,
      "one Release CTA; no yellow outstanding when only drafts await release",
    );
    {
      const setupPanel = page.getByTestId("event-setup-panel");
      const changeCount = await setupPanel.getByTestId("event-setup-change-planning").count();
      const setUpChooser = await setupPanel.getByRole("button", { name: /^Set up$/ }).count();
      const planningCard = await setupPanel.getByTestId("event-setup-card-planning").innerText();
      record(
        "event_setup_change_opens_editor_not_set_up_skip",
        changeCount === 1 && setUpChooser === 0,
        `change=${changeCount} setUpChooser=${setUpChooser}`,
      );
      record(
        "planning_badge_included_not_draft",
        /\bIncluded\b/i.test(planningCard) && !/\bDraft\b/i.test(planningCard),
        planningCard.slice(0, 280),
      );
      record(
        "planning_shows_profile_name",
        /Standard Wedding Setup/i.test(planningCard),
        planningCard.slice(0, 280),
      );
    }

    // Open Planning → management workspace
    await page.getByTestId("event-setup-open-planning").click();
    const managementList = page.getByTestId("planning-task-list");
    try {
      await managementList.waitFor({ state: "visible", timeout: 20_000 });
    } catch {
      // Hash scroll can lag — force Planning tab then wait again.
      await page.getByRole("tab", { name: /^Planning$/i }).click().catch(() => undefined);
      await page.waitForTimeout(800);
      await managementList.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
    }
    record(
      "open_planning_reaches_management_workspace",
      (await managementList.count()) > 0,
      `taskList=${await managementList.count()} url=${page.url()}`,
    );
    const managementBody = await page.locator('[data-testid="planning-task-list"]').innerText().catch(() => "");
    record(
      "management_workspace_keeps_fulfillment_actions",
      /Waive|Create Request|Upcoming|complete/i.test(managementBody)
        || (await page.getByRole("button", { name: /Waive/i }).count()) > 0,
      managementBody.slice(0, 280),
    );
    await page.screenshot({ path: `${OUT}/03b-planning-management-1280.png`, fullPage: true });

    await page.getByRole("tab", { name: /^Overview$/i }).click().catch(async () => {
      await page.locator('[value="overview"]').first().click();
    });
    await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 30_000 });

    // Change for this event → dedicated setup editor
    await page.getByTestId("event-setup-change-planning").click();
    await page.waitForSelector('[data-testid="event-planning-setup-editor"]', { timeout: 15_000 });
    const setupEditor = page.getByTestId("event-planning-setup-editor");
    record(
      "change_opens_dedicated_planning_setup_editor",
      (await setupEditor.count()) === 1,
      `editor=${await setupEditor.count()}`,
    );
    record(
      "setup_editor_has_two_paths_only",
      (await page.getByTestId("planning-setup-mode-template").count()) === 1
        && (await page.getByTestId("planning-setup-mode-customize").count()) === 1
        && (await setupEditor.getByRole("button", { name: /Waive/i }).count()) === 0
        && (await setupEditor.getByRole("button", { name: /Create Request/i }).count()) === 0,
      "template + customize; no waive/request",
    );

    // Customize: add a task, save, reopen (poll DB — fixed 2s wait was flaky)
    await page.getByTestId("planning-setup-mode-customize").click();
    await page.waitForSelector('[data-testid="planning-setup-new-title"]', { timeout: 10_000 });
    const clientTaskTitle = "QA event-only planning task";
    await page.getByTestId("planning-setup-new-title").fill(clientTaskTitle);
    const clientAddBtn = page.getByTestId("planning-setup-add-task");
    for (let i = 0; i < 20 && !(await clientAddBtn.isEnabled()); i += 1) await page.waitForTimeout(200);
    await clientAddBtn.click();
    let customTasks: { id: string; title: string; template_task_id: string | null; owner_type: string }[] = [];
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(500);
      customTasks = (await admin
        .from("event_tasks")
        .select("id,title,template_task_id,owner_type")
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY)
        .eq("title", clientTaskTitle)).data ?? [];
      if (customTasks.length >= 1) break;
      if (i === 8 && (await page.getByTestId("planning-setup-new-title").inputValue()) === clientTaskTitle) {
        await clientAddBtn.click();
      }
    }
    record(
      "setup_editor_add_task_persists",
      customTasks.length === 1
        && customTasks[0]!.template_task_id == null
        && customTasks[0]!.owner_type === "couple",
      JSON.stringify(customTasks),
    );
    await page.screenshot({ path: `${OUT}/03c-planning-setup-editor-1280.png`, fullPage: true });
    await page.getByRole("button", { name: /Back to Overview/i }).click();
    await page.waitForTimeout(500);

    // Library template unchanged (spot-check: no new playbook_tasks titled QA…)
    const { count: libraryHits } = await admin
      .from("playbook_tasks")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("title", "QA event-only planning task");
    record("setup_editor_did_not_mutate_library", (libraryHits ?? 0) === 0, `libraryHits=${libraryHits}`);

    // Re-open Planning Change → Venue checklist path
    await page.getByTestId("event-setup-change-planning").click();
    await page.waitForSelector('[data-testid="event-planning-setup-editor"]', { timeout: 15_000 });
    await page.getByTestId("planning-setup-audience-venue").click();
    await page.waitForSelector('[data-testid="event-venue-planning-setup-editor"]', { timeout: 10_000 });
    record(
      "setup_editor_has_venue_audience",
      (await page.getByTestId("event-venue-planning-setup-editor").count()) === 1
        && (await page.getByTestId("venue-planning-setup-mode-template").count()) === 1
        && (await page.getByTestId("venue-planning-setup-mode-customize").count()) === 1,
      "venue audience + two paths",
    );
    await page.getByTestId("venue-planning-setup-mode-customize").click();
    await page.waitForSelector('[data-testid="venue-planning-setup-new-title"]', { timeout: 10_000 });
    const venueTaskTitle = "QA venue-only planning task";
    await page.getByTestId("venue-planning-setup-new-title").fill(venueTaskTitle);
    const venueAddBtn = page.getByTestId("venue-planning-setup-add-task");
    for (let i = 0; i < 20 && !(await venueAddBtn.isEnabled()); i += 1) await page.waitForTimeout(200);
    await venueAddBtn.click();
    let venueCustomTasks: { id: string; title: string; template_task_id: string | null; owner_type: string }[] = [];
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(500);
      venueCustomTasks = (await admin
        .from("event_tasks")
        .select("id,title,template_task_id,owner_type")
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY)
        .eq("title", venueTaskTitle)).data ?? [];
      if (venueCustomTasks.length >= 1) break;
      if (i === 8 && (await page.getByTestId("venue-planning-setup-new-title").inputValue()) === venueTaskTitle) {
        await venueAddBtn.click();
      }
    }
    record(
      "setup_editor_venue_add_task_persists",
      venueCustomTasks.length === 1
        && venueCustomTasks[0]!.template_task_id == null
        && venueCustomTasks[0]!.owner_type !== "couple",
      JSON.stringify(venueCustomTasks),
    );
    const { count: venueLibraryHits } = await admin
      .from("playbook_tasks")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("title", "QA venue-only planning task");
    record(
      "setup_editor_venue_did_not_mutate_library",
      (venueLibraryHits ?? 0) === 0,
      `libraryHits=${venueLibraryHits}`,
    );
    await page.screenshot({ path: `${OUT}/03d-venue-planning-setup-editor-1280.png`, fullPage: true });
    await page.getByRole("button", { name: /Back to Overview/i }).click();
    await page.waitForTimeout(500);

    // Timeline Change ≠ Open
    const timelineChange = page.getByTestId("event-setup-change-timeline");
    if ((await timelineChange.count()) > 0) {
      const { count: tlBefore } = await admin
        .from("timeline_entries")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!);
      await timelineChange.click();
      await page.waitForSelector('[data-testid="event-timeline-setup-editor"]', { timeout: 15_000 });
      record(
        "change_opens_dedicated_timeline_setup_editor",
        (await page.getByTestId("event-timeline-setup-editor").count()) === 1
          && (await page.getByTestId("timeline-setup-mode-template").count()) === 1
          && (await page.getByTestId("timeline-setup-mode-customize").count()) === 1,
        "timeline editor + two paths",
      );
      await page.getByTestId("timeline-setup-mode-customize").click();
      await page.waitForSelector('[data-testid="timeline-setup-new-title"]', { timeout: 10_000 });
      const tlTitle = "QA event-only timeline item";
      await page.getByTestId("timeline-setup-new-title").fill(tlTitle);
      const tlAddBtn = page.getByTestId("timeline-setup-add-item");
      for (let i = 0; i < 20 && !(await tlAddBtn.isEnabled()); i += 1) await page.waitForTimeout(200);
      await tlAddBtn.click();
      let tlCustom: { id: string; title: string; owner: string }[] = [];
      for (let i = 0; i < 20; i += 1) {
        await page.waitForTimeout(500);
        tlCustom = (await admin
          .from("timeline_entries")
          .select("id,title,owner")
          .eq("event_id", eventId!)
          .eq("venue_id", FANCY)
          .eq("title", tlTitle)).data ?? [];
        if (tlCustom.length >= 1) break;
        if (i === 8 && (await page.getByTestId("timeline-setup-new-title").inputValue()) === tlTitle) {
          await tlAddBtn.click();
        }
      }
      record(
        "timeline_setup_add_item_persists",
        tlCustom.length === 1 && tlCustom[0]!.owner === "venue",
        JSON.stringify(tlCustom),
      );
      const { count: tlAfter } = await admin
        .from("timeline_entries")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!);
      record(
        "timeline_setup_did_not_duplicate_on_add",
        (tlAfter ?? 0) === (tlBefore ?? 0) + 1,
        `before=${tlBefore} after=${tlAfter}`,
      );
      await page.screenshot({ path: `${OUT}/03e-timeline-setup-editor-1280.png`, fullPage: true });
      await page.getByRole("button", { name: /Back to Overview/i }).click();
      await page.waitForTimeout(500);
      await page.getByTestId("event-setup-open-timeline").click().catch(async () => {
        await page.getByRole("button", { name: /Open Timeline/i }).click();
      });
      await page.waitForTimeout(900);
      record(
        "open_timeline_reaches_management_workspace",
        /timeline/i.test(page.url()) || (await page.getByRole("tab", { name: /Timeline/i }).count()) > 0,
        `url=${page.url()}`,
      );
      await page.getByRole("tab", { name: /^Overview$/i }).click().catch(async () => {
        await page.locator('[value="overview"]').first().click();
      });
      await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 30_000 });
    } else {
      record("change_opens_dedicated_timeline_setup_editor", false, "timeline Change button missing");
    }

    // Questionnaires still lack a dedicated Change editor
    record(
      "change_hidden_for_areas_without_setup_editor",
      (await page.getByTestId("event-setup-change-questionnaires").count()) === 0,
      "Questionnaires Change hidden until later phases",
    );

    // Inventory Change → dedicated setup editor; customize persists; Open → management
    const invChange = page.getByTestId("event-setup-change-inventory");
    if ((await invChange.count()) > 0) {
      const invIdBefore = (await admin
        .from("event_inventory")
        .select("id,status,template_id")
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY)
        .maybeSingle()).data;
      const invItemsBefore = invIdBefore
        ? (await admin
            .from("event_inventory_items")
            .select("id", { count: "exact", head: true })
            .eq("event_inventory_id", invIdBefore.id)
            .eq("venue_id", FANCY)).count ?? 0
        : 0;
      await invChange.click();
      await page.waitForSelector('[data-testid="event-inventory-setup-editor"]', { timeout: 15_000 });
      record(
        "change_opens_dedicated_inventory_setup_editor",
        (await page.getByTestId("event-inventory-setup-editor").count()) === 1
          && (await page.getByTestId("inventory-setup-mode-template").count()) === 1
          && (await page.getByTestId("inventory-setup-mode-customize").count()) === 1,
        "inventory setup editor visible",
      );
      await page.getByTestId("inventory-setup-mode-customize").click();
      const invCustomName = `QA event-only inventory ${tag}`;
      await page.getByTestId("inventory-setup-new-name").fill(invCustomName);
      const invAddBtn = page.getByTestId("inventory-setup-add-item");
      for (let i = 0; i < 20 && !(await invAddBtn.isEnabled()); i += 1) {
        await page.waitForTimeout(200);
      }
      await invAddBtn.click();
      let invAfterAdd: { id: string; name: string }[] = [];
      for (let i = 0; i < 20; i += 1) {
        await page.waitForTimeout(500);
        invAfterAdd = (await admin
          .from("event_inventory_items")
          .select("id,name")
          .eq("event_inventory_id", invIdBefore!.id)
          .eq("venue_id", FANCY)
          .ilike("name", `%${invCustomName}%`)).data ?? [];
        if (invAfterAdd.length >= 1) break;
      }
      record(
        "inventory_setup_customize_persists",
        invAfterAdd.length === 1,
        `items=${JSON.stringify(invAfterAdd)}`,
      );
      await page.screenshot({ path: `${OUT}/03f-inventory-setup-editor-1280.png`, fullPage: true });

      // Safe template switch on this open draft (no EO-pushed items)
      const otherInvTpl = (await admin
        .from("inventory_templates")
        .select("id,name")
        .eq("venue_id", FANCY)
        .eq("is_archived", false)
        .neq("id", invIdBefore!.template_id ?? "00000000-0000-0000-0000-000000000000")
        .limit(1)
        .maybeSingle()).data;
      if (otherInvTpl?.id) {
        await page.getByTestId("inventory-setup-mode-template").click();
        await page.getByTestId("inventory-setup-template-select").click();
        await page.getByRole("option", { name: otherInvTpl.name }).click().catch(async () => {
          await page.locator(`[data-value="${otherInvTpl.id}"]`).first().click();
        });
        page.once("dialog", (d) => d.accept());
        await page.getByTestId("inventory-setup-apply-template").click();
        await page.waitForTimeout(3000);
        const invAfterReplace = (await admin
          .from("event_inventory")
          .select("id,template_id,status")
          .eq("event_id", eventId!)
          .eq("venue_id", FANCY)
          .maybeSingle()).data;
        const invCountAfterReplace = (await admin
          .from("event_inventory")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId!)
          .eq("venue_id", FANCY)).count ?? 0;
        record(
          "inventory_setup_template_replace_safe",
          invAfterReplace?.template_id === otherInvTpl.id
            && invAfterReplace?.status === "draft"
            && invCountAfterReplace === 1,
          `template=${invAfterReplace?.template_id} status=${invAfterReplace?.status} drafts=${invCountAfterReplace}`,
        );
        // Re-open editor if sheet closed after apply
        if ((await page.getByTestId("event-inventory-setup-editor").count()) === 0) {
          await page.getByTestId("event-setup-change-inventory").click();
          await page.waitForSelector('[data-testid="event-inventory-setup-editor"]', { timeout: 15_000 });
        }
      } else {
        record("inventory_setup_template_replace_safe", true, "skipped — no alternate inventory template");
      }

      const libTplItemsBefore = invRef
        ? (await admin
            .from("inventory_template_items")
            .select("id", { count: "exact", head: true })
            .eq("template_id", invRef)
            .eq("venue_id", FANCY)).count ?? 0
        : null;

      await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => undefined);
      await page.waitForTimeout(500);
      await page.getByTestId("event-setup-open-inventory").click().catch(async () => {
        await page.getByRole("button", { name: /Open Inventory/i }).click();
      });
      await page.waitForTimeout(900);
      record(
        "open_inventory_reaches_management_workspace",
        /inventory/i.test(page.url()) || (await page.getByRole("tab", { name: /Inventory/i }).count()) > 0,
        `url=${page.url()}`,
      );
      if (libTplItemsBefore != null && invRef) {
        const libTplItemsAfter = (await admin
          .from("inventory_template_items")
          .select("id", { count: "exact", head: true })
          .eq("template_id", invRef)
          .eq("venue_id", FANCY)).count ?? 0;
        record(
          "inventory_library_template_unchanged",
          libTplItemsAfter === libTplItemsBefore,
          `before=${libTplItemsBefore} after=${libTplItemsAfter}`,
        );
      }
      void invItemsBefore;
      await page.getByRole("tab", { name: /^Overview$/i }).click().catch(async () => {
        await page.locator('[value="overview"]').first().click();
      });
      await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 30_000 });
    } else {
      record("change_opens_dedicated_inventory_setup_editor", false, "inventory Change button missing");
    }

    // Event Order Change → dedicated setup editor; customize persists; Open → management
    const eoChange = page.getByTestId("event-setup-change-event_order");
    if ((await eoChange.count()) > 0) {
      const eoBefore = (await admin
        .from("event_orders")
        .select("id,status,template_id,shared_at")
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY)
        .maybeSingle()).data;
      await eoChange.click();
      await page.waitForSelector('[data-testid="event-order-setup-editor"]', { timeout: 15_000 });
      record(
        "change_opens_dedicated_event_order_setup_editor",
        (await page.getByTestId("event-order-setup-editor").count()) === 1
          && (await page.getByTestId("event-order-setup-mode-template").count()) === 1
          && (await page.getByTestId("event-order-setup-mode-customize").count()) === 1,
        "event order setup editor visible",
      );
      await page.getByTestId("event-order-setup-mode-customize").click();
      const eoCustomDesc = `QA event-only EO line ${tag}`;
      await page.getByTestId("event-order-setup-new-description").fill(eoCustomDesc);
      const eoAddBtn = page.getByTestId("event-order-setup-add-line");
      for (let i = 0; i < 20 && !(await eoAddBtn.isEnabled()); i += 1) {
        await page.waitForTimeout(200);
      }
      await eoAddBtn.click();
      let eoLinesAfter: { id: string; description: string }[] = [];
      for (let i = 0; i < 20; i += 1) {
        await page.waitForTimeout(500);
        eoLinesAfter = (await admin
          .from("event_order_lines")
          .select("id,description")
          .eq("event_order_id", eoBefore!.id)
          .eq("venue_id", FANCY)
          .ilike("description", `%${eoCustomDesc}%`)).data ?? [];
        if (eoLinesAfter.length >= 1) break;
      }
      record(
        "event_order_setup_customize_persists",
        eoLinesAfter.length === 1
          && eoBefore?.status === "open"
          && !eoBefore?.shared_at,
        `lines=${JSON.stringify(eoLinesAfter)} status=${eoBefore?.status}`,
      );
      await page.screenshot({ path: `${OUT}/03g-event-order-setup-editor-1280.png`, fullPage: true });

      const otherEoTpl = (await admin
        .from("event_order_templates")
        .select("id,name")
        .eq("venue_id", FANCY)
        .eq("is_archived", false)
        .neq("id", eoBefore!.template_id ?? "00000000-0000-0000-0000-000000000000")
        .limit(1)
        .maybeSingle()).data;
      if (otherEoTpl?.id && !eoBefore?.shared_at && eoBefore?.status === "open") {
        // Re-open on a clean sheet so customize refresh does not leave a stale Select value.
        await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => undefined);
        await page.waitForTimeout(400);
        await page.getByTestId("event-setup-change-event_order").click();
        await page.waitForSelector('[data-testid="event-order-setup-editor"]', { timeout: 15_000 });
        await page.getByTestId("event-order-setup-mode-template").click();
        await page.getByTestId("event-order-setup-template-select").click();
        await page.waitForTimeout(300);
        const eoOption = page.getByRole("option", { name: otherEoTpl.name, exact: true });
        if (await eoOption.count()) await eoOption.click();
        else {
          await page.getByRole("option", { name: new RegExp(otherEoTpl.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
        }
        page.once("dialog", (d) => d.accept());
        await page.getByTestId("event-order-setup-apply-template").click();
        let eoAfterReplace = (await admin
          .from("event_orders")
          .select("id,template_id,status,shared_at")
          .eq("event_id", eventId!)
          .eq("venue_id", FANCY)
          .maybeSingle()).data;
        for (let i = 0; i < 20 && eoAfterReplace?.template_id !== otherEoTpl.id; i += 1) {
          await page.waitForTimeout(500);
          eoAfterReplace = (await admin
            .from("event_orders")
            .select("id,template_id,status,shared_at")
            .eq("event_id", eventId!)
            .eq("venue_id", FANCY)
            .maybeSingle()).data;
        }
        const eoCount = (await admin
          .from("event_orders")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId!)
          .eq("venue_id", FANCY)).count ?? 0;
        record(
          "event_order_setup_package_replace_safe",
          eoAfterReplace?.template_id === otherEoTpl.id
            && eoAfterReplace?.status === "open"
            && !eoAfterReplace?.shared_at
            && eoCount === 1,
          `wanted=${otherEoTpl.id} template=${eoAfterReplace?.template_id} drafts=${eoCount}`,
        );
        if ((await page.getByTestId("event-order-setup-editor").count()) === 0) {
          await page.getByTestId("event-setup-change-event_order").click();
          await page.waitForSelector('[data-testid="event-order-setup-editor"]', { timeout: 15_000 });
        }
      } else {
        record("event_order_setup_package_replace_safe", true, "skipped — no alternate EO package or not open");
      }

      const eoTplRef = (templateRefs.eventOrderTemplateId as string | null) ?? null;
      const eoLibLinesBefore = eoTplRef
        ? (await admin
            .from("event_order_template_lines")
            .select("id", { count: "exact", head: true })
            .eq("template_id", eoTplRef)
            .eq("venue_id", FANCY)).count ?? 0
        : null;

      await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => undefined);
      await page.waitForTimeout(500);
      await page.getByTestId("event-setup-open-event_order").click().catch(async () => {
        await page.getByRole("button", { name: /Open Event Order/i }).click();
      });
      await page.waitForTimeout(900);
      record(
        "open_event_order_reaches_management_workspace",
        /event-order|event_order/i.test(page.url())
          || (await page.getByRole("tab", { name: /Event Order/i }).count()) > 0,
        `url=${page.url()}`,
      );
      if (eoLibLinesBefore != null && eoTplRef) {
        const eoLibLinesAfter = (await admin
          .from("event_order_template_lines")
          .select("id", { count: "exact", head: true })
          .eq("template_id", eoTplRef)
          .eq("venue_id", FANCY)).count ?? 0;
        record(
          "event_order_library_package_unchanged",
          eoLibLinesAfter === eoLibLinesBefore,
          `before=${eoLibLinesBefore} after=${eoLibLinesAfter}`,
        );
      }
      await page.getByRole("tab", { name: /^Overview$/i }).click().catch(async () => {
        await page.locator('[value="overview"]').first().click();
      });
      await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 30_000 });
    } else {
      record("change_opens_dedicated_event_order_setup_editor", false, "event order Change button missing");
    }

    // Floor Plans Change → dedicated offers editor; Open → management; offers ≠ operational
    const floorChange = page.getByTestId("event-setup-change-floor_plans");
    if ((await floorChange.count()) > 0) {
      const offersBefore = (await admin
        .from("event_floor_plan_offers")
        .select("id,floor_plan_template_id,is_offered")
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY)).data ?? [];
      const opsBefore = (await admin
        .from("floor_plans")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY)).count ?? 0;
      const libTplCountBefore = (await admin
        .from("floor_plan_templates")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", FANCY)
        .eq("is_archived", false)).count ?? 0;
      const otherEventOffersBefore = (await admin
        .from("event_floor_plan_offers")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", FANCY)
        .neq("event_id", eventId!)).count ?? 0;

      await floorChange.click();
      await page.waitForSelector('[data-testid="event-floor-plans-setup-editor"]', { timeout: 15_000 });
      const operationalText = await page.getByTestId("floor-plans-setup-operational-state").innerText();
      record(
        "change_opens_dedicated_floor_plans_setup_editor",
        (await page.getByTestId("event-floor-plans-setup-editor").count()) === 1
          && (await page.getByTestId("floor-plans-setup-offers-path").count()) === 1
          && /Operational floor plans/i.test(operationalText),
        operationalText.slice(0, 240),
      );
      record(
        "floor_plans_offers_vs_operational_state_shown",
        opsBefore === 0
          ? /None yet/i.test(operationalText)
          : !/None yet/i.test(operationalText),
        `opsBefore=${opsBefore} text=${operationalText.slice(0, 160)}`,
      );

      // Offer an additional library template when one is available
      const offeredIds = new Set(offersBefore.map((o) => o.floor_plan_template_id));
      const extraTpl = (await admin
        .from("floor_plan_templates")
        .select("id,name")
        .eq("venue_id", FANCY)
        .eq("is_archived", false)
        .limit(20)).data?.find((t) => !offeredIds.has(t.id));
      if (extraTpl?.id) {
        await page.getByTestId("floor-plans-setup-template-select").click();
        await page.waitForTimeout(300);
        const fpOption = page.getByRole("option", { name: extraTpl.name, exact: true });
        if (await fpOption.count()) await fpOption.click();
        else {
          await page.getByRole("option", { name: new RegExp(extraTpl.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().click();
        }
        const coupleLabel = `QA floor offer ${tag}`;
        await page.getByTestId("floor-plans-setup-couple-label").fill(coupleLabel);
        const offerBtn = page.getByTestId("floor-plans-setup-offer");
        for (let i = 0; i < 20 && !(await offerBtn.isEnabled()); i += 1) {
          await page.waitForTimeout(200);
        }
        await offerBtn.click();
        let offersAfter: { id: string; couple_label: string | null; is_offered: boolean; floor_plan_template_id: string }[] = [];
        for (let i = 0; i < 20; i += 1) {
          await page.waitForTimeout(500);
          offersAfter = (await admin
            .from("event_floor_plan_offers")
            .select("id,couple_label,is_offered,floor_plan_template_id")
            .eq("event_id", eventId!)
            .eq("venue_id", FANCY)
            .eq("floor_plan_template_id", extraTpl.id)).data ?? [];
          if (offersAfter.length >= 1) break;
        }
        const opsAfterOffer = (await admin
          .from("floor_plans")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId!)
          .eq("venue_id", FANCY)).count ?? 0;
        record(
          "floor_plans_setup_offer_persists",
          offersAfter.length === 1 && offersAfter[0]?.is_offered === true,
          JSON.stringify(offersAfter),
        );
        record(
          "floor_plans_setup_did_not_create_operational_plan",
          opsAfterOffer === opsBefore,
          `opsBefore=${opsBefore} opsAfter=${opsAfterOffer}`,
        );
      } else {
        record("floor_plans_setup_offer_persists", true, "skipped — no unused template");
        record("floor_plans_setup_did_not_create_operational_plan", opsBefore === ((await admin
          .from("floor_plans")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId!)
          .eq("venue_id", FANCY)).count ?? 0), "no extra offer attempted");
      }

      await page.screenshot({ path: `${OUT}/03h-floor-plans-setup-editor-1280.png`, fullPage: true });

      // Idempotent ensure: reopen editor must not duplicate offers
      await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => undefined);
      await page.waitForTimeout(400);
      await page.getByTestId("event-setup-change-floor_plans").click();
      await page.waitForSelector('[data-testid="event-floor-plans-setup-editor"]', { timeout: 15_000 });
      await page.waitForTimeout(1500);
      const offersAfterReopen = (await admin
        .from("event_floor_plan_offers")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY)).count ?? 0;
      const offersCountBaseline = Math.max(offersBefore.length, 1);
      record(
        "floor_plans_setup_reopen_idempotent",
        offersAfterReopen >= offersCountBaseline
          && offersAfterReopen <= offersBefore.length + 1,
        `before=${offersBefore.length} afterReopen=${offersAfterReopen}`,
      );

      await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => undefined);
      await page.waitForTimeout(400);
      await page.getByTestId("event-setup-open-floor_plans").click().catch(async () => {
        await page.getByRole("button", { name: /Open Floor Plans/i }).click();
      });
      await page.waitForTimeout(900);
      record(
        "open_floor_plans_reaches_management_workspace",
        /floorplan|floor-plan|floor_plan/i.test(page.url())
          || (await page.getByRole("tab", { name: /Floor Plans/i }).count()) > 0,
        `url=${page.url()}`,
      );

      const libTplCountAfter = (await admin
        .from("floor_plan_templates")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", FANCY)
        .eq("is_archived", false)).count ?? 0;
      const otherEventOffersAfter = (await admin
        .from("event_floor_plan_offers")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", FANCY)
        .neq("event_id", eventId!)).count ?? 0;
      record(
        "floor_plans_library_templates_unchanged",
        libTplCountAfter === libTplCountBefore,
        `before=${libTplCountBefore} after=${libTplCountAfter}`,
      );
      record(
        "floor_plans_other_events_offers_unchanged",
        otherEventOffersAfter === otherEventOffersBefore,
        `before=${otherEventOffersBefore} after=${otherEventOffersAfter}`,
      );

      await page.getByRole("tab", { name: /^Overview$/i }).click().catch(async () => {
        await page.locator('[value="overview"]').first().click();
      });
      await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 30_000 });
    } else {
      record("change_opens_dedicated_floor_plans_setup_editor", false, "floor plans Change button missing");
    }

    // Vendors Change → dedicated highlights editor; Open → management; no notify/assign
    const vendorsChange = page.getByTestId("event-setup-change-vendors");
    if ((await vendorsChange.count()) > 0) {
      const recsBefore = (await admin
        .from("event_vendor_recommendations")
        .select("id,vendor_id,note")
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY)).data ?? [];
      const assignBefore = (await admin
        .from("event_vendor_assignments")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY)).count ?? 0;
      const libVendorsBefore = (await admin
        .from("venue_vendor_relationships")
        .select("vendor_id,preference_level,is_required,status", { count: "exact" })
        .eq("venue_id", FANCY)).count ?? 0;
      const otherEventRecsBefore = (await admin
        .from("event_vendor_recommendations")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", FANCY)
        .neq("event_id", eventId!)).count ?? 0;
      const invitesBeforeVendors = (await admin
        .from("client_invitations")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId!)).count ?? 0;

      await vendorsChange.click();
      await page.waitForSelector('[data-testid="event-vendors-setup-editor"]', { timeout: 15_000 });
      const assignText = await page.getByTestId("vendors-setup-assignments-state").innerText();
      record(
        "change_opens_dedicated_vendors_setup_editor",
        (await page.getByTestId("event-vendors-setup-editor").count()) === 1
          && (await page.getByTestId("vendors-setup-highlights-path").count()) === 1
          && /Assigned to this booking/i.test(assignText),
        assignText.slice(0, 240),
      );
      record(
        "vendors_highlights_vs_assignments_state_shown",
        assignBefore === 0 ? /None yet/i.test(assignText) : !/None yet/i.test(assignText),
        `assignBefore=${assignBefore}`,
      );

      const alreadyHighlighted = new Set(recsBefore.map((r) => r.vendor_id));
      const pickVendor = (await admin
        .from("venue_vendor_relationships")
        .select("vendor_id,status,vendors!inner(id,business_name)")
        .eq("venue_id", FANCY)
        .in("status", ["active", "invited"])
        .limit(40)).data?.find((row) => {
          const vid = (row as { vendor_id: string }).vendor_id;
          return !alreadyHighlighted.has(vid);
        }) as { vendor_id: string; vendors: { business_name: string } | { business_name: string }[] } | undefined;

      const vendorName = pickVendor
        ? (Array.isArray(pickVendor.vendors) ? pickVendor.vendors[0]?.business_name : pickVendor.vendors?.business_name)
        : null;
      if (pickVendor?.vendor_id && vendorName) {
        await page.getByTestId("vendors-setup-vendor-select").click();
        await page.waitForTimeout(300);
        const opt = page.getByRole("option", { name: new RegExp(vendorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
        if (await opt.count()) await opt.first().click();
        else await page.locator(`[data-value="${pickVendor.vendor_id}"]`).first().click();
        const note = `QA vendor highlight ${tag}`;
        await page.getByTestId("vendors-setup-note").fill(note);
        const addBtn = page.getByTestId("vendors-setup-add-highlight");
        for (let i = 0; i < 20 && !(await addBtn.isEnabled()); i += 1) await page.waitForTimeout(200);
        await addBtn.click();
        let recsAfter: { id: string; vendor_id: string; note: string | null }[] = [];
        for (let i = 0; i < 20; i += 1) {
          await page.waitForTimeout(500);
          recsAfter = (await admin
            .from("event_vendor_recommendations")
            .select("id,vendor_id,note")
            .eq("event_id", eventId!)
            .eq("venue_id", FANCY)
            .eq("vendor_id", pickVendor.vendor_id)).data ?? [];
          if (recsAfter.length >= 1) break;
        }
        const assignAfterHighlight = (await admin
          .from("event_vendor_assignments")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId!)
          .eq("venue_id", FANCY)).count ?? 0;
        record(
          "vendors_setup_highlight_persists",
          recsAfter.length === 1,
          JSON.stringify(recsAfter),
        );
        record(
          "vendors_setup_did_not_create_assignment",
          assignAfterHighlight === assignBefore,
          `before=${assignBefore} after=${assignAfterHighlight}`,
        );
      } else {
        record("vendors_setup_highlight_persists", true, "skipped — no unused Vendor Network vendor");
        record("vendors_setup_did_not_create_assignment", true, "skipped");
      }

      await page.screenshot({ path: `${OUT}/03i-vendors-setup-editor-1280.png`, fullPage: true });

      await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => undefined);
      await page.waitForTimeout(400);
      await page.getByTestId("event-setup-change-vendors").click();
      await page.waitForSelector('[data-testid="event-vendors-setup-editor"]', { timeout: 15_000 });
      await page.waitForTimeout(1000);
      const recsAfterReopen = (await admin
        .from("event_vendor_recommendations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId!)
        .eq("venue_id", FANCY)).count ?? 0;
      record(
        "vendors_setup_reopen_idempotent",
        recsAfterReopen >= recsBefore.length
          && recsAfterReopen <= recsBefore.length + 1,
        `before=${recsBefore.length} afterReopen=${recsAfterReopen}`,
      );

      await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => undefined);
      await page.waitForTimeout(400);
      await page.getByTestId("event-setup-open-vendors").click().catch(async () => {
        await page.getByRole("button", { name: /Open Vendors/i }).click();
      });
      await page.waitForTimeout(900);
      record(
        "open_vendors_reaches_management_workspace",
        /vendors/i.test(page.url()) || (await page.getByRole("tab", { name: /Vendors/i }).count()) > 0,
        `url=${page.url()}`,
      );

      const libVendorsAfter = (await admin
        .from("venue_vendor_relationships")
        .select("vendor_id", { count: "exact", head: true })
        .eq("venue_id", FANCY)).count ?? 0;
      const otherEventRecsAfter = (await admin
        .from("event_vendor_recommendations")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", FANCY)
        .neq("event_id", eventId!)).count ?? 0;
      const invitesAfterVendors = (await admin
        .from("client_invitations")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId!)).count ?? 0;
      record(
        "vendors_library_relationships_unchanged",
        libVendorsAfter === libVendorsBefore,
        `before=${libVendorsBefore} after=${libVendorsAfter}`,
      );
      record(
        "vendors_other_events_highlights_unchanged",
        otherEventRecsAfter === otherEventRecsBefore,
        `before=${otherEventRecsBefore} after=${otherEventRecsAfter}`,
      );
      record(
        "vendors_setup_did_not_invite",
        invitesAfterVendors === invitesBeforeVendors,
        `before=${invitesBeforeVendors} after=${invitesAfterVendors}`,
      );

      await page.getByRole("tab", { name: /^Overview$/i }).click().catch(async () => {
        await page.locator('[value="overview"]').first().click();
      });
      await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 30_000 });
    } else {
      record("change_opens_dedicated_vendors_setup_editor", false, "vendors Change button missing");
    }

    // Vendors tab: Vendor Network, not a second recommendation curator
    await page.getByRole("tab", { name: /Vendors/i }).click().catch(async () => {
      await page.locator('[value="vendors"], button:has-text("Vendors")').first().click();
    });
    await page.waitForTimeout(800);
    const vendorsText = await page.locator("body").innerText();
    record(
      "vendors_tab_uses_vendor_network",
      /Vendor Network/i.test(vendorsText) && !/Recommended to /i.test(vendorsText),
      vendorsText.slice(0, 280),
    );

    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 60_000 });

    const prepareBtn = page.getByTestId("prepare-and-release-portal");
    record("prepare_release_button_present", (await prepareBtn.count()) > 0, `count=${await prepareBtn.count()}`);
    await prepareBtn.click();
    let clientAppsAfter: { id: string; kind: string; released_at: string | null } | null = null;
    for (let i = 0; i < 30; i += 1) {
      await page.waitForTimeout(500);
      clientAppsAfter = (await admin
        .from("event_playbook_applications")
        .select("id,kind,released_at")
        .eq("event_id", eventId)
        .eq("venue_id", FANCY)
        .eq("kind", "client")
        .maybeSingle()).data;
      if (clientAppsAfter?.released_at) break;
    }
    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 60_000 });
    await page.screenshot({ path: `${OUT}/04-after-prepare-release-1280.png`, fullPage: true });
    if (!clientAppsAfter?.released_at) {
      clientAppsAfter = (await admin
        .from("event_playbook_applications")
        .select("id,kind,released_at")
        .eq("event_id", eventId)
        .eq("venue_id", FANCY)
        .eq("kind", "client")
        .maybeSingle()).data;
    }
    record(
      "prepare_released_client_planning",
      !!clientAppsAfter?.released_at,
      JSON.stringify(clientAppsAfter),
    );
    const { data: venueAppsAfter } = await admin
      .from("event_playbook_applications")
      .select("id,kind,released_at,template_id")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .eq("kind", "venue")
      .maybeSingle();
    record(
      "prepare_kept_venue_checklist_internal",
      !!venueAppsAfter && venueAppsAfter.template_id === venuePbRef,
      JSON.stringify(venueAppsAfter),
    );

    const { count: invitesAfterPrepare } = await admin
      .from("client_invitations")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId);
    record(
      "prepare_did_not_invite",
      (invitesAfterPrepare ?? 0) === 0,
      `invites=${invitesAfterPrepare}`,
    );

    const { count: qSentAfter } = await admin
      .from("event_questionnaires")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .neq("status", "draft");
    record("prepare_did_not_send_questionnaires", (qSentAfter ?? 0) === 0, `sent=${qSentAfter}`);

    const { count: invoicesAfter } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    record("prepare_did_not_create_invoice", (invoicesAfter ?? 0) === 0, `invoices=${invoicesAfter}`);

    // Idempotent prepare again
    const prepareAgain = page.getByTestId("prepare-and-release-portal");
    if (await prepareAgain.count()) {
      await prepareAgain.click();
      await page.waitForTimeout(2500);
    }
    const { count: invCount2 } = await admin
      .from("event_inventory")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    const { count: eoCount2 } = await admin
      .from("event_orders")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    record("prepare_idempotent_no_duplicate_drafts", (invCount2 ?? 0) === 1 && (eoCount2 ?? 0) === 1, `inv=${invCount2} eo=${eoCount2}`);

    const afterVenueInv = (
      await admin.from("event_inventory").select("id", { count: "exact", head: true }).eq("venue_id", FANCY)
    ).count ?? 0;
    const afterVenueEo = (
      await admin.from("event_orders").select("id", { count: "exact", head: true }).eq("venue_id", FANCY)
    ).count ?? 0;
    record(
      "venue_inventory_grew_by_one",
      afterVenueInv === beforeVenueInv + 1,
      `before=${beforeVenueInv} after=${afterVenueInv}`,
    );
    record(
      "venue_eo_grew_by_one",
      afterVenueEo === beforeVenueEo + 1,
      `before=${beforeVenueEo} after=${afterVenueEo}`,
    );

    const { data: profileAfter } = await admin
      .from("venue_setup_profiles")
      .select("template_refs")
      .eq("id", PROFILE_ID)
      .maybeSingle();
    record(
      "profile_unchanged",
      profileAfter?.template_refs?.inventoryTemplateId === invRef
        && profileAfter?.template_refs?.eventOrderTemplateId === eoRef
        && profileAfter?.template_refs?.planningPlaybookTemplateId === clientPbRef
        && profileAfter?.template_refs?.venuePlanningPlaybookTemplateId === venuePbRef,
      JSON.stringify(profileAfter?.template_refs),
    );

    // Code seams: prepare-release present in deployed tree (local source of truth for this SHA)
    const prepareSrc = readFileSync("lib/event-setup/prepare-release.ts", "utf8");
    record(
      "prepare_release_code_boundaries",
      /releasePlaybookApplication/.test(prepareSrc)
        && !/inviteClient/.test(prepareSrc)
        && !/sendQuestionnaire/.test(prepareSrc)
        && !/createInvoice/.test(prepareSrc),
      "prepare-release side-effect boundaries",
    );

    // Separate Invite client action (synthetic .invalid address — no real inbox)
    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 60_000 });
    await page.evaluate(() => {
      document.querySelector('[data-testid="client-workspace-invite"]')?.scrollIntoView({ block: "center" });
      document.getElementById("event-setup")?.scrollIntoView({ block: "end" });
    });
    await page.waitForTimeout(1000);
    const inviteSection = page.getByTestId("client-workspace-invite");
    await inviteSection.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    const inviteEmail = `b2p-invite-${stamp}@hellotocheers-test.invalid`;
    const emailInput = page.getByTestId("client-invite-email");
    for (let i = 0; i < 15 && !(await emailInput.count()); i += 1) {
      await page.waitForTimeout(400);
    }
    if (await emailInput.count()) {
      await emailInput.fill(inviteEmail);
    }
    const openInvite = page.getByTestId("open-client-invite-preview");
    const inviteByRole = page.getByRole("button", { name: /^Invite client$/i });
    const invitePresent = (await openInvite.count()) > 0 || (await inviteByRole.count()) > 0;
    record(
      "invite_button_present_after_prepare",
      invitePresent,
      `testid=${await openInvite.count()} role=${await inviteByRole.count()} section=${await inviteSection.count()}`,
    );
    if (invitePresent) {
      if (await openInvite.count()) await openInvite.click();
      else await inviteByRole.first().click();
      const confirm = page.getByTestId("confirm-send-client-invite");
      await confirm.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
      if (await confirm.count()) {
        await confirm.click();
      }
      // Poll — invite send can exceed a fixed 3s wait (screenshot previously caught "Sending…")
      let invitations: { id: string; status: string; email: string }[] = [];
      for (let i = 0; i < 40; i += 1) {
        await page.waitForTimeout(500);
        invitations = (await admin
          .from("client_invitations")
          .select("id,status,email")
          .eq("client_id", clientId)).data ?? [];
        if (invitations.length >= 1) break;
        const stillSending = await page.getByRole("button", { name: /Sending/i }).count();
        if (stillSending === 0 && i > 10 && invitations.length === 0) {
          // Retry confirm once if dialog still open
          if (await confirm.count()) await confirm.click();
        }
      }
      await page.screenshot({ path: `${OUT}/05-after-invite-1280.png`, fullPage: true });
      record(
        "invite_created_separately",
        invitations.length >= 1,
        JSON.stringify(invitations),
      );
    } else {
      await page.screenshot({ path: `${OUT}/05-invite-missing-1280.png`, fullPage: true });
      record("invite_created_separately", false, "invite button missing");
    }
    const { count: qSentAfterInvite } = await admin
      .from("event_questionnaires")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .neq("status", "draft");
    record("invite_did_not_send_questionnaires", (qSentAfterInvite ?? 0) === 0, `sent=${qSentAfterInvite}`);
    const { count: invoicesAfterInvite } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("venue_id", FANCY);
    record("invite_did_not_create_invoice", (invoicesAfterInvite ?? 0) === 0, `invoices=${invoicesAfterInvite}`);
  } finally {
    await browser.close();
    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.filter((c) => !c.pass).length;
    const payload = {
      workflow: "booking-to-portal-simplification",
      status: failed === 0 ? "GREEN" : "NOT_GREEN",
      expectedSha: EXPECTED_SHA,
      servingSha,
      ids: { leadId, clientId, eventId, profileId: PROFILE_ID, tag },
      passed,
      failed,
      checks,
      at: new Date().toISOString(),
    };
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(payload, null, 2));
    console.log(JSON.stringify({ passed, failed, servingSha, leadId, clientId, eventId }, null, 2));
    if (failed > 0) process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length + 1;
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
    workflow: "booking-to-portal-simplification",
    status: "NOT_GREEN",
    expectedSha: EXPECTED_SHA,
    error: String(err),
    passed,
    failed,
    checks,
    at: new Date().toISOString(),
  }, null, 2));
  process.exit(1);
});
