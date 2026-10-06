import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function lastAcceptTeamInvitationSql(): string {
  const dir = join(process.cwd(), "supabase/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let last = "";
  for (const f of files) {
    const body = readFileSync(join(dir, f), "utf8");
    const start = body.indexOf("create or replace function public.accept_team_invitation");
    if (start < 0) continue;
    const next = body.indexOf("create or replace function", start + 10);
    last = body.slice(start, next > start ? next : undefined);
  }
  assert.ok(last, "expected a final accept_team_invitation definition");
  return last;
}

describe("accept_team_invitation identity boundary", () => {
  const sql = lastAcceptTeamInvitationSql();
  const service = readFileSync(join(process.cwd(), "lib/team/service.ts"), "utf8");
  const joinPage = readFileSync(join(process.cwd(), "app/join/page.tsx"), "utf8");
  const joinActions = readFileSync(join(process.cwd(), "app/join/actions.ts"), "utf8");

  it("final function rejects email mismatch before consuming the invite", () => {
    const mismatch = sql.indexOf("email_mismatch");
    const consume = sql.indexOf("invite_token = null");
    assert.ok(mismatch > 0);
    assert.ok(consume > mismatch, "email check must run before token consumption");
    assert.match(sql, /from auth\.users/);
    assert.match(sql, /lower\(trim/);
  });

  it("mismatch does not bind user_id or accepted_at", () => {
    const beforeUpdate = sql.slice(0, sql.indexOf("update public.venue_staff"));
    assert.match(beforeUpdate, /email_mismatch/);
    assert.doesNotMatch(beforeUpdate, /user_id\s*=\s*v_uid/);
    assert.doesNotMatch(beforeUpdate, /accepted_at\s*=\s*now\(\)/);
  });

  it("preserves pending-owner promotion and unique-violation already_a_member", () => {
    assert.match(sql, /owner_invite_pending/);
    assert.match(sql, /is_owner\s*=\s*case when owner_invite_pending then true/);
    assert.match(sql, /already_a_member/);
  });

  it("successful accept sets the invited venue active server-side", () => {
    assert.match(sql, /insert into public\.venue_staff_active_context/);
    assert.match(service, /setActiveVenue\(data\.venueId\)/);
    assert.match(joinPage, /redirect\("\/setup-hub"\)/);
  });

  it("wrong authenticated identity is signed out before retrying the same token", () => {
    assert.match(joinPage, /email_mismatch/);
    assert.match(joinPage, /signOutToAcceptInviteAction/);
    assert.match(joinActions, /signOutToAcceptInviteAction/);
    assert.match(joinActions, /\/join\?token=/);
    assert.doesNotMatch(joinPage, /Sign in with a different account/);
  });

  it("invitation cannot be replayed after a successful consume", () => {
    assert.match(sql, /invite_token = null/);
    assert.match(sql, /accepted_at is null/);
    assert.match(sql, /invalid_or_expired_token/);
  });

  it("correct invited identity is the only user bound on success", () => {
    const update = sql.slice(sql.indexOf("update public.venue_staff"));
    assert.match(update, /user_id\s*=\s*v_uid/);
    assert.match(sql, /v_email <> v_invited_email/);
  });
});
