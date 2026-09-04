/**
 * Local DB test helper: apply SQL migration files under the shared schema
 * lock, then ensure migration_records.target_entity_type_check is never
 * narrower than (a) values already present in the table and (b) the union of
 * every checked vocabulary declared in repo migration files.
 *
 * Why: parallel DB tests re-apply foundational cutover SQL. Even when those
 * files are written to be monotonic, a stale/partial apply or an older test
 * fixture must not leave sibling suites unable to keep newer entity rows
 * (timeline_entry, floor_plan, …). This is harness isolation — production
 * migration semantics are unchanged.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { withLocalDbSchemaLock, withLocalDbSchemaLockSync } from "@/lib/test/local-db-schema-lock";

const DEFAULT_LOCAL_DB = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const MIGRATIONS_DIR = resolve("supabase/migrations");

const ENTITY_IN_CHECK_RE =
  /migration_records_target_entity_type_check[\s\S]*?check\s*\(\s*target_entity_type\s+in\s*\(([^)]+)\)/gi;

function psql(dbUrl: string, args: string[], sqlOrFile: { sql?: string; file?: string }): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const cmdArgs = [dbUrl, "-v", "ON_ERROR_STOP=1", ...args];
  if (sqlOrFile.file) cmdArgs.push("-f", sqlOrFile.file);
  if (sqlOrFile.sql) cmdArgs.push("-c", sqlOrFile.sql);
  const result = spawnSync("psql", cmdArgs, { encoding: "utf8", timeout: 60_000 });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/** Collect every entity literal that any migration file has ever listed in the check. */
export function collectDeclaredMigrationEntityTypes(migrationsDir = MIGRATIONS_DIR): string[] {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  const found = new Set<string>();
  for (const file of files) {
    const src = readFileSync(join(migrationsDir, file), "utf8");
    for (const match of src.matchAll(ENTITY_IN_CHECK_RE)) {
      const body = match[1] ?? "";
      for (const lit of body.matchAll(/'([^']+)'/g)) {
        if (lit[1]) found.add(lit[1]);
      }
    }
  }
  return [...found].sort();
}

/**
 * Re-apply the check as the union of declared vocabulary + distinct values
 * already stored. Never removes a value the table or migration corpus needs.
 */
export function ensureMigrationRecordsEntityCheckMonotonic(dbUrl = DEFAULT_LOCAL_DB): void {
  const declared = collectDeclaredMigrationEntityTypes();
  assert.ok(declared.length > 0, "expected at least one migration_records entity check in supabase/migrations");

  const tableCheck = psql(dbUrl, ["-tA"], {
    sql: `select to_regclass('public.migration_records') is not null`,
  });
  if (tableCheck.status !== 0 || !/t/.test(tableCheck.stdout)) {
    return;
  }

  const distinct = psql(dbUrl, ["-tA"], {
    sql: `select coalesce(string_agg(quote_literal(d), ','), '')
          from (select distinct target_entity_type as d from public.migration_records) s`,
  });
  assert.equal(distinct.status, 0, distinct.stderr || distinct.stdout);

  const fromRows = (distinct.stdout.match(/'[^']+'/g) ?? []).map((s) => s.slice(1, -1));
  const union = [...new Set([...declared, ...fromRows])].sort();
  const inList = union.map((e) => `'${e.replace(/'/g, "''")}'`).join(", ");

  const repair = psql(dbUrl, [], {
    sql: `
      alter table public.migration_records
        drop constraint if exists migration_records_target_entity_type_check;
      alter table public.migration_records
        add constraint migration_records_target_entity_type_check
        check (target_entity_type in (${inList}));
    `,
  });
  assert.equal(repair.status, 0, repair.stderr || repair.stdout);
}

export function applyLocalMigrationFiles(
  files: readonly string[],
  opts?: { dbUrl?: string; alreadyHoldingLock?: boolean },
): void {
  const dbUrl = opts?.dbUrl ?? DEFAULT_LOCAL_DB;
  const run = () => {
    for (const file of files) {
      const applied = psql(dbUrl, [], { file });
      assert.equal(applied.status, 0, `${file}: ${applied.stderr || applied.stdout}`);
    }
    ensureMigrationRecordsEntityCheckMonotonic(dbUrl);
  };
  if (opts?.alreadyHoldingLock) {
    run();
    return;
  }
  withLocalDbSchemaLockSync(run);
}

export async function applyLocalMigrationFilesAsync(
  files: readonly string[],
  opts?: { dbUrl?: string; alreadyHoldingLock?: boolean },
): Promise<void> {
  const dbUrl = opts?.dbUrl ?? DEFAULT_LOCAL_DB;
  const run = () => {
    for (const file of files) {
      const applied = psql(dbUrl, [], { file });
      assert.equal(applied.status, 0, `${file}: ${applied.stderr || applied.stdout}`);
    }
    ensureMigrationRecordsEntityCheckMonotonic(dbUrl);
  };
  if (opts?.alreadyHoldingLock) {
    run();
    return;
  }
  await withLocalDbSchemaLock(async () => {
    run();
  });
}
