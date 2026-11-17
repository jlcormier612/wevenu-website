import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mappingMissesRequiredFields, suggestHeaderMapping } from "@/lib/import/utils";

describe("suggestHeaderMapping", () => {
  it("maps obvious client spreadsheet headers without inventing the rest", () => {
    const mapping = suggestHeaderMapping("couples", [
      "Partner 1 First Name",
      "Partner 1 Last Name",
      "Email",
      "Notes from old software",
    ]);
    assert.equal(mapping.firstName, "Partner 1 First Name");
    assert.equal(mapping.lastName, "Partner 1 Last Name");
    assert.equal(mapping.email, "Email");
    assert.equal(mapping.internalNotes, null);
    assert.equal(mappingMissesRequiredFields("couples", mapping), false);
  });

  it("leaves Column N unmapped so the owner must review", () => {
    const mapping = suggestHeaderMapping("couples", ["Column 1", "Column 2", "Column 3"]);
    assert.equal(mapping.firstName, null);
    assert.equal(mapping.lastName, null);
    assert.equal(mappingMissesRequiredFields("couples", mapping), true);
  });
});
