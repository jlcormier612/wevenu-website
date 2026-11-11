import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  filterVisibleRecommendations,
  isRecommendationActiveForDisplay,
  RECOMMENDATION_DISMISS_COOLDOWN_MS,
} from "./recommendation-visibility";
import { selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";
import type { VenueRecommendation } from "./recommendation-types";

const FANCY_VENUE_ID = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EXOTIC_REC_ID = "e5a0dd29-f9ce-4d1a-98d9-ba00beafa53c";

function exoticRec(overrides: Partial<VenueRecommendation> = {}): VenueRecommendation {
  return {
    id: EXOTIC_REC_ID,
    insightId: null,
    type: "client_ask_gap_exotic_animal_policy",
    title: "Clients have asked about exotic animals 3 times in the last 30 days.",
    body: "Your published Venue Guide doesn't currently answer this clearly.",
    priority: 75,
    ctas: [{ type: "navigate", target: "/guide", label: "Open Venue Guide" }],
    metadata: { topic: "exotic_animal_policy", gap_count: 3, window_days: 30, venue_id: FANCY_VENUE_ID },
    dismissedAt: null,
    completedAt: null,
    expiresAt: null,
    createdAt: "2026-09-28T00:00:00.000Z",
    ...overrides,
  };
}

function read(rel: string): string {
  return readFileSync(resolve(rel), "utf8");
}

describe("recommendation visibility after dismiss", () => {
  const now = Date.parse("2026-09-29T12:00:00.000Z");

  it("1–6: visible → dismiss → persisted dismissed_at → fresh fetch and reload-equivalent hide it on Fancy", () => {
    const visible = exoticRec();
    assert.equal(isRecommendationActiveForDisplay(visible, now), true);
    assert.equal(filterVisibleRecommendations([visible], now)[0]?.id, EXOTIC_REC_ID);

    const dismissedAt = "2026-09-29T11:59:00.000Z";
    const dismissed = exoticRec({ dismissedAt });
    assert.ok(dismissed.dismissedAt, "persisted row has dismissed_at");
    assert.equal(dismissed.metadata.venue_id, FANCY_VENUE_ID);

    const freshFetch = filterVisibleRecommendations([dismissed], now);
    assert.deepEqual(freshFetch, []);

    const reloadEquivalent = filterVisibleRecommendations([dismissed], now);
    assert.deepEqual(reloadEquivalent, []);

    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [],
      recommendations: reloadEquivalent,
    });
    assert.equal(entry, null);
  });

  it("sync-after-dismiss contract does not resurrect: same type still hidden while dismissed_at is set", () => {
    const dismissed = exoticRec({ dismissedAt: "2026-09-29T11:59:00.000Z" });
    // Dashboard load always re-syncs. After 088, upsert keeps dismissed_at.
    const afterSync = exoticRec({
      dismissedAt: dismissed.dismissedAt,
      title: dismissed.title,
      body: dismissed.body,
    });
    assert.equal(isRecommendationActiveForDisplay(afterSync, now), false);
    assert.deepEqual(filterVisibleRecommendations([afterSync], now), []);

    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [],
      recommendations: [afterSync],
    });
    assert.notEqual(entry?.dismissRecommendationId, EXOTIC_REC_ID);
    assert.notEqual(
      entry?.message,
      "Clients have asked about exotic animals 3 times in the last 30 days.",
    );
  });

  it("7-day restore still surfaces a stale dismissal", () => {
    const old = exoticRec({
      dismissedAt: new Date(now - RECOMMENDATION_DISMISS_COOLDOWN_MS - 1).toISOString(),
    });
    assert.equal(isRecommendationActiveForDisplay(old, now), true);
  });

  it("8–9: Fancy dismiss cannot hide another venue row; unrelated rec stays visible", () => {
    const otherVenue = exoticRec({
      id: "other-venue-rec",
      metadata: { topic: "exotic_animal_policy", venue_id: "not-fancy" },
    });
    const unrelated = exoticRec({
      id: "unrelated-pets",
      type: "client_ask_gap_pet_policy",
      title: "Clients have asked about pets 3 times in the last 30 days.",
      dismissedAt: null,
    });
    const dismissedFancy = exoticRec({ dismissedAt: "2026-09-29T11:59:00.000Z" });
    const visible = filterVisibleRecommendations([dismissedFancy, otherVenue, unrelated], now);
    assert.deepEqual(
      visible.map((r) => r.id),
      ["other-venue-rec", "unrelated-pets"],
    );
    const status = read("supabase/migrations/20261408700000_luv_recommendations_active_venue.sql");
    assert.match(status, /where id = p_recommendation_id and venue_id = v_venue_id/);
  });

  it("completed recommendations stay hidden", () => {
    assert.equal(
      isRecommendationActiveForDisplay(
        exoticRec({ completedAt: "2026-09-29T11:00:00.000Z" }),
        now,
      ),
      false,
    );
  });
});

describe("ask-gap sync preserves dismissal (088)", () => {
  it("ON CONFLICT does not clear dismissed_at and still uses current_user_venue_id", () => {
    const sql = read(
      "supabase/migrations/20261408800000_luv_ask_gap_preserve_dismissal.sql",
    );
    assert.match(sql, /current_user_venue_id\(\)/);
    assert.doesNotMatch(sql, /from venue_users where user_id = auth\.uid\(\) limit 1/);

    const conflict = sql.slice(sql.indexOf("on conflict"));
    const conflictBody = conflict.slice(0, conflict.indexOf("v_upserted"));
    assert.doesNotMatch(conflictBody, /dismissed_at\s*=\s*null/);
    assert.doesNotMatch(conflictBody, /completed_at\s*=\s*null/);
  });

  it("recommendation-service filters dismissed rows after generate+sync+get", () => {
    const service = read("lib/luv/recommendation-service.ts");
    assert.match(service, /filterVisibleRecommendations/);
    assert.match(service, /syncClientAskGapRecommendations/);
    assert.match(service, /generate_venue_recommendations/);
    assert.match(service, /isObservationDismissType/);
  });

  it("PATCH dismiss requires RPC ok, not just a missing PostgREST error", () => {
    const route = read("app/api/recommendations/[id]/route.ts");
    assert.match(route, /update_recommendation_status/);
    assert.match(route, /ok !== true/);
    assert.match(route, /revalidatePath\("\/dashboard"\)/);
  });

  it("Dashboard X only persists a recommendation id and refreshes the server read", () => {
    const card = read("components/dashboard/luv-dashboard-entry.tsx");
    assert.match(card, /canPersistDismiss/);
    assert.match(card, /router\.refresh\(\)/);
    assert.match(card, /payload\.ok !== true/);
    assert.match(card, /dismissObservationId/);
    assert.match(card, /\/api\/recommendations\/observation/);
    assert.doesNotMatch(card, /if \(!entry\.dismissRecommendationId\) \{\s*setHidden\(true\)/);
  });

  it("observation dismiss reuses luv_recommendations and current_user_venue_id", () => {
    const sql = read("supabase/migrations/20261408900000_luv_observation_dismiss.sql");
    assert.match(sql, /dismiss_luv_dashboard_observation/);
    assert.match(sql, /current_user_venue_id\(\)/);
    assert.match(sql, /type not like 'observation:%'/);
    assert.match(sql, /on conflict \(venue_id, type\) do update/);
    assert.match(sql, /set dismissed_at = now\(\)/);
    assert.doesNotMatch(sql, /from venue_users where user_id = auth\.uid\(\) limit 1/);
  });
});
