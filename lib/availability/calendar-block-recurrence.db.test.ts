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
const PHASE4 = resolve("supabase/migrations/20261318000000_tour_capacity_enforcement.sql");
const TURNAROUND = resolve("supabase/migrations/20261319000000_event_turnaround_enforcement.sql");
const CORRECTION = resolve("supabase/migrations/20261320000000_availability_correction_pass.sql");
const RECURRENCE = resolve("supabase/migrations/20261321000000_calendar_block_recurrence_coverage.sql");
const CASES = resolve("lib/availability/calendar-block-recurrence.db.sql");

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

async function withSchemaLockAsync<T>(fn: () => Promise<T>): Promise<T> {
  const dir = join(tmpdir(), "wevenu-k7-avail-schema.lock");
  const started = Date.now();
  while (true) {
    try {
      mkdirSync(dir);
      break;
    } catch {
      if (Date.now() - started > 90_000) throw new Error("timed out waiting for k7 availability schema lock");
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  try {
    return await fn();
  } finally {
    try { rmdirSync(dir); } catch { /* ignore */ }
  }
}

function applyRecurrenceMigrations(): void {
  applySql(PHASE2);
  applySql(PHASE3);
  applySql(PHASE4);
  applySql(TURNAROUND);
  applySql(CORRECTION);
  applySql(RECURRENCE);
}

describe("recurring calendar_blocks live database", () => {
  it("Event/Tour/inquiry writes honor recurring coverage including Sunday 9-5", (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    withSchemaLock(() => {
      applyRecurrenceMigrations();
      const cases = readFileSync(CASES, "utf8");
      const run = psql(["-c", `begin;\n${cases}\nrollback;`]);
      assert.equal(run.status, 0, run.stderr || run.stdout);
    });
  });

  it("an Event on a later Sunday waits on a concurrent recurring calendar_blocks write", async (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    // Hold the schema lock across apply + concurrency. Releasing after apply
    // alone lets parallel availability tests rewrite events_enforce_availability
    // mid-flight and falsely pass the Event insert (seen under full npm test).
    await withSchemaLockAsync(async () => {
      applyRecurrenceMigrations();

      const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeecb";
      const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeecc";
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
          'k7-recur-lock@example.test', crypt('not-a-login', gen_salt('bf')),
          now(), '{"provider":"email","providers":["email"]}', '{}',
          now(), now(), '', '', '', ''
        );
        insert into public.venues (id, owner_user_id, name)
        values ('${venueId}', '${ownerId}', 'K7 Recurring Lock Venue');
      `]);
      assert.equal(setup.status, 0, setup.stderr || setup.stdout);

      try {
        const holder = spawn("psql", [
          LOCAL_URL, "-v", "ON_ERROR_STOP=1", "-c", `
            begin;
            insert into public.calendar_blocks (
              venue_id, title, type, start_date, end_date, is_all_day, start_time, end_time,
              recurrence_rule, recurrence_interval
            ) values (
              '${venueId}', 'Every Sunday 9-5', 'blocked_time', '2099-06-14', '2099-06-14',
              false, '09:00', '17:00', 'weekly', 1
            );
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
            and objid = hashtext('calendar-blocks');
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
        assert.ok(held, "calendar_blocks insert never published the venue calendar-blocks advisory lock");

        const waiter = psql([
          "-c", `
            set lock_timeout = '2s';
            insert into public.events (venue_id, name, event_date, start_time, end_time, status)
            values ('${venueId}', 'Later Sunday', '2099-06-28', '10:00', '12:00', 'draft');
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
          waiter.status !== 0 && /lock timeout|canceling statement due to lock timeout|calendar is blocked/i.test(output),
          `Event insert on a later Sunday must not sneak past an in-flight recurring block, got status=${waiter.status} output=${output}`,
        );
      } finally {
        psql(["-c", `
          delete from public.venues where id = '${venueId}';
          delete from auth.users where id = '${ownerId}';
        `]);
      }
    });
  });
});
