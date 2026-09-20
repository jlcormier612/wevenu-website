import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const page = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
const nav = readFileSync(resolve("lib/navigation.ts"), "utf8");
const engine = readFileSync(resolve("lib/dashboard-system/decision-engine.ts"), "utf8");

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

  it("does not render Your Next Steps", () => {
    assert.doesNotMatch(page, /YourNextStepsCard/);
    assert.doesNotMatch(page, /Your Next Steps/);
    assert.doesNotMatch(page, /excludeTodayFocusFromNextSteps/);
    assert.doesNotMatch(page, /what you should do next after today's urgent work/i);
    assert.equal(existsSync(resolve("components/dashboard/getting-started.tsx")), false);
    assert.equal(existsSync(resolve("lib/dashboard/venue-next-steps.ts")), false);
    assert.doesNotMatch(service, /resolveVenueNextSteps/);
    assert.doesNotMatch(service, /nextSteps,/);
    assert.doesNotMatch(service, /from\("event_tasks"\)/);
  });

  it("suppresses Coming up by cross-section entity identity from Focus only", () => {
    assert.match(page, /excludeByCrossSectionSubject/);
    assert.match(page, /collectCrossSectionSubjects/);
    assert.doesNotMatch(page, /claimedSubjects\.add\(step\.subjectKey\)/);
  });

  it("defines Coming up as awareness, not a second task queue", () => {
    assert.match(page, /title="Coming up"/);
    assert.match(page, /Events in the next 30 days/);
  });

  it("removes the Quick Actions section and does not add Bookings nav", () => {
    assert.doesNotMatch(page, /Quick Actions/);
    assert.doesNotMatch(page, /function QuickAction/);
    assert.doesNotMatch(page, /label="New Booking"/);
    assert.doesNotMatch(nav, /title: "Bookings"/);
    assert.match(nav, /title: "Inbox"/);
    assert.match(page, /\+ New Lead/);
  });

  it("renders the locked Business Snapshot cards, not legacy KPI tiles", () => {
    assert.match(page, /BusinessSnapshotSection/);
    assert.doesNotMatch(page, /label="Payments to Watch"/);
    assert.doesNotMatch(page, /getPaymentsToWatchSummary/);
    assert.doesNotMatch(page, /label="Active Leads"/);
    assert.doesNotMatch(page, /label="Coming up"/);
    assert.match(page, /title="Coming up"/);
    assert.doesNotMatch(page, /\/payments\?filter=attention/);
    assert.doesNotMatch(page, /\/leads\?attention=active/);
    assert.doesNotMatch(page, /label="Venue Health"/);
    assert.doesNotMatch(page, /getVenueHealth/);
  });

  it("does not render the morning priorities email banner", () => {
    assert.doesNotMatch(page, /DigestCallout/);
    assert.doesNotMatch(page, /showDigestCallout/);
    assert.doesNotMatch(page, /morning email each day with your priorities/);
    assert.doesNotMatch(service, /showDigestCallout/);
    assert.doesNotMatch(service, /getNotificationPreferences/);
  });

  it("Coming up classifies events only — not the mixed dated stream", () => {
    assert.match(page, /classifyUpcomingItems/);
    const fn = engine.slice(engine.indexOf("export function classifyUpcomingItems"));
    const end = fn.indexOf("export function classifyTodayDatedItems");
    const body = end >= 0 ? fn.slice(0, end) : fn;
    assert.match(body, /comingUpHorizonEnd/);
    assert.match(body, /data\.upcomingEvents/);
    assert.doesNotMatch(body, /classifyDatedItems/);
    assert.doesNotMatch(body, /upcomingPayments/);
    assert.doesNotMatch(body, /upcomingTours/);
  });

  it("Today's Focus still uses Event Readiness payment/invoice attention", () => {
    const fn = engine.slice(engine.indexOf("export function classifyDashboardItems"));
    const end = fn.indexOf("function classifyDatedItems");
    const body = end >= 0 ? fn.slice(0, end) : fn;
    assert.match(body, /data\.briefing\.needsAttentionNow/);
    assert.doesNotMatch(body, /for \(const .* of data\.overduePayments\)/);
  });

  it("Today's Focus deep-links to owning action surfaces", () => {
    const fn = engine.slice(engine.indexOf("export function classifyDashboardItems"));
    const end = fn.indexOf("function classifyDatedItems");
    const body = end >= 0 ? fn.slice(0, end) : fn;
    assert.match(body, /\/leads\/\$\{lead\.id\}\?tab=messages/);
    assert.match(body, /\/leads\/\$\{task\.leadId\}\?tab=tasks/);
    assert.match(body, /href: `\/tours`/);
    assert.match(body, /href: item\.link/);
  });

  it("Payments list attention filter is unchanged", () => {
    const paymentsPage = readFileSync(resolve("app/(app)/payments/page.tsx"), "utf8");
    assert.match(paymentsPage, /scheduleStatus === "attention"/);
    assert.match(paymentsPage, /excludeFromBusinessReporting/);
  });

  it("keeps Reports navigation", () => {
    assert.match(page, /href="\/reporting"/);
  });
});

describe("Dashboard Coming up is the Clients Coming-up (30-day) population", () => {
  it("counts through getClientListFilterCounts.coming_up, not all-future Upcoming", () => {
    assert.match(service, /getClientListFilterCounts/);
    assert.match(service, /upcomingEventCount: clientListCounts\.coming_up/);
  });

  it("loads Coming up events from the events table, not payment lines", () => {
    assert.match(service, /from\("events"\)/);
    assert.match(service, /\.lte\("event_date", comingUpOut\)/);
    const eventsBlock = service.slice(service.indexOf("Coming up source"), service.indexOf("Payment line items"));
    assert.match(eventsBlock, /from\("events"\)/);
    assert.doesNotMatch(eventsBlock, /payment_line_items/);
    assert.doesNotMatch(eventsBlock, /payment_schedules/);
  });
});
