import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const page = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
const nav = readFileSync(resolve("lib/navigation.ts"), "utf8");

describe("Dashboard page information architecture", () => {
  it("renders Today's Focus with the NOW definition", () => {
    assert.match(page, /title="Today's Focus"/);
    assert.match(page, /What requires attention today/);
    assert.doesNotMatch(page, /title="Morning Briefing"/);
    assert.doesNotMatch(page, /title="Today's Attention"/);
  });

  it("places Luv after Today's Focus and before Coming up", () => {
    const focus = page.indexOf('title="Today\'s Focus"');
    const luv = page.indexOf("{luvEntry &&");
    const upcoming = page.indexOf('title="Coming up"');
    assert.ok(focus >= 0 && luv > focus && upcoming > luv, "Luv sits between Today's Focus and Coming up");
  });

  it("dedupes Your Next Steps against Today's Focus", () => {
    assert.match(page, /excludeTodayFocusFromNextSteps/);
    assert.match(page, /YourNextStepsCard/);
    const nextStepsCard = readFileSync(resolve("components/dashboard/getting-started.tsx"), "utf8");
    assert.match(nextStepsCard, /What you should do next after today's urgent work/);
  });

  it("suppresses Coming up by cross-section entity identity, not only by date", () => {
    assert.match(page, /excludeByCrossSectionSubject/);
    assert.match(page, /collectCrossSectionSubjects/);
    assert.match(page, /claimedSubjects\.add\(step\.subjectKey\)/);
  });

  it("defines Coming up as awareness, not a second task queue", () => {
    assert.match(page, /title="Coming up"/);
    assert.match(page, /Events in the next 60 days/);
  });

  it("removes the Quick Actions section and does not add Bookings nav", () => {
    assert.doesNotMatch(page, /Quick Actions/);
    assert.doesNotMatch(page, /function QuickAction/);
    assert.doesNotMatch(page, /label="New Booking"/);
    assert.doesNotMatch(nav, /title: "Bookings"/);
    assert.match(nav, /title: "Inbox"/);
    assert.match(page, /\+ New Lead/);
  });

  it("uses Payments to Watch in the snapshot and not Venue Health", () => {
    assert.doesNotMatch(page, /label="Active Leads"/);
    assert.match(page, /label="Payments to Watch"/);
    assert.doesNotMatch(page, /label="Coming up"/);
    assert.match(page, /title="Coming up"/);
    assert.match(page, /\/payments\?filter=attention/);
    assert.doesNotMatch(page, /\/leads\?attention=active/);
    assert.doesNotMatch(page, /clientListFilterHref\("coming_up"\)/);
    assert.doesNotMatch(page, /label="Venue Health"/);
    assert.doesNotMatch(page, /getVenueHealth/);
  });

  it("Payments to Watch uses the same attention population as the Payments filter", () => {
    const attention = readFileSync(resolve("lib/payments/attention.ts"), "utf8");
    assert.match(attention, /scheduleStatus === "attention"/);
    assert.match(attention, /excludeFromBusinessReporting/);
    assert.match(attention, /getPaymentSchedules/);
  });

  it("keeps Reports navigation", () => {
    assert.match(page, /href="\/reporting"/);
  });
});

describe("Dashboard Coming up is the Clients Coming-up (60-day) population", () => {
  it("counts through getClientListFilterCounts.coming_up, not all-future Upcoming", () => {
    assert.match(service, /getClientListFilterCounts/);
    assert.match(service, /upcomingEventCount: clientListCounts\.coming_up/);
  });
});

describe("Dashboard Your Next Steps", () => {
  it("resolves the venue queue from event_tasks and portal lifecycle, not activation copy", () => {
    assert.match(service, /resolveVenueNextSteps/);
    assert.match(service, /nextSteps,/);
    assert.match(service, /from\("event_tasks"\)/);
    assert.match(service, /from\("client_invitations"\)/);
    assert.match(service, /from\("client_portal_sessions"\)/);
    assert.doesNotMatch(service, /Build momentum/);
  });
});
