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

  it("exposes Event filtering in the Filters UI", () => {
    assert.match(inbox, /Filter by event/);
    assert.match(inbox, /eventDateFrom/);
    assert.match(inbox, /Filter by event status/);
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

  it("migration extends inbox page RPC with event/sort filters", () => {
    assert.match(migration, /p_event_id/);
    assert.match(migration, /p_event_date_from/);
    assert.match(migration, /p_event_status/);
    assert.match(migration, /p_has_attachments/);
    assert.match(migration, /p_unassigned_only/);
    assert.match(migration, /p_sort/);
    assert.match(migration, /from public\.events ev/);
  });

  it("repository passes new filter args to the RPC", () => {
    assert.match(repo, /p_event_id/);
    assert.match(repo, /p_sort/);
    assert.match(repo, /unassignedOnly/);
    assert.match(repo, /hasAttachments/);
  });
});
