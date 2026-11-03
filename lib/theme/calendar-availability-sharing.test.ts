/**
 * Workstream 2C — Calendar Availability & Sharing card presentation.
 * Copy + chrome only; frozen URLs, availability rules, and public pages.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const css = readFileSync(resolve("app/globals.css"), "utf8");
const pageClient = readFileSync(resolve("components/calendar/calendar-page-client.tsx"), "utf8");
const shareEvent = readFileSync(resolve("components/calendar/share-availability.tsx"), "utf8");
const shareTour = readFileSync(resolve("components/calendar/share-tour-availability.tsx"), "utf8");
const calendarPage = readFileSync(resolve("app/(app)/calendar/page.tsx"), "utf8");
const publicLink = readFileSync(resolve("lib/tours/public-link.ts"), "utf8");
const publicAvailPage = readFileSync(resolve("app/availability/[token]/page.tsx"), "utf8");
const bookPage = readFileSync(resolve("app/book/[key]/page.tsx"), "utf8");

describe("Calendar availability sharing — approved card chrome", () => {
  it("always renders both share cards (including missing public key)", () => {
    assert.match(pageClient, /htc-calendar-share-grid/);
    assert.match(pageClient, /<ShareAvailability url=\{availabilityUrl\} \/>/);
    assert.match(pageClient, /<ShareTourAvailability url=\{tourUrl\} \/>/);
    assert.doesNotMatch(pageClient, /availabilityUrl \? <ShareAvailability/);
  });

  it("styles Public Event Availability with eucalyptus header on white card", () => {
    assert.match(shareEvent, /htc-calendar-share-event/);
    assert.match(shareEvent, /Public Event Availability/);
    assert.match(
      css,
      /\.htc-staff \.htc-calendar-share-event \[data-cal-share-header\],\s*\.htc-staff \.htc-calendar-share-tour \[data-cal-share-header\][\s\S]*?background:\s*var\(--htc-eucalyptus-surface\)/,
    );
  });

  it("styles Tour Scheduling with eucalyptus header/strip matching Public Event Availability and linen guidance nest", () => {
    assert.match(shareTour, /htc-calendar-share-tour/);
    assert.match(shareTour, /Tour Scheduling/);
    assert.match(
      css,
      /\.htc-staff \.htc-calendar-share-tour \[data-cal-share-guidance\][\s\S]*?background:\s*var\(--htc-linen\)/,
    );
    assert.match(
      css,
      /\.htc-staff \.htc-calendar-share-event,\s*\.htc-staff \.htc-calendar-share-tour \{[\s\S]*?inset 3px 0 0 0 var\(--htc-eucalyptus\)/,
    );
  });

  it("keeps locked venue-controlled availability rule on Calendar", () => {
    assert.match(pageClient, /Availability is venue-controlled\./);
    assert.match(
      pageClient,
      /Only Holds, Booked Events and Blocked Time protect dates\. Inquiry dates and preferred dates do not reserve a date\./,
    );
  });
});

describe("Calendar availability sharing — frozen destinations", () => {
  it("keeps general public and tour URL builders unchanged", () => {
    assert.match(calendarPage, /\/availability\/\$\{venue\.embedKey\}/);
    assert.match(calendarPage, /publicTourSchedulingPath\(tourSettings\.tourEmbedKey\)/);
    assert.match(publicLink, /\/book\/\$\{encodeURIComponent\(key\)\}/);
    assert.match(publicLink, /\?o=\$\{encodeURIComponent\(token\)\}/);
  });

  it("does not redesign public availability or book pages in this workstream", () => {
    assert.doesNotMatch(publicAvailPage, /htc-calendar-share|htc-hospitality-heading/);
    assert.doesNotMatch(bookPage, /htc-calendar-share|htc-hospitality-heading/);
  });

  it("keeps Calendar general tour link free of personalized origin token", () => {
    assert.doesNotMatch(shareTour, /href=\{[^}]*\?o=/);
    assert.doesNotMatch(shareTour, /publicTourSchedulingPathForLead/);
    assert.doesNotMatch(calendarPage, /publicTourSchedulingPathForLead/);
  });
});
