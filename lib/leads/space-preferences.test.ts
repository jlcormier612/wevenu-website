import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { VenueSpace } from "@/lib/availability/types";
import {
  normalizeLeadSpacePreference,
  shouldShowLeadSpacePreference,
  spaceAllowsPreferenceUse,
  venueOffersUse,
} from "@/lib/leads/space-preferences";

function space(partial: Partial<VenueSpace> & { id: string; permittedUses?: string[]; isActive?: boolean }): VenueSpace {
  return {
    venueId: "venue-1",
    name: partial.id,
    description: null,
    capacity: null,
    permittedUses: partial.permittedUses ?? [],
    isActive: partial.isActive ?? true,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("lead space preference visibility", () => {
  it("single mode never shows ceremony or reception preference UI", () => {
    const spaces = [
      space({ id: "garden", permittedUses: ["ceremony"] }),
      space({ id: "barn", permittedUses: ["reception"] }),
    ];
    assert.equal(shouldShowLeadSpacePreference("single", spaces, "ceremony"), false);
    assert.equal(shouldShowLeadSpacePreference("single", spaces, "reception"), false);
  });

  it("reception-only venue does not expose Ceremony", () => {
    const spaces = [
      space({ id: "barn", permittedUses: ["reception"] }),
      space({ id: "patio", permittedUses: ["reception", "cocktail_hour"] }),
    ];
    assert.equal(shouldShowLeadSpacePreference("multi", spaces, "ceremony"), false);
    assert.equal(shouldShowLeadSpacePreference("multi", spaces, "reception"), true);
    assert.equal(venueOffersUse(spaces, "ceremony"), false);
  });

  it("multi mode shows ceremony and reception when those uses exist", () => {
    const spaces = [
      space({ id: "garden", permittedUses: ["ceremony"] }),
      space({ id: "barn", permittedUses: ["reception"] }),
    ];
    assert.equal(shouldShowLeadSpacePreference("multi", spaces, "ceremony"), true);
    assert.equal(shouldShowLeadSpacePreference("multi", spaces, "reception"), true);
  });

  it("inactive spaces do not invent a ceremony UI", () => {
    const spaces = [space({ id: "garden", permittedUses: ["ceremony"], isActive: false })];
    assert.equal(shouldShowLeadSpacePreference("multi", spaces, "ceremony"), false);
  });

  it("unrestricted active space offers both uses", () => {
    const spaces = [space({ id: "hall", permittedUses: [] })];
    assert.equal(shouldShowLeadSpacePreference("multi", spaces, "ceremony"), true);
    assert.equal(shouldShowLeadSpacePreference("multi", spaces, "reception"), true);
  });
});

describe("lead space preference shape", () => {
  it("accepts venue_space, external, and undecided", () => {
    assert.deepEqual(
      normalizeLeadSpacePreference({
        useKey: "ceremony",
        preferenceKind: "venue_space",
        spaceId: "garden",
      }),
      { ok: true, value: { useKey: "ceremony", preferenceKind: "venue_space", spaceId: "garden", externalLocation: null } },
    );
    assert.deepEqual(
      normalizeLeadSpacePreference({
        useKey: "reception",
        preferenceKind: "external",
        externalLocation: "  City Hall  ",
      }),
      { ok: true, value: { useKey: "reception", preferenceKind: "external", spaceId: null, externalLocation: "City Hall" } },
    );
    assert.deepEqual(
      normalizeLeadSpacePreference({ useKey: "ceremony", preferenceKind: "undecided" }),
      { ok: true, value: { useKey: "ceremony", preferenceKind: "undecided", spaceId: null, externalLocation: null } },
    );
  });

  it("rejects cocktail_hour and other use keys", () => {
    const result = normalizeLeadSpacePreference({
      useKey: "cocktail_hour",
      preferenceKind: "undecided",
    });
    assert.equal(result.ok, false);
  });

  it("enforces kind shape constraints", () => {
    assert.equal(
      normalizeLeadSpacePreference({ useKey: "ceremony", preferenceKind: "venue_space" }).ok,
      false,
    );
    assert.equal(
      normalizeLeadSpacePreference({
        useKey: "ceremony",
        preferenceKind: "venue_space",
        spaceId: "garden",
        externalLocation: "City Hall",
      }).ok,
      false,
    );
    assert.equal(
      normalizeLeadSpacePreference({
        useKey: "ceremony",
        preferenceKind: "external",
        spaceId: "garden",
        externalLocation: "City Hall",
      }).ok,
      false,
    );
    assert.equal(
      normalizeLeadSpacePreference({
        useKey: "ceremony",
        preferenceKind: "undecided",
        spaceId: "garden",
      }).ok,
      false,
    );
  });
});

describe("booking seed eligibility", () => {
  it("skips inactive, disallowed, and foreign-venue spaces", () => {
    assert.equal(
      spaceAllowsPreferenceUse(space({ id: "a", isActive: false, permittedUses: ["ceremony"] }), "venue-1", "ceremony").seedable,
      false,
    );
    assert.equal(
      spaceAllowsPreferenceUse(space({ id: "a", permittedUses: ["reception"] }), "venue-1", "ceremony").seedable,
      false,
    );
    assert.equal(
      spaceAllowsPreferenceUse(space({ id: "a", venueId: "other", permittedUses: ["ceremony"] }), "venue-1", "ceremony").seedable,
      false,
    );
    assert.equal(
      spaceAllowsPreferenceUse(space({ id: "a", permittedUses: ["ceremony"] }), "venue-1", "ceremony").seedable,
      true,
    );
  });
});

describe("preference is not an assignment", () => {
  it("lead preference writes never insert event_space_assignments", () => {
    const service = readFileSync(resolve("lib/leads/space-preferences-service.ts"), "utf8");
    assert.doesNotMatch(service, /\.from\("event_space_assignments"\)/);
    assert.doesNotMatch(service, /insert into public\.event_space_assignments/);
    assert.match(service, /lead_event_space_preferences/);
  });

  it("one catalog: space_id stays NOT NULL and no second space table is created", () => {
    const sql = readFileSync(resolve("supabase/migrations/20261410500000_lead_event_space_preferences.sql"), "utf8");
    assert.doesNotMatch(sql, /create table.*spaces(?!_)/i);
    assert.match(sql, /create table if not exists public\.lead_event_space_preferences/);
    const assignments = readFileSync(resolve("supabase/migrations/20261405900000_invoice_name_and_venue_spaces_uses.sql"), "utf8");
    assert.match(assignments, /space_id\s+uuid not null/);
  });

  it("lead detail shows ceremony/reception only in multi mode", () => {
    const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    assert.match(detail, /LeadSpacePreferenceFields/);
    assert.match(detail, /spaceOperatingMode === "multi"/);
    assert.match(detail, /spaceOperatingMode !== "multi" && spacesRequired/);
  });
});
