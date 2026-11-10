/**
 * resolveUserTypeForProxy — venue vs vendor preference with multi-membership.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveUserTypeForProxy } from "./enforce-legal-in-proxy";

type StaffRow = {
  venue_id: string;
  role: string;
  is_owner: boolean;
  is_active: boolean;
};

function mockAdmin(input: {
  staffRows?: StaffRow[] | null;
  staffError?: { message: string; code?: string } | null;
  vendorIds?: string[];
}) {
  const staffRows = input.staffRows ?? [];
  const vendorIds = input.vendorIds ?? [];

  const staffBuilder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(
        resolve({
          data: input.staffError ? null : staffRows,
          error: input.staffError ?? null,
        }),
      );
    },
  };

  const vendorBuilder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    limit() {
      return this;
    },
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(
        resolve({
          data: vendorIds.map((vendor_id) => ({ vendor_id })),
          error: null,
        }),
      );
    },
  };

  return {
    from(table: string) {
      if (table === "venue_staff") return staffBuilder;
      if (table === "vendor_users") return vendorBuilder;
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as Parameters<typeof resolveUserTypeForProxy>[0];
}

describe("resolveUserTypeForProxy", () => {
  const multiStaff: StaffRow[] = [
    {
      venue_id: "venue-a",
      role: "owner",
      is_owner: true,
      is_active: true,
    },
    {
      venue_id: "venue-b",
      role: "manager",
      is_owner: false,
      is_active: true,
    },
  ];

  it("single-venue owner resolves to venue_owner on venue prefer", async () => {
    const admin = mockAdmin({
      staffRows: [multiStaff[0]!],
      vendorIds: [],
    });
    const resolved = await resolveUserTypeForProxy(admin, "u1", "venue", "venue-a");
    assert.deepEqual(resolved, {
      userType: "venue_owner",
      kind: "venue_staff",
    });
  });

  it("multi-venue staff resolves manager for active venue", async () => {
    const admin = mockAdmin({ staffRows: multiStaff, vendorIds: ["v1"] });
    const resolved = await resolveUserTypeForProxy(
      admin,
      "u1",
      "venue",
      "venue-b",
    );
    assert.deepEqual(resolved, {
      userType: "venue_manager",
      kind: "venue_staff",
    });
  });

  it("venue+vendor user on venue path does not fall through to vendor when multi-row", async () => {
    const admin = mockAdmin({ staffRows: multiStaff, vendorIds: ["v1"] });
    const resolved = await resolveUserTypeForProxy(admin, "u1", "venue", null);
    assert.equal(resolved.userType, "venue_owner");
    assert.equal(resolved.kind, "venue_owner_signup");
  });

  it("venue membership query error fails closed to venue_owner (not vendor)", async () => {
    const admin = mockAdmin({
      staffRows: null,
      staffError: { message: "multiple rows returned", code: "PGRST116" },
      vendorIds: ["v1"],
    });
    const resolved = await resolveUserTypeForProxy(admin, "u1", "venue", "venue-a");
    assert.deepEqual(resolved, {
      userType: "venue_owner",
      kind: "venue_owner_signup",
    });
  });

  it("valid vendor-only user stays vendor on vendor prefer", async () => {
    const admin = mockAdmin({ staffRows: [], vendorIds: ["v1"] });
    const resolved = await resolveUserTypeForProxy(admin, "u1", "vendor");
    assert.deepEqual(resolved, {
      userType: "vendor",
      kind: "vendor",
    });
  });

  it("venue-only zero staff can still reach vendor when prefer venue and vendor exists", async () => {
    const admin = mockAdmin({ staffRows: [], vendorIds: ["v1"] });
    const resolved = await resolveUserTypeForProxy(admin, "u1", "venue", null);
    assert.deepEqual(resolved, {
      userType: "vendor",
      kind: "vendor",
    });
  });

  it("outdated acceptance still maps venue_owner so Welcome can require VSA", async () => {
    const admin = mockAdmin({
      staffRows: multiStaff,
      vendorIds: ["v1"],
    });
    const resolved = await resolveUserTypeForProxy(
      admin,
      "u1",
      "venue",
      "venue-a",
    );
    assert.equal(resolved.userType, "venue_owner");
  });
});
