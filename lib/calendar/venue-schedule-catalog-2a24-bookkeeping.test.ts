/**
 * Calendar Slice 2A.2.4 — Sandbox apply bookkeeping for catalog migrations.
 *
 * Does not write schema_migrations. Verifies apply-sandbox-migrations.sh will
 * parse version+name correctly and that these timestamps are not collision cases.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { describe, it } from "node:test";

const MIGRATIONS_DIR = resolve("supabase/migrations");
const APPLY_SCRIPT = resolve("apply-sandbox-migrations.sh");

const CATALOG_MIGRATIONS = [
  {
    file: "20261352000000_venue_schedule_item_types_catalog.sql",
    version: "20261352000000",
    name: "venue_schedule_item_types_catalog",
  },
  {
    file: "20261353000000_venue_schedule_item_types_custom_label_unique.sql",
    version: "20261353000000",
    name: "venue_schedule_item_types_custom_label_unique",
  },
  {
    file: "20261354000000_calendar_blocks_custom_requires_catalog_fk.sql",
    version: "20261354000000",
    name: "calendar_blocks_custom_requires_catalog_fk",
  },
] as const;

describe("Calendar catalog migration bookkeeping", () => {
  it("catalog migration filenames parse to unique version+name pairs for apply-sandbox-migrations.sh", () => {
    const applySrc = readFileSync(APPLY_SCRIPT, "utf8");
    assert.match(applySrc, /schema_migrations/);
    assert.match(applySrc, /insert into supabase_migrations\.schema_migrations \(version, name\)/);
    assert.match(applySrc, /on conflict \(version\) do nothing/);
    assert.match(
      applySrc,
      /select 1 from supabase_migrations\.schema_migrations where version = '\$version' and name = '\$name'/,
    );

    const knownCollisionsMatch = applySrc.match(/KNOWN_COLLISIONS="([^"]+)"/);
    assert.ok(knownCollisionsMatch);
    const known = new Set(knownCollisionsMatch![1].split(/\s+/).filter(Boolean));

    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    for (const expected of CATALOG_MIGRATIONS) {
      assert.equal(files.includes(expected.file), true, expected.file);
      const version = basename(expected.file).replace(/^([0-9]+)_.*/, "$1");
      const name = basename(expected.file).replace(/^[0-9]+_(.*)\.sql$/, "$1");
      assert.equal(version, expected.version);
      assert.equal(name, expected.name);
      assert.equal(known.has(version), false, `${version} must not be a known collision`);
      const sameVersion = files.filter((f) => f.startsWith(`${version}_`));
      assert.equal(sameVersion.length, 1, `${version} must be unique on disk`);
    }
  });

  it("verify-sandbox-migrations.sh checks catalog tracking rows after apply", () => {
    const verifySrc = readFileSync(resolve("verify-sandbox-migrations.sh"), "utf8");
    assert.match(verifySrc, /20261352000000/);
    assert.match(verifySrc, /20261353000000/);
    assert.match(verifySrc, /20261354000000/);
    assert.match(verifySrc, /venue_schedule_item_types_catalog/);
    assert.match(verifySrc, /calendar_blocks_custom_requires_catalog_fk/);
  });
});
