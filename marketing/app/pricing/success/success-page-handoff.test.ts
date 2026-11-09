import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("pricing success page — enrollment handoff", () => {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const page = readFileSync(join(dir, "page.tsx"), "utf8");

  it("uses bounded waitForEnrollmentBySession before showing activation", () => {
    assert.match(page, /waitForEnrollmentBySession/);
    assert.match(page, /classifySuccessEnrollment/);
    assert.match(page, /attempts:\s*8/);
    assert.match(page, /delayMs:\s*500/);
    assert.match(page, /lookup:\s*getEnrollmentBySession/);
  });

  it("never shows activation CTA without an activation token", () => {
    assert.match(page, /view === "self_setup_ready" && enrollment\?\.activationToken/);
    assert.match(page, /activationUrlFromToken\(enrollment\.activationToken\)/);
  });

  it("shows pending refresh when still processing", () => {
    assert.match(page, /SuccessPendingRefresh/);
    assert.match(page, /isProcessing && sessionId/);
  });

  it("does not create enrollments on the success page", () => {
    assert.doesNotMatch(page, /upsertVenueEnrollment|createVenueEnrollment|provisionVenue/);
  });
});
