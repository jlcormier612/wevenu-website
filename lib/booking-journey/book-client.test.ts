/**
 * Manual Mark as Booked and automatic commercial booking share bookClient.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

describe("one canonical booking transition", () => {
  it("bookClient is one database transaction, not a cleanup after several statements", () => {
    const book = read("lib/booking-journey/book-client.ts");
    const sql = read("supabase/migrations/20261404200000_atomic_book_relationship.sql");
    assert.match(book, /rpc\("book_relationship"/);
    assert.doesNotMatch(book, /ensureEventBookedAt/);
    assert.doesNotMatch(book, /insertEvent/);
    assert.doesNotMatch(book, /updateLeadSalesStage/);
    assert.doesNotMatch(book, /status: "cancelled"/);
    assert.match(sql, /for update/);
    assert.match(sql, /insert into public\.events/);
    assert.match(sql, /sales_stage = 'booked'/);
    assert.match(sql, /booked_at = v_booked_on/);
    assert.match(sql, /first_booked_at = coalesce\(first_booked_at, now\(\)\)/);
    assert.match(sql, /set event_id = v_event_id/);
    assert.doesNotMatch(sql, /set status = 'cancelled'/);
    const availability = read("supabase/migrations/20261404100000_venue_controlled_availability.sql");
    assert.match(availability, /pg_advisory_xact_lock/);
  });

  it("commercial milestones do not call bookClient", () => {
    const stamp = read("lib/booking-journey/stamp-commercial-booked-at.ts");
    assert.match(stamp, /do not move a relationship to Booked/);
    assert.match(stamp, /return null/);
    assert.doesNotMatch(stamp, /bookClient\(/);
    assert.doesNotMatch(stamp, /book_relationship/);
    assert.doesNotMatch(stamp, /source: "commercial_rule"/);
  });

  it("manual Mark as Booked calls the same bookClient", () => {
    const service = read("lib/leads/service.ts");
    const fn = service.slice(service.indexOf("export async function confirmPipelineBookedMove"));
    assert.match(fn, /bookClient/);
    assert.match(fn, /source: "manual"/);
    assert.match(fn, /newlyBooked: booked\.newlyBooked/);
  });

  it("a second call does not create another event or another celebration", () => {
    const sql = read("supabase/migrations/20261404200000_atomic_book_relationship.sql");
    assert.match(sql, /v_existing_booked_at is not null/);
    assert.match(sql, /v_newly := false/);
    assert.match(sql, /This relationship is already Booked/);
    const book = read("lib/booking-journey/book-client.ts");
    assert.match(book, /previous_sales_stage !== "booked"/);
    assert.match(book, /recordLifecycleBooking/);
  });

  it("cancellation leaves the booked pipeline without clearing booked_at", () => {
    const events = read("lib/events/service.ts");
    const leads = read("lib/leads/service.ts");
    assert.match(events, /leaveActiveBookedPipeline/);
    assert.match(events, /before\.bookedAt/);
    assert.doesNotMatch(events, /booked_at:\s*null/);
    assert.match(leads, /CANCELLED_RELATIONSHIP_STAGE/);
    assert.match(leads, /pipeline_stage_id: null/);
    const ret = leads.slice(leads.indexOf("export async function returnLeadToBooked"));
    assert.match(ret, /\.eq\("status", "cancelled"\)/);
    assert.match(ret, /source: "manual"/);
  });

  it("calendar lists official booked events only", () => {
    const cal = read("lib/calendar/service.ts");
    assert.match(cal, /\.not\("booked_at", "is", null\)/);
    assert.match(cal, /\.neq\("status", "cancelled"\)/);
  });

  it("celebration is consumed from the booking transition, not a query string", () => {
    const page = read("app/(app)/clients/[id]/booked/page.tsx");
    const gate = read("lib/booking-journey/booking-celebration.ts");
    assert.match(page, /consumeBookingCelebration/);
    assert.match(page, /event\?\.bookedAt/);
    assert.doesNotMatch(page, /from === "booked"/);
    assert.match(gate, /booking_celebration_pending/);
  });

  it("booking attaches existing planning rows and does not insert a second copy", () => {
    const sql = read("supabase/migrations/20261404200000_atomic_book_relationship.sql");
    const start = sql.indexOf("create or replace function public.book_relationship");
    const end = sql.indexOf("$$;", start);
    const fn = sql.slice(start, end);
    for (const table of [
      "event_tasks",
      "event_playbook_applications",
      "timeline_sections",
      "timeline_entries",
      "floor_plans",
      "event_orders",
      "event_vendor_assignments",
    ]) {
      assert.match(fn, new RegExp(`update public\\.${table}`));
    }
    assert.doesNotMatch(fn, /insert into public\.event_tasks/);
    assert.doesNotMatch(fn, /insert into public\.timeline_entries/);
    assert.doesNotMatch(fn, /insert into public\.floor_plans/);
    assert.doesNotMatch(fn, /insert into public\.event_orders/);
    assert.doesNotMatch(fn, /insert into public\.event_vendor_assignments/);
    assert.match(fn, /where venue_id = p_venue_id and client_id = p_client_id and event_id is null/);
    assert.doesNotMatch(fn, /exception when/);
  });

  it("pre-booking editors write client_id and leave event_id null", () => {
    const timeline = read("lib/timeline/repository.ts");
    const floors = read("lib/floor-plans/repository.ts");
    const orders = read("lib/event-orders/repository.ts");
    const vendors = read("lib/vendors/repository.ts");
    assert.match(timeline, /event_id: null, client_id: clientId/);
    assert.match(floors, /event_id: null,\s*client_id: clientId/);
    assert.match(orders, /event_id: null, client_id: clientId/);
    assert.match(vendors, /event_id:\s+null/);
    const vendorService = read("lib/vendors/service.ts");
    const assign = vendorService.slice(vendorService.indexOf("export async function assignVendorToClient"));
    assert.match(assign, /insertClientVendorAssignment/);
    assert.doesNotMatch(assign, /markAssignmentBooked/);
    assert.doesNotMatch(assign, /notifyVendorOfEventAssignment/);
    const page = read("app/(app)/clients/[id]/page.tsx");
    assert.match(page, /planningClientId=\{client\.id\}/);
    assert.match(page, /Questionnaires stay unavailable until this relationship is Booked/);
    const unbookedStart = page.indexOf("if (!client.linkedEventId)");
    const unbooked = page.slice(unbookedStart, page.indexOf("if (await bookingCelebrationPending"));
    assert.doesNotMatch(unbooked, /getQuestionnaires|QuestionnairePanel|questionnaireTemplates/);
  });
});
