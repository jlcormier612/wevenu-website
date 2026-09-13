import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BRING_YOUR_BUSINESS_ROUTES, evaluateCutoverPrerequisites } from "./bring-your-business";
import { isPreGraduationAllowedPath } from "./pre-graduation-paths";

describe("Bring Your Business Hub routing", () => {
  it("sends system switchers to Migration Center, not CSV Import", () => {
    assert.equal(BRING_YOUR_BUSINESS_ROUTES.migrationCenter, "/settings/migration");
    assert.notEqual(
      BRING_YOUR_BUSINESS_ROUTES.migrationCenter,
      BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport,
    );
  });

  it("keeps spreadsheet import on the existing CSV Import path", () => {
    assert.equal(BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport, "/settings/import");
  });

  it("both destinations remain reachable under the pre-graduation gate", () => {
    assert.equal(isPreGraduationAllowedPath(BRING_YOUR_BUSINESS_ROUTES.migrationCenter), true);
    assert.equal(isPreGraduationAllowedPath(BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport), true);
    assert.equal(isPreGraduationAllowedPath("/dashboard"), false);
  });
});

describe("evaluateCutoverPrerequisites", () => {
  it("blocks dated Events when multi-space capacity has no spaces", () => {
    const r = evaluateCutoverPrerequisites({ spacesCount: 0, hasCapacityRules: true, maxSimultaneousEvents: 2 });
    assert.equal(r.readyForDatedEvents, false);
    assert.match(r.message ?? "", /Event Spaces/i);
  });

  it("allows import when single-space capacity and no spaces yet", () => {
    const r = evaluateCutoverPrerequisites({ spacesCount: 0, hasCapacityRules: false, maxSimultaneousEvents: 1 });
    assert.equal(r.readyForDatedEvents, true);
  });

  it("allows dated Events once a multi-space venue has spaces", () => {
    const r = evaluateCutoverPrerequisites({ spacesCount: 2, hasCapacityRules: true, maxSimultaneousEvents: 2 });
    assert.equal(r.readyForDatedEvents, true);
    assert.equal(r.message, null);
  });
});

describe("Setup Hub stage order — Calendar before Bring Your Business", () => {
  it("lists calendar-availability before bring-your-business in the overview", () => {
    const src = readFileSync(join(process.cwd(), "components/setup-hub/setup-hub-overview.tsx"), "utf8");
    const cal = src.indexOf('key: "calendar-availability"');
    const byb = src.indexOf('key: "bring-your-business"');
    assert.ok(cal > 0 && byb > 0);
    assert.ok(cal < byb, "Calendar & Availability must precede Bring Your Business");
  });
});

describe("Bring Your Business choices — three equal paths", () => {
  it("persists individual and skipped, and routes Import / individual / skip without forcing Migration", () => {
    const src = readFileSync(join(process.cwd(), "components/setup-hub/bring-your-business-choices.tsx"), "utf8");
    assert.match(src, /Import my business/);
    assert.match(src, /Add things individually/);
    assert.match(src, /starting fresh|Skip for now/i);
    assert.match(src, /setBringYourBusinessPathAction\("individual"\)/);
    assert.match(src, /setBringYourBusinessPathAction\("skipped"\)/);
    assert.match(src, /spreadsheetImport|\/settings\/import/);
  });
});
