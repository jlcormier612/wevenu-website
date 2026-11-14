/**
 * Floor Plans — Prescriptive UX visual acceptance (Sandbox).
 *
 * Uses furnished existing templates (not empty one-table plans):
 *   PRIMARY  Barn-master-floorplan (venue library, 36 objects)
 *   SECOND   Standard Wedding — Reception Only / FP-02 (17 objects)
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/floor-plans-prescriptive-ux/capture-ux-acceptance.mts
 *
 * Production untouched. Disposable fixtures only. No credential rotation.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
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
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
/** Venue-specific furnished layout — 36 objects (rounds, rects, dance, bars, cake, gifts). */
const TPL_PRIMARY = "3d4e11ef-7de7-495b-8fc7-b2eaf59584c3";
/** Global starter FP-02 — Reception Only, 17 objects — genuinely different from primary. */
const TPL_SECOND = "026fb633-2dce-4c73-87c8-144bb29a0318";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `FPUX${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/floor-plans-prescriptive-ux";
const SHOTS = `${OUT}/shots`;
mkdirSync(SHOTS, { recursive: true });
mkdirSync(`${OUT}/after`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Shot = { id: string; file: string; note: string };
const shots: Shot[] = [];
const log: string[] = [];
function say(m: string) {
  log.push(m);
  console.log(m);
}

async function servingImage(): Promise<string> {
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

async function shot(page: { screenshot: (o: Record<string, unknown>) => Promise<Buffer> }, id: string, note: string, fullPage = true) {
  const file = `${id}.png`;
  await page.screenshot({ path: `${SHOTS}/${file}`, fullPage });
  copyFileSync(`${SHOTS}/${file}`, `${OUT}/after/${file}`);
  shots.push({ id, file, note });
  say(`SHOT ${id} — ${note}`);
}

async function templateMeta(id: string) {
  const { data: t } = await admin.from("floor_plan_templates").select("id,name,source_master_key,room_width_ft,room_depth_ft").eq("id", id).maybeSingle();
  const { data: objs } = await admin.from("floor_plan_template_objects").select("object_type,label,capacity").eq("template_id", id);
  const byType: Record<string, number> = {};
  for (const o of objs ?? []) byType[o.object_type] = (byType[o.object_type] || 0) + 1;
  return { ...(t ?? {}), objectCount: objs?.length ?? 0, byType };
}

async function main() {
  const image = await servingImage();
  say(`ECS image: ${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    throw new Error(`Serving image ${image} does not include EXPECTED_SHA ${EXPECTED}`);
  }

  const primaryMeta = await templateMeta(TPL_PRIMARY);
  const secondMeta = await templateMeta(TPL_SECOND);
  say(`PRIMARY ${JSON.stringify(primaryMeta)}`);
  say(`SECOND ${JSON.stringify(secondMeta)}`);

  const tag = `FPUX-${RUN}`;
  const { data: client, error: cErr } = await admin.from("clients").insert({
    venue_id: FANCY,
    first_name: "Floor",
    last_name: `UX ${RUN}`,
    email: `fpux-${RUN.toLowerCase()}@hellotocheers-test.invalid`,
    status: "confirmed",
  }).select("id").single();
  if (cErr || !client) throw cErr ?? new Error("client");

  const { data: event, error: eErr } = await admin.from("events").insert({
    venue_id: FANCY,
    client_id: client.id,
    name: `${tag} Celebration`,
    event_date: "2027-11-14",
    guest_count: 80,
    status: "booked",
  }).select("id").single();
  if (eErr || !event) throw eErr ?? new Error("event");

  // Zero-offer capture first — no plans yet
  const cookies = await staffCookies();
  const browser = await chromium.launch({ headless: true });
  const staff = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await staff.addCookies(cookies);
  const venue = await staff.newPage();

  await venue.goto(`${APP}/events/${event.id}?tab=floorplan`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await venue.waitForTimeout(2500);
  await venue.getByRole("tab", { name: /^Floor Plans$/i }).first().click().catch(() => undefined);
  await venue.waitForTimeout(1500);
  await shot(venue, "V-zero-offers-desktop", "Venue Floor Plans with zero offered layouts");

  // Apply primary furnished template as Additional layout + share
  const applyBtn = venue.getByRole("button", { name: /\+ Additional layout|Add a layout/i }).first();
  if (await applyBtn.count()) {
    await applyBtn.click();
    await venue.waitForTimeout(800);
  }
  // Prefer apply-from-template UI
  const tplPrimary = venue.locator(`[data-testid="floor-plan-template-${TPL_PRIMARY}"]`);
  if (await tplPrimary.count()) {
    await tplPrimary.check();
    await venue.getByRole("button", { name: /^Apply$|Apply .*template/i }).first().click().catch(async () => {
      await venue.getByRole("button", { name: /Create Floor Plan|Apply/i }).first().click();
    });
  } else {
    // Dialog radio / apply path
    await venue.locator(`text=Barn-master`).first().click().catch(() => undefined);
    await venue.getByRole("button", { name: /Apply|Create/i }).first().click().catch(() => undefined);
  }
  await venue.waitForTimeout(3000);

  // Ensure a plan exists via DB clone if UI apply was flaky
  let { data: plans } = await admin.from("floor_plans").select("id,name,shared_with_couple,client_access,client_layout_status,finalized_at,source_template_id").eq("event_id", event.id);
  if (!plans?.length) {
    say("UI apply missed — cloning primary template via RPC-safe insert path");
    const { data: tpl } = await admin.from("floor_plan_templates").select("*").eq("id", TPL_PRIMARY).single();
    const { data: tobjs } = await admin.from("floor_plan_template_objects").select("*").eq("template_id", TPL_PRIMARY);
    const { data: plan } = await admin.from("floor_plans").insert({
      venue_id: FANCY,
      event_id: event.id,
      name: tpl!.name,
      space_id: tpl!.space_id,
      room_width_ft: tpl!.room_width_ft,
      room_depth_ft: tpl!.room_depth_ft,
      measurement_unit: tpl!.measurement_unit ?? "ft",
      background_image_url: tpl!.background_image_url,
      background_image_opacity: tpl!.background_image_opacity,
      source_template_id: tpl!.id,
      shared_with_couple: true,
      client_access: "view",
      client_layout_status: "working",
    }).select("id,name").single();
    if (plan && tobjs?.length) {
      await admin.from("floor_plan_objects").insert(
        tobjs.map((o: Record<string, unknown>, i: number) => ({
          venue_id: FANCY,
          floor_plan_id: plan.id,
          object_type: o.object_type,
          label: o.label,
          capacity: o.capacity,
          x: o.x,
          y: o.y,
          width: o.width,
          height: o.height,
          rotation: o.rotation ?? 0,
          sort_order: o.sort_order ?? i,
          inventory_item_id: o.inventory_item_id,
          color: o.color,
          notes: o.notes,
          locked: false,
          display_shape: o.display_shape,
        })),
      );
    }
    await admin.from("events").update({ operational_floor_plan_id: plan!.id }).eq("id", event.id);
  } else {
    const p = plans[0]!;
    await admin.from("floor_plans").update({
      shared_with_couple: true,
      client_access: "view",
      client_layout_status: "working",
    }).eq("id", p.id);
    await admin.from("floor_plan_objects").update({ locked: false }).eq("floor_plan_id", p.id);
    await admin.from("events").update({ operational_floor_plan_id: p.id }).eq("id", event.id);
  }

  // Offer both templates for multi-offer selection on a second disposable event path
  // — also offer on this event for chooser screens.
  for (const [tplId, label] of [[TPL_PRIMARY, "Barn Reception"], [TPL_SECOND, "Reception Only"]] as const) {
    const { data: existing } = await admin.from("event_floor_plan_offers")
      .select("id").eq("event_id", event.id).eq("floor_plan_template_id", tplId).maybeSingle();
    if (!existing) {
      await admin.from("event_floor_plan_offers").insert({
        venue_id: FANCY,
        event_id: event.id,
        floor_plan_template_id: tplId,
        is_offered: true,
        sort_order: tplId === TPL_PRIMARY ? 1 : 2,
        couple_label: label,
      });
    } else {
      await admin.from("event_floor_plan_offers").update({ is_offered: true, couple_label: label }).eq("id", existing.id);
    }
  }

  await venue.goto(`${APP}/events/${event.id}?tab=floorplan`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await venue.waitForTimeout(2500);
  await shot(venue, "V-working-furnished-desktop", "Venue workspace with furnished working layout");

  // Open plan editor for close-up
  const { data: workingPlans } = await admin.from("floor_plans").select("id,name").eq("event_id", event.id);
  const workingId = workingPlans?.[0]?.id;
  if (workingId) {
    await venue.goto(`${APP}/events/${event.id}/floor-plans/${workingId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await venue.waitForTimeout(2500);
    await shot(venue, "V-canvas-furnished-desktop", "Venue editor canvas — full furnished layout 1440");
    await venue.setViewportSize({ width: 390, height: 844 });
    await venue.waitForTimeout(800);
    await shot(venue, "V-canvas-furnished-mobile", "Venue editor canvas — furnished layout 390");
    await venue.setViewportSize({ width: 1440, height: 900 });
  }

  // Portal session
  const portalToken = `fpux_${RUN.toLowerCase()}_${randomBytes(2).toString("hex")}`;
  await admin.from("client_portal_sessions").insert({
    venue_id: FANCY,
    event_id: event.id,
    client_id: client.id,
    access_token: portalToken,
    access_level: "full",
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
  });

  const coupleCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const couple = await coupleCtx.newPage();
  await couple.goto(`${APP}/p/${encodeURIComponent(portalToken)}?view=floor_plans`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await couple.waitForTimeout(3000);
  await shot(couple, "C-working-furnished-desktop", "Couple working view — furnished canvas + Send layout CTA");

  // Drag one unlocked table if present
  const movable = couple.locator('[data-testid="floor-plan-object-movable"]').first();
  if (await movable.count()) {
    const box = await movable.boundingBox();
    if (box) {
      await couple.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await couple.mouse.down();
      await couple.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20);
      await couple.mouse.up();
      await couple.waitForTimeout(800);
    }
  }
  await shot(couple, "C-working-edit-closeup-desktop", "Couple editing controls on furnished canvas");

  await couple.setViewportSize({ width: 390, height: 844 });
  await couple.waitForTimeout(800);
  await shot(couple, "C-working-furnished-mobile", "Couple mobile 390 — canvas + primary action placement");
  await couple.setViewportSize({ width: 1440, height: 900 });

  // Submit
  const submit = couple.locator('[data-testid="floor-plan-submit-to-venue"]');
  if (await submit.count()) {
    await submit.click();
    await couple.waitForTimeout(400);
    const confirm = couple.locator('[data-testid="floor-plan-submit-confirm-submit"]');
    if (await confirm.count()) await confirm.click();
    await couple.waitForTimeout(2000);
  }
  await shot(couple, "C-submitted-desktop", "Couple submitted state");

  // Venue approve / request changes path — request changes with notes
  await venue.goto(`${APP}/events/${event.id}?tab=floorplan`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await venue.waitForTimeout(2500);
  await shot(venue, "V-submitted-review-desktop", "Venue submitted review — Approve layout / Request changes");

  const noteInput = venue.locator('[data-testid="floor-plan-changes-note-input"]');
  if (await noteInput.count()) {
    await noteInput.fill("Please leave a clearer aisle to the dance floor.");
    await venue.locator('[data-testid="floor-plan-request-changes"]').click();
    await venue.waitForTimeout(2000);
  }
  await couple.reload({ waitUntil: "domcontentloaded" });
  await couple.waitForTimeout(2000);
  await shot(couple, "C-changes-requested-with-notes", "Couple changes requested with venue notes");

  // Clear note path: request without notes is blocked by UI (requires note). Capture without-notes
  // by wiping note via DB for a second status screenshot on a clone isn't needed —
  // document that UI requires notes for Request changes.

  // Resubmit then approve
  const submit2 = couple.locator('[data-testid="floor-plan-submit-to-venue"]');
  if (await submit2.count()) {
    await submit2.click();
    const confirm2 = couple.locator('[data-testid="floor-plan-submit-confirm-submit"]');
    if (await confirm2.count()) await confirm2.click();
    await couple.waitForTimeout(2000);
  }
  await venue.goto(`${APP}/events/${event.id}?tab=floorplan`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await venue.waitForTimeout(2000);
  const approve = venue.locator('[data-testid="floor-plan-approve-submission"]');
  if (await approve.count()) {
    await approve.click();
    await venue.waitForTimeout(2000);
  }
  await couple.reload({ waitUntil: "domcontentloaded" });
  await couple.waitForTimeout(2000);
  await shot(couple, "C-approved-desktop", "Couple approved arrangement");

  // Ready
  if (workingId) {
    await admin.from("floor_plans").update({ finalized_at: new Date().toISOString() }).eq("id", workingId);
  }
  await couple.reload({ waitUntil: "domcontentloaded" });
  await couple.waitForTimeout(2000);
  await shot(couple, "C-ready-desktop", "Couple Ready state — Request a different layout eligibility");

  // Ready replacement request if button present
  const reqBtn = couple.locator('[data-testid="floor-plan-request-different-layout"]');
  if (await reqBtn.count()) {
    await reqBtn.click();
    await couple.waitForTimeout(600);
    await shot(couple, "C-ready-request-dialog", "Ready-state Request a different layout dialog");
    const opt = couple.locator('[data-testid="floor-plan-request-layout-option"]').first();
    if (await opt.count()) {
      await opt.click();
      await couple.waitForTimeout(2000);
    }
    await shot(couple, "C-ready-replacement-pending", "Ready — proposed_replacement recorded; operational unchanged");
  } else {
    say("NOTE: Request different layout not shown (need multiple offers + approved/ready)");
  }

  await venue.goto(`${APP}/events/${event.id}?tab=floorplan`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await venue.waitForTimeout(2500);
  await shot(venue, "V-replacement-decision-desktop", "Venue replacement decision panel");

  // Seating-only with assignments
  if (workingId) {
    // Decline replacement if pending so seating stays on working
    const decline = venue.locator('[data-testid="floor-plan-decline-preference"]');
    if (await decline.count()) {
      await decline.click();
      await venue.waitForTimeout(1500);
    }
    await admin.from("floor_plans").update({
      finalized_at: new Date().toISOString(),
      client_layout_status: "approved",
      client_access: "view",
      shared_with_couple: true,
    }).eq("id", workingId);

    // Create guests + seat assignments on tables
    const { data: tables } = await admin.from("floor_plan_objects")
      .select("id,label,capacity")
      .eq("floor_plan_id", workingId)
      .in("object_type", ["table_round", "table_rect"])
      .limit(4);
    const guestRows = [];
    for (let i = 0; i < 6; i++) {
      guestRows.push({
        venue_id: FANCY,
        event_id: event.id,
        first_name: `Guest${i + 1}`,
        last_name: `Seat${RUN}`,
        email: `g${i}-${RUN.toLowerCase()}@hellotocheers-test.invalid`,
      });
    }
    const { data: guests } = await admin.from("guests").insert(guestRows).select("id");
    if (guests?.length && tables?.length) {
      const assigns = guests.map((g, i) => ({
        venue_id: FANCY,
        event_id: event.id,
        floor_plan_id: workingId,
        guest_id: g.id,
        floor_plan_object_id: tables[i % tables.length]!.id,
      }));
      await admin.from("guest_seat_assignments").insert(assigns);
      say(`Seated ${assigns.length} guests across ${tables.length} tables`);
    }
    await admin.from("events").update({ seating_in_use_floor_plan_id: workingId }).eq("id", event.id);
  }

  await couple.goto(`${APP}/p/${encodeURIComponent(portalToken)}?view=floor_plans`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await couple.waitForTimeout(2500);
  await shot(couple, "C-seating-only-desktop", "Couple seating-only / Ready with Guest Seating route");
  await couple.goto(`${APP}/p/${encodeURIComponent(portalToken)}?view=seating`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await couple.waitForTimeout(2500);
  await shot(couple, "C-guest-seating-assignments", "Guest Seating with actual assignments");

  // Multi-offer chooser on a fresh disposable event
  const { data: client2 } = await admin.from("clients").insert({
    venue_id: FANCY,
    first_name: "Chooser",
    last_name: RUN,
    email: `fpux-ch-${RUN.toLowerCase()}@hellotocheers-test.invalid`,
    status: "confirmed",
  }).select("id").single();
  const { data: event2 } = await admin.from("events").insert({
    venue_id: FANCY,
    client_id: client2!.id,
    name: `${tag} Chooser`,
    event_date: "2027-12-01",
    guest_count: 100,
    status: "booked",
  }).select("id").single();
  for (const [tplId, label, sort] of [
    [TPL_PRIMARY, "Barn Reception", 1],
    [TPL_SECOND, "Reception Only", 2],
  ] as const) {
    await admin.from("event_floor_plan_offers").insert({
      venue_id: FANCY,
      event_id: event2!.id,
      floor_plan_template_id: tplId,
      is_offered: true,
      sort_order: sort,
      couple_label: label,
    });
  }
  const token2 = `fpux_ch_${RUN.toLowerCase()}_${randomBytes(2).toString("hex")}`;
  await admin.from("client_portal_sessions").insert({
    venue_id: FANCY,
    event_id: event2!.id,
    client_id: client2!.id,
    access_token: token2,
    access_level: "full",
    expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
  });
  await couple.goto(`${APP}/p/${encodeURIComponent(token2)}?view=floor_plans`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await couple.waitForTimeout(3000);
  await shot(couple, "C-multi-offer-chooser-desktop", "Initial multiple-offer selection — two different furnished layouts");
  await couple.setViewportSize({ width: 390, height: 844 });
  await couple.waitForTimeout(600);
  await shot(couple, "C-multi-offer-chooser-mobile", "Multi-offer chooser at 390");

  // Additional shared layout empty-state contrast already captured as V-zero; capture Additional after share on event2
  await venue.setViewportSize({ width: 1440, height: 900 });
  await venue.goto(`${APP}/events/${event2!.id}?tab=floorplan`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await venue.waitForTimeout(2000);
  await shot(venue, "V-multi-offer-workspace", "Venue workspace with two offered layouts");

  await browser.close();

  // Index + ZIP
  const index = {
    expectedSha: EXPECTED,
    servingImage: image,
    run: RUN,
    fixtures: {
      primaryTemplate: primaryMeta,
      secondTemplate: secondMeta,
      primarySource: primaryMeta.source_master_key
        ? `global starter master ${primaryMeta.source_master_key}`
        : "venue-specific Fancy library template (not a curated demo mutation)",
      secondSource: secondMeta.source_master_key
        ? `global starter master ${secondMeta.source_master_key}`
        : "venue-specific",
      eventId: event.id,
      chooserEventId: event2!.id,
    },
    shots,
    log,
  };
  writeFileSync(`${OUT}/capture-results.json`, JSON.stringify(index, null, 2));
  writeFileSync(
    `${OUT}/INDEX.md`,
    [
      "# Floor Plans UX acceptance — screenshot index",
      "",
      `Serving SHA: \`${EXPECTED}\``,
      `ECS: \`${image}\``,
      "",
      "## Templates",
      "",
      `- **Primary:** ${primaryMeta.name} (\`${TPL_PRIMARY}\`) — ${primaryMeta.objectCount} objects — ${index.fixtures.primarySource}`,
      `  - Contents: ${JSON.stringify(primaryMeta.byType)}`,
      `- **Second offer:** ${secondMeta.name} (\`${TPL_SECOND}\`) — ${secondMeta.objectCount} objects — ${index.fixtures.secondSource}`,
      `  - Contents: ${JSON.stringify(secondMeta.byType)}`,
      "",
      "## Shots",
      "",
      ...shots.map((s) => `- \`${s.file}\` — ${s.note}`),
      "",
    ].join("\n"),
  );

  try {
    execSync(
      `cd ${OUT} && rm -f floor-plans-prescriptive-ux-screens.zip && zip -qr floor-plans-prescriptive-ux-screens.zip after INDEX.md capture-results.json shots`,
      { stdio: "inherit" },
    );
    say("ZIP written");
  } catch (e) {
    say(`ZIP failed: ${e}`);
  }

  // Contact sheet via magick if available
  try {
    const files = shots.map((s) => `${SHOTS}/${s.file}`).filter((f) => existsSync(f));
    if (files.length) {
      execSync(
        `magick montage ${files.slice(0, 16).join(" ")} -geometry 320x200+8+8 -tile 4x -background '#F7F5F1' ${OUT}/contact-sheet.png`,
        { stdio: "inherit" },
      );
      say("contact-sheet.png written");
    }
  } catch {
    say("magick unavailable — ZIP + individual shots only");
  }

  say(`DONE shots=${shots.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
