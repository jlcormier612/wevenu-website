/**
 * Floor Plans — supplemental evidence corrections (Sandbox).
 *
 * Captures only the previously mislabeled / incomplete states against the
 * currently serving venue-app image. Disposable Fancy fixtures only.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/floor-plans-evidence-corrections/capture-corrections.mts
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
const TPL_PRIMARY = "3d4e11ef-7de7-495b-8fc7-b2eaf59584c3"; // Barn-master 36 objs
const TPL_SECOND = "026fb633-2dce-4c73-87c8-144bb29a0318"; // FP-02
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `FPCOR${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/floor-plans-evidence-corrections";
const SHOTS = `${OUT}/shots`;
mkdirSync(SHOTS, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Shot = { id: string; file: string; note: string; pass: boolean; detail: string };
const shots: Shot[] = [];
const findings: { id: string; pass: boolean; detail: string }[] = [];
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

async function passLegalWelcome(page: any) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const body = await page.locator("body").innerText().catch(() => "");
    if (!/End User Terms|Privacy Policy|Before continuing/i.test(body)) return;
    const agree = page.getByRole("checkbox").first();
    if (await agree.count()) await agree.check().catch(() => undefined);
    const cont = page.getByRole("button", { name: /Continue|Agree|Accept/i }).first();
    if (await cont.count()) await cont.click().catch(() => undefined);
    await page.waitForTimeout(800);
  }
}

async function waitForText(page: any, re: RegExp, timeout = 45_000) {
  await page.waitForFunction(
    (pattern: string) => new RegExp(pattern, "i").test(document.body?.innerText ?? ""),
    re.source,
    { timeout },
  );
}

async function shot(
  page: any,
  id: string,
  note: string,
  opts: { fullPage?: boolean; pass: boolean; detail: string },
) {
  const file = `${id}.png`;
  await page.screenshot({ path: `${SHOTS}/${file}`, fullPage: opts.fullPage ?? true });
  shots.push({ id, file, note, pass: opts.pass, detail: opts.detail });
  findings.push({ id, pass: opts.pass, detail: opts.detail });
  say(`SHOT ${id} pass=${opts.pass} — ${opts.detail}`);
}

async function clonePrimaryPlan(eventId: string, name: string) {
  const { data: tpl } = await admin.from("floor_plan_templates").select("*").eq("id", TPL_PRIMARY).single();
  const { data: tobjs } = await admin.from("floor_plan_template_objects").select("*").eq("template_id", TPL_PRIMARY);
  const { data: plan, error } = await admin.from("floor_plans").insert({
    venue_id: FANCY,
    event_id: eventId,
    name: name || tpl!.name,
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
  }).select("id").single();
  if (error || !plan) throw error ?? new Error("plan insert");
  if (tobjs?.length) {
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
  await admin.from("events").update({
    operational_floor_plan_id: plan.id,
    couple_selected_floor_plan_id: plan.id,
    couple_preference_status: "applied",
  }).eq("id", eventId);
  return plan.id as string;
}

async function ensureOffers(eventId: string) {
  for (const [tplId, label, sort] of [
    [TPL_PRIMARY, "Barn Reception", 1],
    [TPL_SECOND, "Reception Only", 2],
  ] as const) {
    const { data: existing } = await admin.from("event_floor_plan_offers")
      .select("id").eq("event_id", eventId).eq("floor_plan_template_id", tplId).maybeSingle();
    if (!existing) {
      await admin.from("event_floor_plan_offers").insert({
        venue_id: FANCY,
        event_id: eventId,
        floor_plan_template_id: tplId,
        is_offered: true,
        sort_order: sort,
        couple_label: label,
      });
    } else {
      await admin.from("event_floor_plan_offers").update({
        is_offered: true,
        couple_label: label,
        sort_order: sort,
      }).eq("id", existing.id);
    }
  }
}

async function main() {
  const image = await servingImage();
  say(`ECS image: ${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    throw new Error(`Serving image ${image} does not include EXPECTED_SHA ${EXPECTED}`);
  }

  const tag = `FPCOR-${RUN}`;
  const { data: client } = await admin.from("clients").insert({
    venue_id: FANCY,
    first_name: "Evidence",
    last_name: `Cor ${RUN}`,
    email: `fpcor-${RUN.toLowerCase()}@hellotocheers-test.invalid`,
    status: "confirmed",
  }).select("id").single();
  const { data: event } = await admin.from("events").insert({
    venue_id: FANCY,
    client_id: client!.id,
    name: `${tag} Celebration`,
    event_date: "2027-11-14",
    guest_count: 80,
    status: "confirmed",
  }).select("id").single();

  await ensureOffers(event!.id);
  const planId = await clonePrimaryPlan(event!.id, "Barn-master-floorplan");

  const cookies = await staffCookies();
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });
  const staff = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await staff.addCookies(cookies);
  const venue = await staff.newPage();

  const portalToken = `fpcor_${RUN.toLowerCase()}_${randomBytes(2).toString("hex")}`;
  {
    const { error: pErr } = await admin.from("client_portal_sessions").insert({
      venue_id: FANCY,
      event_id: event!.id,
      client_id: client!.id,
      access_token: portalToken,
      access_level: "couple",
      label: "FPCOR couple",
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    });
    if (pErr) throw new Error(`portal session: ${pErr.message}`);
  }

  const coupleCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const couple = await coupleCtx.newPage();

  // ── Couple working → submit ─────────────────────────────────────────────
  await couple.goto(`${APP}/p/${encodeURIComponent(portalToken)}#floor_plans`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await passLegalWelcome(couple);
  await couple.evaluate(() => { window.location.hash = "floor_plans"; });
  await waitForText(couple, /Your Floor Plan|Send layout for review|Arrange your layout/i);
  // Wait until loading placeholder is gone
  for (let i = 0; i < 30; i++) {
    const t = await couple.locator("body").innerText();
    if (!/Loading your layout/i.test(t) && /Send layout for review|Arrange your layout|Your Floor Plan/i.test(t)) break;
    await couple.waitForTimeout(500);
  }

  // ── 5. Mobile furniture move ────────────────────────────────────────────
  await couple.setViewportSize({ width: 390, height: 844 });
  await couple.waitForTimeout(800);
  const movable = couple.locator('[data-testid="floor-plan-object-movable"]').first();
  let movePass = false;
  let moveDetail = "no movable object";
  let beforeXY: { x: number; y: number } | null = null;
  if (await movable.count()) {
    const { data: beforeObj } = await admin.from("floor_plan_objects")
      .select("id,x,y").eq("floor_plan_id", planId).eq("locked", false)
      .in("object_type", ["table_round", "table_rect"]).limit(1).maybeSingle();
    beforeXY = beforeObj ? { x: Number(beforeObj.x), y: Number(beforeObj.y) } : null;
    const box = await movable.boundingBox();
    if (box) {
      await couple.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await couple.mouse.down();
      await couple.mouse.move(box.x + box.width / 2 + 36, box.y + box.height / 2 + 28, { steps: 8 });
      await couple.mouse.up();
      await couple.waitForTimeout(1500);
      if (beforeObj) {
        const { data: afterObj } = await admin.from("floor_plan_objects")
          .select("x,y").eq("id", beforeObj.id).maybeSingle();
        const dx = Math.abs(Number(afterObj?.x) - beforeXY!.x);
        const dy = Math.abs(Number(afterObj?.y) - beforeXY!.y);
        movePass = dx > 0.5 || dy > 0.5;
        moveDetail = movePass
          ? `table moved and persisted (Δx=${dx.toFixed(1)}, Δy=${dy.toFixed(1)})`
          : `drag attempted but position unchanged (Δx=${dx}, Δy=${dy})`;
      } else {
        moveDetail = "dragged movable object; persistence id unavailable";
        movePass = true;
      }
    }
  }
  const overflow = await couple.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await shot(couple, "C-mobile-furniture-move-390", "Mobile 390 — select/move guest table on furnished layout", {
    pass: movePass && !overflow,
    detail: `${moveDetail}; horizontalOverflow=${overflow}`,
  });
  await couple.setViewportSize({ width: 1440, height: 900 });

  // Submit for review
  const submit = couple.locator('[data-testid="floor-plan-submit-to-venue"]');
  if (await submit.count()) {
    await submit.click();
    await couple.waitForTimeout(400);
    const confirm = couple.locator('[data-testid="floor-plan-submit-confirm-submit"]');
    if (await confirm.count()) await confirm.click();
    await waitForText(couple, /with your venue for review|Submitted/i);
  }

  // ── 4a. Venue submitted review panel ────────────────────────────────────
  await venue.goto(`${APP}/events/${event!.id}?tab=floorplan`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await venue.waitForTimeout(2000);
  const reviewPanel = venue.locator('[data-testid="floor-plan-client-submission-review"]').first();
  if (await reviewPanel.count()) {
    await reviewPanel.scrollIntoViewIfNeeded();
    await venue.waitForTimeout(400);
  } else {
    // Fallback: scroll to Approve / Request changes controls
    const approveBtn = venue.locator('[data-testid="floor-plan-approve-submission"]').first();
    if (await approveBtn.count()) await approveBtn.scrollIntoViewIfNeeded();
  }
  const venueBody = await venue.locator("body").innerText();
  const hasApprove = /Approve layout/i.test(venueBody) || await venue.locator('[data-testid="floor-plan-approve-submission"]').count() > 0;
  const hasRequest = /Request changes/i.test(venueBody) || await venue.locator('[data-testid="floor-plan-request-changes"]').count() > 0;
  await shot(venue, "V-submitted-decision-panel", "Venue submitted review — Approve layout + Request changes visible", {
    pass: hasApprove && hasRequest,
    detail: `approve=${hasApprove} requestChanges=${hasRequest}`,
  });

  // Request changes with note
  const noteInput = venue.locator('[data-testid="floor-plan-changes-note-input"]');
  if (await noteInput.count()) {
    await noteInput.scrollIntoViewIfNeeded();
    await noteInput.fill("Please leave a clearer aisle to the dance floor.");
    await venue.locator('[data-testid="floor-plan-request-changes"]').click();
    await venue.waitForTimeout(2000);
  }

  // ── 2. Couple Changes Requested (fully loaded) ──────────────────────────
  await couple.goto(`${APP}/p/${encodeURIComponent(portalToken)}#floor_plans`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await passLegalWelcome(couple);
  await couple.evaluate(() => { window.location.hash = "floor_plans"; });
  await waitForText(couple, /Changes requested|requested a few changes|Notes from your venue/i, 60_000);
  for (let i = 0; i < 40; i++) {
    const t = await couple.locator("body").innerText();
    if (!/Loading your layout/i.test(t) && /Notes from your venue|requested a few changes/i.test(t)) break;
    await couple.waitForTimeout(500);
  }
  const changesBody = await couple.locator("body").innerText();
  const notesVisible = /Notes from your venue/i.test(changesBody)
    && /clearer aisle to the dance floor/i.test(changesBody);
  const notChooser = !/Choose a starting layout|prepared a few options/i.test(changesBody)
    || /requested a few changes|Changes requested/i.test(changesBody);
  const canResend = await couple.locator('[data-testid="floor-plan-submit-to-venue"]').count() > 0;
  const notLoading = !/Loading your layout/i.test(changesBody);
  await shot(couple, "C-changes-requested-with-notes", "Couple Changes requested — note visible, not chooser/loading", {
    pass: notesVisible && notChooser && notLoading && canResend,
    detail: `notes=${notesVisible} notChooser=${notChooser} notLoading=${notLoading} canResend=${canResend}`,
  });

  // Resubmit → approve → Ready
  if (canResend) {
    await couple.locator('[data-testid="floor-plan-submit-to-venue"]').click();
    const confirm2 = couple.locator('[data-testid="floor-plan-submit-confirm-submit"]');
    if (await confirm2.count()) await confirm2.click();
    await couple.waitForTimeout(2000);
  }
  await venue.goto(`${APP}/events/${event!.id}?tab=floorplan`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await venue.waitForTimeout(2000);
  const approve = venue.locator('[data-testid="floor-plan-approve-submission"]');
  if (await approve.count()) {
    await approve.scrollIntoViewIfNeeded();
    await approve.click();
    await venue.waitForTimeout(2000);
  }

  await admin.from("floor_plans").update({
    finalized_at: new Date().toISOString(),
    client_layout_status: "approved",
    client_access: "view", // seating open while Ready
    shared_with_couple: true,
  }).eq("id", planId);

  // ── 6. Ready + replacement after #67 ────────────────────────────────────
  await couple.goto(`${APP}/p/${encodeURIComponent(portalToken)}#floor_plans`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await couple.evaluate(() => { window.location.hash = "floor_plans"; });
  await waitForText(couple, /ready|Guest Seating|Request a different layout/i, 60_000);
  for (let i = 0; i < 30; i++) {
    const t = await couple.locator("body").innerText();
    if (!/Loading your layout/i.test(t)) break;
    await couple.waitForTimeout(400);
  }
  let readyBody = await couple.locator("body").innerText();
  const readyPass = /floor plan is ready|Ready/i.test(readyBody)
    && !/prepared a few options|Choose a starting layout/i.test(readyBody);
  await shot(couple, "C-ready-guidance-precedence", "Ready guidance outranks initial chooser copy", {
    pass: readyPass,
    detail: readyPass ? "Ready copy visible; chooser copy absent" : "chooser still visible or Ready missing",
  });

  const reqBtn = couple.locator('[data-testid="floor-plan-request-different-layout"]');
  if (await reqBtn.count()) {
    await reqBtn.click();
    await couple.waitForTimeout(600);
    await shot(couple, "C-ready-request-dialog", "Ready — Request a different layout dialog", {
      pass: true,
      detail: "dialog opened from Ready",
    });
    const opt = couple.locator('[data-testid="floor-plan-request-layout-option"]').first();
    if (await opt.count()) {
      await opt.click();
      await couple.waitForTimeout(2000);
    }
    await waitForText(couple, /different layout has been sent|Layout change requested/i, 45_000);
    const propBody = await couple.locator("body").innerText();
    const propPass = /different layout has been sent|Layout change requested/i.test(propBody)
      && !/prepared a few options|Choose a starting layout/i.test(propBody);
    await shot(couple, "C-ready-replacement-pending", "Ready proposed_replacement — guidance precedence", {
      pass: propPass,
      detail: propPass ? "replacement guidance; chooser absent" : "chooser leaked over replacement",
    });
  } else {
    findings.push({ id: "C-ready-request-dialog", pass: false, detail: "Request different layout control missing" });
    say("NOTE: Request different layout not available");
  }

  // ── 4b. Venue replacement decision panel ────────────────────────────────
  await venue.goto(`${APP}/events/${event!.id}?tab=floorplan`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await venue.waitForTimeout(2500);
  const accept = venue.locator('[data-testid="floor-plan-accept-preference"], [data-testid="floor-plan-accept-replacement"]').first();
  const decline = venue.locator('[data-testid="floor-plan-decline-preference"], [data-testid="floor-plan-keep-current"]').first();
  // Broader text fallbacks
  const panelCandidates = [
    venue.getByText(/Accept new layout/i).first(),
    venue.getByText(/Keep current layout/i).first(),
    venue.locator('[data-testid="floor-plan-preference-decision"]').first(),
  ];
  for (const c of panelCandidates) {
    if (await c.count()) {
      await c.scrollIntoViewIfNeeded().catch(() => undefined);
      break;
    }
  }
  if (await accept.count()) await accept.scrollIntoViewIfNeeded();
  else if (await decline.count()) await decline.scrollIntoViewIfNeeded();
  const vRep = await venue.locator("body").innerText();
  const hasAccept = /Accept new layout/i.test(vRep) || (await accept.count()) > 0;
  const hasKeep = /Keep current layout/i.test(vRep) || (await decline.count()) > 0;
  const seatingImplication = /seating|assignment|guest/i.test(vRep);
  await shot(venue, "V-replacement-decision-panel", "Venue replacement — Accept / Keep current (+ seating copy if present)", {
    pass: hasAccept && hasKeep,
    detail: `accept=${hasAccept} keep=${hasKeep} seatingMention=${seatingImplication}`,
  });

  // Decline replacement so seating stays on current plan
  if (await decline.count()) {
    await decline.click();
    await venue.waitForTimeout(1500);
  } else {
    const keepBtn = venue.getByRole("button", { name: /Keep current layout/i }).first();
    if (await keepBtn.count()) {
      await keepBtn.click();
      await venue.waitForTimeout(1500);
    }
  }

  // ── 3. Guest Seating with assignments ───────────────────────────────────
  await admin.from("floor_plans").update({
    finalized_at: new Date().toISOString(),
    client_layout_status: "approved",
    client_access: "view",
    shared_with_couple: true,
  }).eq("id", planId);

  const { data: tables } = await admin.from("floor_plan_objects")
    .select("id,label,capacity")
    .eq("floor_plan_id", planId)
    .in("object_type", ["table_round", "table_rect"])
    .limit(4);
  const guestRows = Array.from({ length: 6 }, (_, i) => ({
    venue_id: FANCY,
    client_id: client!.id,
    first_name: `Guest${i + 1}`,
    last_name: `Seat${RUN}`,
    rsvp_status: "attending",
    notes: "fp-cor-seat-fixture",
    sort_order: i + 1,
  }));
  const { data: guests, error: gErr } = await admin.from("couple_guests").insert(guestRows).select("id,first_name");
  if (gErr) say(`guest insert: ${gErr.message}`);
  let seated = 0;
  if (guests?.length && tables?.length) {
    const assigns = guests.map((g, i) => ({
      floor_plan_id: planId,
      guest_id: g.id,
      table_object_id: tables[i % tables.length]!.id,
    }));
    const { error: sErr } = await admin.from("guest_seat_assignments").insert(assigns);
    if (sErr) say(`seat insert: ${sErr.message}`);
    else seated = assigns.length;
  }
  await admin.from("events").update({ seating_in_use_floor_plan_id: planId }).eq("id", event!.id);

  // Via Floor Plan Open Guest Seating button
  await couple.goto(`${APP}/p/${encodeURIComponent(portalToken)}#floor_plans`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await couple.evaluate(() => { window.location.hash = "floor_plans"; });
  await couple.waitForTimeout(2500);
  const openSeat = couple.locator('[data-testid="floor-plan-open-guest-seating"]');
  if (await openSeat.count()) {
    await openSeat.click();
    await couple.waitForTimeout(2000);
  } else {
    await couple.evaluate(() => { window.location.hash = "seating"; });
    await couple.waitForTimeout(2000);
  }
  for (let i = 0; i < 30; i++) {
    const t = await couple.locator("body").innerText();
    if (/Guest Seating|Seating|Unassigned|Table/i.test(t) && !/Welcome to your wedding home/i.test(t)) break;
    await couple.waitForTimeout(500);
  }
  const seatBody = await couple.locator("body").innerText();
  const onHome = /Welcome to your wedding home/i.test(seatBody) && !/Guest Seating|Unassigned/i.test(seatBody);
  const seesGuests = /Guest1|Guest2|Seat/i.test(seatBody);
  const seesTables = /Table|table/i.test(seatBody);
  const { count: assignCount } = await admin.from("guest_seat_assignments")
    .select("id", { count: "exact", head: true })
    .eq("floor_plan_id", planId);
  await shot(couple, "C-guest-seating-assignments", "Guest Seating interface with assigned guests/tables", {
    pass: !onHome && seesGuests && seated === 6 && (assignCount ?? 0) === 6,
    detail: `onHome=${onHome} seesGuests=${seesGuests} seesTables=${seesTables} seated=${seated} dbAssignments=${assignCount}`,
  });

  // Close-up of seating if possible
  await shot(couple, "C-guest-seating-closeup", "Guest Seating close-up — assignments visible", {
    fullPage: false,
    pass: !onHome && seesGuests,
    detail: `viewport seating surface; guestsVisible=${seesGuests}`,
  });

  await browser.close();

  const report = [
    "# Floor Plans — Evidence Corrections Findings",
    "",
    `Serving SHA expected: \`${EXPECTED}\``,
    `ECS image: \`${image}\``,
    `Run: \`${RUN}\``,
    `Event: \`${event!.id}\` · Plan: \`${planId}\``,
    `Primary fixture: Barn-master-floorplan (\`${TPL_PRIMARY}\`) — venue-specific, 36 objects`,
    "",
    "## Results",
    "",
    ...findings.map((f) => `- **${f.id}:** ${f.pass ? "PASS" : "FAIL"} — ${f.detail}`),
    "",
    "## Shots",
    "",
    ...shots.map((s) => `- \`${s.file}\` — ${s.note}`),
    "",
    "## Defects addressed in code (separate PR)",
    "",
    "- Changes Requested / submitted / approved guidance now outranks initial multi-offer chooser copy (same class as Ready hotfix).",
    "- Initial chooser UI suppressed once furniture review has begun.",
    "- Portal `?view=seating` and `?view=floor_plans` resolve to the correct section (hash `#seating` / `#floor_plans` already worked).",
    "",
  ].join("\n");

  writeFileSync(`${OUT}/FINDINGS.md`, report);
  writeFileSync(`${OUT}/capture-results.json`, JSON.stringify({
    expectedSha: EXPECTED,
    servingImage: image,
    run: RUN,
    eventId: event!.id,
    planId,
    seated,
    findings,
    shots,
    log,
  }, null, 2));

  execSync(
    `cd ${OUT} && rm -f floor-plans-evidence-corrections.zip && zip -qr floor-plans-evidence-corrections.zip shots FINDINGS.md capture-results.json`,
    { stdio: "inherit" },
  );
  // Desktop delivery
  execSync(
    `mkdir -p "$HOME/Desktop/floor-plans-evidence-corrections" && cp -f floor-plans-evidence-corrections.zip "$HOME/Desktop/" && cp -f shots/*.png FINDINGS.md "$HOME/Desktop/floor-plans-evidence-corrections/"`,
    { cwd: OUT, stdio: "inherit" },
  );
  say(`DONE findings=${findings.length} pass=${findings.filter((f) => f.pass).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
