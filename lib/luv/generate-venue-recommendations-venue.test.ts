/**
 * Tenant-resolution regression for generate_venue_recommendations().
 *
 * Protects against reverting to:
 *   from venue_users where user_id = auth.uid() limit 1
 *
 * Multi-venue staff (e.g. Fancy + Texting E2E) must generate recommendations
 * only for current_user_venue_id() — the authoritative active venue.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = resolve(ROOT, "supabase/migrations");

function read(rel: string) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

/** Latest migration that defines generate_venue_recommendations(). */
function latestGenerateVenueRecommendationsMigration(): { file: string; sql: string } {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let latest: { file: string; sql: string } | null = null;
  for (const file of files) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
    if (/create\s+or\s+replace\s+function\s+(public\.)?generate_venue_recommendations\s*\(/i.test(sql)) {
      latest = { file, sql };
    }
  }
  assert.ok(latest, "expected a migration defining generate_venue_recommendations");
  return latest!;
}

function functionBody(sql: string): string {
  const start = sql.search(
    /create\s+or\s+replace\s+function\s+(public\.)?generate_venue_recommendations\s*\(/i,
  );
  assert.ok(start >= 0);
  const fromFn = sql.slice(start);
  const dollar = fromFn.indexOf("as $$");
  assert.ok(dollar >= 0);
  const end = fromFn.indexOf("$$;", dollar);
  assert.ok(end > dollar);
  return fromFn.slice(dollar, end);
}

describe("generate_venue_recommendations — authoritative venue (no LIMIT 1)", () => {
  it("latest definition uses current_user_venue_id and never venue_users LIMIT 1", () => {
    const { file, sql } = latestGenerateVenueRecommendationsMigration();
    assert.equal(
      file,
      "20261409300000_generate_venue_recommendations_current_venue.sql",
      "expected the current-venue fix migration to be the latest definition",
    );

    const body = functionBody(sql);
    assert.match(body, /v_venue_id\s*:=\s*public\.current_user_venue_id\(\)/);
    assert.doesNotMatch(
      body,
      /from\s+venue_users\s+where\s+user_id\s*=\s*auth\.uid\(\)\s+limit\s+1/i,
    );
    assert.doesNotMatch(body, /venue_users/i);
    // Venue assignment must not use LIMIT 1; insight row pick within venue may.
    assert.doesNotMatch(
      body,
      /select\s+venue_id\s+into\s+v_venue_id[\s\S]*limit\s+1/i,
    );
  });

  it("all reads/writes in the function are scoped to v_venue_id", () => {
    const { sql } = latestGenerateVenueRecommendationsMigration();
    const body = functionBody(sql);

    // Stale-lead count, inserts, deletes, insight/memory reads must use v_venue_id.
    assert.match(body, /from leads\s+where venue_id = v_venue_id/i);
    assert.match(body, /from venue_health_scores where venue_id = v_venue_id/i);
    assert.match(body, /from luv_insights\s+where venue_id = v_venue_id/i);
    assert.match(body, /from luv_memories\s+where venue_id = v_venue_id/i);
    assert.match(body, /insert into luv_recommendations[\s\S]*values \(\s*v_venue_id/i);

    // CTA alignment UPDATE must not rewrite other tenants' rows.
    const ctaUpdate = body.slice(body.indexOf("Keep already-stored lead_followup"));
    assert.match(ctaUpdate, /where venue_id = v_venue_id\s+and type = 'lead_followup'/);
    assert.doesNotMatch(
      ctaUpdate.replace(/where venue_id = v_venue_id\s+and type = 'lead_followup'/, ""),
      /where type = 'lead_followup'/,
    );
  });

  it("recommendation semantics (types / thresholds) are unchanged from prior definition", () => {
    const prior = read(
      "supabase/migrations/20261400100000_stale_contact_opportunity_age.sql",
    );
    const { sql: fixed } = latestGenerateVenueRecommendationsMigration();

    for (const type of ["lead_followup", "inquiry_reactivation", "seasonal_prep"] as const) {
      assert.match(prior, new RegExp(`type = '${type}'`));
      assert.match(fixed, new RegExp(`type = '${type}'`));
    }
    // Stale-contact threshold remains 2 leads / 7 days.
    assert.match(fixed, /v_stale_leads >= 2/);
    assert.match(
      fixed,
      /coalesce\(last_contacted_at, inquiry_date::timestamptz, created_at\)\s*< \(now\(\) - interval '7 days'\)/,
    );
    // Seasonal ratio threshold unchanged.
    assert.match(fixed, /v_next_ratio >= 1\.35/);
  });

  it("refresh path invokes generate then Ask-gap then tour pattern sync then read", () => {
    const service = read("lib/luv/recommendation-service.ts");
    const fn = service.slice(service.indexOf("export async function refreshVenueRecommendations"));
    const generateIdx = fn.indexOf('rpc("generate_venue_recommendations")');
    const askIdx = fn.indexOf("syncClientAskGapRecommendations");
    const tourIdx = fn.indexOf("syncTourFollowupPatternRecommendation");
    const spotIdx = fn.indexOf("syncPhase5SpotPatternRecommendations");
    const readIdx = fn.indexOf("readPersistedVenueRecommendations");
    assert.ok(generateIdx >= 0);
    assert.ok(askIdx > generateIdx);
    assert.ok(tourIdx > askIdx);
    assert.ok(spotIdx > tourIdx);
    assert.ok(readIdx > spotIdx);
    assert.match(service, /rpc\("get_venue_recommendations"\)/);
  });

  it("read path does not manufacture recommendations", () => {
    const service = read("lib/luv/recommendation-service.ts");
    const fn = service.slice(
      service.indexOf("export async function readVenueRecommendations"),
      service.indexOf("export async function refreshVenueRecommendations"),
    );
    assert.doesNotMatch(fn, /generate_venue_recommendations/);
    assert.doesNotMatch(fn, /syncClientAskGapRecommendations/);
    assert.doesNotMatch(fn, /syncTourFollowupPatternRecommendation/);
    assert.doesNotMatch(fn, /syncPhase5SpotPatternRecommendations/);
    assert.match(fn, /readPersistedVenueRecommendations/);
  });

  it("prior defining migration still documents the defect we fixed (history lock)", () => {
    const prior = read(
      "supabase/migrations/20261400100000_stale_contact_opportunity_age.sql",
    );
    assert.match(
      prior,
      /from venue_users where user_id = auth\.uid\(\) limit 1/,
    );
  });

  /**
   * Multi-venue isolation contract (same user ∈ Venue A + Venue B):
   * venue is resolved once via current_user_venue_id(); every subsequent
   * read/write uses that v_venue_id only. A regenerate while active on A
   * cannot insert/update/delete B rows (including the lead_followup CTA
   * alignment UPDATE).
   */
  it("multi-venue isolation: single venue assignment; no unscoped writes", () => {
    const { sql } = latestGenerateVenueRecommendationsMigration();
    const body = functionBody(sql);

    const assignments = body.match(/v_venue_id\s*:=/g) ?? [];
    assert.equal(assignments.length, 1, "venue must be assigned exactly once");
    assert.match(body, /v_venue_id\s*:=\s*public\.current_user_venue_id\(\)/);

    // No membership-table resolution of any form.
    assert.doesNotMatch(body, /from\s+venue_users/i);
    assert.doesNotMatch(body, /from\s+venue_staff\s+where\s+user_id/i);

    // Every mutating statement that targets luv_recommendations is venue-scoped.
    const mutations = [
      ...body.matchAll(
        /(?:insert into|delete from|update)\s+luv_recommendations[\s\S]*?(?=insert into|delete from|update\s+luv_recommendations|return jsonb_build_object|-- ──|$)/gi,
      ),
    ].map((m) => m[0]);
    assert.ok(mutations.length >= 4, "expected lead_followup / inquiry / seasonal / CTA mutations");
    for (const chunk of mutations) {
      assert.match(
        chunk,
        /v_venue_id/,
        `unscoped luv_recommendations mutation:\n${chunk.slice(0, 200)}`,
      );
    }
  });
});
