/**
 * Guide Gap Recommendations — classifier, coverage, Fancy regression.
 *
 * Classifier terms → Guide sections (client projection):
 *   pet_policy            → policies, faqs (domestic pets: dog/cat/pet/…)
 *   exotic_animal_policy  → policies, faqs (elephant/llama/livestock/…)
 *   alcohol_policy        → policies, faqs (alcohol/BYOB/corkage/…)
 *
 * Exotic is classified BEFORE pet so elephants/llamas never imply missing pet policy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { evaluateAskGapRecommendations } from "@/lib/luv/ask-gap-recommendations";
import {
  ASK_GAP_MIN_COUNT,
  ASK_GAP_TOPIC_GUIDE_SECTIONS,
  ASK_GAP_WINDOW_DAYS,
  classifyAskGapTopic,
  publishedClientGuideCoversTopic,
  recommendationTypeForAskGapTopic,
} from "@/lib/luv/ask-gap-topics";

const ROOT = process.cwd();

function read(rel: string) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

/** Jen's Fancy published policies (Sandbox snapshot). */
const FANCY_CLIENT_GUIDE = {
  policies:
    "No sparklers, confetti or open flames. Pets are allowed for outdoor events on a case by case/approval basis.\nWe supply battery operated candles as part of inventory should you choose to select them.\nNo hanging mechanisms that leave holes or residue behind in the barn.",
  faqs: [] as { question: string; answer: string }[],
};

/** Exact Fancy information_gap (+ other) signals from Sandbox forensic pass. */
const FANCY_SIGNALS = [
  {
    question: "Do you allow live elephants during the ceremony?",
    outcome: "information_gap",
  },
  {
    question: "Are llamas allowed at the venue?",
    outcome: "information_gap",
  },
  {
    question:
      "Can you help me phrase a short question I can send the venue about whether live elephants are allowed during the ceremony?",
    outcome: "information_gap",
  },
  {
    question: "Is outside alcohol permitted?",
    outcome: "information_gap",
  },
  {
    question: "When is my next payment due?",
    outcome: "information_gap",
  },
  {
    question: "Do you allow live elephants during the ceremony?",
    outcome: "information_gap",
  },
  {
    question: "Do you allow dogs?",
    outcome: "answered_venue_guide",
  },
  {
    question: "What do I do to make a payment?",
    outcome: "answered_portal_context",
  },
  {
    question: "How do I submit a questionnaire?",
    outcome: "answered_htc_help",
  },
];

describe("ask-gap topic classifier", () => {
  it("separates pets from exotic animals (exotic first)", () => {
    assert.equal(classifyAskGapTopic("Do you allow dogs?"), "pet_policy");
    assert.equal(classifyAskGapTopic("Are pets welcome?"), "pet_policy");
    assert.equal(
      classifyAskGapTopic("Do you allow live elephants during the ceremony?"),
      "exotic_animal_policy",
    );
    assert.equal(classifyAskGapTopic("Are llamas allowed?"), "exotic_animal_policy");
    assert.equal(classifyAskGapTopic("Can we bring an alpaca?"), "exotic_animal_policy");
  });

  it("classifies alcohol conservatively", () => {
    assert.equal(classifyAskGapTopic("Is outside alcohol permitted?"), "alcohol_policy");
    assert.equal(classifyAskGapTopic("Do you allow BYOB?"), "alcohol_policy");
  });

  it("excludes portal / phrase-help / HTC / non-Guide questions", () => {
    assert.equal(classifyAskGapTopic("When is my next payment due?"), null);
    assert.equal(classifyAskGapTopic("What do I do to make a payment?"), null);
    assert.equal(
      classifyAskGapTopic(
        "Can you help me phrase a short question I can send the venue about elephants?",
      ),
      null,
    );
    assert.equal(classifyAskGapTopic("How do I submit a questionnaire?"), null);
    assert.equal(classifyAskGapTopic("What is the weather tomorrow?"), null);
  });
});

describe("published client Guide coverage", () => {
  it("pet policy text covers pet_policy but NOT exotic_animal_policy", () => {
    assert.equal(publishedClientGuideCoversTopic("pet_policy", FANCY_CLIENT_GUIDE), true);
    assert.equal(
      publishedClientGuideCoversTopic("exotic_animal_policy", FANCY_CLIENT_GUIDE),
      false,
    );
    assert.equal(
      publishedClientGuideCoversTopic("alcohol_policy", FANCY_CLIENT_GUIDE),
      false,
    );
  });

  it("exotic coverage requires exotic/livestock terms, not generic pets", () => {
    const withExotic = {
      policies: "No livestock or exotic animals are permitted on the property.",
      faqs: [],
    };
    assert.equal(publishedClientGuideCoversTopic("exotic_animal_policy", withExotic), true);
    assert.equal(publishedClientGuideCoversTopic("pet_policy", withExotic), false);
  });
});

describe("Fancy Sandbox regression — evaluateAskGapRecommendations", () => {
  it("surfaces exotic_animal_policy at >=3; never pet_policy; alcohol below threshold", () => {
    const active = evaluateAskGapRecommendations(FANCY_SIGNALS, FANCY_CLIENT_GUIDE);
    const types = active.map((r) => r.type);

    assert.ok(
      types.includes("client_ask_gap_exotic_animal_policy"),
      `expected exotic gap rec, got ${JSON.stringify(types)}`,
    );
    assert.ok(!types.includes("client_ask_gap_pet_policy"), "dogs must not produce pet gap");
    assert.ok(
      !types.includes("client_ask_gap_alcohol_policy"),
      "single alcohol gap must not produce recommendation",
    );

    const exotic = active.find((r) => r.type === "client_ask_gap_exotic_animal_policy")!;
    assert.equal(exotic.metadata.topic, "exotic_animal_policy");
    assert.equal(exotic.metadata.gap_count, 3);
    assert.equal(exotic.metadata.window_days, ASK_GAP_WINDOW_DAYS);
    assert.equal(exotic.ctas[0]?.label, "Open Venue Guide");
    assert.equal(exotic.ctas[0]?.target, "/guide");
  });

  it("removes exotic recommendation when Guide covers exotic animals", () => {
    const covered = {
      policies:
        FANCY_CLIENT_GUIDE.policies +
        " Livestock, llamas, elephants, and other exotic animals are not permitted.",
      faqs: [],
    };
    const active = evaluateAskGapRecommendations(FANCY_SIGNALS, covered);
    assert.ok(!active.some((r) => r.metadata.topic === "exotic_animal_policy"));
  });

  it("does not create a recommendation below the locked threshold", () => {
    assert.equal(ASK_GAP_MIN_COUNT, 3);
    const twoExotic = [
      { question: "Do you allow elephants?", outcome: "information_gap" },
      { question: "Are llamas ok?", outcome: "information_gap" },
    ];
    const active = evaluateAskGapRecommendations(twoExotic, FANCY_CLIENT_GUIDE);
    assert.deepEqual(active, []);
  });
});

describe("wiring — reuse luv_recommendations, no second system", () => {
  it("recommendation types follow client_ask_gap_<topic>", () => {
    assert.equal(
      recommendationTypeForAskGapTopic("exotic_animal_policy"),
      "client_ask_gap_exotic_animal_policy",
    );
    assert.deepEqual(ASK_GAP_TOPIC_GUIDE_SECTIONS.pet_policy, ["policies", "faqs"]);
  });

  it("sync aborts without clearing when signal or guide reads fail", () => {
    const src = read("lib/luv/ask-gap-recommendations.ts");
    assert.match(src, /if \(signalsError\)/);
    assert.match(src, /if \(guideError\)/);
    assert.match(src, /ask-gap signals read failed/);
    const syncFn = src.slice(src.indexOf("export async function syncClientAskGapRecommendations"));
    const abortIdx = syncFn.indexOf("if (signalsError)");
    const rpcIdx = syncFn.indexOf("sync_client_ask_gap_recommendations");
    assert.ok(abortIdx >= 0 && rpcIdx > abortIdx, "must return before RPC on read failure");
  });

  it("migration adds sync RPC only; recommendation-service calls it after generate", () => {
    const migration = read(
      "supabase/migrations/20261408600000_luv_client_ask_gap_recommendations.sql",
    );
    assert.match(migration, /sync_client_ask_gap_recommendations/);
    assert.match(migration, /client_ask_gap_%/);
    assert.doesNotMatch(migration, /create table.*luv_ask_gap/i);

    const activeVenue = read(
      "supabase/migrations/20261408700000_luv_recommendations_active_venue.sql",
    );
    assert.match(activeVenue, /current_user_venue_id\(\)/);
    assert.doesNotMatch(activeVenue, /from venue_users where user_id = auth\.uid\(\) limit 1/);

    const preserveDismiss = read(
      "supabase/migrations/20261408800000_luv_ask_gap_preserve_dismissal.sql",
    );
    assert.match(preserveDismiss, /current_user_venue_id\(\)/);
    const conflict = preserveDismiss.slice(preserveDismiss.indexOf("on conflict"));
    assert.doesNotMatch(
      conflict.slice(0, conflict.indexOf("v_upserted")),
      /dismissed_at\s*=\s*null/,
    );

    const service = read("lib/luv/recommendation-service.ts");
    assert.match(service, /syncClientAskGapRecommendations/);
    assert.match(service, /generate_venue_recommendations/);
  });
});
