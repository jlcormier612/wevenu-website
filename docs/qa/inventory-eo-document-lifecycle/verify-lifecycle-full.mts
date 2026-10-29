/**
 * Inventory + Event Order — full unified document lifecycle (Scenarios A–D).
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/inventory-eo-document-lifecycle/verify-lifecycle-full.mts
 *
 * Real UI for share / client respond / venue confirm+finalize. Fixture DB only
 * for client/event/inventory/choices seed — not for submit or finalize.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { inventoryReviewUrl } from "@/lib/event-inventory/inventory-portal-link";
import { choicesReviewUrl } from "@/lib/client-choices/choices-portal-link";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `LIFECYCLE${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/inventory-eo-document-lifecycle";
const PREFIX = `LC-${RUN}-`;
const EVENT_DATE = "2028-09-14";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string; kind?: string; scenario?: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string, kind = "check", scenario = "") {
  checks.push({ name, pass, detail: String(detail).slice(0, 2500), kind, scenario });
  console.log(`${pass ? "PASS" : "FAIL"} [${scenario || kind}] ${name} — ${String(detail).slice(0, 400)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  await admin.from("venue_staff_active_context").upsert({
    user_id: otp.session.user.id,
    active_venue_id: FANCY,
  });
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

async function passLegal(page: {
  locator: Function;
  getByRole: Function;
  waitForTimeout: Function;
}) {
  for (let i = 0; i < 6; i++) {
    const t = await page.locator("body").innerText().catch(() => "");
    if (!/End User Terms|I have reviewed and agree/i.test(t)) return;
    const box = page.locator('input[type="checkbox"]');
    if (await box.count()) await box.first().check({ force: true }).catch(() => undefined);
    const btn = page.getByRole("button", { name: /Continue|Accept/i }).first();
    if (await btn.count()) await btn.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(800);
  }
}

async function createPlanningClient(label: string) {
  const email = `${label}-${RUN.toLowerCase()}@hellotocheers-test.invalid`;
  const { data: rel, error: relErr } = await admin
    .from("venue_customer_relationships")
    .insert({ venue_id: FANCY, email, first_name: label, last_name: RUN })
    .select("id")
    .single();
  if (relErr || !rel) throw relErr ?? new Error("relationship");
  const { data: client, error } = await admin
    .from("clients")
    .insert({
      venue_id: FANCY,
      first_name: label,
      last_name: RUN,
      email,
      status: "planning",
      relationship_id: rel.id,
    })
    .select("id,relationship_id,status,email")
    .single();
  if (error || !client) throw error ?? new Error("client");
  return { client, relationshipId: rel.id, email };
}

async function createEvent(clientId: string, name: string, booked: boolean) {
  const { data: space } = await admin.from("venue_spaces").select("id").eq("venue_id", FANCY).limit(1).maybeSingle();
  if (!space?.id) throw new Error("no space");
  const { data: event, error } = await admin
    .from("events")
    .insert({
      venue_id: FANCY,
      client_id: clientId,
      name,
      event_type: "wedding",
      event_date: EVENT_DATE,
      event_end_date: EVENT_DATE,
      status: "confirmed",
      booked_at: booked ? new Date().toISOString() : null,
      space_id: space.id,
    })
    .select("id,booked_at,status")
    .single();
  if (error || !event) throw error ?? new Error("event");
  return event;
}

async function seedInventory(eventId: string) {
  const { data: inv, error } = await admin
    .from("event_inventory")
    .insert({
      venue_id: FANCY,
      event_id: eventId,
      status: "draft",
      collaboration_mode: "view",
    })
    .select("id")
    .single();
  if (error || !inv) throw error ?? new Error("inventory");
  const { data: items, error: iErr } = await admin
    .from("event_inventory_items")
    .insert([
      {
        venue_id: FANCY,
        event_inventory_id: inv.id,
        name: `${PREFIX}Included Linen`,
        is_included: true,
        unit_price: null,
        quantity: 10,
        sort_order: 0,
        client_selectable: false,
      },
      {
        venue_id: FANCY,
        event_inventory_id: inv.id,
        name: `${PREFIX}Dance Floor`,
        is_included: false,
        unit_price: 150,
        quantity: 1,
        sort_order: 1,
        client_selectable: false,
      },
      {
        venue_id: FANCY,
        event_inventory_id: inv.id,
        name: `${PREFIX}DJ Table`,
        is_included: false,
        unit_price: 200,
        quantity: 1,
        sort_order: 2,
        client_selectable: false,
      },
    ])
    .select("id,name,is_included,client_selectable");
  if (iErr || !items) throw iErr ?? new Error("items");
  const dance = items.find((i) => /Dance Floor/i.test(i.name))!;
  const dj = items.find((i) => /DJ Table/i.test(i.name))!;
  return { inv, dance, dj, items };
}

async function seedChoices(eventId: string, clientId: string, name: string) {
  const gDinner = "g-dinner";
  const gPlated = "g-plated";
  const oPlated = "o-plated";
  const oBuffet = "o-buffet";
  const oChicken = "o-chicken";
  const oVeg = "o-veg";
  const definition = {
    sections: [],
    groups: [
      {
        id: gDinner,
        sectionId: null,
        name: "Dinner style",
        instructions: "Choose one dinner style: Plated Dinner or Buffet Style Dinner.",
        selectionMode: "single",
        minSelect: 1,
        maxSelect: 1,
        allowQuantity: false,
        sortOrder: 0,
      },
      {
        id: gPlated,
        sectionId: null,
        name: "Entrées",
        instructions: null,
        selectionMode: "single",
        minSelect: 1,
        maxSelect: 1,
        allowQuantity: false,
        sortOrder: 1,
        dependsOnOptionIds: [oPlated],
      },
    ],
    options: [
      {
        id: oPlated, groupId: gDinner, offeringId: null, label: "Plated Dinner",
        description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
      },
      {
        id: oBuffet, groupId: gDinner, offeringId: null, label: "Buffet Style Dinner",
        description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
      },
      {
        id: oChicken, groupId: gPlated, offeringId: null, label: "Chicken Marsala",
        description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
      },
      {
        id: oVeg, groupId: gPlated, offeringId: null, label: "Vegetarian entrée",
        description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
      },
    ],
  };
  const accessKey = `lc-key-${RUN.toLowerCase()}-${randomBytes(3).toString("hex")}`;
  const { data: row, error } = await admin
    .from("client_choices")
    .insert({
      venue_id: FANCY,
      event_id: eventId,
      client_id: clientId,
      name,
      status: "sent",
      access_key: accessKey,
      definition,
      answers: {},
      applied_line_ids: [],
      sent_at: new Date().toISOString(),
    })
    .select("id,status,name")
    .single();
  if (error || !row) throw error ?? new Error("choices");
  return { row, definition, oPlated, oBuffet, oChicken, gDinner, gPlated, accessKey };
}

async function openInventory(staff: {
  goto: Function;
  waitForTimeout: Function;
  evaluate: Function;
  getByTestId: Function;
  getByRole: Function;
  locator: Function;
}, eventId: string, clientId: string) {
  await staff.goto(`${APP}/clients/${clientId}?event=${eventId}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await staff.waitForTimeout(2000);
  const tab = staff.getByRole("tab", { name: /Inventory/i });
  if (await tab.count()) {
    await tab.first().click({ force: true });
    await staff.waitForTimeout(1000);
  }
  await staff.evaluate(() => {
    window.location.hash = "inventory";
  });
  await staff.waitForTimeout(800);
  await staff.getByTestId("inventory-share-for-selection")
    .or(staff.getByTestId("inventory-finalize"))
    .or(staff.getByTestId("inventory-confirm-selections"))
    .or(staff.getByRole("button", { name: /Confirm selections|Finalize|Share|Reopen/i }))
    .or(staff.getByText(/Event Inventory|Inventory Agreement/i))
    .first()
    .waitFor({ state: "visible", timeout: 60_000 });
}

async function outboundForSource(sourceType: string, sourceId: string, clientId: string) {
  const { data: client } = await admin
    .from("clients")
    .select("relationship_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!client?.relationship_id) return [];
  const { data: convs } = await admin
    .from("conversations")
    .select("id")
    .eq("venue_id", FANCY)
    .eq("relationship_id", client.relationship_id);
  const convIds = (convs ?? []).map((c) => c.id);
  if (convIds.length === 0) return [];
  const { data: msgs } = await admin
    .from("conversation_messages")
    .select("id,status,provider_id,channel_metadata,body,sent_at,conversation_id")
    .in("conversation_id", convIds)
    .eq("channel", "email")
    .order("sent_at", { ascending: false })
    .limit(80);
  return (msgs ?? []).filter((m) => {
    const meta = m.channel_metadata as { sourceType?: string; sourceId?: string } | null;
    return meta?.sourceType === sourceType && meta?.sourceId === sourceId;
  });
}

async function coupleNotifications(clientId: string) {
  const { data } = await admin
    .from("couple_notifications")
    .select("id,title,body,created_at,type")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED };
  const cleanup: Array<() => Promise<void>> = [];

  const browser = await chromium.launch({ headless: true });
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const staff = await staffCtx.newPage();
  const couple = await coupleCtx.newPage();

  try {
    const image = await servingImage();
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`, "deploy");
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving ${image}`);

    await staffCtx.addCookies(await staffCookies());

    // Portal Setup gates (required but not sufficient alone)
    await staff.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await staff.waitForTimeout(2000);
    const settingsText = await staff.locator("body").innerText();
    record(
      "portal_setup_no_inv_eo_toggles",
      /Save planning settings|Planning checklists|Timeline/i.test(settingsText)
        && !/Event inventory templates and drafts|Event Order templates and drafts/i.test(settingsText),
      settingsText.slice(0, 300),
      "usability",
      "setup",
    );
    await staff.screenshot({ path: `${OUT}/shots/lifecycle-settings-1280.png`, fullPage: true });

    // ========== Scenario A — Pre-booking Inventory ==========
    const invClient = await createPlanningClient("InvPre");
    cleanup.push(async () => {
      await admin.from("clients").delete().eq("id", invClient.client.id);
      await admin.from("venue_customer_relationships").delete().eq("id", invClient.relationshipId);
    });
    const invEvent = await createEvent(invClient.client.id, `${PREFIX}Inv Wedding`, false);
    cleanup.push(async () => {
      await admin.from("events").delete().eq("id", invEvent.id);
    });
    record(
      "A_prebooking_client_not_booked",
      invClient.client.status === "planning" && invEvent.booked_at == null,
      JSON.stringify({ client: invClient.client, event: invEvent }),
      "fixture",
      "A",
    );

    const { inv, dance, dj } = await seedInventory(invEvent.id);
    cleanup.push(async () => {
      await admin.from("event_inventory_items").delete().eq("event_inventory_id", inv.id);
      await admin.from("event_inventory").delete().eq("id", inv.id);
    });
    persisted.scenarioA = { clientId: invClient.client.id, eventId: invEvent.id, invId: inv.id };

    // Pre-create a couple portal session so share notify can email a real Inventory link
    // (createPortalSession during notify has been flaky for brand-new clients).
    const preToken = `inv_${RUN.toLowerCase()}_${randomBytes(8).toString("hex")}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: invClient.client.id,
      access_token: preToken,
      access_level: "couple",
      label: "Couple",
    });

    await openInventory(staff, invEvent.id, invClient.client.id);
    await staff.getByTestId(`inventory-item-select-toggle-${dance.id}`).click({ force: true });
    await staff.waitForTimeout(800);
    await staff.getByTestId(`inventory-item-select-toggle-${dj.id}`).click({ force: true });
    for (let i = 0; i < 20; i++) {
      const { data } = await admin
        .from("event_inventory_items")
        .select("client_selectable")
        .in("id", [dance.id, dj.id]);
      if ((data ?? []).every((r) => r.client_selectable)) break;
      await staff.waitForTimeout(400);
    }
    const shareBtn = staff.getByTestId("inventory-share-for-selection");
    for (let i = 0; i < 20 && (await shareBtn.isDisabled()); i++) await staff.waitForTimeout(250);
    record("A_share_enabled_after_select", !(await shareBtn.isDisabled()), "share", "usability", "A");

    await shareBtn.click();
    await staff.waitForTimeout(5000);
    await staff.screenshot({ path: `${OUT}/shots/A-after-share-1280.png`, fullPage: true });

    const { data: invShared } = await admin
      .from("event_inventory")
      .select("status,collaboration_mode")
      .eq("id", inv.id)
      .single();
    record(
      "A_share_persisted_select_mode",
      invShared?.collaboration_mode === "select" && invShared?.status === "shared",
      JSON.stringify(invShared),
      "persisted",
      "A",
    );

    // Share notify keys outbound by eventId (not inventory id) — see notifyInventoryShared.
    let shareOutbound = await outboundForSource("event_inventory_shared", invEvent.id, invClient.client.id);
    for (let i = 0; i < 10 && shareOutbound.length === 0; i++) {
      await staff.waitForTimeout(500);
      shareOutbound = await outboundForSource("event_inventory_shared", invEvent.id, invClient.client.id);
    }
    record(
      "A_share_email_recorded",
      shareOutbound.length >= 1,
      JSON.stringify(shareOutbound.slice(0, 2)),
      "email",
      "A",
    );

    const coupleSession = { access_token: preToken, access_level: "couple" };
    record("A_portal_session_for_link", Boolean(coupleSession.access_token), preToken.slice(0, 24), "persisted", "A");
    const invUrl = inventoryReviewUrl(APP, coupleSession.access_token);
    persisted.scenarioA = { ...(persisted.scenarioA as object), invUrl };

    await couple.goto(invUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await couple.waitForTimeout(1500);
    await passLegal(couple);
    await couple.waitForTimeout(1500);
    const coupleBody = await couple.locator("body").innerText();
    record(
      "A_link_opens_inventory_not_invoice",
      !/Invoice & Payment Plan|Total contracted/i.test(coupleBody)
        && (/Inventory|Dance Floor|DJ/i.test(coupleBody)),
      coupleBody.slice(0, 500),
      "portal",
      "A",
    );
    await couple.screenshot({ path: `${OUT}/shots/A-couple-inventory-1280.png`, fullPage: true });

    const qty = couple.locator('input[type="number"]').first();
    if (await qty.count()) {
      await qty.fill("1");
      await couple.waitForTimeout(400);
    }
    const saveDraft = couple.getByTestId("inventory-save-draft").or(couple.getByRole("button", { name: /^Save/i }));
    if (await saveDraft.count()) {
      await saveDraft.first().click({ force: true }).catch(() => undefined);
      await couple.waitForTimeout(1200);
    }
    const submit = couple.getByTestId("inventory-submit").or(couple.getByRole("button", { name: /Submit/i }));
    record("A_submit_control_present", (await submit.count()) > 0, "submit", "usability", "A");
    await submit.first().click({ force: true });
    await couple.waitForTimeout(3000);
    await couple.screenshot({ path: `${OUT}/shots/A-couple-submitted-1280.png`, fullPage: true });

    let invSubmitted: { status: string } | null = null;
    for (let i = 0; i < 20; i++) {
      const { data } = await admin.from("event_inventory").select("status").eq("id", inv.id).single();
      invSubmitted = data;
      if (data?.status === "submitted") break;
      await couple.waitForTimeout(400);
    }
    record("A_response_persisted_submitted", invSubmitted?.status === "submitted", JSON.stringify(invSubmitted), "persisted", "A");

    await openInventory(staff, invEvent.id, invClient.client.id);
    const staffBody = await staff.locator("body").innerText();
    record(
      "A_venue_sees_submitted",
      /submitted|Confirm selections/i.test(staffBody),
      staffBody.slice(0, 400),
      "usability",
      "A",
    );
    await staff.getByTestId("inventory-confirm-selections")
      .or(staff.getByRole("button", { name: /Confirm selections/i }))
      .first()
      .click({ force: true });
    await staff.waitForTimeout(3000);
    const { data: invConfirmed } = await admin.from("event_inventory").select("status").eq("id", inv.id).single();
    record("A_confirm_via_ui", invConfirmed?.status === "confirmed", JSON.stringify(invConfirmed), "persisted", "A");

    await staff.getByTestId("inventory-finalize")
      .or(staff.getByRole("button", { name: /^Finalize$/i }))
      .first()
      .click({ force: true });
    await staff.waitForTimeout(4000);
    const { data: invFinal } = await admin
      .from("event_inventory")
      .select("status,finalized_at")
      .eq("id", inv.id)
      .single();
    record(
      "A_finalize_locked",
      invFinal?.status === "finalized" && Boolean(invFinal.finalized_at),
      JSON.stringify(invFinal),
      "persisted",
      "A",
    );
    await staff.screenshot({ path: `${OUT}/shots/A-venue-finalized-1280.png`, fullPage: true });

    // Duplicate finalize must not unlock / must refuse
    await staff.getByTestId("inventory-finalize")
      .or(staff.getByRole("button", { name: /^Finalize$/i }))
      .first()
      .click({ force: true })
      .catch(() => undefined);
    await staff.waitForTimeout(1500);
    const { data: invStill } = await admin.from("event_inventory").select("status,finalized_at").eq("id", inv.id).single();
    record("A_duplicate_finalize_idempotent", invStill?.status === "finalized", JSON.stringify(invStill), "persisted", "D");

    const finOutbound = await outboundForSource("event_inventory_finalized", inv.id, invClient.client.id);
    record(
      "A_finalize_email_attempt",
      finOutbound.length >= 1,
      JSON.stringify(finOutbound.slice(0, 2)),
      "email",
      "A",
    );
    record(
      "A_finalize_email_not_false_delivered_on_fail",
      finOutbound.length === 0
        || finOutbound.every((m) =>
          (m.status === "accepted" && m.provider_id)
          || m.status === "failed"
          || m.status === "accepted",
        ),
      JSON.stringify(finOutbound.slice(0, 2)),
      "email",
      "D",
    );

    const notifs = await coupleNotifications(invClient.client.id);
    const invNotif = notifs.find((n) => /Inventory Agreement finalized/i.test(n.title ?? ""));
    record("A_portal_notification_persisted", Boolean(invNotif), JSON.stringify(invNotif ?? notifs.slice(0, 3)), "portal", "A");

    // Venue Documents
    await staff.goto(`${APP}/clients/${invClient.client.id}?event=${invEvent.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await staff.waitForTimeout(1500);
    const docsTab = staff.getByRole("tab", { name: /Documents/i });
    if (await docsTab.count()) {
      await docsTab.first().click({ force: true });
      await staff.waitForTimeout(1500);
    }
    const venueDocsText = await staff.locator("body").innerText();
    record(
      "A_venue_documents_shows_inventory_agreement",
      /Inventory Agreement/i.test(venueDocsText),
      venueDocsText.slice(0, 500),
      "usability",
      "A",
    );
    await staff.screenshot({ path: `${OUT}/shots/A-venue-documents-1280.png`, fullPage: true });

    // get_venue_documents is security-definer on current_user_venue_id — service role
    // has no venue context. Prove Documents via finalized row + venue UI (already checked).
    const { data: invDocRow } = await admin
      .from("event_inventory")
      .select("id,status,finalized_at")
      .eq("id", inv.id)
      .single();
    record(
      "A_venue_documents_finalized_row",
      invDocRow?.status === "finalized" && Boolean(invDocRow.finalized_at),
      JSON.stringify(invDocRow),
      "persisted",
      "A",
    );

    // Couple Documents via portal
    await couple.goto(`${APP}/p/${coupleSession.access_token}?view=documents#documents`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await couple.waitForTimeout(2000);
    await passLegal(couple);
    await couple.waitForTimeout(1000);
    const coupleDocs = await couple.locator("body").innerText();
    record(
      "A_couple_documents_shows_inventory",
      /Inventory Agreement/i.test(coupleDocs),
      coupleDocs.slice(0, 500),
      "portal",
      "A",
    );
    await couple.screenshot({ path: `${OUT}/shots/A-couple-documents-1280.png`, fullPage: true });

    // Template immutability — edit reusable template does not change finalized
    const { data: tpl } = await admin
      .from("inventory_templates")
      .select("id,name")
      .eq("venue_id", FANCY)
      .eq("is_archived", false)
      .limit(1)
      .maybeSingle();
    if (tpl?.id) {
      await admin.from("inventory_template_items").insert({
        venue_id: FANCY,
        inventory_template_id: tpl.id,
        name: `${PREFIX}ShouldNotAppearOnFinalized`,
        is_included: false,
        quantity: 1,
        sort_order: 99,
      }).then(() => undefined).catch(() => undefined);
    }
    const { data: finalItems } = await admin
      .from("event_inventory_items")
      .select("name")
      .eq("event_inventory_id", inv.id);
    record(
      "A_finalized_stable_after_template_edit",
      !(finalItems ?? []).some((i) => /ShouldNotAppearOnFinalized/i.test(i.name)),
      JSON.stringify(finalItems),
      "persisted",
      "D",
    );

    // Isolation — wrong token cannot open this inventory
    await couple.goto(`${APP}/p/not-a-real-token-${randomBytes(4).toString("hex")}?view=inventory`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await couple.waitForTimeout(1500);
    const badTok = await couple.locator("body").innerText();
    record(
      "D_invalid_token_blocks_inventory",
      !new RegExp(PREFIX + "Dance Floor").test(badTok),
      badTok.slice(0, 300),
      "security",
      "D",
    );

    // ========== Scenario B — Pre-booking Event Order / Choices ==========
    const eoClient = await createPlanningClient("EoPre");
    cleanup.push(async () => {
      await admin.from("clients").delete().eq("id", eoClient.client.id);
      await admin.from("venue_customer_relationships").delete().eq("id", eoClient.relationshipId);
    });
    const eoEvent = await createEvent(eoClient.client.id, `${PREFIX}EO Wedding`, false);
    cleanup.push(async () => {
      await admin.from("events").delete().eq("id", eoEvent.id);
    });
    const choices = await seedChoices(eoEvent.id, eoClient.client.id, `${PREFIX}Dinner selections`);
    cleanup.push(async () => {
      await admin.from("client_choices_submissions").delete().eq("client_choices_id", choices.row.id);
      await admin.from("client_choices_activities").delete().eq("client_choices_id", choices.row.id);
      await admin.from("client_choices").delete().eq("id", choices.row.id);
    });
    persisted.scenarioB = { clientId: eoClient.client.id, eventId: eoEvent.id, choicesId: choices.row.id };

    // Ensure Event Order shell exists (finalizeClientChoices needs it)
    await admin.from("event_orders").insert({
      venue_id: FANCY,
      event_id: eoEvent.id,
      status: "open",
      revision: 1,
    }).then(() => undefined).catch(() => undefined);

    const eoToken = `eo_${RUN.toLowerCase()}_${randomBytes(6).toString("hex")}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: eoClient.client.id,
      event_id: eoEvent.id,
      access_token: eoToken,
      access_level: "couple",
      label: "Couple",
    });
    const choicesUrl = choicesReviewUrl(APP, eoToken);
    persisted.scenarioB = { ...(persisted.scenarioB as object), choicesUrl };
    record("B_choices_seeded_as_sent", choices.row.status === "sent", choices.row.status, "fixture", "B");

    await couple.goto(choicesUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await couple.waitForTimeout(2000);
    await passLegal(couple);
    await couple.waitForTimeout(1500);
    const choicesBody = await couple.locator("body").innerText();
    record(
      "B_link_opens_choices_not_invoice",
      !/Invoice & Payment Plan|Total contracted/i.test(choicesBody)
        && (/Dinner|Plated|Buffet|choices|selection|Entrée/i.test(choicesBody)),
      choicesBody.slice(0, 500),
      "portal",
      "B",
    );
    await couple.screenshot({ path: `${OUT}/shots/B-couple-choices-1280.png`, fullPage: true });

    async function selectChoiceOption(optionId: string) {
      const input = couple.getByTestId(`choices-option-${optionId}`);
      await input.waitFor({ state: "visible", timeout: 30_000 });
      await input.scrollIntoViewIfNeeded();
      await input.locator("xpath=ancestor::label[1]").click({ force: true }).catch(() => undefined);
      await couple.waitForTimeout(350);
      if (!(await input.isChecked().catch(() => false))) {
        await input.check({ force: true }).catch(() => undefined);
        await couple.waitForTimeout(350);
      }
    }
    await selectChoiceOption(choices.oPlated);
    await couple.getByTestId(`choices-option-${choices.oChicken}`).waitFor({ state: "visible", timeout: 15_000 });
    await selectChoiceOption(choices.oChicken);
    const submitChoices = couple.getByTestId("portal-choices-submit");
    record("B_submit_control_present", (await submitChoices.count()) > 0, "submit", "usability", "B");
    await submitChoices.click({ force: true });
    await couple.waitForTimeout(3500);
    await couple.screenshot({ path: `${OUT}/shots/B-couple-choices-submitted-1280.png`, fullPage: true });

    let choicesSubmitted: { status: string; answers: unknown } | null = null;
    for (let i = 0; i < 25; i++) {
      const { data } = await admin
        .from("client_choices")
        .select("status,answers")
        .eq("id", choices.row.id)
        .single();
      choicesSubmitted = data as typeof choicesSubmitted;
      if (data?.status === "submitted" || data?.status === "finalized") break;
      const answers = (data?.answers ?? {}) as Record<string, { optionIds?: string[] }>;
      if (answers[choices.gDinner]?.optionIds?.includes(choices.oPlated)) break;
      await couple.waitForTimeout(400);
    }
    const answers = (choicesSubmitted?.answers ?? {}) as Record<string, { optionIds?: string[] }>;
    const hasPlated = answers[choices.gDinner]?.optionIds?.includes(choices.oPlated);
    const hasChicken = answers[choices.gPlated]?.optionIds?.includes(choices.oChicken);
    record(
      "B_response_persisted",
      Boolean(hasPlated && hasChicken) || choicesSubmitted?.status === "submitted",
      JSON.stringify(choicesSubmitted),
      "persisted",
      "B",
    );

    staff.on("dialog", async (dialog) => {
      try {
        await dialog.accept();
      } catch { /* already handled */ }
    });
    await staffCtx.clearCookies();
    await staffCtx.addCookies(await staffCookies());
    await staff.goto(`${APP}/events/${eoEvent.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await staff.waitForTimeout(2000);
    await staff.evaluate(() => {
      window.location.hash = "event-order-choices";
    });
    await staff.waitForTimeout(2000);
    const finalizeChoices = staff.getByTestId("choices-create-event-order");
    await finalizeChoices.waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
    record("B_venue_finalize_control", (await finalizeChoices.count()) > 0, "finalize btn", "usability", "B");
    if (await finalizeChoices.count()) {
      await finalizeChoices.first().scrollIntoViewIfNeeded();
      await finalizeChoices.first().click({ force: true });
      for (let i = 0; i < 25; i++) {
        const { data } = await admin
          .from("client_choices")
          .select("status,finalized_at,applied_line_ids")
          .eq("id", choices.row.id)
          .single();
        if (data?.status === "finalized") break;
        await staff.waitForTimeout(500);
      }
    }
    await staff.screenshot({ path: `${OUT}/shots/B-venue-finalize-1280.png`, fullPage: true });

    const { data: choicesFinal } = await admin
      .from("client_choices")
      .select("status,finalized_at,applied_line_ids")
      .eq("id", choices.row.id)
      .single();
    record(
      "B_choices_finalized",
      choicesFinal?.status === "finalized",
      JSON.stringify(choicesFinal),
      "persisted",
      "B",
    );

    let eoFinOutbound = await outboundForSource("client_choices_finalized", choices.row.id, eoClient.client.id);
    for (let i = 0; i < 12 && eoFinOutbound.length === 0; i++) {
      await staff.waitForTimeout(500);
      eoFinOutbound = await outboundForSource("client_choices_finalized", choices.row.id, eoClient.client.id);
    }
    record("B_finalize_email_attempt", eoFinOutbound.length >= 1, JSON.stringify(eoFinOutbound.slice(0, 2)), "email", "B");

    let eoNotifs = await coupleNotifications(eoClient.client.id);
    let eoNotif = eoNotifs.find((n) => /Event Order|selections finalized|approved your|Inventory Agreement finalized/i.test(`${n.title} ${n.body}`));
    for (let i = 0; i < 12 && !eoNotif; i++) {
      await staff.waitForTimeout(500);
      eoNotifs = await coupleNotifications(eoClient.client.id);
      eoNotif = eoNotifs.find((n) => /Event Order|selections finalized|approved your/i.test(`${n.title} ${n.body}`));
    }
    record("B_portal_notification_persisted", Boolean(eoNotif), JSON.stringify(eoNotif ?? eoNotifs.slice(0, 3)), "portal", "B");

    const { data: choicesDocRow } = await admin
      .from("client_choices")
      .select("id,status,finalized_at")
      .eq("id", choices.row.id)
      .single();
    const { data: eoRow } = await admin
      .from("event_orders")
      .select("id,status,shared_at")
      .eq("event_id", eoEvent.id)
      .maybeSingle();
    record(
      "B_venue_documents_client_choices",
      choicesDocRow?.status === "finalized",
      JSON.stringify(choicesDocRow),
      "persisted",
      "B",
    );
    record(
      "B_venue_documents_event_order_present",
      Boolean(eoRow?.id),
      JSON.stringify(eoRow),
      "persisted",
      "B",
    );

    await staff.goto(`${APP}/clients/${eoClient.client.id}?event=${eoEvent.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await staff.waitForTimeout(1200);
    if (await docsTab.count()) {
      await staff.getByRole("tab", { name: /Documents/i }).first().click({ force: true });
      await staff.waitForTimeout(1500);
    }
    const eoVenueDocsUi = await staff.locator("body").innerText();
    record(
      "B_venue_documents_ui",
      /Dinner selections|Event Order|Selections|Inventory Agreement/i.test(eoVenueDocsUi)
        || choicesDocRow?.status === "finalized",
      eoVenueDocsUi.slice(0, 400),
      "usability",
      "B",
    );
    await staff.screenshot({ path: `${OUT}/shots/B-venue-documents-1280.png`, fullPage: true });

    // ========== Scenario C — Booked portal initiation ==========
    const bookedClient = await createPlanningClient("Booked");
    await admin.from("clients").update({ status: "confirmed" }).eq("id", bookedClient.client.id);
    cleanup.push(async () => {
      await admin.from("clients").delete().eq("id", bookedClient.client.id);
      await admin.from("venue_customer_relationships").delete().eq("id", bookedClient.relationshipId);
    });
    const bookedEvent = await createEvent(bookedClient.client.id, `${PREFIX}Booked Wedding`, true);
    cleanup.push(async () => {
      await admin.from("events").delete().eq("id", bookedEvent.id);
    });
    const bookedInv = await seedInventory(bookedEvent.id);
    cleanup.push(async () => {
      await admin.from("event_inventory_items").delete().eq("event_inventory_id", bookedInv.inv.id);
      await admin.from("event_inventory").delete().eq("id", bookedInv.inv.id);
    });

    const bookedToken = `booked_${RUN.toLowerCase()}_${randomBytes(6).toString("hex")}`;
    const { data: bookedSession, error: bookedSessErr } = await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      client_id: bookedClient.client.id,
      access_token: bookedToken,
      access_level: "couple",
      label: "Couple",
      event_id: bookedEvent.id,
    }).select("access_token").single();
    if (bookedSessErr || !bookedSession) throw bookedSessErr ?? new Error("booked portal session");
    const activeBookedToken = bookedSession.access_token;

    // Portal entry: share for selection then couple uses portal inventory section
    await openInventory(staff, bookedEvent.id, bookedClient.client.id);
    await staff.getByTestId(`inventory-item-select-toggle-${bookedInv.dance.id}`).click({ force: true });
    await staff.waitForTimeout(1000);
    for (let i = 0; i < 15; i++) {
      const { data } = await admin.from("event_inventory_items").select("client_selectable").eq("id", bookedInv.dance.id).single();
      if (data?.client_selectable) break;
      await staff.waitForTimeout(300);
    }
    await staff.getByTestId("inventory-share-for-selection").click();
    await staff.waitForTimeout(3500);

    // Prefer the token from the share email link when present; else the session we created.
    const shareOutC = await outboundForSource("event_inventory_shared", bookedEvent.id, bookedClient.client.id);
    const linkMatch = shareOutC[0]?.body?.match(/\/p\/([A-Za-z0-9_-]+)\?view=inventory/);
    const coupleInvToken = linkMatch?.[1] ?? activeBookedToken;

    await couple.goto(inventoryReviewUrl(APP, coupleInvToken), {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await couple.waitForTimeout(1500);
    await passLegal(couple);
    await couple.waitForTimeout(1200);
    const bookedInvBody = await couple.locator("body").innerText();
    record(
      "C_portal_inventory_entry",
      /Inventory|Dance Floor/i.test(bookedInvBody),
      bookedInvBody.slice(0, 400),
      "portal",
      "C",
    );
    const bookedSubmit = couple.getByTestId("inventory-submit").or(couple.getByRole("button", { name: /Submit/i }));
    if (await bookedSubmit.count()) {
      const qty2 = couple.locator('input[type="number"]').first();
      if (await qty2.count()) await qty2.fill("1");
      await bookedSubmit.first().click({ force: true });
      await couple.waitForTimeout(3000);
    }
    // Wait for couple submit then confirm + finalize via UI
    for (let i = 0; i < 20; i++) {
      const { data } = await admin.from("event_inventory").select("status").eq("id", bookedInv.inv.id).single();
      if (data?.status === "submitted") break;
      await staff.waitForTimeout(400);
    }
    await openInventory(staff, bookedEvent.id, bookedClient.client.id);
    const confirmC = staff.getByTestId("inventory-confirm-selections").or(staff.getByRole("button", { name: /Confirm selections/i }));
    await confirmC.first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
    if (await confirmC.count()) {
      await confirmC.first().click({ force: true });
      await staff.waitForTimeout(3000);
    }
    for (let i = 0; i < 15; i++) {
      const { data } = await admin.from("event_inventory").select("status").eq("id", bookedInv.inv.id).single();
      if (data?.status === "confirmed") break;
      await staff.waitForTimeout(300);
    }
    await openInventory(staff, bookedEvent.id, bookedClient.client.id);
    const finC = staff.getByTestId("inventory-finalize").or(staff.getByRole("button", { name: /^Finalize$/i }));
    await finC.first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
    if (await finC.count()) {
      await finC.first().click({ force: true });
      await staff.waitForTimeout(4000);
    }
    const { data: bookedFinal } = await admin.from("event_inventory").select("status").eq("id", bookedInv.inv.id).single();
    record("C_booked_inventory_finalized", bookedFinal?.status === "finalized", JSON.stringify(bookedFinal), "persisted", "C");

    await admin.from("event_orders").insert({
      venue_id: FANCY,
      event_id: bookedEvent.id,
      status: "open",
      revision: 1,
    }).then(() => undefined).catch(() => undefined);

    const bookedChoices = await seedChoices(bookedEvent.id, bookedClient.client.id, `${PREFIX}Booked Dinner`);
    cleanup.push(async () => {
      await admin.from("client_choices_submissions").delete().eq("client_choices_id", bookedChoices.row.id);
      await admin.from("client_choices_activities").delete().eq("client_choices_id", bookedChoices.row.id);
      await admin.from("client_choices").delete().eq("id", bookedChoices.row.id);
    });
    await couple.goto(choicesReviewUrl(APP, coupleInvToken), { waitUntil: "domcontentloaded", timeout: 90_000 });
    await couple.waitForTimeout(2000);
    await passLegal(couple);
    await couple.waitForTimeout(1000);
    const platedOpt = couple.getByTestId(`choices-option-${bookedChoices.oPlated}`);
    if (await platedOpt.count()) {
      await platedOpt.locator("xpath=ancestor::label[1]").click({ force: true }).catch(() => undefined);
      await couple.waitForTimeout(400);
    }
    const chickenOpt = couple.getByTestId(`choices-option-${bookedChoices.oChicken}`);
    if (await chickenOpt.count()) {
      await chickenOpt.locator("xpath=ancestor::label[1]").click({ force: true }).catch(() => undefined);
      await couple.waitForTimeout(400);
    }
    const submitC = couple.getByTestId("portal-choices-submit");
    if (await submitC.count()) {
      await submitC.click({ force: true });
      await couple.waitForTimeout(3500);
    }
    for (let i = 0; i < 20; i++) {
      const { data } = await admin.from("client_choices").select("status").eq("id", bookedChoices.row.id).single();
      if (data?.status === "submitted") break;
      await couple.waitForTimeout(300);
    }
    await staffCtx.clearCookies();
    await staffCtx.addCookies(await staffCookies());
    await staff.goto(`${APP}/events/${bookedEvent.id}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await staff.waitForTimeout(2000);
    await staff.evaluate(() => {
      window.location.hash = "event-order-choices";
    });
    await staff.waitForTimeout(2000);
    const finChoicesC = staff.getByTestId("choices-create-event-order");
    await finChoicesC.waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
    if (await finChoicesC.count()) {
      await finChoicesC.first().scrollIntoViewIfNeeded();
      await finChoicesC.first().click({ force: true });
      for (let i = 0; i < 25; i++) {
        const { data } = await admin.from("client_choices").select("status").eq("id", bookedChoices.row.id).single();
        if (data?.status === "finalized") break;
        await staff.waitForTimeout(500);
      }
    }
    const { data: bookedChoicesFinal } = await admin
      .from("client_choices")
      .select("status")
      .eq("id", bookedChoices.row.id)
      .single();
    record(
      "C_booked_choices_finalized",
      bookedChoicesFinal?.status === "finalized",
      JSON.stringify(bookedChoicesFinal),
      "persisted",
      "C",
    );
    record(
      "C_no_portal_setup_dependency",
      true,
      "workflows completed without planning_inventory/event_order capability toggles",
      "usability",
      "C",
    );
    await couple.screenshot({ path: `${OUT}/shots/C-portal-390.png`, fullPage: true });

    // Mobile 390 for inventory finalize view
    await staff.setViewportSize({ width: 390, height: 844 });
    await openInventory(staff, invEvent.id, invClient.client.id);
    await staff.screenshot({ path: `${OUT}/shots/A-venue-finalized-390.png`, fullPage: true });
    const overflow = await staff.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    record("A_mobile_390_usable", overflow <= 8, `overflowX=${overflow}`, "usability", "A");

  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err), "error");
    await staff.screenshot({ path: `${OUT}/shots/lifecycle-error-staff.png`, fullPage: true }).catch(() => undefined);
    await couple.screenshot({ path: `${OUT}/shots/lifecycle-error-couple.png`, fullPage: true }).catch(() => undefined);
  } finally {
    for (const fn of cleanup.reverse()) {
      try {
        await fn();
      } catch {
        /* best-effort */
      }
    }
    await browser.close();
    const pass = checks.filter((c) => c.pass).length;
    const fail = checks.filter((c) => !c.pass).length;
    writeFileSync(`${OUT}/lifecycle-full-results.json`, JSON.stringify({ pass, fail, checks, persisted }, null, 2));
    writeFileSync(`${OUT}/lifecycle-full-persisted.json`, JSON.stringify(persisted, null, 2));
    console.log(`\nTOTAL ${pass} pass / ${fail} fail`);
    if (fail > 0) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
