import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const root = resolve(process.cwd());

describe("engineering cleanup — silent-false-success deletes", () => {
  it("vendor assignment delete checks rows-affected before side effects", () => {
    const repo = readFileSync(resolve(root, "lib/vendors/repository.ts"), "utf8");
    const svc = readFileSync(resolve(root, "lib/vendors/service.ts"), "utf8");

    assert.match(repo, /deleteVendorAssignment[\s\S]*?\.select\("id"\)/);
    assert.match(repo, /data\.length === 0/);

    const removeStart = svc.indexOf("export async function removeVendorAssignment");
    const removeEnd = svc.indexOf("export async function updateVendorAssignment_", removeStart);
    const body = svc.slice(removeStart, removeEnd);
    assert.match(body, /deleteVendorAssignment/);
    assert.match(body, /if \(!deleted\.ok\)/);
    // Side effects must follow a successful delete, not precede it.
    const deleteIdx = body.indexOf("deleteVendorAssignment");
    const approveIdx = body.indexOf("approvePendingRequestsForAssignment");
    const clearIdx = body.indexOf("clearAssignmentBooked");
    assert.ok(deleteIdx >= 0 && approveIdx > deleteIdx && clearIdx > deleteIdx);
  });

  it("event team delete checks rows-affected before activity logging", () => {
    const repo = readFileSync(resolve(root, "lib/events/repository.ts"), "utf8");
    const svc = readFileSync(resolve(root, "lib/events/service.ts"), "utf8");
    assert.match(repo, /deleteTeamMember[\s\S]*?\.select\("id"\)/);
    assert.match(svc, /removeTeamMember[\s\S]*?if \(!deleted\.ok\)/);
  });

  it("note and lead-task deletes check rows-affected", () => {
    for (const [file, fn] of [
      ["lib/clients/repository.ts", "deleteClientNote"],
      ["lib/events/repository.ts", "deleteEventNote"],
      ["lib/leads/repository.ts", "deleteNote"],
      ["lib/leads/repository.ts", "deleteTask"],
    ] as const) {
      const src = readFileSync(resolve(root, file), "utf8");
      const start = src.indexOf(`export async function ${fn}`);
      assert.ok(start >= 0, `${fn} missing in ${file}`);
      const body = src.slice(start, start + 500);
      assert.match(body, /\.select\("id"\)/);
      assert.match(body, /data\.length === 0/);
    }
  });
});

describe("engineering cleanup — active commitment booked_at boundary", () => {
  it("stamps events.booked_at only after a successful commitment write", () => {
    const src = readFileSync(resolve(root, "lib/migration/active-commitment.ts"), "utf8");
    const commitStart = src.indexOf("export async function commitActiveCommitment");
    const tryIdx = src.indexOf("\n  try {", commitStart);
    const catchIdx = src.indexOf("\n  } catch (err) {", tryIdx);
    const createPath = src.slice(tryIdx, catchIdx);
    assert.match(createPath, /ensureEventBookedAt/);
    assert.match(createPath, /Doing this before the try left booked_at set when compensation rolled back/);
    // Create-path stamp must happen after financial/document writes, not before them.
    assert.ok(
      createPath.indexOf('failAfterHook(opts, "document")') < createPath.indexOf("ensureEventBookedAt"),
      "create-path booked_at must stamp after document step",
    );
  });
});

describe("engineering cleanup — analytics venue staff resolution", () => {
  it("migration rewrites owner-only RPCs to current_user_venue_id()", () => {
    const sql = readFileSync(
      resolve(root, "supabase/migrations/20261390000000_analytics_venue_staff_resolution.sql"),
      "utf8",
    );
    assert.match(sql, /get_venue_analytics\(\)/);
    assert.match(sql, /get_client_health_scores\(\)/);
    assert.match(sql, /save_luv_rollup/);
    assert.match(sql, /get_luv_rollups/);
    assert.match(sql, /current_user_venue_id\(\)/);
    assert.match(sql, /Failed to rewrite venue resolution/);
  });
});

describe("engineering cleanup — Luv roll-up prefers canonical metrics", () => {
  it("buildPromptData prefers bookingConversionRate and totalCollectedCanonical", () => {
    const src = readFileSync(resolve(root, "lib/luv/roll-up-service.ts"), "utf8");
    assert.match(src, /bookingConversionRate \?\? leadFunnel\.conversionRate/);
    assert.match(src, /totalCollectedCanonical \?\? payments\.totalCollected/);
  });
});

describe("engineering cleanup — dashboard dead recentBookings removed", () => {
  it("DashboardData no longer carries unused recentBookings / totalClients", () => {
    const types = readFileSync(resolve(root, "lib/dashboard/types.ts"), "utf8");
    const svc = readFileSync(resolve(root, "lib/dashboard/service.ts"), "utf8");
    assert.doesNotMatch(types, /recentBookings/);
    assert.doesNotMatch(types, /totalClients/);
    assert.doesNotMatch(types, /DashboardClient/);
    assert.doesNotMatch(svc, /recentBookings/);
    assert.match(svc, /\.limit\(200\)/);
    assert.match(svc, /\.limit\(100\)/);
  });

  it("dead RecentBookingsWidget component is removed", () => {
    assert.throws(() => readFileSync(resolve(root, "components/dashboard/recent-bookings-widget.tsx"), "utf8"));
  });
});
