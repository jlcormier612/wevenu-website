import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectDeclaredMigrationEntityTypes } from "@/lib/test/apply-local-migrations";

describe("collectDeclaredMigrationEntityTypes", () => {
  it("unions every entity literal from migration_records check constraints", () => {
    const declared = collectDeclaredMigrationEntityTypes();
    for (const entity of [
      "client",
      "active_commitment",
      "guest_list",
      "event_vendor_assignment",
      "timeline_entry",
      "floor_plan",
    ]) {
      assert.ok(declared.includes(entity), `missing ${entity}`);
    }
  });
});
