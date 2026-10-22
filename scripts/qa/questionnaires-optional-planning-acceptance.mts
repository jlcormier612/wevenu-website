/**
 * Questionnaires optional setup + Planning task attachment (Sandbox Fancy).
 * Scheduled questionnaire delivery is intentionally NOT claimed GREEN.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
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
const SPACE_ID = "3b36ec69-b17d-4351-8186-68d96dd6dfe7";
const OUT = "docs/qa/questionnaires-optional-planning";
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
  const month = ((seed >>> 8) % 12) + 1;
  const day = (seed % 28) + 1;
  const year = 2046 + (Math.abs(seed) % 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function main() {
  const stamp = Date.now();
  const tag = `QOP-${stamp}-${randomBytes(2).toString("hex")}`;
  let eventDate = uniqueFarEventDate(stamp ^ randomBytes(2).readUInt16BE(0));
  let servingSha: string | null = null;
  let eventId: string | null = null;
  let clientId: string | null = null;
  let leadId: string | null = null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();

  try {
    const res = await page.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    servingSha =
      noteDeployment(res?.headers()["x-deployment-id"]) ??
      noteDeployment(res?.headers()["link"]);
    if (!servingSha) {
      const ver = await page.goto(`${APP}/api/version`, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
      const body = ver ? await ver.text().catch(() => "") : "";
      servingSha = body.match(/[0-9a-f]{40}/)?.[0] ?? null;
      await page.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    }
    record(
      "serving_sha",
      !!servingSha && servingSha.startsWith(EXPECTED_SHA.slice(0, 8)),
      `serving=${servingSha} expected=${EXPECTED_SHA}`,
    );
    if (!servingSha?.startsWith(EXPECTED_SHA.slice(0, 8))) {
      throw new Error(`serving ${servingSha}, expected ${EXPECTED_SHA}`);
    }

    await page.waitForSelector("text=Planning tools", { timeout: 60_000 });
    const settingsText = await page.locator("body").innerText();
    record("settings_lists_questionnaires_capability", /Questionnaires/i.test(settingsText), "Questionnaires");
    await page.screenshot({ path: `${OUT}/01-settings-planning-tools-1280.png`, fullPage: true }).catch(() => undefined);

    const { data: venueCaps } = await admin
      .from("venues")
      .select("planning_questionnaires_enabled")
      .eq("id", FANCY)
      .single();
    const capsOn = venueCaps?.planning_questionnaires_enabled !== false;
    record("fancy_questionnaires_capability_on", capsOn, JSON.stringify(venueCaps));

    const { data: lead, error: leadErr } = await admin
      .from("leads")
      .insert({
        venue_id: FANCY,
        first_name: "QOP",
        last_name: tag.slice(-10),
        partner_first_name: "Portal",
        partner_last_name: "Partner",
        email: `qop-${stamp}@hellotocheers-test.invalid`,
        event_type: "wedding",
        event_date: eventDate,
        guest_count: 64,
        sales_stage: "new_inquiry",
        status: "active",
        source: "website",
        inquiry_message: `[qa] questionnaires optional planning ${tag}`,
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
      throw new Error("could not assign space in booking confirmation");
    }
    const submit = page.getByTestId("booking-confirm-submit");
    for (let i = 0; i < 60 && !(await submit.isEnabled()); i += 1) await page.waitForTimeout(500);
    if (!(await submit.isEnabled())) {
      eventDate = uniqueFarEventDate(stamp ^ Date.now() ^ 0xabcdef);
      await page.getByTestId("booking-confirm-date").fill(eventDate);
      await pickUse("reception").catch(() => false);
      for (let i = 0; i < 60 && !(await submit.isEnabled()); i += 1) await page.waitForTimeout(500);
    }
    if (!(await submit.isEnabled())) throw new Error("booking-confirm-submit stayed disabled");
    await submit.click({ timeout: 15_000 });
    try {
      await page.waitForURL(/\/(clients|events)\//, { timeout: 90_000 });
    } catch {
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
        await page.screenshot({ path: `${OUT}/02-booking-nav-timeout.png`, fullPage: true }).catch(() => undefined);
        throw new Error(`booking navigation failed url=${page.url()}`);
      }
    }

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
    record("booking_created_event", Boolean(eventId && clientId), JSON.stringify({ eventId, clientId }));
    if (!eventId) throw new Error("no event after booking");

    await page.goto(`${APP}/events/${eventId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    const overview = await page.locator("body").innerText();
    const hasQCard = /Questionnaires/i.test(overview);
    record(
      "overview_questionnaires_visibility_matches_capability",
      capsOn ? hasQCard : !hasQCard,
      `capsOn=${capsOn} hasQCard=${hasQCard}`,
    );
    await page.screenshot({ path: `${OUT}/02-event-overview-1280.png`, fullPage: true }).catch(() => undefined);

    // Change Planning — prefer setup card Change control
    const changeBtns = page.getByRole("button", { name: /^Change for this event$/i });
    const count = await changeBtns.count();
    let opened = false;
    for (let i = 0; i < count; i += 1) {
      const btn = changeBtns.nth(i);
      const cardText = await btn.evaluate((el) => el.closest("section,li,div")?.textContent ?? "");
      if (/Planning/i.test(cardText) && !/Venue Planning|Timeline|Inventory|Event Order|Floor|Vendor/i.test(cardText.split("Change")[0] ?? "")) {
        // Prefer the Planning card specifically
      }
      if (/Planning checklist|Client Planning|Planning/i.test(cardText)) {
        await btn.click();
        opened = await page.waitForSelector('[data-testid="event-planning-setup-editor"]', { timeout: 8_000 }).then(() => true).catch(() => false);
        if (opened) break;
      }
    }
    if (!opened && count > 0) {
      // First Change is usually Planning on Overview
      await changeBtns.first().click();
      opened = await page.waitForSelector('[data-testid="event-planning-setup-editor"]', { timeout: 8_000 }).then(() => true).catch(() => false);
    }
    record("planning_change_editor_open", opened, `changeButtons=${count}`);

    if (opened) {
      const customize = page.getByTestId("planning-setup-mode-customize");
      if (await customize.count()) await customize.click();
      const title = `QOP attach ${tag}`;
      await page.getByTestId("planning-setup-new-title").fill(title);
      const attach = page.getByTestId("planning-setup-new-questionnaire");
      record("planning_attach_control_present", (await attach.count()) === 1, `count=${await attach.count()}`);
      if ((await attach.count()) === 1) {
        await attach.check();
        await page.getByTestId("planning-setup-add-task").click();
        let row: { id: string; action_type: string | null; auto_complete_trigger: string | null } | null = null;
        for (let i = 0; i < 20; i += 1) {
          await page.waitForTimeout(400);
          const { data: tasks } = await admin
            .from("event_tasks")
            .select("id,title,action_type,auto_complete_trigger")
            .eq("event_id", eventId)
            .eq("venue_id", FANCY)
            .eq("title", title);
          if (tasks?.[0]) {
            row = tasks[0] as typeof row;
            break;
          }
        }
        record(
          "planning_task_questionnaire_attached",
          row?.action_type === "questionnaire" && row?.auto_complete_trigger === "questionnaire_submitted",
          JSON.stringify(row),
        );
        const { data: qs } = await admin
          .from("event_questionnaires")
          .select("id,status")
          .eq("event_id", eventId)
          .eq("venue_id", FANCY);
        record(
          "attach_did_not_mark_questionnaire_sent",
          !(qs ?? []).some((q) => q.status === "sent"),
          JSON.stringify(qs ?? []),
        );
        // Reload editor — attachment still reflected
        await page.getByRole("button", { name: /Back to Overview/i }).click().catch(() => undefined);
        await page.waitForTimeout(800);
        await changeBtns.first().click().catch(() => undefined);
        await page.waitForSelector('[data-testid="event-planning-setup-editor"]', { timeout: 8_000 }).catch(() => undefined);
        if (row?.id) {
          const box = page.getByTestId(`planning-setup-task-questionnaire-${row.id}`);
          for (let i = 0; i < 15 && (await box.count()) === 0; i += 1) await page.waitForTimeout(300);
          record(
            "planning_attachment_survives_reopen",
            (await box.count()) === 1 && (await box.isChecked()),
            `taskId=${row.id} count=${await box.count()}`,
          );
        } else {
          record("planning_attachment_survives_reopen", false, "no task row");
        }
      } else {
        record("planning_task_questionnaire_attached", false, "checkbox missing");
        record("attach_did_not_mark_questionnaire_sent", false, "skipped");
        record("planning_attachment_survives_reopen", false, "skipped");
      }
      await page.screenshot({ path: `${OUT}/03-planning-attach-1280.png`, fullPage: true }).catch(() => undefined);
    } else {
      record("planning_attach_control_present", false, "editor closed");
      record("planning_task_questionnaire_attached", false, "skipped");
      record("attach_did_not_mark_questionnaire_sent", false, "skipped");
      record("planning_attachment_survives_reopen", false, "skipped");
    }

    const { count: templateCount } = await admin
      .from("questionnaire_templates")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY);
    record("reusable_templates_remain", (templateCount ?? 0) >= 1, `templates=${templateCount}`);

    record(
      "scheduled_send_partial_blocked",
      true,
      "No automated questionnaire delivery schedule in domain — not claimed GREEN",
    );
  } catch (err) {
    record("harness_error", false, err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
    const failed = checks.filter((c) => !c.pass).length;
    const passed = checks.filter((c) => c.pass).length;
    const payload = {
      workflow: "questionnaires-optional-planning",
      status: failed === 0 ? "PARTIAL_GREEN_CORE" : "NOT_GREEN",
      note: "Scheduled sends remain PARTIAL/BLOCKED even when core checks pass",
      expectedSha: EXPECTED_SHA,
      servingSha,
      ids: { leadId, eventId, clientId, tag },
      passed,
      failed,
      checks,
      scheduledSends: "PARTIAL_BLOCKED",
    };
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(payload, null, 2));
    console.log(JSON.stringify({ passed, failed, servingSha, eventId, status: payload.status }, null, 2));
    // Core may be green while scheduled stays partial — exit 0 only if no failed checks
    process.exitCode = failed === 0 ? 0 : 1;
  }
}

main();
