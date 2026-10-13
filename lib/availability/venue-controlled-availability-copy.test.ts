/**
 * Locks venue-facing availability education copy. Does not exercise booking
 * behavior — only the customer-facing guidance placements.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { FINAL_HELP_ARTICLES } from "@/lib/help-guides/final-articles";

const settings = readFileSync(resolve("app/(app)/settings/availability/page.tsx"), "utf8");
const calendar = readFileSync(resolve("components/calendar/calendar-page-client.tsx"), "utf8");
const calendarView = readFileSync(resolve("components/calendar/calendar-view.tsx"), "utf8");
const bookedDialog = readFileSync(resolve("components/leads/pipeline-booked-confirm-dialog.tsx"), "utf8");
const conflictWarning = readFileSync(resolve("components/availability/conflict-warning.tsx"), "utf8");
const holdSection = readFileSync(resolve("components/availability/date-holds-section.tsx"), "utf8");

describe("Venue-controlled availability education copy", () => {
  it("Availability settings use the locked heading, model, Holds, and Tours guidance", () => {
    assert.match(settings, /How date availability works/);
    assert.match(settings, /You control when a date is protected\./);
    assert.match(
      settings,
      /A preferred date from an inquiry does not reserve the date\. A date is protected only when you place a Hold or move a relationship to Booked\. HTC does not decide that a contract, payment, or other milestone means a booking/,
    );
    assert.match(
      settings,
      /Available means a prospect can still request that date — it is not a reservation or a guarantee/,
    );
    assert.match(
      settings,
      /Prospects often read Available as a real chance to hold their event/,
    );
    assert.match(settings, /When to block an entire day\./);
    assert.match(
      settings,
      /Leaving a date Available can still let someone inquire when an existing booking already makes their eventual schedule impractical/,
    );
    assert.match(
      settings,
      /Confirmed events and public availability\./,
    );
    assert.match(
      settings,
      /By default, a confirmed event closes that date for prospective clients/,
    );
    assert.match(
      settings,
      /Choose holds, blocked dates, capacity, spaces, and the confirmed-event public preference so the public calendar matches how you actually book/,
    );
    assert.match(
      settings,
      /These limits guide staff scheduling and do not override the separate public confirmed-event availability preference/,
    );
    assert.match(
      settings,
      /Choose whether venue-created Holds prevent other bookings\. This setting applies wherever HTC checks availability\./,
    );
    assert.match(
      settings,
      /Choose whether tours can be scheduled when an event is occupying the date\. This setting applies wherever HTC checks availability\./,
    );
    assert.doesNotMatch(settings, /checks tour availability/);
  });

  it("Calendar uses the locked venue-controlled guidance and Help link", () => {
    assert.match(calendar, /Availability is venue-controlled\./);
    assert.match(
      calendar,
      /Only Holds, Booked Events and Blocked Time protect dates\. Inquiry dates and preferred dates do not reserve a date\./,
    );
    assert.match(calendar, /Learn how availability works/);
    assert.match(calendar, /href="\/help\/how-does-date-availability-work"/);
  });

  it("Booked confirmation uses the locked heading and date-protection copy", () => {
    assert.match(bookedDialog, /Confirm this booking/);
    assert.match(bookedDialog, /Review the dates, spaces, and times for this event\./);
    assert.match(bookedDialog, /Current hold/);
    assert.match(
      bookedDialog,
      /This lead already has a hold on the calendar\. Update the details below to reflect the final booking\./,
    );
    assert.match(
      bookedDialog,
      /Choose the space and the times it will be used for each part of the event\./,
    );
    assert.match(bookedDialog, /When you confirm/);
    assert.match(
      bookedDialog,
      /The booking will reserve the selected spaces and times on the calendar\. Any unused part of this lead&apos;s hold will be released\./,
    );
    assert.match(bookedDialog, /Confirm booking/);
    assert.match(conflictWarning, /This time is unavailable/);
    assert.match(
      conflictWarning,
      /Another booking or hold already reserves one or more of the selected spaces during this time\. Change the dates, spaces, or times to continue\./,
    );
    assert.match(bookedDialog, /excludeLeadId=\{draft\.leadId/);
    assert.match(bookedDialog, /availabilityBlocked/);
    assert.doesNotMatch(bookedDialog, /Mark this client as booked/);
    assert.doesNotMatch(bookedDialog, /according to your venue/);
    assert.doesNotMatch(bookedDialog, /advisory lock|booked_at|database transaction/i);
  });

  it("Hold confirmation uses the locked heading and settings copy", () => {
    assert.match(holdSection, /You(?:'|\&apos;)re placing a Hold on this date\./);
    assert.match(
      holdSection,
      /Whether this Hold prevents booking is controlled by your availability settings\./,
    );
    assert.match(calendarView, /You(?:'|\&apos;)re placing a Hold on this date\./);
    assert.match(
      calendarView,
      /Whether this Hold prevents booking is controlled by your availability settings\./,
    );
    assert.doesNotMatch(calendarView, /Date booked\./);
    assert.doesNotMatch(calendarView, /enough to say/);
    assert.doesNotMatch(calendarView, /This reserves the date/);
  });

  it("Help article explains the locked venue-controlled model without implementation terms", () => {
    const article = FINAL_HELP_ARTICLES.find((a) => a.slug === "how-does-date-availability-work");
    assert.ok(article);
    assert.equal(article.title, "How Does Date Availability Work?");
    assert.match(article.body, /You decide when a date is protected\./);
    assert.match(
      article.body,
      /HTC does not automatically reserve a date because a couple submits an inquiry, names a preferred date, signs a contract, or makes a payment\./,
    );
    assert.match(article.body, /• Hold: You deliberately place a Hold on the date\./);
    assert.match(
      article.body,
      /• Booked: You move the relationship to Booked, either yourself or through an automation you've configured\./,
    );
    assert.match(
      article.body,
      /HTC records and enforces the booking decision you make; it does not impose its own definition of when a couple is booked\./,
    );
    assert.match(
      article.body,
      /A preferred date is not a reservation\. A couple can tell you they want June 14, but June 14 remains available until you deliberately protect it\./,
    );
    assert.match(
      article.body,
      /By default, a confirmed \(Booked\) event closes that date for prospective clients/,
    );
    assert.match(
      article.body,
      /Date holds and availability → When a confirmed event is already on the calendar/,
    );
    assert.match(
      article.body,
      /raising it alone does not change public Available \/ Not available/,
    );
    assert.match(article.body, /Tour availability is controlled separately/);
    assert.doesNotMatch(article.body, /booked_at|advisory lock|RPC|database (?:transaction|constraint)/i);
  });

  it("Scheduling Capacity copy separates staff limits from public confirmed-event preference", () => {
    const capacity = readFileSync(resolve("components/availability/capacity-rules-section.tsx"), "utf8");
    assert.match(capacity, /Choose 1 if your venue hosts one event at a time/);
    assert.match(capacity, /does not make dates with confirmed events available for new public inquiries/);
    assert.doesNotMatch(capacity, /simple venue/i);
    assert.match(capacity, /Venues that host one event at a time apply this venue-wide/);
    assert.match(capacity, /Turnaround does not change public Available/);
  });

  it("setup guide covers confirmed-event public preference and current section list", () => {
    const setup = readFileSync(resolve("lib/help-guides/setup-guides.ts"), "utf8");
    const calendarGuide = setup.slice(setup.indexOf('slug: "setup-calendar-availability"'));
    assert.match(calendarGuide, /Date holds and availability/);
    assert.match(calendarGuide, /Choose what a confirmed event means for the public/);
    assert.match(
      calendarGuide,
      /Do not assume raising Scheduling Capacity alone opens simultaneous public availability/,
    );
    assert.doesNotMatch(calendarGuide, /three sections, in this order/);
    assert.doesNotMatch(setup, /Hold doesn't block bookings by design/);
  });
});
