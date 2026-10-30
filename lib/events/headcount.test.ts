/**
 * Narrow B / B0 — headcount helpers + no-recalc / EO-still-Estimated contracts.
 *
 * Run: npx tsx --test lib/events/headcount.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  boundHeadcountForApply,
  estimatedHeadcount,
  guaranteedHeadcount,
  headcountRecalcEnabled,
} from "@/lib/events/headcount";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("headcount helpers (B0)", () => {
  it("maps estimated and guaranteed, preferring guaranteed only in boundHeadcountForApply", () => {
    assert.equal(estimatedHeadcount(120), 120);
    assert.equal(estimatedHeadcount(null), null);
    assert.equal(guaranteedHeadcount(100), 100);
    assert.equal(guaranteedHeadcount(null), null);
    assert.equal(boundHeadcountForApply(120, 100), 100);
    assert.equal(boundHeadcountForApply(120, null), 120);
    assert.equal(boundHeadcountForApply(null, null), null);
  });

  it("recalc flag is env-gated (B2 enables in sandbox/test)", () => {
    // B0 shipped the helper as false; B2 flips the sandbox/test default on.
    // Production remains fail-closed unless HEADCOUNT_RECALC_ENABLED is set.
    assert.equal(typeof headcountRecalcEnabled(), "boolean");
    assert.match(read("lib/events/headcount.ts"), /HEADCOUNT_RECALC_ENABLED/);
  });
});

describe("B0 contracts — schema + UI labels", () => {
  it("migration adds guaranteed_guest_count without rewriting guest_count", () => {
    const sql = read("supabase/migrations/20261427000000_events_guaranteed_guest_count.sql");
    assert.match(sql, /add column if not exists guaranteed_guest_count integer/);
    assert.doesNotMatch(sql, /rename column.*guest_count/i);
    assert.doesNotMatch(sql, /update public\.events set guest_count/i);
  });

  it("venue form and detail expose Estimated + Guaranteed", () => {
    const form = read("components/events/event-form.tsx");
    assert.match(form, /Estimated guest count/);
    assert.match(form, /Guaranteed guest count/);
    assert.match(form, /guaranteedGuestCount/);
    const detail = read("components/events/event-detail.tsx");
    assert.match(detail, /Estimated/);
    assert.match(detail, /Guaranteed/);
    assert.match(detail, /guaranteedGuestCount/);
  });

  it("repo persists guaranteed; B0 schema/UI remain", () => {
    const repo = read("lib/events/repository.ts");
    assert.match(repo, /guaranteed_guest_count/);
    assert.match(repo, /guaranteedGuestCount/);
  });
});

// B1 apply/seed wiring lives in headcount-b1.test.ts (Guaranteed ?? Estimated).
