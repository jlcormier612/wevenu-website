/**
 * Contract {{event_spaces}} must reflect the canonical space assignment:
 * Event.space_id first, else the lead's planned_event_space_id.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  EMPTY_EVENT_SPACES_LABEL,
  replaceEmptyEventSpacesLabel,
  resolveEventSpacesLabel,
} from "@/lib/contracts/event-spaces-merge";

const SPACES = [
  { id: "barn-id", name: "Barn" },
  { id: "garden-id", name: "Garden Lawn" },
  { id: "bridge-id", name: "Covered Bridge" },
];

describe("resolveEventSpacesLabel", () => {
  it("uses Event.space_id when present", () => {
    assert.equal(
      resolveEventSpacesLabel({
        spaces: SPACES,
        eventSpaceId: "barn-id",
        plannedEventSpaceId: "garden-id",
      }),
      "Barn",
    );
  });

  it("falls back to lead planned_event_space_id when Event has no space", () => {
    assert.equal(
      resolveEventSpacesLabel({
        spaces: SPACES,
        eventSpaceId: null,
        plannedEventSpaceId: "barn-id",
      }),
      "Barn",
    );
  });

  it("falls back to planned space when there is no Event at all", () => {
    assert.equal(
      resolveEventSpacesLabel({
        spaces: SPACES,
        eventSpaceId: undefined,
        plannedEventSpaceId: "barn-id",
      }),
      "Barn",
    );
  });

  it("keeps empty-state copy when neither assignment exists", () => {
    assert.equal(
      resolveEventSpacesLabel({
        spaces: SPACES,
        eventSpaceId: null,
        plannedEventSpaceId: null,
      }),
      EMPTY_EVENT_SPACES_LABEL,
    );
  });

  it("keeps empty-state when space id is unknown", () => {
    assert.equal(
      resolveEventSpacesLabel({
        spaces: SPACES,
        eventSpaceId: "missing",
        plannedEventSpaceId: "also-missing",
      }),
      EMPTY_EVENT_SPACES_LABEL,
    );
  });

  it("replaces pre-baked empty copy once a real space is known", () => {
    const body = `Event Spaces: ${EMPTY_EVENT_SPACES_LABEL}\n\nAlso: ${EMPTY_EVENT_SPACES_LABEL}`;
    assert.equal(
      replaceEmptyEventSpacesLabel(body, "Barn"),
      "Event Spaces: Barn\n\nAlso: Barn",
    );
    assert.equal(
      replaceEmptyEventSpacesLabel(body, EMPTY_EVENT_SPACES_LABEL),
      body,
    );
  });

  it("prefers event_space_assignments over single space_id", () => {
    assert.equal(
      resolveEventSpacesLabel({
        spaces: SPACES,
        eventSpaceId: "barn-id",
        assignments: [
          { useKey: "ceremony", useLabel: "Ceremony", spaceId: "garden-id", spaceName: "Garden Lawn" },
          { useKey: "reception", useLabel: "Reception", spaceId: "barn-id", spaceName: "Barn" },
        ],
      }),
      "Ceremony: Garden Lawn\nReception: Barn",
    );
  });

  it("renders unused uses as absent — only assigned uses appear", () => {
    assert.equal(
      resolveEventSpacesLabel({
        spaces: SPACES,
        eventSpaceId: "barn-id",
        assignments: [
          { useKey: "ceremony", useLabel: "Ceremony", spaceId: "garden-id" },
          { useKey: "reception", useLabel: "Reception", spaceId: "barn-id" },
          { useKey: "cocktail_hour", useLabel: "Cocktail Hour", spaceId: "bridge-id" },
        ],
      }),
      "Ceremony: Garden Lawn\nReception: Barn\nCocktail Hour: Covered Bridge",
    );
  });
});

describe("buildContractMergeData uses planned lead space", () => {
  it("wires resolveEventSpacesLabel and reads leads.planned_event_space_id", () => {
    const service = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
    assert.match(service, /resolveEventSpacesLabel/);
    assert.match(service, /planned_event_space_id/);
    assert.match(service, /from\("leads"\)/);
    assert.match(service, /getEventIdForClient/);
    assert.match(service, /replaceEmptyEventSpacesLabel/);
    // Must not hardcode a space name into merge.
    assert.doesNotMatch(service, /eventSpaces\s*=\s*["']Barn["']/);
  });

  it("ensureCommercialCustomer resolves client's Event when selection.eventId is null", () => {
    const src = readFileSync(resolve("lib/booking-journey/ensure-commercial-customer.ts"), "utf8");
    assert.match(src, /getEventIdForClient/);
  });
});
