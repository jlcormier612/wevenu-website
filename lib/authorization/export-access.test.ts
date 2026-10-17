import assert from "node:assert/strict";
import test from "node:test";

import { canExportVenueData } from "@/lib/authorization/export-access";
import type { MembershipAccessInput } from "@/lib/authorization/types";

function member(overrides: Partial<MembershipAccessInput> = {}): MembershipAccessInput {
  return {
    isActive: true,
    isOwner: false,
    accessTitle: "staff",
    titleBasis: null,
    overrides: {},
    ...overrides,
  };
}

test("owner can export even without the capability and on a non-admin title", () => {
  assert.equal(canExportVenueData(member({ isOwner: true, accessTitle: "staff" })), true);
  assert.equal(
    canExportVenueData(member({
      isOwner: true,
      accessTitle: "manager",
      overrides: { "data.export": false },
    })),
    true,
  );
});

test("administrator can export even when the capability override is off", () => {
  assert.equal(canExportVenueData(member({ accessTitle: "administrator" })), true);
  assert.equal(
    canExportVenueData(member({
      accessTitle: "administrator",
      overrides: { "data.export": false },
    })),
    true,
  );
  assert.equal(
    canExportVenueData(member({
      accessTitle: "custom",
      titleBasis: "administrator",
      overrides: { "data.export": false },
    })),
    true,
  );
});

test("other titles export only with an explicit grant", () => {
  for (const accessTitle of ["manager", "coordinator", "staff", "view_only"] as const) {
    assert.equal(canExportVenueData(member({ accessTitle })), false, accessTitle);
    assert.equal(
      canExportVenueData(member({ accessTitle, overrides: { "data.export": true } })),
      true,
      accessTitle,
    );
  }
});

test("inactive members cannot export", () => {
  assert.equal(canExportVenueData(member({ isActive: false, isOwner: true })), false);
  assert.equal(
    canExportVenueData(member({ isActive: false, accessTitle: "administrator" })),
    false,
  );
});
