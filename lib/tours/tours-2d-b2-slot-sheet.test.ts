/**
 * HTC Tours 2D-B2 — Schedule / Reschedule sheet seams.
 * Static regression for exclusion RPC, lifecycle, conflict recovery, UX chrome.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { isTourSlotConflictError } from "@/lib/tours/slot-conflict";

const ROOT = resolve(".");
const MIGRATIONS = resolve(ROOT, "supabase/migrations");
const EXCLUDE_MIGRATION = "20261427200000_coordinator_tour_slots_exclude.sql";
const CORRECTION = "20261320000000_availability_correction_pass.sql";
const ATOMICITY = "20261322000000_tour_booking_atomicity.sql";

const excludeSql = readFileSync(resolve(MIGRATIONS, EXCLUDE_MIGRATION), "utf8");
const correctionSql = readFileSync(resolve(MIGRATIONS, CORRECTION), "utf8");
const atomicitySql = readFileSync(resolve(MIGRATIONS, ATOMICITY), "utf8");
const service = readFileSync(resolve(ROOT, "lib/tours/service.ts"), "utf8");
const actions = readFileSync(resolve(ROOT, "app/(app)/leads/[id]/actions.ts"), "utf8");
const settingsActions = readFileSync(resolve(ROOT, "app/(app)/settings/tour-actions.ts"), "utf8");
const panel = readFileSync(resolve(ROOT, "components/leads/tour-panel.tsx"), "utf8");
const preview = readFileSync(resolve(ROOT, "components/leads/tour-send-preview.tsx"), "utf8");
const css = readFileSync(resolve(ROOT, "app/globals.css"), "utf8");

const slotBody = panel.slice(
  panel.indexOf("function SlotPickerBody"),
  panel.indexOf("function SlotPickerSheet"),
);
const appointmentRow = panel.slice(
  panel.indexOf("function AppointmentRow"),
  panel.indexOf("type TourScheduleContextValue"),
);
const b2Css = css.slice(
  css.indexOf("/* ─── 2D-B2: Schedule / Reschedule slot sheet"),
  css.indexOf(".dark .htc-staff .htc-calendar-share-card"),
);

describe("2D-B2 coordinator slot self-exclusion RPC", () => {
  it("drops the two-argument overload before creating a defaulted three-argument function", () => {
    assert.match(excludeSql, /drop function if exists public\.get_coordinator_tour_slots\(date, date\);/);
    assert.match(
      excludeSql,
      /create or replace function public\.get_coordinator_tour_slots\(\s*p_start_date\s+date,\s*p_end_date\s+date,\s*p_exclude_appointment_id\s+uuid default null/s,
    );
    assert.match(excludeSql, /_generate_tour_slots\(\s*v_venue_id,\s*p_start_date,\s*p_end_date,\s*p_exclude_appointment_id/s);
    assert.match(excludeSql, /security definer/);
    assert.match(excludeSql, /set search_path = public/);
    assert.match(excludeSql, /grant execute on function public\.get_coordinator_tour_slots\(date, date, uuid\)\s+to authenticated;/);
    // No lingering parallel overload created in this migration
    assert.equal((excludeSql.match(/create or replace function public\.get_coordinator_tour_slots/g) ?? []).length, 1);
  });

  it("is the latest get_coordinator_tour_slots definition among migrations", () => {
    const files = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const last = [...files].reverse().find((f) => {
      const body = readFileSync(resolve(MIGRATIONS, f), "utf8");
      return /create or replace function public\.get_coordinator_tour_slots/.test(body);
    });
    assert.equal(last, EXCLUDE_MIGRATION);
  });

  it("service omits exclude for Schedule/Settings and passes id for Reschedule", () => {
    assert.match(service, /excludeAppointmentId\?:\s*string\s*\|\s*null/);
    assert.match(service, /p_exclude_appointment_id: excludeAppointmentId/);
    assert.match(service, /PGRST202/);
    assert.match(service, /Could not find the function/);
    assert.match(actions, /excludeAppointmentId\?:\s*string\s*\|\s*null/);
    // Settings preview still uses two-arg call site
    assert.match(settingsActions, /getCoordinatorTourSlots\(startDate, endDate\)/);
    assert.doesNotMatch(settingsActions, /p_exclude_appointment_id|excludeAppointmentId/);
  });

  it("SlotPickerBody passes rescheduleAppointmentId into slot load and Schedule uses null id", () => {
    assert.match(slotBody, /getCoordinatorTourSlotsAction\(start, end, rescheduleAppointmentId\)/);
    assert.match(slotBody, /\[rescheduleAppointmentId\]/);
  });
});

describe("2D-B2 confirmed reschedule lifecycle (Decision A)", () => {
  it("reschedule_tour updates in place, resets status, and clears confirmed_at", () => {
    const fn = atomicitySql.slice(atomicitySql.indexOf("create or replace function public.reschedule_tour("));
    assert.match(fn, /update public\.tour_appointments\s+set scheduled_at = p_new_slot_start, status = 'scheduled', confirmed_at = null/s);
    assert.match(fn, /'appointmentId', p_appointment_id/);
    assert.match(fn, /_is_tour_slot_blocked\(v_venue_id, p_new_slot_start, v_slot_end, p_appointment_id\)/);
    assert.doesNotMatch(fn.slice(0, fn.indexOf("$$;")), /insert into public\.tour_appointments/);
  });
});

describe("2D-B2 Edit consolidation and mandatory review", () => {
  it("keeps a single Reschedule control on active rows", () => {
    assert.match(appointmentRow, /tour-appointment-reschedule-/);
    assert.doesNotMatch(appointmentRow, /tour-appointment-edit-/);
    assert.doesNotMatch(appointmentRow, />\s*Edit\s*</);
    assert.match(appointmentRow, /isActive = appt\.status === "scheduled" \|\| appt\.status === "confirmed"/);
  });

  it("preserves mandatory Review email before confirm", () => {
    assert.match(slotBody, /Review email/);
    assert.match(slotBody, /previewScheduleTourEmailAction|previewRescheduleTourEmailAction/);
    assert.match(slotBody, /data-testid="tour-slot-review-email"/);
    assert.match(slotBody, /data-testid="tour-slot-confirm"/);
    // Confirm only reachable after preview is set (footer branch)
    assert.match(slotBody, /\{preview \? \(/);
    assert.match(preview, /Who|Channel|What|Why|recipientAction|htcAfterward/);
    assert.match(preview, /preview\.subject/);
    assert.match(preview, /preview\.body/);
  });
});

describe("2D-B2 conflict recovery (Decision H)", () => {
  it("detects known conflict messages from RPC / capacity mapping", () => {
    assert.equal(isTourSlotConflictError("This slot was just booked. Please choose another time."), true);
    assert.equal(isTourSlotConflictError("That time is no longer available. Please choose another time."), true);
    assert.equal(isTourSlotConflictError("Session expired."), false);
  });

  it("on conflict refreshes slots, clears time and preview, keeps sheet open", () => {
    assert.match(slotBody, /isTourSlotConflictError\(result\.error\)/);
    assert.match(slotBody, /setSelectedSlot\(null\)/);
    assert.match(slotBody, /setPreview\(null\)/);
    assert.match(slotBody, /await load\(month, year\)/);
    // Success path closes; conflict path must not call onClose before return
    const conflictBlock = slotBody.slice(slotBody.indexOf("isTourSlotConflictError"));
    assert.doesNotMatch(conflictBlock.slice(0, 280), /onClose\(\)/);
  });
});

describe("2D-B2 hospitality UX and calm-blue guidance", () => {
  it("scopes calm-blue tokens and sheet guidance without recoloring the whole sheet", () => {
    assert.match(css, /--htc-calm-blue:\s*#eaf1f7/i);
    assert.match(css, /--htc-calm-blue-deep:\s*#dfe9f1/i);
    assert.match(css, /--htc-border-calm:\s*#d5e1eb/i);
    assert.match(css, /--htc-calm-accent:\s*#63819a/i);
    // Sheet portals outside .htc-staff — use html:has(.htc-staff) like other overlays
    assert.match(b2Css, /html:has\(\.htc-staff\) \.htc-tour-slot-guidance/);
    assert.match(b2Css, /var\(--htc-calm-blue\)/);
    assert.match(b2Css, /var\(--htc-botanical\)/);
    assert.match(b2Css, /var\(--htc-eucalyptus-surface\)/);
    assert.match(slotBody, /Only times that are available for this venue are shown/);
  });

  it("uses eucalyptus/botanical for calendar and time selection", () => {
    assert.match(b2Css, /\[data-tour-cal-selected="true"\]/);
    assert.match(b2Css, /\[data-tour-slot-selected="true"\]/);
    assert.match(panel, /htc-tour-slot-cal-day/);
    assert.match(panel, /htc-tour-slot-time-chip/);
  });

  it("keeps Sheet architecture with sticky footer classes", () => {
    assert.match(panel, /function SlotPickerSheet/);
    assert.match(panel, /SheetContent/);
    assert.match(panel, /htc-tour-slot-sheet-footer/);
    assert.match(b2Css, /@media \(max-width: 639px\)/);
  });
});

describe("2D-B2 timezone correction preserved", () => {
  it("does not reintroduce UTC wall-clock formatting in slot generation correction", () => {
    const gen = correctionSql.slice(correctionSql.indexOf("create or replace function public._generate_tour_slots("));
    assert.match(gen, /_venue_scheduling_timezone/);
    assert.match(gen, /to_char\(v_slot_start at time zone v_tz, 'HH12:MI AM'\)/);
    assert.doesNotMatch(gen.replace(/--.*$/gm, ""), /at time zone 'UTC'/);
    // B2 migration must not redefine _generate_tour_slots (only call through)
    assert.doesNotMatch(excludeSql, /create or replace function public\._generate_tour_slots/);
  });
});
