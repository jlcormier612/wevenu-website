/**
 * Inbox Product layout + filter regression locks (source contracts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("Inbox Product two-column workspace", () => {
  const inbox = readFileSync(resolve("app/(app)/messaging/conversation-inbox.tsx"), "utf8");
  const thread = readFileSync(resolve("components/conversations/conversation-thread.tsx"), "utf8");
  const migration = readFileSync(
    resolve("supabase/migrations/20261357000000_inbox_product_filters.sql"),
    "utf8",
  );
  const repo = readFileSync(resolve("lib/conversations/repository.ts"), "utf8");

  it("does not mount the persistent Relationship Context panel", () => {
    assert.doesNotMatch(inbox, /RelationshipContextPanel/);
    assert.doesNotMatch(inbox, /RelationshipContextSheet/);
    assert.doesNotMatch(inbox, /PanelRight/);
  });

  it("uses a two-column list | conversation shell", () => {
    assert.match(inbox, /md:w-80 lg:w-96/);
    assert.match(inbox, /flex-1 flex-col/);
    assert.doesNotMatch(inbox, /w-72.*Relationship|Relationship.*w-72/);
  });

  it("keeps Unread and Needs response as distinct attention filters", () => {
    assert.match(inbox, /Needs response/);
    assert.match(inbox, /Unread/);
    assert.match(inbox, /needs_response/);
  });

  it("exposes Event attribute filters — not a giant event directory", () => {
    assert.match(inbox, /Event type/);
    assert.match(inbox, /Filter by event date/);
    assert.match(inbox, /Specific event/);
    assert.match(inbox, /Search for a specific event/);
    assert.match(inbox, /INBOX_EVENT_TYPE_OPTIONS/);
    assert.match(inbox, /INBOX_EVENT_DATE_PRESET_OPTIONS/);
    assert.doesNotMatch(inbox, /Filter by event"/);
    assert.doesNotMatch(inbox, /Any event<\/option>/);
    assert.doesNotMatch(inbox, /listInboxFilterEventsAction/);
  });

  it("keeps Sort as a sort control with event-date and name options", () => {
    assert.match(inbox, /Sort conversations/);
    assert.match(inbox, /INBOX_SORT_OPTIONS/);
    const filtersSrc = readFileSync(resolve("lib/conversations/inbox-filters.ts"), "utf8");
    assert.match(filtersSrc, /event_date_asc/);
    assert.match(filtersSrc, /client_name_asc/);
    assert.match(filtersSrc, /Most recent activity/);
  });

  it("thread header uses compact orientation + workspace link", () => {
    assert.match(thread, /conversationHeaderOrientation/);
    assert.match(thread, /headerOrientation\.workspaceHref/);
    assert.match(thread, /headerOrientation\.workspaceLabel/);
    const header = readFileSync(resolve("lib/conversations/inbox-header.ts"), "utf8");
    assert.match(header, /Open booking workspace →/);
  });

  it("message bubbles are not locked to the old narrow middle-column width", () => {
    assert.match(thread, /max-w-\[min\(42rem,88%\)\]/);
    assert.doesNotMatch(thread, /max-w-\[72%\]/);
  });

  it("migration extends inbox page RPC with event attribute + sort filters", () => {
    const attrMigration = readFileSync(
      resolve("supabase/migrations/20261358000000_inbox_event_attribute_filters.sql"),
      "utf8",
    );
    assert.match(attrMigration, /p_event_types/);
    assert.match(attrMigration, /p_event_date_from/);
    assert.match(attrMigration, /p_event_status/);
    assert.match(attrMigration, /event_date_asc/);
    assert.match(attrMigration, /client_name_asc/);
    assert.match(attrMigration, /p_cursor_sort_key/);
    assert.match(migration, /p_has_attachments/);
    assert.match(migration, /p_unassigned_only/);
  });

  it("repository passes event type + sort cursor args to the RPC", () => {
    assert.match(repo, /p_event_id/);
    assert.match(repo, /p_event_types/);
    assert.match(repo, /p_cursor_sort_key/);
    assert.match(repo, /p_sort/);
    assert.match(repo, /unassignedOnly/);
    assert.match(repo, /hasAttachments/);
  });
});
