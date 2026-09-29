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

  it("app caller still invokes generate then Ask-gap then tour pattern sync", () => {
    const service = read("lib/luv/recommendation-service.ts");
    const fn = service.slice(service.indexOf("export async function getVenueRecommendations"));
    const generateIdx = fn.indexOf('rpc("generate_venue_recommendations")');
    const askIdx = fn.indexOf("syncClientAskGapRecommendations");
    const tourIdx = fn.indexOf("syncTourFollowupPatternRecommendation");
    assert.ok(generateIdx >= 0);
    assert.ok(askIdx > generateIdx);
    assert.ok(tourIdx > askIdx);
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
});
