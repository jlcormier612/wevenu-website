/**
 * Regression: Step 2 sync PageHeaders must not stack on pages that already
 * own a hospitality banner (Calendar client, Dashboard greeting, Inbox).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("Nav header dupe fixes", () => {
  it("Calendar page does not add a second PageHeader above CalendarPageClient", () => {
    const page = readFileSync("app/(app)/calendar/page.tsx", "utf8");
    assert.match(page, /calendar-streaming-root/);
    assert.match(page, /CalendarPageClient/);
    assert.equal(page.includes('from "@/components/shell/module-placeholder"'), false);
    assert.doesNotMatch(page, /Month, week, day, and agenda views/);
    const client = readFileSync("components/calendar/calendar-page-client.tsx", "utf8");
    assert.match(client, /title="Calendar"/);
    assert.match(client, /htc-hospitality-heading/);
  });

  it("Dashboard page does not add a Dashboard PageHeader above the greeting", () => {
    const page = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
    assert.match(page, /dashboard-streaming-root/);
    assert.match(page, /DashboardHeaderIsland/);
    assert.equal(page.includes('from "@/components/shell/module-placeholder"'), false);
    assert.doesNotMatch(page, /Your venue briefing/);
  });

  it("Inbox page does not add a sync PageHeader above ConversationInbox", () => {
    const page = readFileSync("app/(app)/messaging/page.tsx", "utf8");
    assert.match(page, /inbox-streaming-root/);
    assert.match(page, /ConversationInbox/);
    assert.equal(page.includes('from "@/components/shell/module-placeholder"'), false);
    assert.doesNotMatch(page, /Conversations with couples and vendors/);
    const inbox = readFileSync("app/(app)/messaging/conversation-inbox.tsx", "utf8");
    assert.match(inbox, />Inbox</);
    assert.match(inbox, /htc-hospitality-heading/);
  });

  it("Library banner says Templates; Reports has no Templates back link", () => {
    const library = readFileSync("app/(app)/library/page.tsx", "utf8");
    assert.match(library, /title="Templates"/);
    assert.doesNotMatch(library, /title="Library"/);
    const shell = readFileSync("components/reporting/reports-layout-shell.tsx", "utf8");
    assert.match(shell, /title="Reports"/);
    assert.doesNotMatch(shell, /CollectionBackLink/);
  });
});
