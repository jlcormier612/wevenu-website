/**
 * Persist minimal Couple Ask Luv signals (Luv Intelligence V1).
 * Inserts only via token-validated RPC — never trust client-supplied venue_id.
 */

import { createClient } from "@/integrations/supabase/server";
import type {
  LuvAskGuideSection,
  LuvAskKnowledgeLayer,
  LuvAskNextStepType,
  LuvAskOutcome,
} from "@/lib/luv/ask-outcome";
import { knowledgeLayerForOutcome } from "@/lib/luv/ask-outcome";
import { LUV_ASK_MAX_QUESTION_CHARS } from "@/lib/luv/ask-guard";

export type RecordLuvAskSignalInput = {
  token: string;
  question: string;
  outcome: LuvAskOutcome;
  guideSection?: LuvAskGuideSection | string | null;
  knowledgeLayer?: LuvAskKnowledgeLayer | null;
  nextSteps?: LuvAskNextStepType[];
};

/**
 * Best-effort write. Ask responses must not fail if signal persistence fails.
 */
export async function recordLuvAskSignal(input: RecordLuvAskSignalInput): Promise<void> {
  const question = input.question.trim().slice(0, LUV_ASK_MAX_QUESTION_CHARS);
  if (!question || !input.token) return;

  const knowledgeLayer =
    input.knowledgeLayer !== undefined
      ? input.knowledgeLayer
      : knowledgeLayerForOutcome(input.outcome);

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_luv_ask_signal", {
      p_token: input.token,
      p_question: question,
      p_outcome: input.outcome,
      p_guide_section: input.guideSection ?? null,
      p_knowledge_layer: knowledgeLayer,
      p_next_steps: input.nextSteps ?? [],
    });
    if (error) {
      console.error("record_luv_ask_signal failed:", error.message);
    }
  } catch (err) {
    console.error("record_luv_ask_signal error:", err);
  }
}
