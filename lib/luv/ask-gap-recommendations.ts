/**
 * Couple Ask → Venue Guide gap recommendations.
 *
 * Aggregates qualifying `luv_ask_signals` (information_gap + classified topic)
 * over a rolling window, checks published client Guide coverage, and upserts
 * into the existing `luv_recommendations` table via sync RPC.
 *
 * Does not modify Ask V1 outcomes or Guide content.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentVenue } from "@/lib/venue/service";
import {
  projectGuideForAudience,
  type VenueGuideRaw,
} from "@/lib/venue-guide/audience";
import {
  ASK_GAP_GUIDE_CTA,
  ASK_GAP_MIN_COUNT,
  ASK_GAP_TOPICS,
  ASK_GAP_WINDOW_DAYS,
  buildAskGapRecommendationCopy,
  classifyAskGapTopic,
  publishedClientGuideCoversTopic,
  recommendationTypeForAskGapTopic,
  type AskGapGuideProjection,
  type AskGapTopic,
} from "./ask-gap-topics";
import type { RecommendationCta } from "./recommendation-types";

export type AskGapSignalInput = {
  question: string;
  outcome: string;
};

export type ActiveAskGapRecommendation = {
  type: string;
  title: string;
  body: string;
  priority: number;
  ctas: RecommendationCta[];
  metadata: {
    topic: AskGapTopic;
    gap_count: number;
    window_days: number;
  };
};

/**
 * Pure evaluation: count qualifying gaps, apply threshold + coverage.
 * Used by sync + unit tests (Fancy regression cases).
 */
export function evaluateAskGapRecommendations(
  signals: AskGapSignalInput[],
  clientGuide: AskGapGuideProjection | null | undefined,
): ActiveAskGapRecommendation[] {
  const counts = new Map<AskGapTopic, number>();

  for (const signal of signals) {
    if (signal.outcome !== "information_gap") continue;
    const topic = classifyAskGapTopic(signal.question);
    if (!topic) continue;
    counts.set(topic, (counts.get(topic) ?? 0) + 1);
  }

  const active: ActiveAskGapRecommendation[] = [];

  for (const topic of ASK_GAP_TOPICS) {
    const gapCount = counts.get(topic) ?? 0;
    if (gapCount < ASK_GAP_MIN_COUNT) continue;
    if (publishedClientGuideCoversTopic(topic, clientGuide)) continue;

    const { title, body } = buildAskGapRecommendationCopy(topic, gapCount);
    active.push({
      type: recommendationTypeForAskGapTopic(topic),
      title,
      body,
      priority: 75,
      ctas: [ASK_GAP_GUIDE_CTA],
      metadata: {
        topic,
        gap_count: gapCount,
        window_days: ASK_GAP_WINDOW_DAYS,
      },
    });
  }

  return active;
}

type OperationalInfoRow = {
  policies: string | null;
  faqs: unknown;
  section_audiences: unknown;
  section_overrides: unknown;
  parking_info: string | null;
  transportation: string | null;
  nearby_accommodations: string | null;
  hotel_blocks: unknown;
  rain_plan: string | null;
  ceremony_instructions: string | null;
  things_to_do: string | null;
  important_contacts: unknown;
};

function mapOperationalRowToGuideRaw(row: OperationalInfoRow): VenueGuideRaw {
  return {
    parkingInfo: row.parking_info,
    transportation: row.transportation,
    nearbyAccommodations: row.nearby_accommodations,
    hotelBlocks: Array.isArray(row.hotel_blocks) ? row.hotel_blocks : [],
    rainPlan: row.rain_plan,
    policies: row.policies,
    ceremonyInstructions: row.ceremony_instructions,
    thingsToDo: row.things_to_do,
    faqs: Array.isArray(row.faqs)
      ? (row.faqs as VenueGuideRaw["faqs"])
      : [],
    importantContacts: Array.isArray(row.important_contacts)
      ? row.important_contacts
      : [],
    sectionAudiences: row.section_audiences,
    sectionOverrides: row.section_overrides,
  };
}

/**
 * Load published client Guide + recent information_gap signals, evaluate,
 * and sync into luv_recommendations via security-definer RPC.
 */
export async function syncClientAskGapRecommendations(
  supabase: SupabaseClient,
): Promise<void> {
  try {
    const venue = await getCurrentVenue();
    if (!venue) return;

    const since = new Date(
      Date.now() - ASK_GAP_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [{ data: signals, error: signalsError }, { data: opRow, error: guideError }] =
      await Promise.all([
      supabase
        .from("luv_ask_signals")
        .select("question, outcome")
        .eq("venue_id", venue.id)
        .eq("outcome", "information_gap")
        .gte("created_at", since),
      supabase
        .from("venue_operational_info")
        .select(
          "policies, faqs, section_audiences, section_overrides, parking_info, transportation, nearby_accommodations, hotel_blocks, rain_plan, ceremony_instructions, things_to_do, important_contacts",
        )
        .eq("venue_id", venue.id)
        .maybeSingle<OperationalInfoRow>(),
    ]);

    // Never sync an empty payload when reads failed — the RPC would clear
    // pending client_ask_gap_* rows (including ones the venue just dismissed).
    if (signalsError) {
      console.error("ask-gap signals read failed:", signalsError.message);
      return;
    }
    if (guideError) {
      console.error("ask-gap guide read failed:", guideError.message);
      return;
    }

    const projected = projectGuideForAudience(
      opRow ? mapOperationalRowToGuideRaw(opRow) : null,
      "clients",
    );

    const active = evaluateAskGapRecommendations(signals ?? [], projected);

    const { error } = await supabase.rpc("sync_client_ask_gap_recommendations", {
      p_gaps: active,
    });
    if (error) {
      console.error("sync_client_ask_gap_recommendations failed:", error.message);
    }
  } catch (err) {
    console.error("syncClientAskGapRecommendations error:", err);
  }
}
