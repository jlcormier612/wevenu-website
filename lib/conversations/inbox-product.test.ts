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

  it("composes Event as full-width half/half — not a narrow equal grid cell", () => {
    assert.doesNotMatch(inbox, /lg:grid-cols-3/);
    assert.match(inbox, /md:grid-cols-2 md:items-start/);
    // Event type list and date/status/lookup are siblings in that two-column row
    const eventBlock = inbox.slice(inbox.indexOf(">Event</legend>"), inbox.indexOf(">Assignment</legend>"));
    assert.match(eventBlock, /Event type/);
    assert.match(eventBlock, /Event date/);
    assert.match(eventBlock, /Event status/);
    assert.match(eventBlock, /Specific event/);
    assert.match(eventBlock, /md:grid-cols-2/);
  });

  it("keeps Sort as a sort control with event-date and name options", () => {
    assert.match(inbox, /Sort conversations/);
    assert.match(inbox, /INBOX_SORT_OPTIONS/);
    const filtersSrc = readFileSync(resolve("lib/conversations/inbox-filters.ts"), "utf8");
    assert.match(filtersSrc, /event_date_asc/);
    assert.match(filtersSrc, /client_name_asc/);
    assert.match(filtersSrc, /Most recent activity/);
  });

  it("thread header is minimal — workspace link + assignment, no duplicate identity", () => {
    assert.match(thread, /conversationHeaderOrientation/);
    const headerStart = thread.indexOf("Inbox list card holds identity");
    const headerEnd = thread.indexOf("No messages yet — say hello");
    assert.ok(headerStart >= 0 && headerEnd > headerStart);
    const headerBlock = thread.slice(headerStart, headerEnd);
    assert.match(headerBlock, /headerOrientation\.workspaceHref/);
    assert.match(headerBlock, /headerOrientation\.workspaceLabel/);
    assert.match(headerBlock, /Assigned coordinator/);
    assert.doesNotMatch(headerBlock, /headerOrientation\?\.relationshipLabel/);
    assert.doesNotMatch(headerBlock, /headerOrientation\?\.eventLine/);
    assert.doesNotMatch(headerBlock, /summary\.displayName/);
    assert.doesNotMatch(headerBlock, /threadInitials/);
    assert.doesNotMatch(headerBlock, /Create Request/);
    assert.doesNotMatch(headerBlock, /createRequestFromConversation/);
    const header = readFileSync(resolve("lib/conversations/inbox-header.ts"), "utf8");
    assert.match(header, /Open booking workspace →/);
    assert.match(header, /Open lead workspace →/);
    assert.match(header, /year: "numeric"/);
  });

  it("Inbox uses full-height workspace without a fixed calc-height pane", () => {
    assert.doesNotMatch(inbox, /h-\[calc\(100svh-9rem\)\]/);
    assert.match(inbox, /flex min-h-0 flex-1 overflow-hidden rounded-sm border/);
    assert.match(thread, /flex h-full min-h-0 flex-1 flex-col overflow-y-auto/);
  });

  it("email preview is tall enough to read comfortably", () => {
    const compose = readFileSync(resolve("components/conversations/conversation-compose.tsx"), "utf8");
    assert.match(compose, /min-h-\[20rem\] h-\[min\(45vh,36rem\)\]/);
    assert.doesNotMatch(compose, /className="h-36 w-full bg-background"/);
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
