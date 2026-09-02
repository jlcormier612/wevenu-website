import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const page = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");

describe("Dashboard page information architecture", () => {
  it("renders Today's Focus and does not keep Morning Briefing or Today's Attention", () => {
    assert.match(page, /title="Today's Focus"/);
    assert.doesNotMatch(page, /title="Morning Briefing"/);
    assert.doesNotMatch(page, /title="Today's Attention"/);
  });

  it("places Luv immediately after Today's Focus", () => {
    const focus = page.indexOf('title="Today\'s Focus"');
    const luv = page.indexOf("{luvEntry &&");
    const upcoming = page.indexOf('title="Upcoming"');
    assert.ok(focus >= 0 && luv > focus && upcoming > luv, "Luv sits between Today's Focus and Upcoming");
  });

  it("uses the three operational snapshot tiles and not Venue Health", () => {
    assert.match(page, /label="Active Leads"/);
    assert.match(page, /label="Payments to Watch"/);
    assert.match(page, /label="Upcoming"/);
    assert.match(page, /clientListFilterHref\("upcoming"\)/);
    assert.doesNotMatch(page, /Next 60 days/);
    assert.doesNotMatch(page, /label="Upcoming Events"/);
    assert.doesNotMatch(page, /label="Venue Health"/);
    assert.doesNotMatch(page, /getVenueHealth/);
  });

  it("does not add Tours Scheduled or a second outstanding definition", () => {
    assert.doesNotMatch(page, /Tours Scheduled/);
    assert.doesNotMatch(page, /value=\{.*overduePayments/);
  });

  it("keeps Quick Actions, Getting Started, and Reports", () => {
    assert.match(page, /Quick Actions/);
    assert.match(page, /GettingStartedCard/);
    assert.match(page, /href="\/reporting"/);
  });
});

describe("Dashboard Upcoming is the Clients Upcoming population", () => {
  it("counts through getClientListFilterCounts, not a 60-day events query", () => {
    assert.match(service, /getClientListFilterCounts/);
    assert.match(service, /upcomingEventCount: clientListCounts\.upcoming/);
    assert.doesNotMatch(service, /upcomingEventCountRes/);
  });
});
