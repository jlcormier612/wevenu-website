/**
 * Live DB/PostgREST-equivalent RLS tests for Floor Plan Phase 1 permissions.
 * Applies the staff write-gate migration under the shared local DB schema lock,
 * then runs a begin/rollback SQL matrix as authenticated JWT members.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

import { withLocalDbSchemaLockSync } from "@/lib/test/local-db-schema-lock";

const LOCAL_URL = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MIGRATION = resolve("supabase/migrations/20261329000000_floor_plan_staff_write_gates.sql");
const CASES = resolve("lib/floor-plans/staff-write-gates.db.sql");

function psql(args: string[], extra?: { timeoutMs?: number }): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("psql", [LOCAL_URL, "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
    timeout: extra?.timeoutMs ?? 60_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`,
  };
}

function localDbAvailable(): boolean {
  const probe = psql(["-c", "select 1"], { timeoutMs: 3000 });
  return probe.status === 0;
}

function applyMigration(): void {
  // Make re-runs under the shared lock idempotent (CREATE POLICY is not).
  const dropNew = `
    drop policy if exists floor_plans_staff_insert_gate on public.floor_plans;
    drop policy if exists floor_plans_staff_update_gate on public.floor_plans;
    drop policy if exists floor_plan_objects_staff_insert_gate on public.floor_plan_objects;
    drop policy if exists floor_plan_objects_staff_update_gate on public.floor_plan_objects;
    drop policy if exists floor_plan_templates_staff_insert_gate on public.floor_plan_templates;
    drop policy if exists floor_plan_templates_staff_update_gate on public.floor_plan_templates;
    drop policy if exists floor_plan_template_objects_staff_insert_gate on public.floor_plan_template_objects;
    drop policy if exists floor_plan_template_objects_staff_update_gate on public.floor_plan_template_objects;
    drop policy if exists event_floor_plan_offers_staff_insert_gate on public.event_floor_plan_offers;
    drop policy if exists event_floor_plan_offers_staff_update_gate on public.event_floor_plan_offers;
    drop policy if exists event_floor_plan_offers_staff_delete_gate on public.event_floor_plan_offers;
    drop policy if exists floor_plan_template_objects_delete_gate on public.floor_plan_template_objects;
  `;
  const prep = psql(["-c", dropNew]);
  assert.equal(prep.status, 0, prep.stderr || prep.stdout);

  let last = { status: 1 as number | null, stdout: "", stderr: "" };
  for (let attempt = 0; attempt < 6; attempt++) {
    last = psql(["-f", MIGRATION]);
    if (last.status === 0) return;
    if (!/tuple concurrently updated|deadlock detected/i.test(`${last.stderr}\n${last.stdout}`)) break;
  }
  assert.equal(last.status, 0, last.stderr || last.stdout);
}

describe("floor plan staff write gates live database", () => {
  it("applies RESTRICTIVE Staff gates and proves the role matrix via authenticated JWT", (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }

    withLocalDbSchemaLockSync(() => {
      applyMigration();

      const policyCheck = psql([
        "-qAt",
        "-c",
        `
          select string_agg(polname, ',' order by polname)
          from pg_policy
          where polrelid = 'public.floor_plans'::regclass;
        `,
      ]);
      assert.equal(policyCheck.status, 0, policyCheck.stderr);
      const names = policyCheck.stdout.trim();
      assert.match(names, /floor_plans_all/);
      assert.match(names, /floor_plans_delete_gate/);
      assert.match(names, /floor_plans_staff_insert_gate/);
      assert.match(names, /floor_plans_staff_update_gate/);

      const objDelete = psql([
        "-qAt",
        "-c",
        `
          select pg_get_expr(polqual, polrelid)
          from pg_policy
          where polrelid = 'public.floor_plan_objects'::regclass
            and polname = 'floor_plan_objects_delete_gate';
        `,
      ]);
      assert.equal(objDelete.status, 0, objDelete.stderr);
      assert.match(objDelete.stdout, /coordinator/);

      const cases = readFileSync(CASES, "utf8");
      const run = psql(["-c", `begin;\n${cases}\nrollback;`], { timeoutMs: 60_000 });
      assert.equal(run.status, 0, run.stderr || run.stdout);
      const notice = `${run.stderr}\n${run.stdout}`;
      assert.match(notice, /FLOOR_PLAN_RLS_OK/);
      t.diagnostic(notice.split("\n").find((l) => l.includes("FLOOR_PLAN_RLS_OK") || l.includes("NOTICE")) ?? "ok");
    });
  });
});
