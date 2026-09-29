import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  filterVisibleObservations,
  isObservationDismissType,
  observationDismissType,
  observationIdFromDismissType,
} from "./observation-dismiss";
import { selectLuvDashboardEntry } from "@/lib/dashboard-system/luv-entry";
import type { LuvObservation } from "./types";

const TOUR_OBS_ID = "tour-no-followup-sweepqa";

function observation(overrides: Partial<LuvObservation> = {}): LuvObservation {
  return {
    id: TOUR_OBS_ID,
    kind: "risk",
    priority: "high",
    message: "SweepQA JourneyOne completed their tour 15h ago — follow up while it's fresh.",
    link: "/leads/sweepqa",
    actionLabel: "View Lead →",
    recommendation: {
      label: "Ask Luv to draft a follow-up",
      link: "/leads/sweepqa?luv=follow_up_email",
      type: "draft",
    },
    ...overrides,
  };
}

describe("Luv observation dismiss identity", () => {
  it("namespaces observation dismiss rows so Guide-gap types stay distinct", () => {
    assert.equal(observationDismissType(TOUR_OBS_ID), `observation:${TOUR_OBS_ID}`);
    assert.equal("observation:".length, 12);
    assert.equal(isObservationDismissType("observation:tour-no-followup-1"), true);
    assert.equal(isObservationDismissType("client_ask_gap_exotic_animal_policy"), false);
    assert.equal(observationIdFromDismissType(`observation:${TOUR_OBS_ID}`), TOUR_OBS_ID);
  });

  it("list RPC extracts the full observation id after the 12-char prefix", () => {
    const extract = readFileSync(
      resolve("supabase/migrations/20261409000000_luv_observation_dismiss_id_extract.sql"),
      "utf8",
    );
    assert.match(extract, /char_length\('observation:'\) \+ 1/);
    const fnBody = extract.slice(extract.indexOf("create or replace function"));
    assert.doesNotMatch(fnBody, /substring\(type from 14\)/);
    const liveType = observationDismissType("tour-no-followup-0068ef45-02ac-4bee-9730-9080abae32a6");
    assert.equal(liveType.slice("observation:".length), "tour-no-followup-0068ef45-02ac-4bee-9730-9080abae32a6");
    assert.notEqual(liveType.slice(13), "tour-no-followup-0068ef45-02ac-4bee-9730-9080abae32a6");
  });

  it("hides a dismissed observation on a fresh read and keeps an unrelated one", () => {
    const tour = observation();
    const other = observation({
      id: "portal-inactive-other",
      message: "Another couple hasn't visited in 21 days.",
    });
    const visible = filterVisibleObservations([tour, other], new Set([TOUR_OBS_ID]));
    assert.deepEqual(visible.map((o) => o.id), ["portal-inactive-other"]);
  });

  it("reload-equivalent still hides the dismissed observation", () => {
    const dismissed = new Set([TOUR_OBS_ID]);
    const first = filterVisibleObservations([observation()], dismissed);
    const reload = filterVisibleObservations([observation()], dismissed);
    assert.deepEqual(first, []);
    assert.deepEqual(reload, []);
    assert.equal(
      selectLuvDashboardEntry({
        focusItems: [],
        observations: reload,
        recommendations: [],
      }),
      null,
    );
  });

  it("dashboard entry exposes the observation id so X can persist", () => {
    const entry = selectLuvDashboardEntry({
      focusItems: [],
      observations: [observation()],
      recommendations: [],
    });
    assert.equal(entry?.dismissObservationId, TOUR_OBS_ID);
    assert.equal(entry?.dismissRecommendationId, undefined);
    assert.equal(
      entry?.message,
      "SweepQA JourneyOne completed their tour 15h ago — follow up while it's fresh.",
    );
  });

  it("does not treat a Guide-gap recommendation as an observation dismiss type", () => {
    const service = readFileSync(resolve("lib/luv/recommendation-service.ts"), "utf8");
    assert.match(service, /isObservationDismissType/);
    assert.match(service, /getDismissedObservationIds/);
    const route = readFileSync(resolve("app/api/recommendations/observation/route.ts"), "utf8");
    assert.match(route, /dismiss_luv_dashboard_observation/);
    assert.match(route, /revalidatePath\("\/dashboard"\)/);
  });
});
