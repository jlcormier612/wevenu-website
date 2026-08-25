import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPreGraduationAllowedPath } from "./pre-graduation-paths";

describe("isPreGraduationAllowedPath — Setup Hub destinations before graduation", () => {
  it("allows Setup Hub itself and nested stages", () => {
    assert.equal(isPreGraduationAllowedPath("/setup-hub"), true);
    assert.equal(isPreGraduationAllowedPath("/setup-hub/lead-capture"), true);
    assert.equal(isPreGraduationAllowedPath("/setup-hub/financials"), true);
  });

  it("allows Venue Settings, Availability, Import, Migration Center, and Team", () => {
    assert.equal(isPreGraduationAllowedPath("/settings/business"), true);
    assert.equal(isPreGraduationAllowedPath("/settings/availability"), true);
    assert.equal(isPreGraduationAllowedPath("/settings/import"), true);
    assert.equal(isPreGraduationAllowedPath("/settings/migration"), true);
    assert.equal(isPreGraduationAllowedPath("/settings/team"), true);
    assert.equal(isPreGraduationAllowedPath("/settings"), true);
  });

  it("allows Library / Packages (and other library routes stages link to)", () => {
    assert.equal(isPreGraduationAllowedPath("/library"), true);
    assert.equal(isPreGraduationAllowedPath("/library/packages"), true);
  });

  it("allows Help & Guides articles linked from stage copy", () => {
    assert.equal(
      isPreGraduationAllowedPath("/help/getting-started-what-to-set-up-before-i-start"),
      true,
    );
  });

  it("still gates operational workspace areas", () => {
    for (const path of [
      "/dashboard",
      "/leads",
      "/clients",
      "/tours",
      "/messaging",
      "/contracts",
      "/calendar",
      "/reporting",
      "/tasks",
      "/invoices",
      "/payments",
      "/vendors",
    ]) {
      assert.equal(isPreGraduationAllowedPath(path), false, path);
    }
  });

  it("does not treat lookalike prefixes as allowed", () => {
    assert.equal(isPreGraduationAllowedPath("/setup-hubber"), false);
    assert.equal(isPreGraduationAllowedPath("/settings-extra"), false);
    assert.equal(isPreGraduationAllowedPath("/librarything"), false);
  });

  it("fails closed on empty or non-path input", () => {
    assert.equal(isPreGraduationAllowedPath(""), false);
    assert.equal(isPreGraduationAllowedPath("setup-hub"), false);
  });
});
