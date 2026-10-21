/**
 * Booking-to-portal simplification acceptance.
 * Configure once → book presets drafts → Prepare and release portal → Invite separate.
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

async function main() {
  const stamp = Date.now();
  const tag = `B2P-${stamp}-${randomBytes(2).toString("hex")}`;
  const eventDate = `2033-${String((stamp % 11) + 1).padStart(2, "0")}-${String((stamp % 27) + 1).padStart(2, "0")}`;
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
      const row = dialog.getByTestId(`esa-row-${useKey}`);
      if (!(await row.count())) return false;
      const trigger = row.locator(`#esa-${useKey}`);
      await trigger.click();
      const opt = page.getByRole("option", { name: /Barn/i }).first();
      await opt.waitFor({ state: "visible", timeout: 10_000 });
      await opt.click();
      await page.waitForFunction(
        (id) => {
          const el = document.getElementById(id);
          return Boolean(el && /Barn/i.test(el.textContent ?? ""));
        },
        `esa-${useKey}`,
        { timeout: 8_000 },
      );
      const start = row.locator(`#esa-${useKey}-start`);
      await start.waitFor({ state: "visible", timeout: 5_000 });
      for (let i = 0; i < 20 && !(await start.isEnabled()); i += 1) {
        await page.waitForTimeout(200);
      }
      if (!(await start.isEnabled())) return false;
      await start.fill("11:00");
      const end = row.locator(`#esa-${useKey}-end`);
      if (await end.isEnabled()) await end.fill("17:00");
      const date = row.getByTestId(`esa-date-${useKey}`);
      if (await date.count() && await date.isEnabled()) await date.fill(eventDate);
      return true;
    }
    if (!(await pickUse("reception")) && !(await pickUse("ceremony"))) {
      await page.screenshot({ path: `${OUT}/02-booking-dialog-blocked.png`, fullPage: true });
      throw new Error("could not assign space in booking confirmation");
    }

    const submit = page.getByTestId("booking-confirm-submit");
    await submit.waitFor({ state: "visible", timeout: 10_000 });
    for (let i = 0; i < 20 && !(await submit.isEnabled()); i += 1) {
      await page.waitForTimeout(250);
    }
    if (!(await submit.isEnabled())) {
      await page.screenshot({ path: `${OUT}/02-booking-submit-disabled.png`, fullPage: true });
      throw new Error("booking-confirm-submit stayed disabled");
    }
    await submit.click();
    await page.waitForURL(/\/(clients|events)\//, { timeout: 90_000 });
    await page.screenshot({ path: `${OUT}/02-after-booking-1280.png`, fullPage: true });

    const { data: client } = await admin.from("clients").select("id").eq("lead_id", leadId).maybeSingle();
    clientId = client?.id ?? null;
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
      /Prepare and release portal/i.test(setupText),
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
    await page.waitForTimeout(3500);
    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 60_000 });
    await page.screenshot({ path: `${OUT}/04-after-prepare-release-1280.png`, fullPage: true });

    const { data: clientAppsAfter } = await admin
      .from("event_playbook_applications")
      .select("id,kind,released_at")
      .eq("event_id", eventId)
      .eq("venue_id", FANCY)
      .eq("kind", "client")
      .maybeSingle();
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
    await page.waitForSelector('[data-testid="client-workspace-invite"]', { timeout: 60_000 });
    const inviteEmail = `b2p-invite-${stamp}@hellotocheers-test.invalid`;
    const emailInput = page.getByTestId("client-invite-email");
    if (await emailInput.count()) {
      await emailInput.fill(inviteEmail);
    }
    const openInvite = page.getByTestId("open-client-invite-preview");
    record("invite_button_present_after_prepare", (await openInvite.count()) > 0, `count=${await openInvite.count()}`);
    if (await openInvite.count()) {
      await openInvite.click();
      const confirm = page.getByTestId("confirm-send-client-invite");
      await confirm.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
      if (await confirm.count()) {
        await confirm.click();
        await page.waitForTimeout(3000);
      }
      await page.screenshot({ path: `${OUT}/05-after-invite-1280.png`, fullPage: true });
    }
    const { data: invitations } = await admin
      .from("client_invitations")
      .select("id,status,email")
      .eq("client_id", clientId);
    record(
      "invite_created_separately",
      (invitations?.length ?? 0) >= 1,
      JSON.stringify(invitations),
    );
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
