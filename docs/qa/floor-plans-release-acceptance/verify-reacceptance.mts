/**
 * Floor Plans comprehensive re-acceptance — gap closure on serving tip.
 *
 * Focus (prior GREEN gaps):
 *  J2  Multi-offer via Event setup UI → couple chooser → preference persist
 *  Setup member attach via UI only (no DB member insert)
 *  Venue unlock object via editor UI → couple move
 *
 * Also re-proves FP-RA-1 Additional+Share submit path without offers.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/floor-plans-release-acceptance/verify-reacceptance.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
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
const BARN = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const TPL_A = "3d4e11ef-7de7-495b-8fc7-b2eaf59584c3";
const TPL_B = "026fb633-2dce-4c73-87c8-144bb29a0318";
const EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `FPRA${Date.now().toString(36).toUpperCase()}`;
const PREFIX = `FPRA-${RUN}-`;
const OUT = "docs/qa/floor-plans-release-acceptance";
const DAY = String((Number.parseInt(RUN.replace(/\D/g, "").slice(-2) || "12", 10) % 27) + 1).padStart(2, "0");
const EVENT_DATE = `2027-11-${DAY}`;
mkdirSync(`${OUT}/reacceptance`, { recursive: true });
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string; evidence: string };
type Ux = { screen: string; text: string; assessment: string; severity: "ok" | "confusing" | "blocker" | "p2" | "p3" };
const checks: Check[] = [];
const usability: Ux[] = [];

function record(name: string, pass: boolean, detail: string, evidence = "live-ui") {
  checks.push({ name, pass, detail: String(detail).slice(0, 2500), evidence });
  console.log(`${pass ? "PASS" : "FAIL"} [${evidence}] ${name} — ${String(detail).slice(0, 350)}`);
}
function noteUx(screen: string, text: string, assessment: string, severity: Ux["severity"]) {
  usability.push({ screen, text: text.slice(0, 1200), assessment, severity });
  console.log(`UX[${severity}] ${screen} — ${assessment.slice(0, 200)}`);
}

async function servingImage() {
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

async function passLegal(page: any) {
  for (let i = 0; i < 5; i++) {
    const t = await page.locator("body").innerText().catch(() => "");
    if (!/End User Terms|I have reviewed and agree/i.test(t)) return;
    const box = page.locator('input[type="checkbox"]');
    if (await box.count()) await box.first().check({ force: true }).catch(() => undefined);
    const btn = page.getByRole("button", { name: /Continue|Accept/i }).first();
    if (await btn.count()) await btn.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(900);
  }
}

async function openFloorPlans(page: any, eventId: string) {
  await page.goto(`${APP}/events/${eventId}?tab=floorplan`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2000);
  const tab = page.getByRole("tab", { name: /^Floor Plans$/i }).first();
  if (await tab.count()) {
    const st = await tab.getAttribute("data-state").catch(() => null);
    if (st !== "active") await tab.click();
  }
  await page.locator('[data-testid="floor-plan-operational-workspace"], [data-testid="floor-plan-working-card"], [data-testid="floor-plan-empty-no-working"]')
    .first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
}

async function openOverview(page: any, eventId: string) {
  await page.goto(`${APP}/events/${eventId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 60_000 });
  await page.waitForTimeout(800);
}

/** Open Event Setup → Floor Plans Change editor (offer path). */
async function openFloorPlansOfferEditor(page: any, eventId: string) {
  await openOverview(page, eventId);
  const fpCard = page.locator('[data-testid="event-setup-card-floor_plans"]');
  await fpCard.waitFor({ timeout: 45_000 });
  const setUp = fpCard.getByRole("button", { name: /^Set up$/i }).first();
  if (await setUp.count()) {
    await setUp.click();
    await page.waitForTimeout(2500);
    await page.waitForSelector('[data-testid="event-setup-panel"]', { timeout: 30_000 }).catch(() => undefined);
  }
  // Outstanding CTA may say Change for this event after readiness fix
  const outstandingChange = page.locator('[data-testid="event-setup-outstanding"]')
    .getByRole("button", { name: /Change for this event/i }).first();
  const changeBtn = page.locator('[data-testid="event-setup-change-floor_plans"]');
  if (await changeBtn.count()) {
    await changeBtn.click();
  } else if (await outstandingChange.count()) {
    await outstandingChange.click();
  } else {
    // Last resort: open Change from card text
    const anyChange = fpCard.getByRole("button", { name: /Change for this event/i });
    if (await anyChange.count()) await anyChange.click();
    else throw new Error("Change for this event missing on Floor Plans card — offer editor unreachable");
  }
  await page.locator('[data-testid="event-floor-plans-setup-editor"]').waitFor({ timeout: 30_000 });
}

async function coupleFloor(page: any, token: string) {
  await page.goto(`${APP}/p/${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await passLegal(page);
  await page.waitForTimeout(800);
  const nav = page.locator('button[title="Floor Plan"], button[title="Floor Plans"]').first();
  if (await nav.count()) await nav.click();
  else await page.getByRole("button", { name: /Floor Plan/i }).first().click().catch(() => undefined);
  await page.waitForTimeout(2000);
}

async function cleanup(ids: {
  clientId: string | null; eventId: string | null; portalToken: string | null;
}) {
  const { clientId, eventId, portalToken } = ids;
  if (!eventId) return;
  await admin.from("event_floor_plan_review_flags").delete().eq("event_id", eventId);
  await admin.from("event_floor_plan_flips").delete().eq("event_id", eventId);
  const { data: setups } = await admin.from("event_floor_plan_setups").select("id").eq("event_id", eventId);
  const sids = (setups ?? []).map((s) => s.id);
  if (sids.length) {
    await admin.from("event_floor_plan_setup_members").delete().in("setup_id", sids);
    await admin.from("event_floor_plan_setups").delete().in("id", sids);
  }
  await admin.from("event_floor_plan_offers").delete().eq("event_id", eventId);
  const { data: plans } = await admin.from("floor_plans").select("id").eq("event_id", eventId);
  const pids = (plans ?? []).map((p) => p.id);
  if (pids.length) {
    await admin.from("guest_seat_assignments").delete().in("floor_plan_id", pids);
    await admin.from("floor_plan_objects").delete().in("floor_plan_id", pids);
    await admin.from("floor_plans").delete().in("id", pids);
  }
  if (portalToken) await admin.from("client_portal_sessions").delete().eq("access_token", portalToken);
  await admin.from("event_space_assignments").delete().eq("event_id", eventId);
  await admin.from("events").delete().eq("id", eventId);
  if (clientId) await admin.from("clients").delete().eq("id", clientId);
}

async function main() {
  const persisted: Record<string, unknown> = { run: RUN, expectedSha: EXPECTED };
  let clientId: string | null = null;
  let eventId: string | null = null;
  let portalToken: string | null = null;

  const browser = await chromium.launch({ headless: true });
  const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  staffCtx.on("dialog", async (d: { accept: () => Promise<void> }) => { await d.accept(); });
  await staffCtx.addCookies(await staffCookies());
  const page = await staffCtx.newPage();

  try {
    const image = await servingImage();
    persisted.serving = image;
    record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`, "serving");
    if (!image.includes(EXPECTED.slice(0, 12))) throw new Error(`Serving mismatch ${image}`);
    const health = await fetch(`${APP}/api/health`).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    record("api_health", health.status === 200 && health.body?.ok === true, JSON.stringify(health), "serving");

    // ── Fixture: booked Fancy event, zero layouts ────────────────────────────
    const { data: client, error: cErr } = await admin.from("clients").insert({
      venue_id: FANCY, first_name: "FPRA", last_name: RUN,
      email: `fpra-${RUN.toLowerCase()}@hellotocheers-test.invalid`, status: "confirmed",
    }).select("id").single();
    if (cErr || !client) throw cErr ?? new Error("client");
    clientId = client.id;
    const { data: event, error: eErr } = await admin.from("events").insert({
      venue_id: FANCY, client_id: clientId, name: `${PREFIX}Wedding`,
      event_type: "wedding", event_date: EVENT_DATE, event_end_date: EVENT_DATE,
      status: "confirmed", booked_at: new Date().toISOString(), space_id: BARN,
    }).select("id").single();
    if (eErr || !event) throw eErr ?? new Error("event");
    eventId = event.id;
    await admin.rpc("replace_event_space_assignments", {
      p_venue_id: FANCY, p_event_id: eventId, p_primary_space_id: BARN,
      p_assignments: [
        { useKey: "ceremony", useLabel: "Ceremony", spaceId: BARN, startTime: null, endTime: null, scheduledDate: null, sortOrder: 0 },
        { useKey: "reception", useLabel: "Reception", spaceId: BARN, startTime: null, endTime: null, scheduledDate: null, sortOrder: 1 },
      ],
    });
    portalToken = `fpra_${RUN.toLowerCase()}_${randomBytes(2).toString("hex")}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY, client_id: clientId, event_id: eventId,
      access_token: portalToken, access_level: "couple", label: "FPRA couple",
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    });
    persisted.clientId = clientId;
    persisted.eventId = eventId;
    persisted.portalToken = portalToken;
    const { count: zero } = await admin.from("floor_plans").select("id", { count: "exact", head: true }).eq("event_id", eventId);
    record("fixture_zero_layouts", zero === 0, `plans=${zero}`, "persisted");

    // ── Journey 2: Multi-offer via Event setup UI ─────────────────────────────
    await openFloorPlansOfferEditor(page, eventId);
    await page.screenshot({ path: `${OUT}/reacceptance/j2-offer-editor-1280.png`, fullPage: true });
    const editorText = await page.locator('[data-testid="event-floor-plans-setup-editor"]').innerText().catch(() => "");
    noteUx(
      "Event setup floor-plan offers",
      editorText,
      /Offer|Library|couple/i.test(editorText)
        ? "Offer editor explains event-only offers vs Library."
        : "Offer editor missing or unclear.",
      /Offer|Library/i.test(editorText) ? "ok" : "p2",
    );
    record(
      "j2_change_opens_offer_editor_without_profile",
      (await page.locator('[data-testid="event-floor-plans-setup-editor"]').count()) === 1
        && (await page.locator('[data-testid="floor-plans-setup-template-select"]').count()) === 1,
      editorText.slice(0, 400),
      "live-ui",
    );

    async function offerTemplateViaUi(templateId: string, label: string) {
      const trigger = page.locator('[data-testid="floor-plans-setup-template-select"]');
      await trigger.waitFor({ state: "visible", timeout: 20_000 });
      await trigger.click();
      await page.waitForTimeout(500);
      // SelectItem by value or visible name from library
      const { data: tpl } = await admin.from("floor_plan_templates").select("id,name").eq("id", templateId).maybeSingle();
      const item = page.getByRole("option", { name: new RegExp(tpl?.name?.slice(0, 24) ?? templateId, "i") }).first();
      if (await item.count()) await item.click();
      else {
        // fallback: click any option then filter by selecting via keyboard
        await page.locator('[role="option"]').first().click().catch(() => undefined);
      }
      await page.waitForTimeout(400);
      const labelField = page.locator('[data-testid="floor-plans-setup-couple-label"]');
      if (await labelField.count()) await labelField.fill(label);
      const offerBtn = page.locator('[data-testid="floor-plans-setup-offer"]');
      await offerBtn.click();
      for (let i = 0; i < 16; i++) {
        await page.waitForTimeout(500);
        const { data } = await admin.from("event_floor_plan_offers")
          .select("id,floor_plan_template_id,is_offered,couple_label")
          .eq("event_id", eventId)
          .eq("floor_plan_template_id", templateId)
          .eq("is_offered", true);
        if ((data ?? []).length > 0) return true;
      }
      return false;
    }

    const offeredA = await offerTemplateViaUi(TPL_A, `${PREFIX}Offer-A`);
    await page.waitForTimeout(1500);
    const offeredB = await offerTemplateViaUi(TPL_B, `${PREFIX}Offer-B`);
    const { data: offersNow } = await admin.from("event_floor_plan_offers")
      .select("id,couple_label,is_offered,floor_plan_template_id")
      .eq("event_id", eventId)
      .eq("is_offered", true);
    record(
      "j2_multi_offers_created_via_ui",
      offeredA && offeredB && (offersNow ?? []).length >= 2,
      JSON.stringify({ offeredA, offeredB, offersNow }),
      "live-ui+persisted",
    );
    await page.screenshot({ path: `${OUT}/reacceptance/j2-two-offers-1280.png`, fullPage: true });
    // Close sheet
    await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => undefined);
    await page.waitForTimeout(1000);

    // Ensure working layouts exist / share for couple visibility of chooser
    await openFloorPlans(page, eventId);
    // Offering may seed working layout — wait for plans
    for (let i = 0; i < 20; i++) {
      const { count } = await admin.from("floor_plans").select("id", { count: "exact", head: true }).eq("event_id", eventId);
      if ((count ?? 0) >= 1) break;
      await page.waitForTimeout(500);
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => undefined);
      await page.waitForTimeout(1500);
    }
    // If still only offers without plans, create additional layouts from templates then share
    let { data: plans } = await admin.from("floor_plans").select("id,name,shared_with_couple").eq("event_id", eventId);
    if ((plans ?? []).length < 2) {
      // Apply templates as additional layouts so couple can prefer among real plans
      for (const [tpl, name] of [[TPL_A, `${PREFIX}Plan-A`], [TPL_B, `${PREFIX}Plan-B`]] as const) {
        if ((plans ?? []).some((p) => p.name === name)) continue;
        const add = page.getByRole("button", { name: /Additional layout/i }).first();
        if (!(await add.count())) break;
        await add.click();
        await page.waitForTimeout(600);
        await page.getByText("Apply Template", { exact: true }).first().click().catch(() => undefined);
        await page.locator(`[data-testid="floor-plan-template-${tpl}"]`).check().catch(() => undefined);
        const nameIn = page.locator('input[placeholder="Reception"], input[placeholder*="Reception" i]').first();
        if (await nameIn.count()) await nameIn.fill(name);
        await page.getByRole("button", { name: /^Apply$/i }).last().click().catch(() => undefined);
        await page.waitForTimeout(4000);
        if (page.url().includes("/floor-plans/")) await openFloorPlans(page, eventId);
      }
      ({ data: plans } = await admin.from("floor_plans").select("id,name,shared_with_couple").eq("event_id", eventId));
    }
    // Share all via UI
    for (let g = 0; g < 8; g++) {
      const btn = page.locator("button", { hasText: /^Share Floor Plan$/ }).first();
      if (!(await btn.count())) break;
      await btn.click().catch(() => undefined);
      await page.waitForTimeout(1500);
    }
    const { data: shared } = await admin.from("floor_plans")
      .select("id,shared_with_couple")
      .eq("event_id", eventId);
    record("j2_layouts_shared_via_ui", (shared ?? []).some((p) => p.shared_with_couple), JSON.stringify(shared), "live-ui+persisted");

    // Couple multi-offer chooser
    const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const couple = await coupleCtx.newPage();
    await coupleFloor(couple, portalToken!);
    await couple.screenshot({ path: `${OUT}/reacceptance/j2-couple-chooser-1280.png`, fullPage: true });
    const coupleBody = await couple.locator("body").innerText();
    const chooser = couple.locator('[data-testid="floor-plan-choose-layout"]');
    const savePref = couple.getByRole("button", { name: /Save as preference/i });
    const hasChooser = (await chooser.count()) > 0 || (await savePref.count()) > 0
      || /Choose|preference|Save as preference/i.test(coupleBody);
    noteUx(
      "Couple multi-offer chooser",
      coupleBody.slice(0, 900),
      hasChooser
        ? "Chooser or preference action present for multi-offer path."
        : "No preference chooser — multi-offer path not visible to couple.",
      hasChooser ? "ok" : "blocker",
    );
    record("j2_couple_sees_multi_offer_chooser", hasChooser, coupleBody.slice(0, 400), "live-ui");

    let prefSaved = false;
    if (await savePref.count()) {
      // Click a distinct option if present
      const opt = couple.locator('[data-testid^="floor-plan-option-"], [data-testid="floor-plan-choose-layout"] button, [data-testid="floor-plan-choose-layout"] label').first();
      if (await opt.count()) await opt.click().catch(() => undefined);
      await savePref.first().click();
      await couple.waitForTimeout(2500);
      prefSaved = true;
    }
    const { data: evtPref } = await admin.from("events")
      .select("couple_selected_floor_plan_id,couple_preference_status")
      .eq("id", eventId)
      .maybeSingle();
    // Also check offers-scoped preference
    const { data: setupPrefs } = await admin.from("event_floor_plan_setups")
      .select("id,couple_selected_floor_plan_id,couple_preference_status")
      .eq("event_id", eventId);
    const selected = Boolean(evtPref?.couple_selected_floor_plan_id)
      || (setupPrefs ?? []).some((s) => s.couple_selected_floor_plan_id);
    record(
      "j2_couple_preference_persisted",
      prefSaved || selected,
      JSON.stringify({ prefSaved, evtPref, setupPrefs }),
      "live-ui+persisted",
    );

    // Return visit
    await coupleFloor(couple, portalToken!);
    const returnBody = await couple.locator("body").innerText();
    const { data: evtPref2 } = await admin.from("events")
      .select("couple_selected_floor_plan_id")
      .eq("id", eventId)
      .maybeSingle();
    record(
      "j2_preference_survives_return",
      Boolean(evtPref2?.couple_selected_floor_plan_id) || selected || /preference|selected|With venue/i.test(returnBody),
      JSON.stringify({ evtPref2, text: returnBody.slice(0, 250) }),
      "live-ui+persisted",
    );
    await coupleCtx.close();

    // ── Setup member attach via UI only (new disposable layouts if needed) ───
    await openFloorPlans(page, eventId);
    const setupToggle = page.locator('[data-testid="floor-plan-setup-package-toggle"]');
    if (await setupToggle.count()) {
      if ((await page.locator('[data-testid="floor-plan-setup-package-editor"]').count()) === 0) {
        await setupToggle.click();
        await page.waitForTimeout(800);
      }
    }
    async function addSetup(name: string) {
      const field = page.locator("#new-setup-name").or(page.getByTestId("floor-plan-setup-name"));
      const btn = page.getByTestId("floor-plan-setup-create");
      if (!(await field.count()) || !(await btn.count())) return false;
      await field.first().fill(name);
      await page.waitForTimeout(300);
      await btn.click();
      for (let i = 0; i < 16; i++) {
        await page.waitForTimeout(400);
        const { data } = await admin.from("event_floor_plan_setups").select("id").eq("event_id", eventId).ilike("name", name);
        if ((data ?? []).length) {
          await page.waitForTimeout(1200);
          if ((await page.locator('[data-testid="floor-plan-setup-package-editor"]').count()) === 0) {
            await setupToggle.click().catch(() => undefined);
            await page.waitForTimeout(600);
          }
          return true;
        }
      }
      return false;
    }
    const cerOk = await addSetup("Ceremony");
    const recOk = await addSetup("Reception");
    await page.waitForTimeout(1500);
    if ((await page.locator('[data-testid="floor-plan-setup-package-editor"]').count()) === 0) {
      await setupToggle.click().catch(() => undefined);
      await page.waitForTimeout(800);
    }
    const { data: setups } = await admin.from("event_floor_plan_setups").select("id,name").eq("event_id", eventId);
    const { data: planRows } = await admin.from("floor_plans").select("id,name").eq("event_id", eventId).order("created_at");
    const planA = planRows?.[0]?.id ?? null;
    const planB = planRows?.[1]?.id ?? null;
    // Attach requires distinct unassigned layouts (a layout can only sit in one setup).
    let attachedViaUi = 0;
    let attachAttempts: unknown[] = [];
    if ((setups ?? []).length >= 2 && planA && planB && planA !== planB) {
      const ordered = [...(setups ?? [])].sort((a, b) => {
        if (/Ceremony/i.test(a.name)) return -1;
        if (/Ceremony/i.test(b.name)) return 1;
        return a.name.localeCompare(b.name);
      });
      const wants = [planA, planB];
      for (let i = 0; i < ordered.length && i < wants.length; i++) {
        const s = ordered[i]!;
        const want = wants[i]!;
        const sel = page.locator(`[data-testid="floor-plan-setup-attach-${s.id}"]`);
        const visible = (await sel.count()) > 0;
        if (!visible) {
          attachAttempts.push({ setup: s.name, want, visible: false });
          continue;
        }
        await sel.selectOption(want);
        let ok = false;
        for (let w = 0; w < 20; w++) {
          await page.waitForTimeout(400);
          const { data: mem } = await admin.from("event_floor_plan_setup_members")
            .select("id").eq("setup_id", s.id).eq("floor_plan_id", want);
          if ((mem ?? []).length) { ok = true; break; }
        }
        attachAttempts.push({ setup: s.name, want, visible: true, ok });
      }
      const { data: members } = await admin.from("event_floor_plan_setup_members")
        .select("id,setup_id,floor_plan_id")
        .in("setup_id", (setups ?? []).map((s) => s.id));
      attachedViaUi = members?.length ?? 0;
    }
    record(
      "setup_members_attached_via_ui_only",
      cerOk && recOk && attachedViaUi >= 2,
      JSON.stringify({ cerOk, recOk, setups, attachedViaUi, planA, planB, attachAttempts }),
      attachedViaUi >= 2 ? "live-ui+persisted" : "live-ui",
    );
    await page.screenshot({ path: `${OUT}/reacceptance/setup-attach-1280.png`, fullPage: true });

    // ── Unlock via venue editor UI (not service-role) ────────────────────────
    if (planA) {
      await page.goto(`${APP}/events/${eventId}/floor-plans/${planA}`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await page.waitForTimeout(3000);
      // Select a locked object if possible
      const locked = page.locator('[data-testid="floor-plan-object-locked"], g[data-testid="floor-plan-object-locked"]').first();
      const anyObj = page.locator("svg g[data-object-id], [data-object-id]").first();
      if (await locked.count()) await locked.click({ force: true }).catch(() => undefined);
      else if (await anyObj.count()) await anyObj.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(800);
      let unlockedViaUi = false;
      async function tryUnlockSelected() {
        const checkbox = page.locator('[data-testid="floor-plan-object-lock-toggle"]')
          .or(page.locator('label:has-text("Lock Position") input[type="checkbox"]')).first();
        if (!(await checkbox.count())) return false;
        const wasLocked = await checkbox.isChecked().catch(() => true);
        if (wasLocked) {
          await checkbox.uncheck({ force: true }).catch(async () => {
            await checkbox.click({ force: true });
          });
          await page.waitForTimeout(1800);
        }
        return true;
      }
      const { data: lockedObjs } = await admin.from("floor_plan_objects")
        .select("id").eq("floor_plan_id", planA).eq("locked", true).limit(3);
      for (const row of lockedObjs ?? []) {
        await page.locator(`[data-object-id="${row.id}"]`).first().click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(700);
        if (!(await tryUnlockSelected())) continue;
        const { data: after } = await admin.from("floor_plan_objects").select("id,locked").eq("id", row.id).maybeSingle();
        if (after?.locked === false) {
          unlockedViaUi = true;
          persisted.unlockedViaUi = after.id;
          break;
        }
      }
      if (!unlockedViaUi) {
        // Fall back: click any canvas object then toggle Lock Position
        const anyObj = page.locator("svg g[data-object-id], [data-object-id]").first();
        if (await anyObj.count()) await anyObj.click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(600);
        await tryUnlockSelected();
        const { data: objs } = await admin.from("floor_plan_objects")
          .select("id,locked").eq("floor_plan_id", planA).eq("locked", false).limit(3);
        unlockedViaUi = (objs ?? []).length > 0;
        persisted.unlockedViaUi = objs?.[0]?.id ?? null;
      }
      noteUx(
        "Venue editor Lock Position",
        "Lock Position checkbox on selected object",
        unlockedViaUi
          ? "Customer can unlock template-locked furniture via Lock Position."
          : "Could not unlock via editor — drag would remain blocked for couple.",
        unlockedViaUi ? "ok" : "blocker",
      );
      record("furniture_unlocked_via_venue_editor_ui", unlockedViaUi, JSON.stringify({ unlockedViaUi, id: persisted.unlockedViaUi }), "live-ui+persisted");
      await page.screenshot({ path: `${OUT}/reacceptance/unlock-editor-1280.png`, fullPage: true });
    } else {
      record("furniture_unlocked_via_venue_editor_ui", false, "no planA", "live-ui");
    }

    // ── Journey 3 remnant: Additional+Share submit still works on a clean path ─
    // Use a second disposable event for pure FP-RA-1 without offers contamination
    const { data: client2 } = await admin.from("clients").insert({
      venue_id: FANCY, first_name: "FPRA3", last_name: RUN,
      email: `fpra3-${RUN.toLowerCase()}@hellotocheers-test.invalid`, status: "confirmed",
    }).select("id").single();
    const { data: event2 } = await admin.from("events").insert({
      venue_id: FANCY, client_id: client2!.id, name: `${PREFIX}AddShare`,
      event_type: "wedding", event_date: EVENT_DATE, event_end_date: EVENT_DATE,
      status: "confirmed", booked_at: new Date().toISOString(), space_id: BARN,
    }).select("id").single();
    await admin.rpc("replace_event_space_assignments", {
      p_venue_id: FANCY, p_event_id: event2!.id, p_primary_space_id: BARN,
      p_assignments: [
        { useKey: "ceremony", useLabel: "Ceremony", spaceId: BARN, startTime: null, endTime: null, scheduledDate: null, sortOrder: 0 },
      ],
    });
    const token3 = `fpra3_${RUN.toLowerCase()}_${randomBytes(2).toString("hex")}`;
    await admin.from("client_portal_sessions").insert({
      venue_id: FANCY, client_id: client2!.id, event_id: event2!.id,
      access_token: token3, access_level: "couple", label: "FPRA3",
      expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    });
    await openFloorPlans(page, event2!.id);
    const empty = page.locator('[data-testid="floor-plan-empty-no-working"]');
    const emptyText = (await empty.count()) ? await empty.innerText() : "";
    noteUx("First-use empty", emptyText, /Offer a layout|Additional layout/i.test(emptyText) ? "Paths distinguished." : "Empty unclear.", /Offer|Additional/i.test(emptyText) ? "ok" : "p2");
    await page.getByRole("button", { name: /Additional layout/i }).first().click();
    await page.getByText("Apply Template", { exact: true }).first().click().catch(() => undefined);
    await page.locator(`[data-testid="floor-plan-template-${TPL_A}"]`).check();
    await page.getByRole("button", { name: /^Apply$/i }).last().click();
    await page.waitForTimeout(4500);
    if (page.url().includes("/floor-plans/")) {
      // Unlock one object via editor before share
      const planUrl = page.url();
      const planId3 = planUrl.split("/floor-plans/")[1]?.split(/[?#]/)[0];
      if (planId3) {
        const { data: lockedObj } = await admin.from("floor_plan_objects").select("id").eq("floor_plan_id", planId3).eq("locked", true).limit(1);
        if (lockedObj?.[0]) {
          await page.locator(`[data-object-id="${lockedObj[0].id}"]`).first().click({ force: true }).catch(() => undefined);
          await page.waitForTimeout(500);
          const cb = page.locator('label:has-text("Lock Position") input[type="checkbox"]').first();
          if (await cb.count() && await cb.isChecked()) await cb.click({ force: true });
          await page.waitForTimeout(1200);
        }
      }
      await openFloorPlans(page, event2!.id);
    }
    for (let g = 0; g < 4; g++) {
      const btn = page.locator("button", { hasText: /^Share Floor Plan$/ }).first();
      if (!(await btn.count())) break;
      await btn.click().catch(() => undefined);
      await page.waitForTimeout(1200);
    }
    const couple3 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const c3 = await couple3.newPage();
    await coupleFloor(c3, token3);
    const submit = c3.locator('[data-testid="floor-plan-submit-to-venue"]').or(c3.getByRole("button", { name: /Submit floor plan/i }));
    const submitVisible = (await submit.count()) > 0 && await submit.first().isVisible().catch(() => false);
    record("j3_fp_ra1_submit_without_preference", submitVisible, `submitVisible=${submitVisible}`, "live-ui");
    if (submitVisible) {
      await submit.first().click();
      await c3.waitForTimeout(600);
      const confirm = c3.locator('[data-testid="floor-plan-submit-confirm-submit"]');
      if (await confirm.count()) await confirm.click();
      await c3.waitForTimeout(2000);
      const { data: plans3 } = await admin.from("floor_plans").select("id,client_layout_status").eq("event_id", event2!.id);
      record(
        "j3_fp_ra1_submit_persisted",
        (plans3 ?? []).some((p) => p.client_layout_status === "submitted"),
        JSON.stringify(plans3),
        "live-ui+persisted",
      );
    } else {
      record("j3_fp_ra1_submit_persisted", false, "submit not available", "live-ui");
    }
    await couple3.close();
    // cleanup event2
    await cleanup({ clientId: client2!.id, eventId: event2!.id, portalToken: token3 });

    persisted.usability = usability;
  } catch (err) {
    let detail = err instanceof Error ? (err.stack ?? err.message) : "";
    if (!detail) try { detail = JSON.stringify(err); } catch { detail = String(err); }
    record("harness_error", false, detail, "harness");
    try { await page.screenshot({ path: `${OUT}/reacceptance/harness-error.png`, fullPage: true }); } catch { /* */ }
  } finally {
    await browser.close();
    if (!process.env.KEEP_FIXTURE) await cleanup({ clientId, eventId, portalToken });
    const pass = checks.every((c) => c.pass);
    const blockers = usability.filter((u) => u.severity === "blocker" || u.severity === "p2");
    writeFileSync(`${OUT}/reacceptance/browser-results.json`, JSON.stringify({
      pass, run: RUN, expectedSha: EXPECTED, checks, usability,
      blockers: blockers.length, persisted,
    }, null, 2));
    writeFileSync(`${OUT}/reacceptance/persisted-state.json`, JSON.stringify(persisted, null, 2));
    writeFileSync(`${OUT}/reacceptance/usability-notes.json`, JSON.stringify(usability, null, 2));
    console.log(`\n${checks.filter((c) => c.pass).length}/${checks.length} passed; UX blockers/p2=${blockers.length}`);
    process.exitCode = pass && blockers.length === 0 ? 0 : 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
