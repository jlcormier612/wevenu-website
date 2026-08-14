import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BROCHURE_STARTER_MASTERS,
  shouldSkipBrochureStarterProvision,
} from "@/lib/brochures/starters";
import {
  SAVED_REPORT_STARTER_MASTERS,
  shouldSkipSavedReportStarterProvision,
} from "@/lib/saved-reports/starters";
import { SAVED_REPORT_PATHS } from "@/lib/saved-reports/types";

describe("brochure starters", () => {
  it("ships exactly one Venue Overview master", () => {
    assert.equal(BROCHURE_STARTER_MASTERS.length, 1);
    assert.equal(BROCHURE_STARTER_MASTERS[0].key, "BR-01");
    assert.equal(BROCHURE_STARTER_MASTERS[0].name, "Venue Overview");
  });

  it("uses live packages/FAQs flags without inventing venue claims", () => {
    const m = BROCHURE_STARTER_MASTERS[0];
    assert.equal(m.includePackages, true);
    assert.equal(m.includeFaqs, true);
    assert.match(m.welcomeText, /Hello to Cheers/i);
    assert.doesNotMatch(m.welcomeText, /\$\d|cancellation|insurance|capacity of/i);
  });

  it("skips by key and same name", () => {
    assert.equal(
      shouldSkipBrochureStarterProvision({
        masterKey: "BR-01",
        masterName: "Venue Overview",
        existingByKey: new Set(["BR-01"]),
        existingNames: new Set(),
      }),
      "skip_key",
    );
    assert.equal(
      shouldSkipBrochureStarterProvision({
        masterKey: "BR-01",
        masterName: "Venue Overview",
        existingByKey: new Set(),
        existingNames: new Set(["Venue Overview"]),
      }),
      "skip_name",
    );
    assert.equal(
      shouldSkipBrochureStarterProvision({
        masterKey: "BR-01",
        masterName: "Venue Overview",
        existingByKey: new Set(),
        existingNames: new Set(),
      }),
      "create",
    );
  });
});

describe("saved report starters", () => {
  it("ships Sales, Bookings, Revenue, Events over canonical paths", () => {
    assert.equal(SAVED_REPORT_STARTER_MASTERS.length, 4);
    const paths = SAVED_REPORT_STARTER_MASTERS.map((m) => m.reportPath);
    assert.deepEqual(paths, [
      "/reporting/sales",
      "/reporting/bookings",
      "/reporting/revenue",
      "/reporting/events",
    ]);
    for (const p of paths) {
      assert.ok((SAVED_REPORT_PATHS as readonly string[]).includes(p));
    }
  });

  it("does not invent custom metric paths", () => {
    for (const m of SAVED_REPORT_STARTER_MASTERS) {
      assert.ok(m.reportPath.startsWith("/reporting/"));
      assert.equal(m.datePreset, "this_month");
    }
  });

  it("skips by key and same name", () => {
    assert.equal(
      shouldSkipSavedReportStarterProvision({
        masterKey: "SR-SALES",
        masterName: "Sales",
        existingByKey: new Set(["SR-SALES"]),
        existingNames: new Set(),
      }),
      "skip_key",
    );
    assert.equal(
      shouldSkipSavedReportStarterProvision({
        masterKey: "SR-SALES",
        masterName: "Sales",
        existingByKey: new Set(),
        existingNames: new Set(["Sales"]),
      }),
      "skip_name",
    );
  });
});
