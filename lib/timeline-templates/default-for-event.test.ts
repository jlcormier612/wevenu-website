import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDefaultTimelineTemplateId } from "@/lib/timeline-templates/default-for-event";
import type { TimelineTemplate } from "@/lib/timeline-templates/types";

function tpl(partial: Partial<TimelineTemplate> & Pick<TimelineTemplate, "id" | "name">): TimelineTemplate {
  return {
    venueId: "v",
    eventType: null,
    spaceId: null,
    isDefault: false,
    isArchived: false,
    sourceMasterKey: null,
    createdAt: "",
    updatedAt: "",
    itemCount: 0,
    spaceName: null,
    ...partial,
  };
}

describe("resolveDefaultTimelineTemplateId", () => {
  it("prefers event-type + space default over broader defaults", () => {
    const templates = [
      tpl({ id: "wide", name: "Wide", isDefault: true, eventType: null, spaceId: null }),
      tpl({ id: "type", name: "Type", isDefault: true, eventType: "wedding", spaceId: null }),
      tpl({ id: "space", name: "Space", isDefault: true, eventType: "wedding", spaceId: "ballroom" }),
    ];
    assert.equal(resolveDefaultTimelineTemplateId(templates, "wedding", "ballroom"), "space");
    assert.equal(resolveDefaultTimelineTemplateId(templates, "wedding", "garden"), "type");
    assert.equal(resolveDefaultTimelineTemplateId(templates, "corporate", null), "wide");
  });

  it("returns undefined when no defaults are marked", () => {
    const templates = [tpl({ id: "a", name: "A", eventType: "wedding", spaceId: "ballroom" })];
    assert.equal(resolveDefaultTimelineTemplateId(templates, "wedding", "ballroom"), undefined);
  });
});
