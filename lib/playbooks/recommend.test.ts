import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { recommendPlanningTemplate, type RecommendableTemplate } from "@/lib/playbooks/recommend";

function tpl(partial: Partial<RecommendableTemplate> & Pick<RecommendableTemplate, "id" | "name" | "kind">): RecommendableTemplate {
  return {
    eventType: "wedding",
    isDefault: false,
    isArchived: false,
    ...partial,
  };
}

describe("recommendPlanningTemplate", () => {
  it("recommends the default template that matches the event type", () => {
    const templates = [
      tpl({ id: "c-other", name: "Corporate Client", kind: "client", eventType: "corporate", isDefault: true }),
      tpl({ id: "c-wed", name: "Standard Wedding Client Planning", kind: "client", eventType: "wedding", isDefault: true }),
      tpl({ id: "c-wed-alt", name: "Intimate Wedding Client Planning", kind: "client", eventType: "wedding", isDefault: false }),
      tpl({ id: "v-wed", name: "Standard Wedding Venue Planning", kind: "venue", eventType: "wedding", isDefault: true }),
    ];
    const client = recommendPlanningTemplate(templates, "client", "wedding");
    assert.equal(client.recommended?.id, "c-wed");
    assert.equal(client.recommended?.name, "Standard Wedding Client Planning");
    assert.equal(client.reason, "event_type_default");
    assert.deepEqual(client.matching.map((t) => t.id).sort(), ["c-wed", "c-wed-alt"]);

    const venue = recommendPlanningTemplate(templates, "venue", "wedding");
    assert.equal(venue.recommended?.id, "v-wed");
    assert.equal(venue.recommended?.name, "Standard Wedding Venue Planning");
  });

  it("uses existing is_default semantics for a kind-wide default when nothing matches the event type", () => {
    const templates = [
      tpl({ id: "c-untyped", name: "General Client Planning", kind: "client", eventType: null, isDefault: true }),
      tpl({ id: "c-corp", name: "Corporate Client", kind: "client", eventType: "corporate", isDefault: false }),
    ];
    const result = recommendPlanningTemplate(templates, "client", "wedding");
    assert.equal(result.recommended?.id, "c-untyped");
    assert.equal(result.reason, "kind_default");
    assert.equal(result.matching.length, 0);
  });

  it("says no matching template when none share the event type and no kind default exists", () => {
    const templates = [
      tpl({ id: "c-corp", name: "Corporate Client", kind: "client", eventType: "corporate" }),
      tpl({ id: "v-wed", name: "Standard Wedding Venue Planning", kind: "venue", eventType: "wedding", isDefault: true }),
    ];
    const result = recommendPlanningTemplate(templates, "client", "wedding");
    assert.equal(result.recommended, null);
    assert.equal(result.reason, "no_match");
    assert.equal(result.matching.length, 0);
    assert.equal(result.choices.length, 1);
    assert.equal(result.choices[0]?.id, "c-corp");
  });

  it("does not silently choose an arbitrary non-default when several templates match", () => {
    const templates = [
      tpl({ id: "a", name: "Alpha Wedding", kind: "client", eventType: "wedding" }),
      tpl({ id: "b", name: "Beta Wedding", kind: "client", eventType: "wedding" }),
    ];
    const result = recommendPlanningTemplate(templates, "client", "wedding");
    assert.equal(result.recommended, null);
    assert.equal(result.reason, "multiple_matches");
    assert.equal(result.matching.length, 2);
    assert.deepEqual(result.choices.map((t) => t.id), ["a", "b"]);
  });

  it("recommends the only matching template even when it is not marked default", () => {
    const templates = [
      tpl({ id: "only", name: "Elopement Client Planning", kind: "client", eventType: "elopement" }),
    ];
    const result = recommendPlanningTemplate(templates, "client", "elopement");
    assert.equal(result.recommended?.id, "only");
    assert.equal(result.reason, "event_type_only_match");
  });

  it("ignores archived templates and the other planning kind", () => {
    const templates = [
      tpl({ id: "archived", name: "Old Wedding", kind: "client", eventType: "wedding", isDefault: true, isArchived: true }),
      tpl({ id: "venue-default", name: "Venue Wedding", kind: "venue", eventType: "wedding", isDefault: true }),
      tpl({ id: "live", name: "Live Wedding", kind: "client", eventType: "wedding" }),
    ];
    const result = recommendPlanningTemplate(templates, "client", "wedding");
    assert.equal(result.recommended?.id, "live");
    assert.equal(result.choices.length, 1);
  });

  it("does not treat a default for a different event type as a match", () => {
    const templates = [
      tpl({ id: "corp-default", name: "Corporate Client", kind: "client", eventType: "corporate", isDefault: true }),
    ];
    const result = recommendPlanningTemplate(templates, "client", "wedding");
    assert.equal(result.recommended, null);
    assert.equal(result.reason, "no_match");
  });
});
