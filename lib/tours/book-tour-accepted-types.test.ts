import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("book_tour accepted event type enforcement", () => {
  const sql = readFileSync(
    resolve("supabase/migrations/20261331000000_book_tour_accepted_event_types.sql"),
    "utf8",
  );

  it("normalizes event type and rejects types outside accepted_inquiry_event_types", () => {
    assert.match(sql, /v_type := public\.normalize_event_type\(p_event_type\)/);
    assert.match(sql, /event_type_not_accepted/);
    assert.match(sql, /v_type = any \(v_accepted\)/);
    assert.match(sql, /social_event/);
  });

  it("preserves tour occupancy locks and orphan-lead subtransaction from atomicity pass", () => {
    assert.match(sql, /lock_tour_occupancy_interval/);
    assert.match(sql, /hashtext\('calendar-blocks'\)/);
    assert.match(sql, /when raise_exception then/);
    assert.match(sql, /slot_unavailable/);
  });

  it("stores normalized event type on the tour appointment", () => {
    const insertAt = sql.indexOf("insert into public.tour_appointments");
    assert.ok(insertAt > 0);
    const insertBlock = sql.slice(insertAt, insertAt + 800);
    assert.match(insertBlock, /v_type/);
    assert.doesNotMatch(insertBlock, /p_event_type/);
  });
});

describe("create_public_lead and book_tour share accepted-type contract", () => {
  const leadSql = readFileSync(
    resolve("supabase/migrations/20261330000000_canonical_event_types.sql"),
    "utf8",
  );
  const tourSql = readFileSync(
    resolve("supabase/migrations/20261331000000_book_tour_accepted_event_types.sql"),
    "utf8",
  );

  it("both reject event_type_not_accepted after normalize_event_type", () => {
    assert.match(leadSql, /event_type_not_accepted/);
    assert.match(tourSql, /event_type_not_accepted/);
    assert.match(leadSql, /normalize_event_type/);
    assert.match(tourSql, /normalize_event_type/);
  });
});
