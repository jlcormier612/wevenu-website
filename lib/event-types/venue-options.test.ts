import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_ACCEPTED_EVENT_TYPES, EVENT_TYPES } from "@/lib/event-types/canonical";
import {
  LEGACY_EVENT_TYPE_OPTION_DESCRIPTION,
  LEGACY_EVENT_TYPE_OPTION_SUFFIX,
  buildVenueEventTypeOptions,
} from "@/lib/event-types/venue-options";

const OBSERVED_ACCEPTED = [
  "wedding",
  "corporate",
  "social_event",
  "birthday",
];

describe("buildVenueEventTypeOptions", () => {
  it("new record: returns only accepted catalog values in catalog order", () => {
    const options = buildVenueEventTypeOptions({ acceptedRaw: OBSERVED_ACCEPTED });
    assert.deepEqual(
      options.map((o) => o.value),
      ["wedding", "corporate", "social_event", "birthday"],
    );
    assert.deepEqual(
      options.map((o) => o.label),
      ["Wedding", "Corporate Event", "Social Event", "Birthday Party"],
    );
    assert.ok(!options.some((o) => o.value === "elopement"));
    assert.ok(!options.some((o) => o.value === "engagement_party"));
    assert.ok(!options.some((o) => o.isLegacyCurrent));
  });

  it("new record: empty/null configuration uses DEFAULT_ACCEPTED_EVENT_TYPES", () => {
    const fromNull = buildVenueEventTypeOptions({ acceptedRaw: null });
    const fromEmpty = buildVenueEventTypeOptions({ acceptedRaw: [] });
    assert.deepEqual(
      fromNull.map((o) => o.value),
      DEFAULT_ACCEPTED_EVENT_TYPES,
    );
    assert.deepEqual(
      fromEmpty.map((o) => o.value),
      DEFAULT_ACCEPTED_EVENT_TYPES,
    );
  });

  it("edit: current accepted value appears once", () => {
    const options = buildVenueEventTypeOptions({
      acceptedRaw: OBSERVED_ACCEPTED,
      currentValue: "wedding",
    });
    assert.equal(options.filter((o) => o.value === "wedding").length, 1);
    assert.ok(!options.some((o) => o.isLegacyCurrent));
  });

  it("edit: current legacy value appears and is marked current/no longer offered", () => {
    const options = buildVenueEventTypeOptions({
      acceptedRaw: OBSERVED_ACCEPTED,
      currentValue: "elopement",
    });
    const legacy = options.find((o) => o.value === "elopement");
    assert.ok(legacy);
    assert.equal(legacy!.isLegacyCurrent, true);
    assert.equal(legacy!.label, `Elopement${LEGACY_EVENT_TYPE_OPTION_SUFFIX}`);
    assert.equal(legacy!.description, LEGACY_EVENT_TYPE_OPTION_DESCRIPTION);
    assert.deepEqual(
      options.filter((o) => !o.isLegacyCurrent).map((o) => o.value),
      OBSERVED_ACCEPTED,
    );
  });

  it("ordering: accepted options follow canonical catalog order", () => {
    const shuffled = ["birthday", "wedding", "social_event", "corporate"];
    const options = buildVenueEventTypeOptions({ acceptedRaw: shuffled });
    const catalogOrder = EVENT_TYPES.map((t) => t.value).filter((v) =>
      shuffled.includes(v),
    );
    assert.deepEqual(
      options.map((o) => o.value),
      catalogOrder,
    );
  });

  it("unknown/invalid stored value: still selectable without crashing", () => {
    const options = buildVenueEventTypeOptions({
      acceptedRaw: OBSERVED_ACCEPTED,
      currentValue: "  Custom Barn Bash  ",
    });
    const legacy = options.find((o) => o.isLegacyCurrent);
    assert.ok(legacy);
    assert.equal(legacy!.value, "Custom Barn Bash");
    assert.match(legacy!.label, /Custom Barn Bash/);
  });
});
