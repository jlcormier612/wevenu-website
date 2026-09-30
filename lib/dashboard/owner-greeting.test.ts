import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { resolveDashboardOwnerFirstName } from "./owner-greeting.ts";

describe("dashboard owner greeting — multi-owner regression", () => {
  const fancyTwoOwners = [
    {
      full_name: "Jen Fancy",
      title: null,
      accepted_at: "2026-09-22T00:27:26.23007+00:00",
      owner_invite_pending: false,
      user_id: "linked-owner-user-id",
    },
    {
      full_name: "Ron Cormier",
      title: null,
      accepted_at: null,
      owner_invite_pending: true,
      user_id: null,
    },
  ];

  it("prefers accepted/linked owner first name when a pending owner invite also exists", () => {
    assert.equal(resolveDashboardOwnerFirstName(fancyTwoOwners), "Jen");
  });

  it("still personalizes when the pending invite is listed first", () => {
    assert.equal(resolveDashboardOwnerFirstName([...fancyTwoOwners].reverse()), "Jen");
  });

  it("does not let the pending owner displace the accepted owner", () => {
    const name = resolveDashboardOwnerFirstName(fancyTwoOwners);
    assert.notEqual(name, null);
    assert.notEqual(name, "Ron");
    assert.equal(name, "Jen");
  });

  it("falls back to null when no usable owner full_name exists", () => {
    assert.equal(resolveDashboardOwnerFirstName([]), null);
    assert.equal(resolveDashboardOwnerFirstName(null), null);
    assert.equal(
      resolveDashboardOwnerFirstName([{ full_name: "   ", owner_invite_pending: false, user_id: "x", accepted_at: "2026-01-01" }]),
      null,
    );
  });

  it("keeps first-token extraction from full_name", () => {
    assert.equal(
      resolveDashboardOwnerFirstName([
        {
          full_name: "Jen Fancy",
          accepted_at: "2026-01-01",
          owner_invite_pending: false,
          user_id: "x",
        },
      ]),
      "Jen",
    );
  });

  it("does not use bare maybeSingle on is_owner in getDashboardData", () => {
    const service = readFileSync(resolve("lib/dashboard/service.ts"), "utf8");
    assert.match(service, /resolveDashboardOwnerFirstName/);
    // The historical failure mode: .eq("is_owner", true).maybeSingle()
    assert.doesNotMatch(
      service,
      /\.eq\(\s*["']is_owner["']\s*,\s*true\s*\)\s*\n?\s*\.maybeSingle/,
    );
    assert.doesNotMatch(service, /is_owner", true\)\s*\.maybeSingle/);
  });
});
