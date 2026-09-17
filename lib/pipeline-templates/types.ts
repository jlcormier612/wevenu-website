/**
 * Pipeline Templates domain types.
 * Venue-facing stages (name/order/color) are primary; canonicalStage is the
 * reporting/normalization layer — see docs/booking-journey-design.md §2.
 */

export type CanonicalStage =
  | "inquiry" | "tour" | "proposal" | "decision" | "booked" | "lost" | "cancelled"
  | "unmapped";

const CANONICAL_STAGE_VALUES: readonly CanonicalStage[] = [
  "inquiry", "tour", "proposal", "decision", "booked", "lost", "cancelled", "unmapped",
];

export function isCanonicalStage(value: string): value is CanonicalStage {
  return (CANONICAL_STAGE_VALUES as readonly string[]).includes(value);
}

export type PipelineStage = {
  id: string;
  venueId: string;
  pipelineTemplateId: string;
  name: string;
  color: string; // hex, "#RRGGBB"
  sortOrder: number;
  canonicalStage: CanonicalStage;
  probability: number | null; // 0-100
  createdAt: string;
  updatedAt: string;
};

export type PipelineStageInput = {
  /** Existing stage id when editing — preserves FK identity for leads.pipeline_stage_id. */
  id?: string;
  name: string;
  color: string;
  canonicalStage: CanonicalStage;
  probability: string; // form input, parsed on save; "" = null
};

export type PipelineTemplate = {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PipelineTemplateWithStages = PipelineTemplate & { stages: PipelineStage[] };

export type PipelineTemplateInput = {
  name: string;
  description: string;
  isActive: boolean;
  stages: PipelineStageInput[];
};

export type PipelineTemplateErrors = Record<string, string>;

export type PipelineTemplateActionResult =
  | { ok: true }
  | { ok: false; errors?: PipelineTemplateErrors; message?: string };

export type CreatePipelineTemplateResult =
  | { ok: true; templateId: string }
  | { ok: false; errors?: PipelineTemplateErrors; message?: string };
