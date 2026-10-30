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

  it("recalc flag stays off in B0", () => {
    assert.equal(headcountRecalcEnabled(), false);
  });
});

describe("B0 contracts — schema, UI labels, EO still Estimated-only", () => {
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

  it("EO apply/seed still selects guest_count only (not guaranteed)", () => {
    const service = read("lib/event-orders/service.ts");
    assert.match(service, /from\("events"\)\.select\("guest_count"\)/);
    assert.doesNotMatch(service, /guaranteed_guest_count/);
    assert.doesNotMatch(service, /boundHeadcountForApply/);
    assert.doesNotMatch(service, /headcountRecalcEnabled/);
  });

  it("repo persists guaranteed without using it for EO", () => {
    const repo = read("lib/events/repository.ts");
    assert.match(repo, /guaranteed_guest_count/);
    assert.match(repo, /guaranteedGuestCount/);
    const headcount = read("lib/events/headcount.ts");
    assert.match(headcount, /Do not wire `boundHeadcountForApply` into EO paths until slice B1/);
  });
});
