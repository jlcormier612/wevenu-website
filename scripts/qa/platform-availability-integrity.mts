/**
 * Sandbox: platform availability integrity — public form lead + inquiry +
 * staff precheck seams. Disposable fixtures only. No secrets/PII logged.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { buildAvailabilityConflicts } from "@/lib/availability/precheck";
import { tourExceptionCoversDate } from "@/lib/tours/blocked-date-recurrence";

config({ path: ".env.local", quiet: true });

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = "docs/qa/availability-integrity";
mkdirSync(OUT, { recursive: true });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
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
  const email = `jennifer+availint.${stamp}@hellotocheers.com`;
  const password = `Av-${stamp}-Aa1x`;
  let userId = "";
  let venueId = "";
  let formKey = "";
  let formId = "";
  let embedKey = "";
  let exceptionId = "";

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
        name: `Avail Int ${stamp}`,
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
      .select("id, embed_key, tour_embed_key")
      .single();
    if (vErr || !venue) throw vErr ?? new Error("venue");
    venueId = venue.id;
    embedKey = venue.embed_key as string;

    await admin.from("venue_staff").insert({
      venue_id: venueId,
      user_id: userId,
      full_name: "Avail Owner",
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

    const { data: exc, error: eErr } = await admin
      .from("tour_availability_exceptions")
      .insert({
        venue_id: venueId,
        start_date: "2027-12-25",
        end_date: "2027-12-25",
        label: "Christmas",
        recurrence_rule: "annual",
      })
      .select("id")
      .single();
    if (eErr || !exc) throw eErr ?? new Error("exception");
    exceptionId = exc.id;

    const { data: form, error: fErr } = await admin
      .from("public_forms")
      .insert({
        venue_id: venueId,
        internal_name: `avail-int-${stamp}`,
        public_title: "Avail Int Form",
        description: "",
        status: "published",
        field_config: {
          phone: "optional",
          event_type: "optional",
          preferred_event_date: "required",
          guest_count: "optional",
        },
      })
      .select("id, public_key")
      .single();
    if (fErr || !form) throw fErr ?? new Error("form");
    formId = form.id;
    formKey = form.public_key as string;

    // 1) Inquiry available-dates excludes Christmas
    const dates = await fetch(
      `${APP}/api/public/inquiry-available-dates?key=${encodeURIComponent(embedKey)}&start=2027-12-20&end=2027-12-31`,
    ).then((r) => r.json() as Promise<{ dates?: string[]; ok?: boolean }>);
    record(
      "inquiry_api_excludes_christmas",
      !(dates.dates ?? []).includes("2027-12-25"),
      `n=${(dates.dates ?? []).length}`,
    );

    // 2) create_public_lead rejects
    const { data: leadReject } = await admin.rpc("create_public_lead", {
      p_embed_key: embedKey,
      p_first_name: "QA",
      p_last_name: "Inquiry",
      p_email: `inq.${stamp}@example.test`,
      p_phone: null,
      p_partner_first: null,
      p_partner_last: null,
      p_partner_email: null,
      p_event_type: "wedding",
      p_event_date: "2027-12-25",
      p_guest_count: 50,
      p_estimated_budget: null,
      p_message: "blocked",
      p_source_data: { qa: "platform_avail" },
    });
    record(
      "create_public_lead_rejects_blocked",
      (leadReject as { ok?: boolean; error?: string })?.ok === false
        && (leadReject as { error?: string })?.error === "date_unavailable",
      JSON.stringify(leadReject),
    );

    // 3) create_public_form_lead rejects (the gap this pass closes)
    const { data: formReject } = await admin.rpc("create_public_form_lead", {
      p_public_key: formKey,
      p_first_name: "QA",
      p_last_name: "Form",
      p_email: `form.${stamp}@example.test`,
      p_phone: "",
      p_event_type: "wedding",
      p_event_date: "2027-12-25",
      p_guest_count: null,
      p_message: "blocked form",
      p_source_data: { qa: "platform_avail_form" },
    });
    record(
      "create_public_form_lead_rejects_blocked",
      (formReject as { ok?: boolean; error?: string })?.ok === false
        && (formReject as { error?: string })?.error === "date_unavailable",
      JSON.stringify(formReject),
    );

    const { count: formLeads } = await admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("email", `form.${stamp}@example.test`);
    record("no_form_lead_on_reject", (formLeads ?? 0) === 0, `count=${formLeads}`);

    // 4) Legitimate open date still accepted on form path
    const openDate = "2027-12-24";
    const { data: formOk } = await admin.rpc("create_public_form_lead", {
      p_public_key: formKey,
      p_first_name: "QA",
      p_last_name: "Open",
      p_email: `form.open.${stamp}@example.test`,
      p_phone: "",
      p_event_type: "wedding",
      p_event_date: openDate,
      p_guest_count: null,
      p_message: "ok",
      p_source_data: { qa: "platform_avail_form_ok" },
    });
    const openLeadId = String((formOk as { lead_id?: string })?.lead_id ?? "");
    record(
      "create_public_form_lead_allows_open_date",
      (formOk as { ok?: boolean })?.ok === true && openLeadId.length > 0,
      JSON.stringify({ ok: (formOk as { ok?: boolean })?.ok, lead: openLeadId.slice(0, 8) }),
    );
    if (openLeadId) await admin.from("leads").delete().eq("id", openLeadId);

    // 5) Annual helper + staff preferred_date conflict shape
    record(
      "annual_helper_covers_future_christmas",
      tourExceptionCoversDate(
        { startDate: "2027-12-25", endDate: "2027-12-25", recurrenceRule: "annual" },
        "2030-12-25",
      ),
      "2030-12-25",
    );
    const staffPref = buildAvailabilityConflicts(
      { date: "2027-12-25", type: "event", purpose: "preferred_date" },
      {
        calendarBlocks: [],
        holdCount: 0,
        holdBlocksAvailability: true,
        rules: { maxSimultaneousEvents: 1, maxSimultaneousTours: 1, minTurnaroundHours: 0 },
        events: [],
        activeSpaceIds: [],
        allSpaceIds: [],
        tours: [],
        tourExceptionLabel: "Christmas",
      },
    );
    record(
      "staff_preferred_date_warns_tour_blocked",
      staffPref.available === false
        && staffPref.conflicts.some((c) => c.type === "tour_exception"),
      JSON.stringify(staffPref.conflicts.map((c) => c.type)),
    );

    // 6) SQL authority helper
    const { data: covers } = await admin.rpc("tour_availability_exception_covers_date", {
      p_venue_id: venueId,
      p_date: "2027-12-25",
    });
    record("sql_exception_covers_christmas", covers === true, String(covers));
  } catch (e) {
    record("fixture_error", false, e instanceof Error ? e.message : String(e));
  } finally {
    if (exceptionId) await admin.from("tour_availability_exceptions").delete().eq("id", exceptionId);
    if (formId) await admin.from("public_forms").delete().eq("id", formId);
    if (venueId) {
      await admin.from("leads").delete().eq("venue_id", venueId);
      await admin.from("venue_staff").delete().eq("venue_id", venueId);
      await admin.from("venues").delete().eq("id", venueId);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  }

  const passCount = checks.filter((c) => c.pass).length;
  const out = {
    observedAt,
    tip,
    checks,
    passCount,
    total: checks.length,
    verdict: passCount === checks.length && checks.length > 0 ? "GREEN" : "NOT_GREEN",
  };
  writeFileSync(`${OUT}/platform-browser-results.json`, JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify({ passCount, total: checks.length, tip, verdict: out.verdict }, null, 2));
  if (passCount < checks.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
