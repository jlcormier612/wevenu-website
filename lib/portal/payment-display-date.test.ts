import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { formatPortalPaymentDate } from "@/lib/portal/payment-display-date";

describe("formatPortalPaymentDate", () => {
  it("formats a date-only YYYY-MM-DD value", () => {
    assert.equal(formatPortalPaymentDate("2026-09-15"), "Sep 15, 2026");
  });

  it("formats a full ISO timestamp using the calendar date prefix", () => {
    assert.equal(formatPortalPaymentDate("2026-09-15T03:56:48.264444+00:00"), "Sep 15, 2026");
    assert.equal(formatPortalPaymentDate("2026-09-13T19:40:00Z"), "Sep 13, 2026");
  });

  it("returns an em dash for null, undefined, or empty", () => {
    assert.equal(formatPortalPaymentDate(null), "—");
    assert.equal(formatPortalPaymentDate(undefined), "—");
    assert.equal(formatPortalPaymentDate(""), "—");
  });

  it("Payments uses the shared helper for paid and due labels", () => {
    const src = readFileSync(resolve("components/portal/payment-section.tsx"), "utf8");
    assert.match(src, /formatPortalPaymentDate/);
    assert.doesNotMatch(src, /const \[y, m, d\] = iso\.split\("-"\)/);
  });
});
