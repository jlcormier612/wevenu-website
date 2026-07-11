/**
 * Pipeline Templates domain types — Phase 1 (editor only, no Leads connection).
 * See docs/booking-journey-design.md §2 for the canonical/venue-facing split.
 */

export type CanonicalStage = "inquiry" | "tour" | "proposal" | "decision" | "booked" | "lost" | "cancelled";

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
