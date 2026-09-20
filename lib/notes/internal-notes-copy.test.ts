import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INTERNAL_NOTES_LABEL,
  INTERNAL_NOTES_PRIVACY_HINT,
} from "@/lib/notes/internal-notes-copy";

describe("internal notes locked copy", () => {
  it("uses the canonical label and privacy line", () => {
    assert.equal(INTERNAL_NOTES_LABEL, "Internal notes");
    assert.equal(
      INTERNAL_NOTES_PRIVACY_HINT,
      "Private to your venue team — never visible to the client.",
    );
  });

  it("does not use ambiguous Notes or client profile wording", () => {
    assert.notEqual(INTERNAL_NOTES_LABEL, "Notes");
    assert.doesNotMatch(INTERNAL_NOTES_PRIVACY_HINT, /client profile/i);
    assert.match(INTERNAL_NOTES_PRIVACY_HINT, /never visible to the client/i);
  });
});
