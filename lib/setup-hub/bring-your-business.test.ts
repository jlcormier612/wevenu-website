import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BRING_YOUR_BUSINESS_ROUTES } from "./bring-your-business";
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
