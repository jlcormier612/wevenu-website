/**
 * Apply-sheet copy for lines vs choice groups vs empty categories.
 * Run: npx tsx --test lib/event-order-templates/apply-presence-copy.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  applySectionAbsenceCopy,
  applySectionChoiceNote,
  applyTemplateStructureCopy,
} from "@/lib/event-order-templates/apply-presence-copy";

describe("apply-sheet presence copy", () => {
  it("distinguishes choice groups from a genuinely empty section", () => {
    assert.match(applySectionAbsenceCopy(0, 1), /Clients choose options/);
    assert.doesNotMatch(applySectionAbsenceCopy(0, 1), /Section only/);
    assert.doesNotMatch(applySectionAbsenceCopy(0, 1), /no offerings to select/);
    assert.match(applySectionAbsenceCopy(0, 0), /no Event Order lines and no client choice groups yet/);
  });

  it("notes choice groups alongside traditional lines", () => {
    assert.equal(applySectionChoiceNote(0), null);
    assert.match(applySectionChoiceNote(2) ?? "", /2 choice groups/);
  });

  it("choices-first templates are not described as sections only", () => {
    const copy = applyTemplateStructureCopy(0, 4);
    assert.ok(copy);
    assert.match(copy, /client selections/);
    assert.doesNotMatch(copy, /sections only/);
    assert.match(copy, /not an invoice/);
    assert.equal(applyTemplateStructureCopy(3, 4), null);
  });

  it("apply sheet uses the presence helper and dropped the old empty-section line", () => {
    const apply = readFileSync(
      resolve("components/event-order-templates/apply-event-order-template-sheet.tsx"),
      "utf8",
    );
    assert.match(apply, /applySectionAbsenceCopy/);
    assert.match(apply, /applyTemplateStructureCopy/);
    assert.doesNotMatch(apply, /Section only — no offerings to select/);
    assert.doesNotMatch(apply, /This template is sections only/);
  });
});
