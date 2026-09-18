/**
 * Open-lead lifecycle — reporting category vs sales_stage, no client_id / exclude gate.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  isOpenLeadLifecycle,
  isOpenLeadOpportunity,
  isOpenReportingCategory,
  TERMINAL_LEAD_LIFECYCLE_STATES,
} from "@/lib/leads/open-lifecycle";

const root = path.join(import.meta.dirname, "../..");

describe("isOpenLeadLifecycle", () => {
  it("excludes booked / lost / won / cancelled only", () => {
    for (const t of TERMINAL_LEAD_LIFECYCLE_STATES) {
      assert.equal(isOpenLeadLifecycle(t), false);
    }
    assert.equal(isOpenLeadLifecycle("new_inquiry"), true);
    assert.equal(isOpenLeadLifecycle("tour_scheduled"), true);
    assert.equal(isOpenLeadLifecycle("proposal_sent"), true);
    assert.equal(isOpenLeadLifecycle("enrolled_in_sequence"), true);
    assert.equal(isOpenLeadLifecycle("custom_anything"), true);
  });
});

describe("isOpenReportingCategory", () => {
  it("uses reporting categories, not venue stage names", () => {
    assert.equal(isOpenReportingCategory("inquiry"), true);
    assert.equal(isOpenReportingCategory("tour"), true);
    assert.equal(isOpenReportingCategory("proposal"), true);
    assert.equal(isOpenReportingCategory("decision"), true);
    assert.equal(isOpenReportingCategory("unmapped"), true);
    assert.equal(isOpenReportingCategory("booked"), false);
    assert.equal(isOpenReportingCategory("lost"), false);
    assert.equal(isOpenReportingCategory("cancelled"), false);
  });
});

describe("isOpenLeadOpportunity", () => {
  it("prefers canonical reporting category over sales_stage", () => {
    assert.equal(
      isOpenLeadOpportunity({ salesStage: "booked", canonicalStage: "decision" }),
      true,
    );
    assert.equal(
      isOpenLeadOpportunity({ salesStage: "new_inquiry", canonicalStage: "booked" }),
      false,
    );
    assert.equal(
      isOpenLeadOpportunity({ salesStage: "tour_scheduled" }),
      true,
    );
  });

  it("module executable body does not gate on client_id or exclude flag", () => {
    const src = readFileSync(path.join(root, "lib/leads/open-lifecycle.ts"), "utf8");
    const body = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(body, /client_id|exclude_from_business_reporting|excludeFromBusinessReporting/);
    assert.match(body, /isOpenReportingCategory|isOpenLeadLifecycle/);
  });
});
