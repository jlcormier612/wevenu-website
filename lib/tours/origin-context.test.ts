import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  createTourOriginToken,
  requireTourOriginSigningSecret,
  TOUR_ORIGIN_SIGNING_SECRET_MISSING,
  tourOriginSigningSecret,
  verifyTourOriginToken,
} from "@/lib/tours/origin-context";
import { decidePublicTourAttach, type PublicTourLeadRow } from "@/lib/tours/public-tour-attach";

const DEDICATED = "dedicated-tour-origin-secret";
const CRON = "cron-secret-must-not-sign-tours";
const SERVICE_ROLE = "service-role-key-must-not-sign-tours";
const OTHER = "other-secret";

function env(partial: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return partial as NodeJS.ProcessEnv;
}

function openLead(partial: Partial<PublicTourLeadRow> & { id: string }): PublicTourLeadRow {
  return {
    venueId: "venue-a",
    salesStage: "new_inquiry",
    email: "couple@example.com",
    partnerEmail: null,
    relationshipId: "rel-1",
    ...partial,
  };
}

describe("tour originating context token", () => {
  it("signs and verifies with the dedicated TOUR_ORIGIN_SIGNING_SECRET only", () => {
    const secret = tourOriginSigningSecret(env({
      TOUR_ORIGIN_SIGNING_SECRET: DEDICATED,
      CRON_SECRET: CRON,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE,
    }));
    assert.equal(secret, DEDICATED);
    const token = createTourOriginToken(
      { venueId: "venue-a", leadId: "lead-1", nowMs: 1_000, ttlMs: 60_000 },
      secret!,
    );
    assert.deepEqual(
      verifyTourOriginToken(token, secret!, 1_500),
      { venueId: "venue-a", leadId: "lead-1", exp: 61_000 },
    );
    assert.equal(verifyTourOriginToken(token, DEDICATED, 1_500)?.leadId, "lead-1");
    assert.equal(verifyTourOriginToken(token, OTHER, 1_500), null);
  });

  it("does not fall back to CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY", () => {
    assert.equal(
      tourOriginSigningSecret(env({
        CRON_SECRET: CRON,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE,
      })),
      null,
    );
    assert.equal(
      tourOriginSigningSecret(env({
        TOUR_ORIGIN_SIGNING_SECRET: "  ",
        CRON_SECRET: CRON,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE,
      })),
      null,
    );
    assert.throws(
      () => requireTourOriginSigningSecret(env({
        CRON_SECRET: CRON,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE,
      })),
      (err: unknown) => err instanceof Error && err.message === TOUR_ORIGIN_SIGNING_SECRET_MISSING,
    );
  });

  it("rejects tokens signed with CRON_SECRET or SUPABASE_SERVICE_ROLE_KEY", () => {
    const dedicated = tourOriginSigningSecret(env({ TOUR_ORIGIN_SIGNING_SECRET: DEDICATED }));
    assert.equal(dedicated, DEDICATED);
    const cronToken = createTourOriginToken(
      { venueId: "venue-a", leadId: "lead-1", nowMs: 1_000, ttlMs: 60_000 },
      CRON,
    );
    const roleToken = createTourOriginToken(
      { venueId: "venue-a", leadId: "lead-1", nowMs: 1_000, ttlMs: 60_000 },
      SERVICE_ROLE,
    );
    assert.equal(verifyTourOriginToken(cronToken, dedicated!, 1_500), null);
    assert.equal(verifyTourOriginToken(roleToken, dedicated!, 1_500), null);
    assert.equal(
      decidePublicTourAttach({
        venueId: "venue-a",
        originToken: cronToken,
        signingSecret: dedicated,
        originLead: openLead({ id: "lead-1" }),
        email: "couple@example.com",
        openEmailMatches: [],
        nowMs: 1_500,
      }).action,
      "reject",
    );
    assert.equal(
      decidePublicTourAttach({
        venueId: "venue-a",
        originToken: roleToken,
        signingSecret: dedicated,
        originLead: openLead({ id: "lead-1" }),
        email: "couple@example.com",
        openEmailMatches: [],
        nowMs: 1_500,
      }).action,
      "reject",
    );
  });

  it("rejects expired tokens and empty input", () => {
    const token = createTourOriginToken(
      { venueId: "venue-a", leadId: "lead-1", nowMs: 1_000, ttlMs: 10 },
      DEDICATED,
    );
    assert.equal(verifyTourOriginToken(token, DEDICATED, 2_000), null);
    assert.equal(verifyTourOriginToken("", DEDICATED, 1_500), null);
    assert.equal(verifyTourOriginToken(null, DEDICATED, 1_500), null);
  });

  it("source never falls back to unrelated credentials", () => {
    const src = readFileSync(resolve("lib/tours/origin-context.ts"), "utf8");
    assert.match(src, /TOUR_ORIGIN_SIGNING_SECRET/);
    assert.doesNotMatch(src, /env\.CRON_SECRET/);
    assert.doesNotMatch(src, /env\.SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(src, /NEXT_PUBLIC_/);
    const service = readFileSync(resolve("lib/tours/service.ts"), "utf8");
    assert.match(service, /requireTourOriginSigningSecret/);
    assert.match(service, /tourOriginSigningSecret\(\)/);
  });
});
