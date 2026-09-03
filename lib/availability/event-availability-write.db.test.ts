import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";

const LOCAL_URL = process.env.HTC_LOCAL_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const PHASE2 = resolve("supabase/migrations/20261316000000_event_availability_assert.sql");
const PHASE3 = resolve("supabase/migrations/20261317000000_event_availability_write_enforcement.sql");
const TURNAROUND = resolve("supabase/migrations/20261319000000_event_turnaround_enforcement.sql");
const CORRECTION = resolve("supabase/migrations/20261320000000_availability_correction_pass.sql");
const RECURRENCE = resolve("supabase/migrations/20261321000000_calendar_block_recurrence_coverage.sql");
const CASES = resolve("lib/availability/event-availability-write.db.sql");
const DIRECT_ADD = resolve("lib/availability/direct-add-transactional.db.sql");

function psql(args: string[], extra?: { timeoutMs?: number }): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("psql", [LOCAL_URL, "-v", "ON_ERROR_STOP=1", ...args], {
    encoding: "utf8",
    timeout: extra?.timeoutMs ?? 45_000,
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

function applySql(file: string): void {
  let last = { status: 1 as number | null, stdout: "", stderr: "" };
  for (let attempt = 0; attempt < 6; attempt++) {
    last = psql(["-f", file]);
    if (last.status === 0) return;
    if (!/tuple concurrently updated|deadlock detected/i.test(`${last.stderr}\n${last.stdout}`)) break;
  }
  assert.equal(last.status, 0, last.stderr || last.stdout);
}

function applyPhase3(): void {
  applySql(PHASE2);
  applySql(PHASE3);
  applySql(TURNAROUND);
  applySql(CORRECTION);
  applySql(RECURRENCE);
}

function withSchemaLock<T>(fn: () => T): T {
  const dir = join(tmpdir(), "wevenu-k7-avail-schema.lock");
  const started = Date.now();
  while (true) {
    try {
      mkdirSync(dir);
      break;
    } catch {
      if (Date.now() - started > 90_000) throw new Error("timed out waiting for k7 availability schema lock");
      spawnSync("sleep", ["0.2"]);
    }
  }
  try {
    return fn();
  } finally {
    try { rmdirSync(dir); } catch { /* ignore */ }
  }
}

function runPsql(sql: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn("psql", [LOCAL_URL, "-v", "ON_ERROR_STOP=1", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += String(d); });
    child.stderr.on("data", (d) => { stderr += String(d); });
    child.on("close", (status) => resolvePromise({ status, stdout, stderr }));
  });
}

describe("event write enforcement live database", () => {
  it("CREATE/EDIT/booking writes cover all occupancy decisions and leave failed edits unchanged", (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    withSchemaLock(() => {
      applyPhase3();
      const cases = readFileSync(CASES, "utf8");
      const run = psql(["-c", `begin;\n${cases}\nrollback;`]);
      assert.equal(run.status, 0, run.stderr || run.stdout);
    });
  });

  it("Direct Add Client+Event refusal leaves no Client under authenticated JWT context", (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    withSchemaLock(() => {
      applyPhase3();
      const cases = readFileSync(DIRECT_ADD, "utf8");
      const run = psql(["-c", `begin;\n${cases}\nrollback;`]);
      assert.equal(run.status, 0, run.stderr || run.stdout);
    });
  });

  it("two concurrent inserts of the same simple-venue slot cannot both succeed", async (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    withSchemaLock(() => { applyPhase3(); });

    const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee2";
    const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee3";
    const setup = psql(["-c", `
      delete from public.venues where id = '${venueId}';
      delete from auth.users where id = '${ownerId}';
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
        'k7-phase3-lock@example.test', crypt('not-a-login', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}', '{}',
        now(), now(), '', '', '', ''
      );
      insert into public.venues (id, owner_user_id, name)
      values ('${venueId}', '${ownerId}', 'K7 Phase3 Lock Venue');
    `]);
    assert.equal(setup.status, 0, setup.stderr || setup.stdout);

    try {
      const holder = spawn("psql", [
        LOCAL_URL, "-v", "ON_ERROR_STOP=1", "-c", `
          begin;
          insert into public.events (venue_id, name, event_date, status)
          values ('${venueId}', 'Holder', '2099-01-15', 'draft');
          select pg_sleep(20);
          rollback;
        `,
      ], { stdio: ["ignore", "pipe", "pipe"] });

      const lockSql = `
        select count(*)::int
        from pg_locks
        where locktype = 'advisory'
          and granted
          and classid = hashtext('${venueId}')
          and objid = hashtext('2099-01-15');
      `;
      const waitStarted = Date.now();
      let held = false;
      while (Date.now() - waitStarted < 5000) {
        const probe = psql(["-qAt", "-c", lockSql], { timeoutMs: 3000 });
        if (probe.status === 0 && Number.parseInt(probe.stdout.trim(), 10) >= 1) {
          held = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.ok(held, "insert trigger never published a venue-day advisory lock");

      const waiter = psql([
        "-c", `
          set lock_timeout = '2s';
          insert into public.events (venue_id, name, event_date, status)
          values ('${venueId}', 'Waiter', '2099-01-15', 'draft');
        `,
      ], { timeoutMs: 8000 });

      holder.kill("SIGTERM");
      await new Promise<void>((resolveWait) => {
        if (holder.exitCode != null) {
          resolveWait();
          return;
        }
        holder.once("exit", () => resolveWait());
        setTimeout(() => {
          holder.kill("SIGKILL");
          resolveWait();
        }, 2000);
      });

      const output = `${waiter.stdout}\n${waiter.stderr}`;
      assert.ok(
        waiter.status !== 0 && /lock timeout|canceling statement due to lock timeout|already booked/i.test(output),
        `second insert must not succeed while the first transaction holds the slot, got status=${waiter.status} output=${output}`,
      );
    } finally {
      psql(["-c", `
        delete from public.venues where id = '${venueId}';
        delete from auth.users where id = '${ownerId}';
      `]);
    }
  });

  it("two concurrent Events cannot both pass a 12-hour turnaround gap", async (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    withSchemaLock(() => { applyPhase3(); });

    const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee40";
    const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee41";
    const setup = psql(["-c", `
      delete from public.venues where id = '${venueId}';
      delete from auth.users where id = '${ownerId}';
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000', '${ownerId}', 'authenticated', 'authenticated',
        'k7-turnaround-race@example.test', crypt('not-a-login', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}', '{}',
        now(), now(), '', '', '', ''
      );
      insert into public.venues (id, owner_user_id, name)
      values ('${venueId}', '${ownerId}', 'K7 Turnaround Race Venue');
      insert into public.venue_capacity_rules (venue_id, max_simultaneous_events, min_turnaround_hours)
      values ('${venueId}', 1, 12);
    `]);
    assert.equal(setup.status, 0, setup.stderr || setup.stdout);

    try {
      const [first, second] = await Promise.all([
        runPsql(`
          insert into public.events (venue_id, name, event_date, start_time, end_time, status)
          values ('${venueId}', 'Night', '2099-06-15', '22:00', '23:00', 'draft');
        `),
        runPsql(`
          insert into public.events (venue_id, name, event_date, start_time, end_time, status)
          values ('${venueId}', 'Morning', '2099-06-16', '09:00', '10:00', 'draft');
        `),
      ]);
      const okCount = [first, second].filter((r) => r.status === 0).length;
      assert.equal(okCount, 1, `exactly one of the turnaround-adjacent inserts must succeed, got night=${first.status} ${first.stderr} morning=${second.status} ${second.stderr}`);
      const count = psql(["-qAt", "-c", `
        select count(*)::int from public.events
        where venue_id = '${venueId}' and status is distinct from 'cancelled';
      `]);
      assert.equal(count.status, 0, count.stderr);
      assert.equal(Number.parseInt(count.stdout.trim(), 10), 1);
    } finally {
      psql(["-c", `
        delete from public.venues where id = '${venueId}';
        delete from auth.users where id = '${ownerId}';
      `]);
    }
  });
});
