import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const root = resolve(process.cwd());
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const sql = read("supabase/migrations/20261410500000_lead_event_space_preferences.sql");
const latest = read("supabase/migrations/20261411900000_event_type_aware_space_preferences.sql");
const fn = latest.slice(
  latest.indexOf("create or replace function public.book_relationship"),
  latest.indexOf("$$;", latest.indexOf("create or replace function public.book_relationship")),
);

describe("Booking-E1 space preference seeding", () => {
  it("seeds inside book_relationship, not a second client round-trip", () => {
    const book = read("lib/booking-journey/book-client.ts");
    assert.match(book, /rpc\("book_relationship"/);
    assert.equal((book.match(/rpc\(/g) ?? []).length, 1);
    assert.match(fn, /lead_event_space_preferences/);
    assert.match(fn, /insert into public\.event_space_assignments/);
    assert.match(fn, /external_ceremony_location/);
    assert.match(fn, /external_reception_location/);
    const seedAt = fn.indexOf("Seed booked-event space authority");
    const returnAt = fn.lastIndexOf("return jsonb_build_object");
    assert.ok(seedAt > 0 && returnAt > seedAt, "seed must run before the function returns");
    assert.doesNotMatch(book, /lead_event_space_preferences/);
    assert.doesNotMatch(book, /replaceEventSpaceAssignments/);
  });

  it("does not rewrite lead preferences and only seeds newly booked events", () => {
    assert.match(fn, /Never rewrite lead_event_space_preferences/);
    assert.match(fn, /if v_newly and v_lead_id is not null then/);
    assert.doesNotMatch(fn, /update public\.lead_event_space_preferences/);
    assert.doesNotMatch(fn, /delete from public\.lead_event_space_preferences/);
  });

  it("skips inactive and disallowed venue_space preferences", () => {
    assert.match(fn, /s\.is_active/);
    assert.match(fn, /p\.use_key = any \(s\.permitted_uses\)/);
    assert.match(fn, /preference_kind = 'venue_space'/);
    assert.match(fn, /preference_kind = 'external'/);
  });

  it("seeds any configured venue_space use key, not only ceremony/reception", () => {
    assert.doesNotMatch(fn, /p\.use_key in \('ceremony', 'reception'\)/);
    assert.match(fn, /cocktail_hour/);
    assert.match(sql, /lead_event_space_preferences/);
  });

  it("bookClient remains one RPC", () => {
    const book = read("lib/booking-journey/book-client.ts");
    assert.doesNotMatch(book, /from\("lead_event_space_preferences"\)/);
    assert.doesNotMatch(book, /from\("event_space_assignments"\)/);
  });
});
