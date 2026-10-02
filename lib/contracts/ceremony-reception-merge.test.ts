import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { MERGE_FIELDS, REMOVED_MERGE_FIELD_KEYS } from "@/lib/contracts/constants";
import {
  CEREMONY_OUTSIDE_VENUE,
  CEREMONY_SPACE_UNLISTED,
  RECEPTION_SPACE_UNLISTED,
  resolveCeremonySpace,
  resolveReceptionSpace,
} from "@/lib/contracts/ceremony-reception-merge";
import { EMPTY_EVENT_SPACES_LABEL } from "@/lib/contracts/event-spaces-merge";
import { buildMergeData, mergeContent } from "@/lib/contracts/merge";

describe("ceremony_space / reception_space catalog", () => {
  it("adds exactly two fields to the existing 22-field picker", () => {
    const keys = MERGE_FIELDS.map((f) => f.key);
    assert.equal(MERGE_FIELDS.length, 24);
    assert.ok(keys.includes("ceremony_space"));
    assert.ok(keys.includes("reception_space"));
    assert.ok(keys.includes("event_spaces"));
    assert.ok(!keys.includes("ceremony_summary"));
    assert.ok(!keys.includes("reception_summary"));
    for (const removed of REMOVED_MERGE_FIELD_KEYS) {
      assert.ok(!keys.includes(removed));
    }
    assert.doesNotMatch(keys.join(" "), /\./);
  });
});

describe("ceremony / reception resolution — post-booking (event authority)", () => {
  it("uses assignment names independently", () => {
    assert.equal(
      resolveCeremonySpace({ assignmentName: "  Garden  ", externalCeremonyLocation: "City Hall" }),
      "Garden",
    );
    assert.equal(
      resolveReceptionSpace({ assignmentName: "  Barn  ", externalReceptionLocation: "Warehouse" }),
      "Barn",
    );
  });

  it("uses locked external ceremony copy and trimmed reception text", () => {
    assert.equal(
      resolveCeremonySpace({ assignmentName: null, externalCeremonyLocation: "  City Hall  " }),
      CEREMONY_OUTSIDE_VENUE,
    );
    assert.equal(
      resolveReceptionSpace({ assignmentName: null, externalReceptionLocation: "  Warehouse  " }),
      "Warehouse",
    );
  });

  it("treats null and empty external strings as unlisted", () => {
    assert.equal(resolveCeremonySpace({}), CEREMONY_SPACE_UNLISTED);
    assert.equal(resolveCeremonySpace({ assignmentName: "", externalCeremonyLocation: "   " }), CEREMONY_SPACE_UNLISTED);
    assert.equal(resolveReceptionSpace({}), RECEPTION_SPACE_UNLISTED);
    assert.equal(resolveReceptionSpace({ assignmentName: null, externalReceptionLocation: "" }), RECEPTION_SPACE_UNLISTED);
  });

  it("does not fall back to event_spaces, planned space, or the other use", () => {
    const ceremony = resolveCeremonySpace({ assignmentName: null, externalCeremonyLocation: null });
    const reception = resolveReceptionSpace({ assignmentName: "Barn", externalReceptionLocation: null });
    assert.equal(ceremony, CEREMONY_SPACE_UNLISTED);
    assert.equal(reception, "Barn");
    assert.notEqual(ceremony, EMPTY_EVENT_SPACES_LABEL);
    assert.notEqual(ceremony, "Barn");
  });

  it("ignores lead preferences once booked", () => {
    assert.equal(
      resolveCeremonySpace({
        booked: true,
        assignmentName: null,
        preference: { kind: "venue_space", spaceName: "Garden Lawn" },
      }),
      CEREMONY_SPACE_UNLISTED,
    );
    assert.equal(
      resolveReceptionSpace({
        booked: true,
        assignmentName: "Barn",
        preference: { kind: "venue_space", spaceName: "Stale Pref Barn" },
      }),
      "Barn",
    );
  });
});

describe("ceremony / reception resolution — pre-booking (lead preferences)", () => {
  it("resolves venue-space preference names", () => {
    assert.equal(
      resolveCeremonySpace({
        booked: false,
        preference: { kind: "venue_space", spaceName: "  Garden Lawn  " },
      }),
      "Garden Lawn",
    );
    assert.equal(
      resolveReceptionSpace({
        booked: false,
        preference: { kind: "venue_space", spaceName: "Barn" },
      }),
      "Barn",
    );
  });

  it("resolves external preferences with ceremony locked copy and reception text", () => {
    assert.equal(
      resolveCeremonySpace({
        booked: false,
        preference: { kind: "external", externalLocation: "  City Hall  " },
      }),
      CEREMONY_OUTSIDE_VENUE,
    );
    assert.equal(
      resolveReceptionSpace({
        booked: false,
        preference: { kind: "external", externalLocation: "  Harbor Dock  " },
      }),
      "Harbor Dock",
    );
  });

  it("undecided and missing preferences stay unlisted", () => {
    assert.equal(
      resolveCeremonySpace({ booked: false, preference: { kind: "undecided" } }),
      CEREMONY_SPACE_UNLISTED,
    );
    assert.equal(resolveReceptionSpace({ booked: false, preference: null }), RECEPTION_SPACE_UNLISTED);
    assert.equal(
      resolveCeremonySpace({
        booked: false,
        // Pre-booking must not invent from assignment-shaped leftovers.
        assignmentName: "Should Not Appear",
        preference: { kind: "undecided" },
      }),
      CEREMONY_SPACE_UNLISTED,
    );
  });
});

describe("buildMergeData always resolves the new fields", () => {
  it("never returns blank, null, undefined, or raw tokens", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Ada",
      clientLastName: "Lovelace",
      eventDate: "2030-06-15",
      eventType: "wedding",
      guestCount: 80,
      contractTitle: "Agreement",
    });
    assert.equal(data.ceremony_space, CEREMONY_SPACE_UNLISTED);
    assert.equal(data.reception_space, RECEPTION_SPACE_UNLISTED);
    assert.equal(mergeContent("{{ceremony_space}} / {{reception_space}}", data), `${CEREMONY_SPACE_UNLISTED} / ${RECEPTION_SPACE_UNLISTED}`);
    assert.doesNotMatch(mergeContent("Hello {{unknown_token}}", data), /undefined|null/);
    assert.equal(mergeContent("Hello {{unknown_token}}", data), "Hello {{unknown_token}}");
  });

  it("preview resolution does not write into authored content", () => {
    const authored = "Ceremony: {{ceremony_space}}\nReception: {{reception_space}}";
    const preview = mergeContent(authored, buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Ada",
      clientLastName: "Lovelace",
      eventDate: "2030-06-15",
      eventType: "wedding",
      guestCount: 80,
      contractTitle: "Agreement",
      ceremonySpace: "Garden",
      receptionSpace: "Barn",
    }));
    assert.equal(preview, "Ceremony: Garden\nReception: Barn");
    assert.match(authored, /\{\{ceremony_space\}\}/);
    assert.match(authored, /\{\{reception_space\}\}/);
  });

  it("Wedding Venue Agreement starter places ceremony/reception tokens without inventing new merge authority", () => {
    const starter = readFileSync(resolve("lib/contracts/starters.ts"), "utf8");
    assert.match(starter, /Ceremony\n\{\{ceremony_space\}\}/);
    assert.match(starter, /Reception\n\{\{reception_space\}\}/);
    assert.match(starter, /\{\{event_spaces\}\}/);
    assert.doesNotMatch(starter, /Add your venue's approved ceremony timing and location language/);
    assert.doesNotMatch(starter, /Add your venue's approved reception timing and location language/);
  });
});

describe("authority boundaries", () => {
  it("buildContractMergeData uses lead preferences only when not booked; event authority when booked", () => {
    const service = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
    const fn = service.slice(service.indexOf("export async function buildContractMergeData"));
    assert.match(fn, /resolveCeremonySpace/);
    assert.match(fn, /resolveReceptionSpace/);
    assert.match(fn, /external_ceremony_location|externalCeremonyLocation/);
    assert.match(fn, /relationshipBooked/);
    assert.match(fn, /bookedAt/);
    assert.match(fn, /lead_event_space_preferences/);
    assert.match(fn, /booked: relationshipBooked/);
    // Still refuse questionnaire / planned-space / notes as ceremony_space authority.
    const ceremonyCall = fn.slice(fn.indexOf("ceremonySpace: resolveCeremonySpace"), fn.indexOf("receptionSpace: resolveReceptionSpace"));
    assert.doesNotMatch(ceremonyCall, /planned_event_space_id/);
    assert.doesNotMatch(ceremonyCall, /questionnaire/);
    assert.doesNotMatch(ceremonyCall, /lead_notes/);
    assert.doesNotMatch(fn, /resolveEventSpacesLabel\([\s\S]*ceremony_space/);
  });

  it("event_spaces merge stays on its own path", () => {
    const eventSpaces = readFileSync(resolve("lib/contracts/event-spaces-merge.ts"), "utf8");
    assert.match(eventSpaces, /plannedEventSpaceId/);
    assert.doesNotMatch(eventSpaces, /ceremony_space/);
    assert.doesNotMatch(eventSpaces, /reception_space/);
  });
});
