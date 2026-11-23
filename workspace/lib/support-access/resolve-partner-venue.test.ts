import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Stage 1F partner venue resolve wiring", () => {
  it("start route resolves vendor venue when missing", () => {
    const src = readFileSync(
      resolve(import.meta.dirname, "../../app/api/support-access/start/route.ts"),
      "utf8",
    );
    assert.match(src, /resolveVenueForVendor/);
    assert.match(src, /ambiguous/);
  });

  it("support page enriches inbox portal targets", () => {
    const src = readFileSync(
      resolve(import.meta.dirname, "../../app/(app)/support/page.tsx"),
      "utf8",
    );
    assert.match(src, /enrichInboxPortalTargets/);
  });
});
