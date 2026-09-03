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
const ATOMICITY = resolve("supabase/migrations/20261322000000_tour_booking_atomicity.sql");
const CASES = resolve("lib/tours/tour-capacity-write.db.sql");

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

function applyTourMigrations(): void {
  applySql(PHASE2);
  applySql(PHASE3);
  applySql(PHASE4);
  applySql(TURNAROUND);
  applySql(CORRECTION);
  applySql(RECURRENCE);
  applySql(ATOMICITY);
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

function setupVenue(venueId: string, ownerId: string, email: string): void {
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
      '${email}', crypt('not-a-login', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{}',
      now(), now(), '', '', '', ''
    );
    insert into public.venues (id, owner_user_id, name)
    values ('${venueId}', '${ownerId}', 'K7 Phase4 Race Venue');
    insert into public.tour_availability_windows (venue_id, day_of_week, start_time, end_time)
    select '${venueId}', d, '00:00'::time, '23:59'::time from generate_series(0, 6) as d;
  `]);
  assert.equal(setup.status, 0, setup.stderr || setup.stdout);
}

function cleanupVenue(venueId: string, ownerId: string): void {
  psql(["-c", `
    delete from public.venues where id = '${venueId}';
    delete from auth.users where id = '${ownerId}';
  `]);
}

describe("tour capacity live database", () => {
  it("covers capacity, overlap, cancel, edit, windows, exceptions, duration, and buffer", (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    withSchemaLock(() => {
      applyTourMigrations();
      const cases = readFileSync(CASES, "utf8");
      let run = { status: 1 as number | null, stdout: "", stderr: "" };
      for (let attempt = 0; attempt < 6; attempt++) {
        run = psql(["-c", cases]);
        if (run.status === 0) break;
        if (!/deadlock detected/i.test(`${run.stderr}\n${run.stdout}`)) break;
      }
      assert.equal(run.status, 0, run.stderr || run.stdout);
    });
  });

  it("two concurrent Tour bookings cannot exceed capacity", async (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    await withSchemaLockAsync(async () => {
      applyTourMigrations();
      const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee20";
      const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee21";
      setupVenue(venueId, ownerId, "k7-phase4-race@example.test");

      try {
        const [first, second] = await Promise.all([
          runPsql(`
            insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
            values ('${venueId}', '2099-06-15 10:00:00+00', 60, 'scheduled', 'RaceA');
          `),
          runPsql(`
            insert into public.tour_appointments (venue_id, scheduled_at, duration_minutes, status, contact_name)
            values ('${venueId}', '2099-06-15 10:00:00+00', 60, 'scheduled', 'RaceB');
          `),
        ]);
        const count = psql(["-qAt", "-c", `
          select count(*)::int from public.tour_appointments
          where venue_id = '${venueId}' and status is distinct from 'cancelled';
        `]);
        assert.equal(count.status, 0, count.stderr);
        assert.equal(
          Number.parseInt(count.stdout.trim(), 10),
          1,
          `concurrent bookings must not exceed max=1, got ${count.stdout}; a=${first.status} ${first.stderr} b=${second.status} ${second.stderr}`,
        );
        assert.ok(
          (first.status === 0) !== (second.status === 0),
          `exactly one concurrent insert should succeed, got a=${first.status} b=${second.status}`,
        );
      } finally {
        cleanupVenue(venueId, ownerId);
      }
    });
  });

  it("two concurrent reschedules cannot exceed capacity", async (t: TestContext) => {
    if (!localDbAvailable()) {
      t.skip("local Postgres is not running");
      return;
    }
    await withSchemaLockAsync(async () => {
      applyTourMigrations();
      const venueId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee16";
      const ownerId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee17";
      const tourA = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee18";
      const tourB = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee19";
      setupVenue(venueId, ownerId, "k7-phase4-resched@example.test");
      const seed = psql(["-c", `
        insert into public.tour_appointments (id, venue_id, scheduled_at, duration_minutes, status, contact_name)
        values
          ('${tourA}', '${venueId}', '2099-06-15 10:00:00+00', 60, 'scheduled', 'A'),
          ('${tourB}', '${venueId}', '2099-06-15 14:00:00+00', 60, 'scheduled', 'B');
      `]);
      assert.equal(seed.status, 0, seed.stderr || seed.stdout);

      try {
        const [first, second] = await Promise.all([
          runPsql(`
            update public.tour_appointments
               set scheduled_at = '2099-06-15 12:00:00+00'
             where id = '${tourA}';
          `),
          runPsql(`
            update public.tour_appointments
               set scheduled_at = '2099-06-15 12:00:00+00'
             where id = '${tourB}';
          `),
        ]);
        const noon = psql(["-qAt", "-c", `
          select count(*)::int from public.tour_appointments
          where venue_id = '${venueId}'
            and status is distinct from 'cancelled'
            and scheduled_at = '2099-06-15 12:00:00+00';
        `]);
        assert.equal(noon.status, 0, noon.stderr);
        assert.equal(
          Number.parseInt(noon.stdout.trim(), 10),
          1,
          `concurrent reschedules must not exceed max=1 at 12:00, got ${noon.stdout}; a=${first.status} ${first.stderr} b=${second.status} ${second.stderr}`,
        );
        assert.ok(
          (first.status === 0) !== (second.status === 0),
          `exactly one concurrent reschedule should succeed, got a=${first.status} b=${second.status}`,
        );
        const loser = first.status === 0 ? tourB : tourA;
        const leftover = psql(["-qAt", "-c", `
          select scheduled_at at time zone 'UTC' from public.tour_appointments where id = '${loser}';
        `]);
        assert.ok(
          /10:00:00|14:00:00/.test(leftover.stdout),
          `losing reschedule must leave the original time, got ${leftover.stdout}`,
        );
      } finally {
        cleanupVenue(venueId, ownerId);
      }
    });
  });
});
