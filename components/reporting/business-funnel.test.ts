import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

describe("BusinessFunnel hospitality KPI tiles", () => {
  const funnel = readFileSync(resolve("components/reporting/business-funnel.tsx"), "utf8");
  const overview = readFileSync(resolve("app/(app)/reporting/page.tsx"), "utf8");

  it("uses Phase 11B metric-family tones on period and cohort tiles", () => {
    assert.match(funnel, /htc-report-metric-tile/);
    assert.match(funnel, /data-tone=\{stage\.tone\}/);
    assert.match(funnel, /tone: "sales"/);
    assert.match(funnel, /tone: "bookings"/);
    assert.match(funnel, /tone: "contracted"/);
    assert.match(funnel, /tone: "collected"/);
    assert.match(funnel, /tone: "outstanding"/);
    assert.doesNotMatch(funnel, /rounded-md border border-border px-3 py-2\.5/);
  });

  it("Overview uses BusinessFunnel as the single KPI presentation", () => {
    assert.match(overview, /<BusinessFunnel/);
    assert.doesNotMatch(overview, /<ComparisonCardGrid/);
    assert.doesNotMatch(overview, /<ComparisonCard[\s>]/);
  });
});
