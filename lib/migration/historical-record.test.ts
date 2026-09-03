import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  HISTORICAL_RECORD_ELIGIBLE,
  HISTORICAL_RECORD_LABEL,
  historicalRecordReviewMessage,
  isHistoricalRecordEligibleError,
  isLiveAvailabilityConflictError,
  isPastEventDate,
} from "./historical-record";

describe("historical record review", () => {
  it("uses the exact reviewed outcome copy", () => {
    assert.equal(
      HISTORICAL_RECORD_LABEL,
      "Import as historical record — will not affect future availability.",
    );
  });

  it("treats only dates before UTC today as past", () => {
    assert.equal(isPastEventDate("2020-01-01", "2026-09-03"), true);
    assert.equal(isPastEventDate("2026-09-03", "2026-09-03"), false);
    assert.equal(isPastEventDate("2027-06-12", "2026-09-03"), false);
    assert.equal(isPastEventDate("", "2026-09-03"), false);
  });

  it("marks occupancy failures on past Events as historical-eligible, not a silent bypass", () => {
    const msg = historicalRecordReviewMessage("This date is already booked for an overlapping event.");
    assert.match(msg, new RegExp(HISTORICAL_RECORD_ELIGIBLE));
    assert.match(msg, /will not affect future availability/);
    assert.equal(isHistoricalRecordEligibleError([msg]), true);
    assert.equal(isLiveAvailabilityConflictError([msg]), false);
  });

  it("keeps future occupancy conflicts as live — never Import anyway", () => {
    const errors = ["This date is already booked for an overlapping event."];
    assert.equal(isHistoricalRecordEligibleError(errors), false);
    assert.equal(isLiveAvailabilityConflictError(errors), true);
  });
});

describe("historical record surfaces in Migration Center", () => {
  it("offers the reviewed historical outcome and does not treat needs_review occupancy as Import anyway", () => {
    const src = readFileSync(join(process.cwd(), "components/settings/migration-center.tsx"), "utf8");
    assert.match(src, /approve_historical/);
    assert.match(src, /HISTORICAL_RECORD_LABEL/);
    assert.match(src, /isLiveAvailabilityConflictError/);
  });
});
