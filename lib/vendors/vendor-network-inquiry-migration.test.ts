/**
 * SQL contract tests for couple_vendor_inquiry migration.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261365000000_vendor_network_inquiry_and_process.sql",
  ),
  "utf8",
);

describe("vendor network inquiry migration contracts", () => {
  it("adds couple_vendor_inquiry kind", () => {
    assert.match(migration, /couple_vendor_inquiry/);
    assert.match(migration, /conversations_kind_check/);
  });

  it("enforces one inquiry per relationship + vendor relationship", () => {
    assert.match(migration, /conversations_couple_vendor_inquiry_uniq/);
  });

  it("does not create assignments in start_portal_vendor_inquiry", () => {
    const start = migration.slice(
      migration.indexOf("start_portal_vendor_inquiry"),
      migration.indexOf("get_portal_couple_vendor_conversations"),
    );
    assert.doesNotMatch(start, /insert into public\.event_vendor_assignments/i);
  });

  it("merges inquiry into couple_vendor on assignment provision", () => {
    assert.match(
      migration,
      /conversation_kind = 'couple_vendor_inquiry'[\s\S]*conversation_kind = 'couple_vendor'/,
    );
  });

  it("claim honors invitation expiry", () => {
    assert.match(migration, /invitation_expired/);
    assert.match(migration, /expires_at <= now\(\)/);
  });

  it("adds required and in-house attributes", () => {
    assert.match(migration, /is_required/);
    assert.match(migration, /is_in_house/);
    assert.match(migration, /venue_required_vendor_categories/);
  });

  it("Recommended RPC returns the same process fields as directory", () => {
    assert.match(migration, /get_event_vendor_recommendations/);
    const recIdx = migration.lastIndexOf("get_event_vendor_recommendations");
    const recSlice = migration.slice(recIdx);
    assert.match(recSlice, /'preferenceLevel'/);
    assert.match(recSlice, /'isRequired'/);
    assert.match(recSlice, /'isInHouse'/);
    assert.match(recSlice, /'inquiryConversationId'/);
  });

  it("scopes conversations_relationship_uniq to venue_couple so inquiries can share relationship_id", () => {
    assert.match(
      migration,
      /create unique index conversations_relationship_uniq[\s\S]*conversation_kind = 'venue_couple'/,
    );
  });
});
