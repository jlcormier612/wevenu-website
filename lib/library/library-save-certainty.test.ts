import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { LIBRARY_LABELS } from "@/components/library/labels";

describe("Library autosave labels — durable save certainty", () => {
  it("exposes All changes saved and teaching copy", () => {
    assert.equal(LIBRARY_LABELS.allChangesSaved, "All changes saved");
    assert.equal(LIBRARY_LABELS.autosaveTeaching, "Changes save as you work. You can leave anytime.");
    assert.equal(LIBRARY_LABELS.saving, "Saving…");
  });

  it("LibrarySaveStatus defaults to durable saved (no fade-to-blank)", () => {
    const src = readFileSync(resolve("components/library/library-save-status.tsx"), "utf8");
    assert.match(src, /export function useLibrarySaveStatus\(resetMs = 0\)/);
    assert.match(src, /LIBRARY_LABELS\.allChangesSaved/);
    assert.match(src, /LibraryAutosaveHint/);
  });

  it("EO / Inventory / Choices editors teach autosave", () => {
    for (const file of [
      "components/event-order-templates/event-order-template-detail.tsx",
      "components/event-inventory/inventory-template-detail.tsx",
      "components/client-choices-templates/choices-template-detail.tsx",
    ]) {
      const src = readFileSync(resolve(file), "utf8");
      assert.match(src, /LibraryAutosaveHint/, file);
      assert.match(src, /LibrarySaveStatus/, file);
    }
  });
});
