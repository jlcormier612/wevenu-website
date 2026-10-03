import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import type { VenueSpace } from "@/lib/availability/types";
import { EXPERIENCE_PROFILES } from "@/lib/event-experience";
import {
  normalizeLeadSpacePreference,
  occupancyAnchorSpaceIdFromPreferences,
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

const fancyMix = [
  space({ id: "barn", permittedUses: ["ceremony", "reception", "cocktail_hour", "rehearsal_dinner"] }),
  space({ id: "patio", permittedUses: ["cocktail_hour"] }),
];

describe("lead space preference visibility", () => {
  it("single mode never shows use-keyed preference UI", () => {
    assert.equal(shouldShowLeadSpacePreference("single", fancyMix, "ceremony", "wedding"), false);
    assert.equal(shouldShowLeadSpacePreference("single", fancyMix, "cocktail_hour", "corporate"), false);
  });

  it("wedding shows ceremony and reception first and keeps cocktail hour", () => {
    assert.equal(shouldShowLeadSpacePreference("multi", fancyMix, "ceremony", "wedding"), true);
    assert.equal(shouldShowLeadSpacePreference("multi", fancyMix, "reception", "wedding"), true);
    assert.equal(shouldShowLeadSpacePreference("multi", fancyMix, "cocktail_hour", "wedding"), true);
  });

  it("corporate hides ceremony/reception and shows cocktail hour", () => {
    assert.equal(shouldShowLeadSpacePreference("multi", fancyMix, "ceremony", "corporate"), false);
    assert.equal(shouldShowLeadSpacePreference("multi", fancyMix, "reception", "corporate"), false);
    assert.equal(shouldShowLeadSpacePreference("multi", fancyMix, "cocktail_hour", "corporate"), true);
  });

  it("social and birthday match corporate filtering", () => {
    for (const type of ["social_event", "birthday"] as const) {
      assert.equal(shouldShowLeadSpacePreference("multi", fancyMix, "ceremony", type), false);
      assert.equal(shouldShowLeadSpacePreference("multi", fancyMix, "cocktail_hour", type), true);
    }
  });

  it("inactive spaces do not invent a ceremony UI", () => {
    const spaces = [space({ id: "garden", permittedUses: ["ceremony"], isActive: false })];
    assert.equal(shouldShowLeadSpacePreference("multi", spaces, "ceremony", "wedding"), false);
  });

  it("unrestricted spaces do not invent ceremony/reception columns", () => {
    const spaces = [space({ id: "hall", permittedUses: [] })];
    assert.equal(shouldShowLeadSpacePreference("multi", spaces, "ceremony", "wedding"), false);
    assert.equal(shouldShowLeadSpacePreference("multi", spaces, "ceremony", "corporate"), false);
    assert.equal(venueOffersUse(spaces, "ceremony"), true);
  });
});

describe("lead space preference shape", () => {
  it("accepts venue_space, external, and undecided for wedding ceremony", () => {
    assert.deepEqual(
      normalizeLeadSpacePreference({
        useKey: "ceremony",
        preferenceKind: "venue_space",
        spaceId: "garden",
      }, { profile: EXPERIENCE_PROFILES.wedding }),
      { ok: true, value: { useKey: "ceremony", preferenceKind: "venue_space", spaceId: "garden", externalLocation: null } },
    );
    assert.deepEqual(
      normalizeLeadSpacePreference({
        useKey: "reception",
        preferenceKind: "external",
        externalLocation: "  City Hall  ",
      }, { profile: EXPERIENCE_PROFILES.wedding }),
      { ok: true, value: { useKey: "reception", preferenceKind: "external", spaceId: null, externalLocation: "City Hall" } },
    );
    assert.deepEqual(
      normalizeLeadSpacePreference({ useKey: "ceremony", preferenceKind: "undecided" }, { profile: EXPERIENCE_PROFILES.wedding }),
      { ok: true, value: { useKey: "ceremony", preferenceKind: "undecided", spaceId: null, externalLocation: null } },
    );
  });

  it("accepts cocktail_hour as a configured use", () => {
    const result = normalizeLeadSpacePreference({
      useKey: "cocktail_hour",
      preferenceKind: "venue_space",
      spaceId: "patio",
    }, { allowedUseKeys: ["cocktail_hour"], profile: EXPERIENCE_PROFILES.corporate });
    assert.deepEqual(result, {
      ok: true,
      value: { useKey: "cocktail_hour", preferenceKind: "venue_space", spaceId: "patio", externalLocation: null },
    });
  });

  it("rejects ceremony rows for a corporate allowed-use list", () => {
    const result = normalizeLeadSpacePreference({
      useKey: "ceremony",
      preferenceKind: "undecided",
    }, { allowedUseKeys: ["cocktail_hour"], profile: EXPERIENCE_PROFILES.corporate });
    assert.equal(result.ok, false);
  });

  it("rejects external location on non-wedding uses", () => {
    const result = normalizeLeadSpacePreference({
      useKey: "cocktail_hour",
      preferenceKind: "external",
      externalLocation: "Hotel lobby",
    }, { allowedUseKeys: ["cocktail_hour"], profile: EXPERIENCE_PROFILES.corporate });
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

describe("occupancy anchor from preferences", () => {
  it("wedding prefers reception venue-space over ceremony", () => {
    assert.equal(
      occupancyAnchorSpaceIdFromPreferences([
        { useKey: "ceremony", preferenceKind: "venue_space", spaceId: "garden", externalLocation: null },
        { useKey: "reception", preferenceKind: "venue_space", spaceId: "barn", externalLocation: null },
      ], { weddingFamily: true }),
      "barn",
    );
  });

  it("corporate uses the first relevant venue-space preference", () => {
    assert.equal(
      occupancyAnchorSpaceIdFromPreferences([
        { useKey: "cocktail_hour", preferenceKind: "venue_space", spaceId: "patio", externalLocation: null },
      ], { weddingFamily: false, relevantUseKeys: ["cocktail_hour", "meeting"] }),
      "patio",
    );
  });

  it("returns null when no venue-space preference exists", () => {
    assert.equal(
      occupancyAnchorSpaceIdFromPreferences([
        { useKey: "ceremony", preferenceKind: "external", spaceId: null, externalLocation: "City Hall" },
        { useKey: "reception", preferenceKind: "undecided", spaceId: null, externalLocation: null },
      ]),
      null,
    );
  });
});

describe("preference is not an assignment", () => {
  it("lead preference writes never insert event_space_assignments", () => {
    const service = readFileSync(resolve("lib/leads/space-preferences-service.ts"), "utf8");
    assert.doesNotMatch(service, /\.from\("event_space_assignments"\)/);
    assert.doesNotMatch(service, /insert into public\.event_space_assignments/);
    assert.match(service, /lead_event_space_preferences/);
    assert.match(service, /occupancyAnchorSpaceIdFromPreferences/);
    assert.match(service, /planned_event_space_id/);
    assert.doesNotMatch(service, /linked_event_id/);
    assert.match(service, /eq\("lead_id", leadId\)/);
  });

  it("one catalog: space_id stays NOT NULL and no second space table is created", () => {
    const sql = readFileSync(resolve("supabase/migrations/20261410500000_lead_event_space_preferences.sql"), "utf8");
    assert.doesNotMatch(sql, /create table.*spaces(?!_)/i);
    assert.match(sql, /create table if not exists public\.lead_event_space_preferences/);
    const assignments = readFileSync(resolve("supabase/migrations/20261405900000_invoice_name_and_venue_spaces_uses.sql"), "utf8");
    assert.match(assignments, /space_id\s+uuid not null/);
  });

  it("lead detail shows relevant uses in multi mode; Event Space when none or single mode", () => {
    const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");
    assert.match(detail, /LeadSpacePreferenceFields/);
    assert.match(detail, /relevantUsesForEventType/);
    assert.match(detail, /showUsePreferences/);
    assert.match(detail, /showEventSpaceField/);
    assert.match(detail, /EventSpaceField/);
    assert.match(detail, /eventType=\{lead\.eventType\}/);
  });
});
