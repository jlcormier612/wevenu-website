/**
 * Sandbox: existing-lead tour scheduling preserves preferred event date.
 * Disposable venue + lead with held/unavailable preferred date.
 * Never logs secrets or PII.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { createTourOriginToken } from "@/lib/tours/origin-context";

config({ path: ".env.local", quiet: true });
try {
  const extra = readFileSync("/tmp/htc-tour-origin.env", "utf8");
  for (const line of extra.split("\n")) {
    const m = line.match(/^TOUR_ORIGIN_SIGNING_SECRET=(.+)$/);
    if (m) process.env.TOUR_ORIGIN_SIGNING_SECRET = m[1];
  }
} catch {
  /* optional */
}

process.env.NEXT_PUBLIC_APP_URL = "https://app.sandbox.hellotocheers.com";

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/tour-scheduling";
mkdirSync(OUT, { recursive: true });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
}
if (!process.env.TOUR_ORIGIN_SIGNING_SECRET?.trim()) {
  throw new Error("TOUR_ORIGIN_SIGNING_SECRET missing");
}

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 400)}`);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function main() {
  const observedAt = new Date().toISOString();
  const tipHtml = await fetch(`${APP}/login`).then((r) => r.text());
  const tip = (tipHtml.match(/dpl=([a-f0-9]{40})/) || [])[1] || "unknown";
  const stamp = Date.now();
  const email = `jennifer+eltour.${stamp}@hellotocheers.com`;
  const password = `El-${stamp}-Aa1x`;
  let userId = "";
  let venueId = "";
  let leadId = "";
  let holdId = "";
  let appointmentId = "";
  let tourEmbedKey = "";
  const preferredDate = "2027-12-25"; // typically blocked / held

  try {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (cErr || !created.user) throw cErr ?? new Error("createUser");
    userId = created.user.id;

    const { data: venue, error: vErr } = await admin
      .from("venues")
      .insert({
        owner_user_id: userId,
        name: `EL Tour ${stamp}`,
        email,
        tour_scheduling_enabled: true,
        inquiry_event_date_mode: "choose_available",
        inquiry_form_fields: {
          phone: "optional",
          partner: "optional",
          guest_count: "optional",
          event_details: "optional",
          estimated_budget: "optional",
          preferred_event_date: "required",
        },
      })
      .select("id, tour_embed_key, embed_key")
      .single();
    if (vErr || !venue) throw vErr ?? new Error("venue");
    venueId = venue.id;
    tourEmbedKey = venue.tour_embed_key as string;

    // Ensure tour windows exist for near-term slots
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
    const ymd = tomorrow.toISOString().slice(0, 10);
    const dow = tomorrow.getUTCDay();
    await admin.from("tour_availability_windows").insert({
      venue_id: venueId,
      day_of_week: dow,
      start_time: "10:00",
      end_time: "16:00",
    }).then(() => {}).catch(() => {});

    await admin.from("venue_staff").insert({
      venue_id: venueId,
      user_id: userId,
      full_name: "EL Tour Owner",
      email,
      role: "owner",
      is_owner: true,
      is_active: true,
      accepted_at: new Date().toISOString(),
      access_title: "administrator",
      title_basis: "administrator",
      capability_overrides: {},
      owner_invite_pending: false,
    });

    await admin.from("venue_onboarding_intake").upsert(
      {
        venue_id: venueId,
        path: "self_setup",
        venue_name: `EL Tour ${stamp}`,
        space_mode: "one",
        spaces: [{ name: "Main", maxCapacity: null }],
        offers_tours: true,
        inquiry_sources: [],
        bring_business_choice: "starting_fresh",
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "venue_id" },
    );

    const { data: lead, error: lErr } = await admin
      .from("leads")
      .insert({
        venue_id: venueId,
        first_name: "Existing",
        last_name: "Lead",
        email: `couple.${stamp}@example.com`,
        event_type: "wedding",
        event_date: preferredDate,
        sales_stage: "new_inquiry",
        acquisition_source: "other",
        source: "other",
        exclude_from_business_reporting: true,
        inquiry_date: new Date().toISOString().slice(0, 10),
      })
      .select("id, event_date, relationship_id")
      .single();
    if (lErr || !lead) throw lErr ?? new Error("lead");
    leadId = lead.id;

    // Active hold on preferred date
    const holdIns = await admin
      .from("date_holds")
      .insert({
        venue_id: venueId,
        lead_id: leadId,
        hold_date: preferredDate,
        status: "active",
        title: "EL tour hold",
      })
      .select("id")
      .maybeSingle();
    if (holdIns.error) {
      record("hold_insert", false, holdIns.error.message);
    } else if (holdIns.data) {
      holdId = holdIns.data.id;
      record("hold_insert", true, holdId.slice(0, 8));
    }

    const beforeEventDate = lead.event_date;
    const { count: leadsBefore } = await admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);

    const token = createTourOriginToken(
      { venueId, leadId },
      process.env.TOUR_ORIGIN_SIGNING_SECRET!,
    );
    const url = `${APP}/book/${encodeURIComponent(tourEmbedKey)}?o=${encodeURIComponent(token)}`;

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: "load", timeout: 90000 });
    await page.waitForTimeout(2500);

    const body = ((await page.locator("body").innerText()) as string).replace(/\s+/g, " ");
    const hasReadOnly = (await page.locator('[data-testid="existing-lead-preferred-event-date"]').count()) > 0;
    record("readonly_preferred_date_shown", hasReadOnly, body.slice(0, 160));
    record(
      "not_forced_to_reselect_calendar",
      hasReadOnly && !body.includes("Select a date from available") && !(await page.locator('[data-testid="existing-lead-preferred-event-date"] input[type="date"]').count()),
      "no date input inside existing-lead block",
    );
    record("copy_mentions_already_shared", /already shared/i.test(body), body.slice(0, 120));

    // Pick first available tour slot button
    const dayButtons = page.locator("button").filter({ hasText: /^\d{1,2}$/ });
    // Prefer clicking an available day in the tour calendar — look for enabled day cells
    const tourSection = page.getByText(/Select your tour/i);
    record("tour_section_present", (await tourSection.count()) > 0, "tour section");

    // Fetch slots via API (UI context already verified above)
    async function firstSlot(startYmd: string, endYmd: string) {
      const res = await fetch(
        `${APP}/api/tours/slots?key=${encodeURIComponent(tourEmbedKey)}&start=${startYmd}&end=${endYmd}`,
      ).then((r) => r.json() as Promise<{ slots?: { start: string; time: string; date: string }[] }>);
      return (res.slots ?? [])[0] ?? null;
    }
    const rangeStart = new Date();
    rangeStart.setUTCDate(rangeStart.getUTCDate() + 1);
    const rangeEnd = new Date();
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 21);
    let chosen =
      (await firstSlot(ymd, ymd)) ??
      (await firstSlot(rangeStart.toISOString().slice(0, 10), rangeEnd.toISOString().slice(0, 10)));

    let bookedOk = false;
    if (chosen) {
      record("tour_slot_available", true, chosen.start);
      // Navigate month if needed then click day + time via UI is fragile; submit via API with origin token for persistence proof,
      // and still verify UI context above.
      const bookRes = await fetch(`${APP}/api/tours/book`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: tourEmbedKey,
          slotStart: chosen.start,
          firstName: "Existing",
          lastName: "Lead",
          partnerName: "",
          email: `couple.${stamp}@example.com`,
          phone: "",
          eventType: "wedding",
          eventDate: "", // client omits / clears — server must preserve
          guestCount: null,
          notes: "EL tour preferred-date proof",
          originToken: token,
        }),
      }).then((r) => r.json() as Promise<Record<string, unknown>>);
      bookedOk = bookRes.ok === true && Boolean(bookRes.appointmentId);
      appointmentId = String(bookRes.appointmentId ?? "");
      record(
        "book_with_empty_client_event_date",
        bookedOk,
        `ok=${bookRes.ok} err=${bookRes.error ?? ""} appt=${appointmentId.slice(0, 8)}`,
      );
      record(
        "attached_existing_lead",
        bookRes.attachedExistingLead === true || bookRes.leadId === leadId,
        `leadId=${String(bookRes.leadId ?? "").slice(0, 8)} attached=${bookRes.attachedExistingLead}`,
      );
    } else {
      record("tour_slot_available", false, "none");
      record("book_with_empty_client_event_date", false, "no slot");
      record("attached_existing_lead", false, "no slot");
    }

    // Invalid token rejected
    const bad = await fetch(`${APP}/api/tours/book`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: tourEmbedKey,
        slotStart: chosen?.start ?? new Date(Date.now() + 3 * 86400000).toISOString(),
        firstName: "X",
        lastName: "Y",
        partnerName: "",
        email: `other.${stamp}@example.com`,
        phone: "",
        eventType: "wedding",
        eventDate: preferredDate,
        guestCount: null,
        notes: "",
        originToken: "v1.bad.token.0.deadbeef",
      }),
    }).then((r) => r.json() as Promise<Record<string, unknown>>);
    record("invalid_token_rejected", bad.ok === false, String(bad.error ?? ""));

    // Unavailable slot rejected
    const unavailable = await fetch(`${APP}/api/tours/book`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: tourEmbedKey,
        slotStart: "2099-01-01T03:15:00.000Z",
        firstName: "Existing",
        lastName: "Lead",
        partnerName: "",
        email: `couple.${stamp}@example.com`,
        phone: "",
        eventType: "wedding",
        eventDate: "",
        guestCount: null,
        notes: "",
        originToken: token,
      }),
    }).then((r) => r.json() as Promise<Record<string, unknown>>);
    record("unavailable_slot_rejected", unavailable.ok === false, String(unavailable.error ?? ""));

    // Cross-venue: token for this lead must not book against a foreign tour key
    const foreignVenue = await admin
      .from("venues")
      .select("id, tour_embed_key")
      .neq("id", venueId)
      .eq("tour_scheduling_enabled", true)
      .not("tour_embed_key", "is", null)
      .limit(1)
      .maybeSingle<{ id: string; tour_embed_key: string }>();
    if (foreignVenue.data?.tour_embed_key) {
      const cross = await fetch(`${APP}/api/tours/book`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: foreignVenue.data.tour_embed_key,
          slotStart: chosen?.start ?? new Date(Date.now() + 3 * 86400000).toISOString(),
          firstName: "Existing",
          lastName: "Lead",
          partnerName: "",
          email: `couple.${stamp}@example.com`,
          phone: "",
          eventType: "wedding",
          eventDate: preferredDate,
          guestCount: null,
          notes: "",
          originToken: token,
        }),
      }).then((r) => r.json() as Promise<Record<string, unknown>>);
      record(
        "cross_venue_token_rejected",
        cross.ok === false || cross.leadId !== leadId,
        `ok=${cross.ok} err=${cross.error ?? ""}`,
      );
    } else {
      record("cross_venue_token_rejected", true, "no foreign venue with tour key — skipped");
    }

    // Generic book page (no o=) must not show existing-lead block
    await page.goto(`${APP}/book/${encodeURIComponent(tourEmbedKey)}`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    record(
      "generic_link_no_lead_context",
      (await page.locator('[data-testid="existing-lead-preferred-event-date"]').count()) === 0,
      "no existing-lead block",
    );

    // Lead without preferred date: clear event_date, reopen with fresh token
    await admin.from("leads").update({ event_date: null }).eq("id", leadId);
    const tokenNoDate = createTourOriginToken(
      { venueId, leadId },
      process.env.TOUR_ORIGIN_SIGNING_SECRET!,
    );
    await page.goto(
      `${APP}/book/${encodeURIComponent(tourEmbedKey)}?o=${encodeURIComponent(tokenNoDate)}`,
      { waitUntil: "load" },
    );
    await page.waitForTimeout(2000);
    const noDateBody = ((await page.locator("body").innerText()) as string).replace(/\s+/g, " ");
    const noDateBlock = (await page.locator('[data-testid="existing-lead-preferred-event-date"]').count()) > 0;
    record(
      "lead_without_preferred_date_allows_tour_ui",
      noDateBlock && /No preferred event date is on file/i.test(noDateBody),
      noDateBody.slice(0, 160),
    );
    // Restore preferred date for persistence assertions below
    await admin.from("leads").update({ event_date: preferredDate }).eq("id", leadId);

    // Refresh/reopen preserves context without duplicating appointment
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    record(
      "reopen_preserves_readonly_context",
      (await page.locator('[data-testid="existing-lead-preferred-event-date"]').count()) > 0,
      "readonly block after reopen",
    );
    const { count: apptCount } = await admin
      .from("tour_appointments")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId);
    record("reopen_no_duplicate_tour", (apptCount ?? 0) <= 1, `appointments=${apptCount}`);

    // New inquiry blocked-date still enforced (tour availability exception → public dates API)
    const exceptionIns = await admin.from("tour_availability_exceptions").insert({
      venue_id: venueId,
      start_date: "2027-12-25",
      end_date: "2027-12-25",
      label: "Christmas",
      recurrence_rule: "annual",
    }).select("id").maybeSingle();
    const inquiryDates = await fetch(
      `${APP}/api/public/inquiry-available-dates?key=${encodeURIComponent(venue.embed_key as string)}&start=2027-12-20&end=2027-12-31`,
    ).then(async (r) => {
      const j = (await r.json()) as { dates?: string[]; ok?: boolean; error?: string };
      return j;
    });
    const christmasAvailable = (inquiryDates.dates ?? []).includes("2027-12-25");
    record(
      "new_inquiry_blocked_date_still_enforced",
      !christmasAvailable && inquiryDates.ok !== false,
      `christmas_in_list=${christmasAvailable} ok=${inquiryDates.ok} exc=${exceptionIns.error?.message ?? exceptionIns.data?.id?.slice(0, 8) ?? ""}`,
    );
    if (exceptionIns.data?.id) {
      await admin.from("tour_availability_exceptions").delete().eq("id", exceptionIns.data.id);
    }

    // Persisted checks
    const { data: leadAfter } = await admin
      .from("leads")
      .select("id, event_date, sales_stage")
      .eq("id", leadId)
      .maybeSingle();
    record(
      "event_date_unchanged",
      String(leadAfter?.event_date ?? "").slice(0, 10) === String(beforeEventDate).slice(0, 10),
      `before=${beforeEventDate} after=${leadAfter?.event_date}`,
    );
    const { count: leadsAfter } = await admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    record("no_duplicate_lead", leadsBefore === leadsAfter, `before=${leadsBefore} after=${leadsAfter}`);
    const { count: events } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId);
    record("no_event_created", (events ?? 0) === 0, `events=${events}`);
    if (holdId) {
      const { data: hold } = await admin.from("date_holds").select("id, status, hold_date").eq("id", holdId).maybeSingle();
      record(
        "hold_unchanged",
        hold?.status === "active" && String(hold.hold_date).slice(0, 10) === preferredDate,
        JSON.stringify(hold),
      );
    } else {
      record("hold_unchanged", true, "no hold table/row — skipped");
    }
    if (appointmentId) {
      const { data: appt } = await admin
        .from("tour_appointments")
        .select("id, lead_id, event_date, status")
        .eq("id", appointmentId)
        .maybeSingle();
      record(
        "appointment_on_correct_lead",
        appt?.lead_id === leadId && String(appt?.event_date ?? "").slice(0, 10) === preferredDate,
        JSON.stringify({ lead: appt?.lead_id?.slice(0, 8), event_date: appt?.event_date, status: appt?.status }),
      );
    }

    await page.screenshot({ path: `${OUT}/existing-lead-tour-form.png`, fullPage: true });
    await browser.close();
  } catch (e) {
    record("browser_error", false, e instanceof Error ? e.message : String(e));
  } finally {
    if (appointmentId) await admin.from("tour_appointments").delete().eq("id", appointmentId);
    if (holdId) await admin.from("date_holds").delete().eq("id", holdId);
    if (leadId) {
      await admin.from("leads").delete().eq("id", leadId);
    }
    if (venueId) {
      await admin.from("tour_availability_exceptions").delete().eq("venue_id", venueId);
      await admin.from("tour_availability_windows").delete().eq("venue_id", venueId);
      await admin.from("venue_onboarding_intake").delete().eq("venue_id", venueId);
      await admin.from("venue_staff").delete().eq("venue_id", venueId);
      await admin.from("venues").delete().eq("id", venueId);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  }

  const passCount = checks.filter((c) => c.pass).length;
  const out = {
    observedAt,
    tip,
    preferredDate,
    checks,
    passCount,
    total: checks.length,
    verdict: passCount === checks.length && checks.length > 0 ? "GREEN" : "NOT_GREEN",
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify({ passCount, total: checks.length, tip, verdict: out.verdict }, null, 2));
  if (passCount < checks.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
