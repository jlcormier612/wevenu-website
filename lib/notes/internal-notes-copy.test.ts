import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INTERNAL_NOTES_LABEL,
  INTERNAL_NOTES_PRIVACY_HINT,
  NOTES_FROM_YOUR_VENUE_HINT,
  NOTES_FROM_YOUR_VENUE_LABEL,
  internalNotesLabel,
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

  it("contextual labels keep the word Internal", () => {
    for (const scope of ["tour", "vendor", "task", "payment", "timeline"] as const) {
      assert.match(internalNotesLabel(scope), /^Internal /);
    }
    assert.equal(internalNotesLabel("default"), INTERNAL_NOTES_LABEL);
  });

  it("keeps customer-facing payment schedule copy distinct from Internal", () => {
    assert.equal(NOTES_FROM_YOUR_VENUE_LABEL, "Notes from your venue");
    assert.match(NOTES_FROM_YOUR_VENUE_HINT, /couple/i);
    assert.doesNotMatch(NOTES_FROM_YOUR_VENUE_LABEL, /Internal/i);
  });
});
