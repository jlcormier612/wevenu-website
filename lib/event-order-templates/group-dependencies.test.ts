/**
 * Dependency authoring helpers — Increment 1 commercial choice tree.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatDependsOnSummary,
  isDependentGroup,
  parentOptionCandidates,
  sanitizeDependsOnOptionIds,
} from "@/lib/event-order-templates/group-dependencies";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import {
  isChoiceGroupActive,
  orderedVisibleChoiceGroups,
} from "@/lib/client-choices/conditional-groups";
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateOption,
  EventOrderTemplateWithDetails,
} from "@/lib/event-order-templates/types";

const ts = "2026-01-01T00:00:00Z";

function group(
  partial: Partial<EventOrderTemplateGroup> & Pick<EventOrderTemplateGroup, "id" | "name">,
): EventOrderTemplateGroup {
  return {
    templateId: "tmpl-1",
    venueId: "venue-a",
    sectionId: null,
    instructions: null,
    selectionMode: "single",
    minSelect: 1,
    maxSelect: 1,
    allowQuantity: false,
    dependsOnOptionIds: [],
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts,
    ...partial,
  };
}

function option(
  partial: Partial<EventOrderTemplateOption> &
    Pick<EventOrderTemplateOption, "id" | "groupId" | "label">,
): EventOrderTemplateOption {
  return {
    templateId: "tmpl-1",
    venueId: "venue-a",
    offeringId: null,
    description: null,
    isIncluded: true,
    unitPrice: 0,
    isDefault: false,
    sortOrder: 0,
    createdAt: ts,
    updatedAt: ts,
    ...partial,
  };
}

const dinner = group({ id: "g-dinner", name: "Dinner style", sortOrder: 0 });
const platedKids = group({
  id: "g-plated-kids",
  name: "Plated follow-ups",
  sortOrder: 1,
  dependsOnOptionIds: ["o-plated"],
});
const buffetKids = group({
  id: "g-buffet-kids",
  name: "Buffet follow-ups",
  sortOrder: 2,
  dependsOnOptionIds: ["o-buffet"],
});
const always = group({ id: "g-always", name: "Always-on add-ons", sortOrder: 3 });

const plated = option({ id: "o-plated", groupId: "g-dinner", label: "Plated Dinner", sortOrder: 0 });
const buffet = option({ id: "o-buffet", groupId: "g-dinner", label: "Buffet Dinner", sortOrder: 1 });
const beer = option({ id: "o-beer", groupId: "g-always", label: "Beer & Wine", sortOrder: 0 });

const groups = [dinner, platedKids, buffetKids, always];
const options = [plated, buffet, beer];

describe("formatDependsOnSummary", () => {
  it("reports Always shown when there are no dependencies", () => {
    assert.equal(formatDependsOnSummary([], options), "Always shown");
    assert.equal(formatDependsOnSummary(undefined, options), "Always shown");
  });

  it("renders a single parent option label", () => {
    assert.equal(formatDependsOnSummary(["o-plated"], options), "Depends on: Plated Dinner");
  });

  it("renders multiple activating parents with or", () => {
    assert.equal(
      formatDependsOnSummary(["o-plated", "o-buffet"], options),
      "Depends on: Plated Dinner or Buffet Dinner",
    );
    assert.equal(
      formatDependsOnSummary(["o-plated", "o-buffet", "o-beer"], options),
      "Depends on: Plated Dinner, Buffet Dinner, or Beer & Wine",
    );
  });
});

describe("parentOptionCandidates / sanitizeDependsOnOptionIds", () => {
  it("lists options from other groups only", () => {
    const candidates = parentOptionCandidates(groups, options, "g-plated-kids");
    assert.deepEqual(
      candidates.map((c) => c.id),
      ["o-plated", "o-buffet", "o-beer"],
    );
    assert.ok(candidates.every((c) => c.groupId !== "g-plated-kids"));
  });

  it("sanitizes add: keeps valid ids, drops unknown and self-group ids", () => {
    assert.deepEqual(
      sanitizeDependsOnOptionIds(
        ["o-plated", "o-plated", "missing", "", "o-beer"],
        options,
        "g-plated-kids",
      ),
      ["o-plated", "o-beer"],
    );
    // Cannot depend on options that live on the same group (none here for dinner).
    assert.deepEqual(
      sanitizeDependsOnOptionIds(["o-plated"], options, "g-dinner"),
      [],
    );
  });

  it("supports removing a dependency by omitting it", () => {
    const before = ["o-plated", "o-buffet"];
    const after = sanitizeDependsOnOptionIds(["o-plated"], options, "g-plated-kids");
    assert.deepEqual(after, ["o-plated"]);
    assert.ok(!after.includes("o-buffet"));
    assert.deepEqual(
      sanitizeDependsOnOptionIds([], options, "g-plated-kids"),
      [],
    );
  });
});

describe("isDependentGroup", () => {
  it("distinguishes gated vs always-on groups", () => {
    assert.equal(isDependentGroup(platedKids), true);
    assert.equal(isDependentGroup(always), false);
  });
});

describe("persistence + freeze + preview semantics", () => {
  function templateWithDeps(
    childDeps: string[],
  ): EventOrderTemplateWithDetails {
    return {
      id: "tmpl-1",
      venueId: "venue-a",
      name: "Dependency editor fixture",
      description: null,
      sourceMasterKey: null,
      isArchived: false,
      createdAt: ts,
      updatedAt: ts,
      sections: [],
      lines: [],
      groups: [
        dinner,
        {
          ...platedKids,
          dependsOnOptionIds: childDeps,
        },
      ],
      options: [plated, buffet],
    };
  }

  it("serializes dependsOnOptionIds into the selection freeze", () => {
    const def = selectionDefinitionFromEventOrderTemplate(
      templateWithDeps(["o-plated", "o-buffet"]),
    );
    const child = def.groups.find((g) => g.id === "g-plated-kids");
    assert.deepEqual(child?.dependsOnOptionIds, ["o-plated", "o-buffet"]);
  });

  it("reload shape retains configured dependency (round-trip via template model)", () => {
    const saved = templateWithDeps(["o-plated"]);
    const reloaded = structuredClone(saved);
    assert.deepEqual(
      reloaded.groups.find((g) => g.id === "g-plated-kids")?.dependsOnOptionIds,
      ["o-plated"],
    );
    assert.equal(
      formatDependsOnSummary(
        reloaded.groups.find((g) => g.id === "g-plated-kids")!.dependsOnOptionIds,
        reloaded.options,
      ),
      "Depends on: Plated Dinner",
    );
  });

  it("preview: child hidden until parent selected; visible after", () => {
    const def = selectionDefinitionFromEventOrderTemplate(templateWithDeps(["o-plated"]));
    const empty = orderedVisibleChoiceGroups(def, {});
    assert.deepEqual(
      empty.map((g) => g.id),
      ["g-dinner"],
    );
    assert.equal(isChoiceGroupActive(def.groups[1]!, {}), false);

    const withParent = orderedVisibleChoiceGroups(def, {
      "g-dinner": { optionIds: ["o-plated"] },
    });
    assert.deepEqual(
      withParent.map((g) => g.id),
      ["g-dinner", "g-plated-kids"],
    );
  });

  it("honest-empty dependent group stays active with zero options", () => {
    const def = selectionDefinitionFromEventOrderTemplate(templateWithDeps(["o-plated"]));
    assert.equal(def.options.filter((o) => o.groupId === "g-plated-kids").length, 0);
    const visible = orderedVisibleChoiceGroups(def, {
      "g-dinner": { optionIds: ["o-plated"] },
    });
    const child = visible.find((g) => g.id === "g-plated-kids");
    assert.ok(child);
    assert.equal(isDependentGroup({ dependsOnOptionIds: child!.dependsOnOptionIds ?? [] }), true);
  });

  it("regression: groups without dependencies remain always visible", () => {
    const def = selectionDefinitionFromEventOrderTemplate(templateWithDeps([]));
    const child = def.groups.find((g) => g.id === "g-plated-kids")!;
    assert.deepEqual(child.dependsOnOptionIds, []);
    assert.equal(isChoiceGroupActive(child, {}), true);
    assert.equal(
      orderedVisibleChoiceGroups(def, {}).map((g) => g.id).join(","),
      "g-dinner,g-plated-kids",
    );
  });
});
