/**
 * Floor Plan Templates — venue-scoped event-type dropdown options.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { EVENT_TYPES } from "@/lib/event-types/canonical";
import {
  FLOOR_PLAN_TEMPLATE_ANY_EVENT_TYPE,
  buildFloorPlanTemplateCreateEventTypeOptions,
  buildFloorPlanTemplateEditEventTypeOptions,
  buildFloorPlanTemplateFilterEventTypeOptions,
} from "@/lib/floor-plan-templates/event-type-options";

const ROOT = process.cwd();
function read(rel: string) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("Floor Plan Template filter event-type options", () => {
  it("includes All event types sentinel + only accepted venue types", () => {
    const options = buildFloorPlanTemplateFilterEventTypeOptions([
      "wedding",
      "corporate",
    ]);
    assert.equal(options[0]?.value, FLOOR_PLAN_TEMPLATE_ANY_EVENT_TYPE);
    assert.equal(options[0]?.label, "All event types");
    assert.deepEqual(
      options.slice(1).map((o) => o.value),
      ["wedding", "corporate"],
    );
    assert.deepEqual(
      options.slice(1).map((o) => o.label),
      ["Wedding", "Corporate Event"],
    );
    assert.ok(!options.some((o) => o.value === "elopement"));
    assert.ok(!options.some((o) => o.value === "quinceanera"));
    assert.ok(!options.some((o) => o.value === "other"));
    assert.ok(!options.some((o) => o.value === "birthday"));
  });

  it("excludes every unselected global catalog type", () => {
    const accepted = ["wedding", "corporate"];
    const options = buildFloorPlanTemplateFilterEventTypeOptions(accepted);
    const values = new Set(options.map((o) => o.value));
    for (const t of EVENT_TYPES) {
      if (!accepted.includes(t.value)) {
        assert.ok(!values.has(t.value), `unexpected global type ${t.value}`);
      }
    }
  });
});

describe("Floor Plan Template create/starter event-type options", () => {
  it("includes Any event type + only accepted venue types", () => {
    const options = buildFloorPlanTemplateCreateEventTypeOptions([
      "wedding",
      "corporate",
    ]);
    assert.equal(options[0]?.value, FLOOR_PLAN_TEMPLATE_ANY_EVENT_TYPE);
    assert.equal(options[0]?.label, "Any event type");
    assert.deepEqual(
      options.slice(1).map((o) => ({ value: o.value, label: o.label })),
      [
        { value: "wedding", label: "Wedding" },
        { value: "corporate", label: "Corporate Event" },
      ],
    );
    assert.ok(!options.some((o) => o.value === "elopement"));
    assert.ok(!options.some((o) => o.value === "quinceanera"));
  });
});

describe("Floor Plan Template edit — legacy current value", () => {
  it("retains Corporate when accepted is Wedding-only", () => {
    const options = buildFloorPlanTemplateEditEventTypeOptions(
      ["wedding"],
      "corporate",
    );
    assert.equal(options[0]?.label, "Any event type");
    assert.ok(options.some((o) => o.value === "wedding"));
    const legacy = options.find((o) => o.value === "corporate");
    assert.ok(legacy, "corporate must remain selectable");
    assert.equal(legacy?.isLegacyCurrent, true);
    assert.match(legacy?.label ?? "", /Corporate Event/);
  });
});

describe("Floor Plan Templates venue-facing wiring — not raw EVENT_TYPES", () => {
  it("list section and starter picker use venue-scoped helpers, not raw EVENT_TYPES map", () => {
    const section = read(
      "components/floor-plan-templates/floor-plan-templates-section.tsx",
    );
    const picker = read(
      "components/floor-plan-templates/floor-plan-template-starter-picker.tsx",
    );
    const page = read("app/(app)/library/floor-plan-templates/page.tsx");

    assert.match(page, /getInquiryFormSettings|accepted_inquiry_event_types|acceptedEventTypes/);
    assert.match(section, /buildFloorPlanTemplateFilterEventTypeOptions|eventTypeOptions/);
    assert.match(picker, /buildFloorPlanTemplateCreateEventTypeOptions|eventTypeOptions/);

    assert.doesNotMatch(section, /\.\.\.EVENT_TYPES/);
    assert.doesNotMatch(picker, /\.\.\.EVENT_TYPES/);
    assert.doesNotMatch(section, /EVENT_TYPES\.map/);
    assert.doesNotMatch(picker, /EVENT_TYPES\.map/);
  });
});
