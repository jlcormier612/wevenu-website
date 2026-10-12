/**
 * Sandbox: generic Calendar tour link + existing lead with active hold.
 * Prospect must complete tour without selecting the held preferred date.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { createTourOriginToken } from "@/lib/tours/origin-context";

config({ path: ".env.local", quiet: true });
try {
  for (const line of readFileSync("/tmp/htc-tour-origin.env", "utf8").split("\n")) {
    const m = line.match(/^TOUR_ORIGIN_SIGNING_SECRET=(.+)$/);
    if (m) process.env.TOUR_ORIGIN_SIGNING_SECRET = m[1];
  }
} catch {
  /* optional */
}

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/tour-scheduling";
mkdirSync(OUT, { recursive: true });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) throw new Error("Not Sandbox");

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 300)}`);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const tipHtml = await fetch(`${APP}/login`).then((r) => r.text());
  const tip = (tipHtml.match(/dpl=([a-f0-9]{40})/) || [])[1] || "unknown";
  const stamp = Date.now();
  const email = `jennifer+genhold.${stamp}@hellotocheers.com`;
  let userId = "";
  let venueId = "";
  let leadId = "";
  let holdId = "";
  let appointmentId = "";
  let tourEmbedKey = "";
  const preferredDate = "2027-09-04";
  const coupleEmail = `couple.genhold.${stamp}@example.com`;

  try {
    const { data: created } = await admin.auth.admin.createUser({
      email,
      password: `G-${stamp}-Aa1x`,
      email_confirm: true,
    });
    userId = created!.user!.id;
    const { data: venue } = await admin
      .from("venues")
      .insert({
        owner_user_id: userId,
        name: `GenHold ${stamp}`,
        email,
        tour_scheduling_enabled: true,
        inquiry_event_date_mode: "choose_available",
        inquiry_form_fields: {
          phone: "optional",
          partner: "optional",
          guest_count: "required",
          event_details: "optional",
          estimated_budget: "optional",
          preferred_event_date: "required",
        },
      })
      .select("id, tour_embed_key, embed_key")
      .single();
    venueId = venue!.id;
    tourEmbedKey = venue!.tour_embed_key as string;
    for (let d = 0; d < 7; d++) {
      await admin.from("tour_availability_windows").insert({
        venue_id: venueId,
        day_of_week: d,
        start_time: "10:00",
        end_time: "16:00",
      });
    }
    const { data: lead } = await admin
      .from("leads")
      .insert({
        venue_id: venueId,
        first_name: "Pat",
        last_name: "Prospect",
        email: coupleEmail,
        event_type: "wedding",
        event_date: preferredDate,
        guest_count: 120,
        sales_stage: "outreach_sent",
        acquisition_source: "other",
        source: "other",
        exclude_from_business_reporting: true,
        inquiry_date: new Date().toISOString().slice(0, 10),
      })
      .select("id, event_date")
      .single();
    leadId = lead!.id;
    const holdIns = await admin
      .from("date_holds")
      .insert({
        venue_id: venueId,
        lead_id: leadId,
        hold_date: preferredDate,
        status: "active",
        title: "gen hold",
      })
      .select("id")
      .single();
    holdId = holdIns.data!.id;

    const dates = await fetch(
      `${APP}/api/public/inquiry-available-dates?key=${encodeURIComponent(venue!.embed_key as string)}&start=2027-09-01&end=2027-09-10`,
    ).then((r) => r.json() as Promise<{ dates?: string[] }>);
    record(
      "held_date_not_in_public_available_set",
      !(dates.dates ?? []).includes(preferredDate),
      `available=${(dates.dates ?? []).join(",")}`,
    );

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let bookPayload: Record<string, unknown> | null = null;
    let bookRes: Record<string, unknown> | null = null;
    page.on("response", async (res) => {
      if (res.url().includes("/api/tours/book") && res.request().method() === "POST") {
        try {
          bookPayload = JSON.parse(res.request().postData() || "{}") as Record<string, unknown>;
          bookRes = (await res.json()) as Record<string, unknown>;
        } catch {
          /* ignore */
        }
      }
    });

    const genericUrl = `${APP}/book/${encodeURIComponent(tourEmbedKey)}`;
    await page.goto(genericUrl, { waitUntil: "load", timeout: 90000 });
    await page.waitForTimeout(2500);
    const body = ((await page.locator("body").innerText()) as string).replace(/\s+/g, " ");
    record(
      "generic_no_existing_lead_readonly_block",
      (await page.locator('[data-testid="existing-lead-preferred-event-date"]').count()) === 0,
      "no o= context",
    );
    record(
      "generic_preferred_optional_for_tour",
      /Optional for tours/i.test(body) && !/Preferred event date \*/i.test(body),
      body.slice(0, 200),
    );

    await page.getByRole("button", { name: /Schedule a Tour/i }).click().catch(() => {});
    await page.waitForTimeout(500);
    await page.locator('input[type="number"]').first().fill("120");
    // Fill identity matching existing lead
    await page.locator('input').nth(0).fill("Pat"); // may already be empty
    // Use labels
    const first = page.getByLabel(/First name/i);
    if (await first.count()) await first.fill("Pat");
    const last = page.getByLabel(/Last name/i);
    if (await last.count()) await last.fill("Prospect");
    const emailInput = page.getByLabel(/^Email/i);
    if (await emailInput.count()) await emailInput.fill(coupleEmail);
    await page.locator("select").first().selectOption({ label: "Wedding" }).catch(async () => {
      await page.locator("select").first().selectOption("wedding");
    });

    const dayBtns = page.locator("form button").filter({ hasText: /^\d{1,2}$/ });
    let selected = false;
    for (let i = 0; i < Math.min(await dayBtns.count(), 40); i++) {
      const btn = dayBtns.nth(i);
      if (await btn.isDisabled()) continue;
      await btn.click();
      await page.waitForTimeout(400);
      const timeBtn = page.getByRole("button", { name: /\d{1,2}:\d{2}\s*(AM|PM)/i }).first();
      if (await timeBtn.count()) {
        await timeBtn.click();
        selected = true;
        break;
      }
    }
    record("generic_ui_tour_slot_selected", selected, "slot");
    await page.screenshot({ path: `${OUT}/generic-held-before-submit.png`, fullPage: true });
    await page.getByRole("button", { name: "Confirm Tour" }).click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}/generic-held-after-submit.png`, fullPage: true });
    const after = ((await page.locator("body").innerText()) as string).replace(/\s+/g, " ");
    const ok = bookRes?.ok === true && Boolean(bookRes?.appointmentId);
    appointmentId = String(bookRes?.appointmentId ?? "");
    record(
      "generic_confirm_tour_without_selecting_held_date",
      ok && /You.?re booked/i.test(after),
      `ok=${bookRes?.ok} eventDate=${JSON.stringify(bookPayload?.eventDate)} err=${bookRes?.error ?? ""}`,
    );
    record(
      "generic_attached_existing_lead",
      bookRes?.attachedExistingLead === true || bookRes?.leadId === leadId,
      `attached=${bookRes?.attachedExistingLead}`,
    );
    record(
      "generic_payload_event_date_empty_or_absent",
      !bookPayload?.eventDate,
      `eventDate=${JSON.stringify(bookPayload?.eventDate)}`,
    );

    // Personal o= link still shows read-only
    const token = createTourOriginToken(
      { venueId, leadId },
      process.env.TOUR_ORIGIN_SIGNING_SECRET!,
    );
    await page.goto(`${genericUrl}?o=${encodeURIComponent(token)}`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    record(
      "personal_link_readonly_preferred",
      (await page.locator('[data-testid="existing-lead-preferred-event-date"]').count()) > 0,
      "o= context",
    );
    record(
      "personal_link_hides_mode_toggle",
      (await page.getByRole("button", { name: /Request Information/i }).count()) === 0,
      "locked schedule_tour",
    );

    const { data: leadAfter } = await admin
      .from("leads")
      .select("event_date, sales_stage")
      .eq("id", leadId)
      .single();
    const { data: holdAfter } = await admin.from("date_holds").select("status, hold_date").eq("id", holdId).single();
    record(
      "preferred_date_unchanged",
      String(leadAfter?.event_date).slice(0, 10) === preferredDate,
      String(leadAfter?.event_date),
    );
    record(
      "hold_still_active",
      holdAfter?.status === "active" && String(holdAfter.hold_date).slice(0, 10) === preferredDate,
      JSON.stringify(holdAfter),
    );
    const { count: leadCount } = await admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    record("no_duplicate_lead", leadCount === 1, `count=${leadCount}`);

    await browser.close();
  } catch (e) {
    record("browser_error", false, e instanceof Error ? e.message : String(e));
  } finally {
    if (appointmentId) await admin.from("tour_appointments").delete().eq("id", appointmentId);
    if (holdId) await admin.from("date_holds").delete().eq("id", holdId);
    if (leadId) await admin.from("leads").delete().eq("id", leadId);
    if (venueId) {
      await admin.from("tour_availability_windows").delete().eq("venue_id", venueId);
      await admin.from("venues").delete().eq("id", venueId);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  }

  const passCount = checks.filter((c) => c.pass).length;
  const out = {
    tip,
    preferredDate,
    checks,
    passCount,
    total: checks.length,
    verdict: passCount === checks.length && checks.length > 0 ? "GREEN" : "NOT_GREEN",
  };
  writeFileSync(`${OUT}/generic-held-browser-results.json`, JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify({ passCount, total: checks.length, tip, verdict: out.verdict }, null, 2));
  if (passCount < checks.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
