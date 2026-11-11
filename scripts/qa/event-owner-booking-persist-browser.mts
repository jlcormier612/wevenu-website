/**
 * Sandbox: event owner selected at booking confirmation persists independently
 * of the lead sales owner. Disposable Fancy Venue only.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED_PREFIX = process.env.EXPECTED_TIP_PREFIX ?? "";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/event-owner-booking-persist";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
const createdLeadIds: string[] = [];

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(linkHeader: string | undefined) {
  const match = linkHeader?.match(/dpl=([0-9a-f]{40})/);
  return match?.[1] ?? null;
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
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map(
      (c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      }),
    ),
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

async function cleanup() {
  for (const leadId of createdLeadIds) {
    const { data: clients } = await admin.from("clients").select("id").eq("lead_id", leadId).eq("venue_id", FANCY);
    for (const c of clients ?? []) {
      const { data: evs } = await admin.from("events").select("id").eq("client_id", c.id);
      for (const e of evs ?? []) {
        await admin.from("event_space_assignments").delete().eq("event_id", e.id);
        await admin.from("events").delete().eq("id", e.id);
      }
      await admin.from("clients").delete().eq("id", c.id);
    }
    await admin.from("date_holds").delete().eq("lead_id", leadId);
    await admin.from("leads").delete().eq("id", leadId);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = String(Date.now()).slice(-6);
  const dayOffset = Number(stamp) % 280;
  const d = new Date(Date.UTC(2031, 2, 5 + dayOffset));
  const EVENT_DATE = d.toISOString().slice(0, 10);

  const { data: staff } = await admin
    .from("venue_staff")
    .select("id, full_name")
    .eq("venue_id", FANCY)
    .eq("is_active", true)
    .order("full_name");
  if (!staff || staff.length < 2) throw new Error("need ≥2 active staff");
  const staffA = staff.find((s) => s.full_name === "Jen Fancy") ?? staff[0]!;
  const staffB = staff.find((s) => s.id !== staffA.id && s.full_name === "Terry Tuttle")
    ?? staff.find((s) => s.id !== staffA.id)!;
  const staffC = staff.find((s) => s.id !== staffA.id && s.id !== staffB.id)
    ?? staff.find((s) => s.full_name === "Ron Cormier" && s.id !== staffA.id)
    ?? staffB;

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: "Owner",
      last_name: `Persist${stamp}`,
      email: `owner-persist-${stamp}@hellotocheers-test.invalid`,
      event_date: EVENT_DATE,
      event_type: "wedding",
      sales_stage: "new_inquiry",
      status: "active",
      source: "website",
      inquiry_message: `[qa] event-owner persist ${stamp}`,
      inquiry_message_origin: "venue",
      assigned_staff_id: staffA.id,
    })
    .select("id, assigned_staff_id")
    .single();
  if (leadErr) throw leadErr;
  createdLeadIds.push(lead.id);
  record("lead_sales_owner_a", lead.assigned_staff_id === staffA.id, JSON.stringify({ lead, staffA }));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();

  try {
    const login = await page.goto(APP + "/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const serving = noteDeployment(login?.headers()["link"]);
    const tipOk = !EXPECTED_PREFIX || (!!serving && serving.startsWith(EXPECTED_PREFIX));
    record("serving_commit", tipOk, serving ?? "no dpl");
    if (!tipOk) throw new Error(`serving ${serving}, expected ${EXPECTED_PREFIX}`);

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
    // Allow live draft fetch to settle — regression was wiping assignee here.
    await page.waitForTimeout(1500);
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

    // Select Staff B AFTER draft settle (proves wipe fix).
    const staffSelect = dialog.getByTestId("booking-assigned-staff");
    await staffSelect.click();
    await page.getByRole("option", { name: staffB.full_name }).first().click();
    await page.waitForTimeout(400);
    // Simulate late draft identity churn: wait; selection must stick.
    await page.waitForTimeout(1200);
    const selectedLabel = await staffSelect.innerText();
    record(
      "confirmation_keeps_staff_b_after_draft_settle",
      selectedLabel.includes(staffB.full_name),
      selectedLabel,
    );

    await page.getByTestId("booking-confirm-submit").click();
    await page.waitForURL(/\/clients\//, { timeout: 60_000 });

    const { data: client } = await admin
      .from("clients")
      .select("id, lead_id")
      .eq("lead_id", lead.id)
      .eq("venue_id", FANCY)
      .single();
    if (!client) throw new Error("client missing");

    const { data: event } = await admin
      .from("events")
      .select("id, assigned_staff_id, booked_at")
      .eq("client_id", client.id)
      .eq("venue_id", FANCY)
      .not("booked_at", "is", null)
      .maybeSingle();
    record(
      "persisted_event_owner_b",
      !!event && event.assigned_staff_id === staffB.id,
      JSON.stringify({ event, staffB }),
    );

    const { data: leadAfter } = await admin
      .from("leads")
      .select("assigned_staff_id, sales_stage")
      .eq("id", lead.id)
      .single();
    record(
      "lead_still_owner_a",
      leadAfter?.assigned_staff_id === staffA.id,
      JSON.stringify(leadAfter),
    );

    if (!page.url().includes(`/clients/${client.id}`) || page.url().includes("/booked")) {
      await page.goto(`${APP}/clients/${client.id}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    }
    await page.getByTestId("event-owner-assignment").waitFor({ state: "visible", timeout: 20_000 });
    const ownerRegion = await page.getByTestId("event-owner-assignment").innerText();
    record("workspace_shows_staff_b", ownerRegion.includes(staffB.full_name), ownerRegion);
    await page.screenshot({ path: `${OUT_DIR}/01-booked-owner-b.png`, fullPage: true });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("event-owner-assignment").waitFor({ state: "visible", timeout: 20_000 });
    const afterReload = await page.getByTestId("event-owner-assignment").innerText();
    record("reload_still_staff_b", afterReload.includes(staffB.full_name), afterReload);

    // Reassign to Staff C via UI
    const ownerSelect = page.getByTestId("event-owner-assignment").locator('[data-slot="select-trigger"]').first()
      .or(page.getByTestId("event-owner-assignment").getByRole("combobox"));
    await ownerSelect.first().click();
    await page.getByRole("option", { name: staffC.full_name }).first().click();
    await page.getByTestId("event-owner-assignment-save").click();
    await page.waitForTimeout(1500);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("event-owner-assignment").waitFor({ state: "visible", timeout: 20_000 });
    const afterC = await page.getByTestId("event-owner-assignment").innerText();
    const { data: eventC } = await admin
      .from("events")
      .select("assigned_staff_id")
      .eq("id", event!.id)
      .single();
    const { data: leadFinal } = await admin
      .from("leads")
      .select("assigned_staff_id")
      .eq("id", lead.id)
      .single();
    record(
      "reassign_staff_c_persists",
      afterC.includes(staffC.full_name) && eventC?.assigned_staff_id === staffC.id,
      JSON.stringify({ afterC, eventC, staffC }),
    );
    record(
      "lead_still_a_after_reassign",
      leadFinal?.assigned_staff_id === staffA.id,
      JSON.stringify(leadFinal),
    );
    await page.screenshot({ path: `${OUT_DIR}/02-reassigned-owner-c.png`, fullPage: true });

    writeFileSync(
      `${OUT_DIR}/persisted.json`,
      JSON.stringify({ staffA, staffB, staffC, leadId: lead.id, clientId: client.id, event }, null, 2),
    );
  } finally {
    await browser.close().catch(() => undefined);
    try {
      await cleanup();
    } catch (err) {
      console.error("cleanup", err);
    }
  }

  const payload = { tipPrefix: EXPECTED_PREFIX, checks, pass: checks.every((c) => c.pass) };
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(payload, null, 2));
  console.log(payload.pass ? "ALL PASS" : "SOME FAILED");
  process.exit(payload.pass ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  writeFileSync(
    `${OUT_DIR}/browser-results.json`,
    JSON.stringify({ tipPrefix: EXPECTED_PREFIX, checks, pass: false, error: String(err) }, null, 2),
  );
  await cleanup().catch(() => undefined);
  process.exit(1);
});
