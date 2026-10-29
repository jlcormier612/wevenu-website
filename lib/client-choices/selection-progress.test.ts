import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  isAtSelectionMaximum,
  selectionMaximumReachedMessage,
  selectionProgressForGroup,
  selectionProgressLabel,
} from "@/lib/client-choices/selection-progress";

describe("selection progress + max enforcement helpers", () => {
  it("formats exact-N live counts", () => {
    assert.equal(
      selectionProgressLabel({ selectionMode: "multi", minSelect: 2, maxSelect: 2 }, 0),
      "Choose exactly 2 — 0 of 2 selected",
    );
    assert.equal(
      selectionProgressLabel({ selectionMode: "multi", minSelect: 3, maxSelect: 3 }, 2),
      "Choose exactly 3 — 2 of 3 selected",
    );
  });

  it("formats min–max range and optional exact-or-skip groups", () => {
    assert.equal(
      selectionProgressLabel({ selectionMode: "multi", minSelect: 2, maxSelect: 4 }, 3),
      "Choose 2–4 — 3 selected",
    );
    assert.equal(
      selectionProgressLabel({ selectionMode: "multi", minSelect: 0, maxSelect: 2 }, 1),
      "Optional — choose exactly 2 or skip — 1 of 2 selected",
    );
    const partial = selectionProgressForGroup(
      { selectionMode: "multi", minSelect: 0, maxSelect: 2 },
      1,
    );
    assert.equal(partial.requirementMet, false);
    const skipped = selectionProgressForGroup(
      { selectionMode: "multi", minSelect: 0, maxSelect: 2 },
      0,
    );
    assert.equal(skipped.requirementMet, true);
  });

  it("formats single-select progress", () => {
    assert.match(
      selectionProgressLabel({ selectionMode: "single", minSelect: 1, maxSelect: 1 }, 1),
      /1 of 1 selected/,
    );
  });

  it("detects at-maximum without inventing silent replacement", () => {
    assert.equal(
      isAtSelectionMaximum({ selectionMode: "multi", maxSelect: 2 }, 2),
      true,
    );
    assert.equal(
      isAtSelectionMaximum({ selectionMode: "multi", maxSelect: 2 }, 1),
      false,
    );
    assert.equal(
      isAtSelectionMaximum({ selectionMode: "multi", maxSelect: null }, 99),
      false,
    );
    const progress = selectionProgressForGroup(
      { selectionMode: "multi", minSelect: 3, maxSelect: 3 },
      3,
    );
    assert.equal(progress.atMaximum, true);
    assert.equal(progress.requirementMet, true);
  });

  it("explains why another option cannot be selected", () => {
    assert.match(
      selectionMaximumReachedMessage({
        name: "Hard alcohol",
        selectionMode: "multi",
        minSelect: 2,
        maxSelect: 2,
      }),
      /limited to 2|Deselect/i,
    );
  });
});

describe("portal + finalize seams", () => {
  it("portal uses live progress and blocks over-max adds", () => {
    const portal = readFileSync("components/portal/choices-section.tsx", "utf8");
    assert.match(portal, /selectionProgressForGroup/);
    assert.match(portal, /isAtSelectionMaximum/);
    assert.match(portal, /selectionMaximumReachedMessage/);
    assert.match(portal, /choices-group-progress/);
  });

  it("finalize re-validates before Event Order mutations", () => {
    const src = readFileSync("lib/client-choices/service.ts", "utf8");
    const finalize = src.slice(src.indexOf("export async function finalizeClientChoices"));
    const validateIdx = finalize.indexOf("validateChoicesAnswers");
    const removeIdx = finalize.indexOf("removeLine");
    assert.ok(validateIdx > 0, "finalize must call validateChoicesAnswers");
    assert.ok(removeIdx > validateIdx, "validation must run before removeLine");
    assert.doesNotMatch(
      finalize.slice(0, validateIdx + 40),
      /createInvoice/,
    );
  });
});
