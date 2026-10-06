import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { classifyActiveVenueCase } from "@/lib/venue/active-context-logic";

const HANDOFF_MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20261412900000_invite_identity_and_onboarding_handoff.sql",
);
const REPAIR_MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20261413000000_repair_juniper_owner_identity_sandbox.sql",
);

describe("one-time venue onboarding handoff", () => {
  const sql = readFileSync(HANDOFF_MIGRATION, "utf8");
  const bootstrap = readFileSync(join(process.cwd(), "lib/venue/active-context.ts"), "utf8");
  const activate = readFileSync(
    join(process.cwd(), "app/api/internal/enrollment/activate/route.ts"),
    "utf8",
  );
  const activateAction = readFileSync(
    join(process.cwd(), "workspace/app/activate/actions.ts"),
    "utf8",
  );
  const helpers = readFileSync(
    join(process.cwd(), "shared/email/templates/helpers.ts"),
    "utf8",
  );
  const selectAction = readFileSync(
    join(process.cwd(), "app/(app)/select-venue/actions.ts"),
    "utf8",
  );
  const switcher = readFileSync(join(process.cwd(), "lib/venue/venue-switcher.ts"), "utf8");

  it("binds handoff to user, email, venue, origin, expiry, and one-time consumption", () => {
    assert.match(sql, /create table if not exists public\.venue_onboarding_handoffs/);
    assert.match(sql, /intended_email text not null/);
    assert.match(sql, /origin text not null/);
    assert.match(sql, /expires_at timestamptz not null/);
    assert.match(sql, /consumed_at timestamptz/);
    assert.match(sql, /purchase_activation/);
    assert.match(sql, /owner_invitation/);
  });

  it("create is service-role only and consume takes no client venue id", () => {
    assert.match(
      sql,
      /grant execute on function public\.create_venue_onboarding_handoff\([^)]+\) to service_role/,
    );
    const consumeStart = sql.indexOf(
      "create or replace function public.consume_venue_onboarding_handoff()",
    );
    assert.ok(consumeStart > 0);
    const consume = sql.slice(consumeStart, consumeStart + 2200);
    assert.doesNotMatch(consume, /p_venue_id/);
    assert.match(consume, /auth\.uid\(\)/);
    assert.match(consume, /from auth\.users/);
    assert.match(consume, /email_mismatch/);
    assert.match(consume, /expires_at > now\(\)/);
    assert.match(consume, /consumed_at is null/);
    assert.match(consume, /already_consumed|consumed_at = now\(\)/);
  });

  it("activate preserves venueId by writing the purchaser handoff", () => {
    assert.match(activate, /createPurchaseOnboardingHandoff/);
    assert.match(activate, /userId/);
    assert.match(activate, /enrollment\.owner_email/);
    assert.match(activate, /row\.venue_id/);
    assert.match(activateAction, /productPostActivationLoginUrl\(\)/);
    assert.match(helpers, /\/login\?activated=1&next=/);
    assert.doesNotMatch(helpers, /venueId=/);
    assert.doesNotMatch(activateAction, /venueId=/);
  });

  it("bootstrap consumes the handoff before ordinary classification", () => {
    const consumeAt = bootstrap.indexOf("await consumeOnboardingHandoff()");
    const classifyAt = bootstrap.indexOf("classifyActiveVenueCase({");
    assert.ok(consumeAt > 0);
    assert.ok(classifyAt > consumeAt);
    assert.match(bootstrap, /Does not change B_keep_valid/);
  });

  it("ordinary B_keep_valid is unchanged", () => {
    assert.equal(
      classifyActiveVenueCase({
        memberships: [{ venueId: "fancy" }, { venueId: "juniper" }],
        dbContextVenueId: "fancy",
        dbContextMembershipValid: true,
      }),
      "B_keep_valid",
    );
  });

  it("manual switch still requires set_active_venue membership check, not a raw query param", () => {
    assert.match(selectAction, /setActiveVenue\(venueId\)/);
    assert.doesNotMatch(selectAction, /searchParams/);
    assert.match(switcher, /set_active_venue/);
  });

  it("handoff expire and replay are rejected without a client venue id", () => {
    const consumeStart = sql.indexOf(
      "create or replace function public.consume_venue_onboarding_handoff()",
    );
    const consume = sql.slice(consumeStart);
    assert.match(consume, /expires_at > now\(\)/);
    assert.match(consume, /consumed_at is null/);
    assert.match(consume, /already_consumed|not found/);
    assert.doesNotMatch(consume, /p_venue_id/);
  });

  it("handoff cannot be consumed by a different authenticated user", () => {
    const consumeStart = sql.indexOf(
      "create or replace function public.consume_venue_onboarding_handoff()",
    );
    const consume = sql.slice(consumeStart);
    assert.match(consume, /where user_id = v_uid/);
    assert.match(consume, /email_mismatch/);
    assert.match(consume, /from public\.venue_staff s/);
  });

  it("ordinary login still keeps a valid prior venue, not newest-wins", () => {
    assert.equal(
      classifyActiveVenueCase({
        memberships: [{ venueId: "prior" }, { venueId: "newest" }],
        dbContextVenueId: "prior",
        dbContextMembershipValid: true,
      }),
      "B_keep_valid",
    );
    assert.notEqual(
      classifyActiveVenueCase({
        memberships: [{ venueId: "prior" }, { venueId: "newest" }],
        dbContextVenueId: "prior",
        dbContextMembershipValid: true,
      }),
      "A_auto_single",
    );
  });
});

describe("Juniper owner identity sandbox repair", () => {
  const sql = readFileSync(REPAIR_MIGRATION, "utf8");

  it("targets only the known-invalid Fancy-as-Juniper-Owner row", () => {
    assert.match(sql, /f26f53a4-5613-47ff-9523-b37fad9d7adb/);
    assert.match(sql, /af2d6aa1-0eb2-4e65-aa6f-c066cb71a4b6/);
    assert.match(sql, /jyagnesak@yahoo\.com/);
    assert.match(sql, /2fa73101-337b-4530-8c77-f3c272c5463e/);
    assert.match(sql, /htc\.allow_last_owner_change/);
    assert.match(sql, /user_id = null/);
    assert.match(sql, /accepted_at = null/);
    assert.match(sql, /owner_invite_pending = true/);
    assert.match(sql, /is_owner = false/);
    assert.match(sql, /6721694e-3f38-45e6-9afa-383ba1fd7564/);
    assert.doesNotMatch(sql, /drop table/i);
  });
});
