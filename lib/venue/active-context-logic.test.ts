import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

import {
  classifyActiveVenueCase,
  resolveCookieAfterDbSync,
} from "@/lib/venue/active-context-logic";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20261405100000_venue_staff_active_context.sql",
);

describe("Wave 2 active venue case classification", () => {
  it("Case A: exactly one membership auto-initializes", () => {
    assert.equal(
      classifyActiveVenueCase({
        memberships: [{ venueId: "a" }],
        dbContextVenueId: null,
        dbContextMembershipValid: false,
      }),
      "A_auto_single",
    );
  });

  it("Case B: multi + valid context keeps context", () => {
    assert.equal(
      classifyActiveVenueCase({
        memberships: [{ venueId: "a" }, { venueId: "b" }],
        dbContextVenueId: "a",
        dbContextMembershipValid: true,
      }),
      "B_keep_valid",
    );
  });

  it("Case C: multi + no context requires selection", () => {
    assert.equal(
      classifyActiveVenueCase({
        memberships: [{ venueId: "a" }, { venueId: "b" }],
        dbContextVenueId: null,
        dbContextMembershipValid: false,
      }),
      "C_need_selection",
    );
  });

  it("Case D: zero memberships", () => {
    assert.equal(
      classifyActiveVenueCase({
        memberships: [],
        dbContextVenueId: null,
        dbContextMembershipValid: false,
      }),
      "D_none",
    );
  });

  it("Case E: stale/invalid context requires selection", () => {
    assert.equal(
      classifyActiveVenueCase({
        memberships: [{ venueId: "a" }, { venueId: "b" }],
        dbContextVenueId: "a",
        dbContextMembershipValid: false,
      }),
      "E_stale_need_selection",
    );
    assert.equal(
      classifyActiveVenueCase({
        memberships: [{ venueId: "b" }],
        dbContextVenueId: "a",
        dbContextMembershipValid: true,
      }),
      "E_stale_need_selection",
    );
  });

  it("never uses LIMIT 1 / arbitrary first membership when multi and empty", () => {
    const result = classifyActiveVenueCase({
      memberships: [{ venueId: "z" }, { venueId: "a" }],
      dbContextVenueId: null,
      dbContextMembershipValid: false,
    });
    assert.equal(result, "C_need_selection");
    assert.notEqual(result, "A_auto_single");
  });
});

describe("Wave 2 cookie sync (never authorization)", () => {
  it("clears cookie when DB context is null", () => {
    assert.deepEqual(
      resolveCookieAfterDbSync({ dbVenueId: null, cookieVenueId: "forged" }),
      { cookieVenueId: null, action: "clear" },
    );
  });

  it("DB wins on cookie/DB mismatch (forged cookie)", () => {
    assert.deepEqual(
      resolveCookieAfterDbSync({ dbVenueId: "real", cookieVenueId: "forged" }),
      { cookieVenueId: "real", action: "write" },
    );
  });

  it("keeps cookie when it already mirrors DB", () => {
    assert.deepEqual(
      resolveCookieAfterDbSync({ dbVenueId: "a", cookieVenueId: "a" }),
      { cookieVenueId: "a", action: "keep" },
    );
  });
});

describe("Wave 2 migration SQL invariants", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("current_user_venue_id does not use owner_user_id or LIMIT 1 membership selection", () => {
    // Isolate the cutover function body after the "current_user_venue_id cutover" marker
    const marker = "current_user_venue_id cutover";
    const idx = sql.indexOf(marker);
    assert.ok(idx > 0);
    const after = sql.slice(idx);
    const fn = after.slice(0, after.indexOf("current_user_role scoped"));
    // Strip SQL comments before asserting against forbidden identifiers.
    const body = fn.replace(/--[^\n]*/g, "");
    assert.doesNotMatch(body, /owner_user_id/);
    assert.doesNotMatch(body, /limit\s+1/i);
    assert.match(fn, /venue_staff_active_context/);
    assert.match(fn, /accepted_at is not null/);
    assert.match(fn, /is_active = true/);
  });

  it("current_user_role resolves via current_user_venue_id only", () => {
    const marker = "current_user_role scoped";
    const idx = sql.indexOf(marker);
    assert.ok(idx > 0);
    const after = sql.slice(idx);
    const fn = after.slice(0, after.indexOf("Invalidate context"));
    assert.match(fn, /current_user_venue_id\(\)/);
    assert.doesNotMatch(fn, /owner_user_id/);
    assert.doesNotMatch(fn, /from public\.venues where owner_user_id/);
  });

  it("set_active_venue requires active accepted membership", () => {
    assert.match(sql, /create or replace function public\.set_active_venue/);
    assert.match(sql, /not_a_member/);
    assert.match(sql, /accepted_at is not null/);
  });

  it("includes Case A single-membership backfill and membership-loss trigger", () => {
    assert.match(sql, /Case A backfill/);
    assert.match(sql, /venue_staff_clear_active_context/);
    assert.match(sql, /clear_active_venue_on_membership_loss/);
  });

  it("does not alter ownership uniqueness or venue_staff role model", () => {
    assert.doesNotMatch(sql, /drop index.*venue_staff_one_owner/i);
    assert.doesNotMatch(sql, /access_title/);
    assert.doesNotMatch(sql, /capability_overrides/);
    assert.doesNotMatch(sql, /drop column.*owner_user_id/i);
  });
});

describe("Wave 2 switch invariant (documented)", () => {
  it("switching venue changes only active context identity, not membership rows", () => {
    // Pure documentation of the invariant — membership/role/ownership are
    // stored on venue_staff and are not written by set_active_venue.
    const mig = readFileSync(MIGRATION, "utf8");
    const setFnStart = mig.indexOf("create or replace function public.set_active_venue");
    const setFnEnd = mig.indexOf("create or replace function public.list_my_venue_memberships");
    const setFn = mig.slice(setFnStart, setFnEnd);
    assert.match(setFn, /insert into public\.venue_staff_active_context/);
    assert.doesNotMatch(setFn, /update public\.venue_staff/);
    assert.doesNotMatch(setFn, /is_owner/);
    assert.doesNotMatch(setFn, /set role/i);
  });
});
