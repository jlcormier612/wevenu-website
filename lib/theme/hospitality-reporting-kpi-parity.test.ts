/**
 * Permanent guard: Reports Overview must keep Phase 11B colored metric tiles.
 * A future reporting feature must not silently revert BusinessFunnel to plain borders
 * (regression introduced by 40c7bb55).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("hospitality reporting KPI parity guard", () => {
  const funnel = readFileSync(resolve("components/reporting/business-funnel.tsx"), "utf8");
  const css = readFileSync(resolve("app/globals.css"), "utf8");

  it("BusinessFunnel keeps htc-report-metric-tile + family tones", () => {
    assert.match(funnel, /htc-report-metric-tile/);
    assert.match(funnel, /data-tone=\{stage\.tone\}/);
    for (const tone of ["sales", "bookings", "contracted", "collected", "outstanding"] as const) {
      assert.match(funnel, new RegExp(`tone:\\s*"${tone}"`));
    }
  });

  it("globals keep tone fills under .htc-staff", () => {
    assert.match(css, /\.htc-staff \.htc-report-metric-tile\[data-tone="sales"\]/);
    assert.match(css, /\.htc-staff \.htc-report-metric-tile\[data-tone="outstanding"\]/);
    assert.match(css, /--htc-soft-blush/);
    assert.match(css, /--htc-eucalyptus-surface/);
  });
});
