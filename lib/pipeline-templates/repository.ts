/**
 * Pipeline Templates data access layer — Phase 1. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  PipelineStage, PipelineTemplate, PipelineTemplateInput, PipelineTemplateWithStages,
} from "@/lib/pipeline-templates/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = {
  id: string; venue_id: string; name: string; description: string | null; is_active: boolean;
  created_at: string; updated_at: string;
};
type StageRow = {
  id: string; venue_id: string; pipeline_template_id: string; name: string; color: string;
  sort_order: number; canonical_stage: PipelineStage["canonicalStage"]; probability: number | null;
  created_at: string; updated_at: string;
};

function mapTemplate(r: TemplateRow): PipelineTemplate {
  return {
    id: r.id, venueId: r.venue_id, name: r.name, description: r.description, isActive: r.is_active,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapStage(r: StageRow): PipelineStage {
  return {
    id: r.id, venueId: r.venue_id, pipelineTemplateId: r.pipeline_template_id, name: r.name, color: r.color,
    sortOrder: r.sort_order, canonicalStage: r.canonical_stage, probability: r.probability,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function getTemplates(client: DbClient, venueId: string): Promise<PipelineTemplate[]> {
  const { data, error } = await client.from("pipeline_templates").select("*")
    .eq("venue_id", venueId).order("name");
  if (error) throw error;
  return (data as TemplateRow[]).map(mapTemplate);
}

/**
 * "The active Pipeline Template" — Phase 2 needs a single answer to this
 * even though Phase 1 never enforced only-one-active (and choosing which
 * one is deliberately Phase 4's job, not this one). Temporary tie-break:
 * most recently updated wins if more than one is marked active. Returns
 * null if the venue has none — every caller must treat that as "fall back
 * to the existing status-only experience," not an error.
 */
export async function getActiveTemplateWithStages(client: DbClient, venueId: string): Promise<PipelineTemplateWithStages | null> {
  const { data: template, error } = await client.from("pipeline_templates").select("*")
    .eq("venue_id", venueId).eq("is_active", true)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle<TemplateRow>();
  if (error) throw error;
  if (!template) return null;
  const { data: stages, error: stagesError } = await client.from("pipeline_stages").select("*")
    .eq("pipeline_template_id", template.id).order("sort_order");
  if (stagesError) throw stagesError;
  return { ...mapTemplate(template), stages: (stages as StageRow[]).map(mapStage) };
}

export async function getTemplateWithStages(client: DbClient, venueId: string, id: string): Promise<PipelineTemplateWithStages | null> {
  const { data: template, error } = await client.from("pipeline_templates").select("*")
    .eq("id", id).eq("venue_id", venueId).maybeSingle<TemplateRow>();
  if (error) throw error;
  if (!template) return null;
  const { data: stages, error: stagesError } = await client.from("pipeline_stages").select("*")
    .eq("pipeline_template_id", id).order("sort_order");
  if (stagesError) throw stagesError;
  return { ...mapTemplate(template), stages: (stages as StageRow[]).map(mapStage) };
}

export async function insertTemplate(client: DbClient, venueId: string, input: PipelineTemplateInput): Promise<string> {
  if (input.isActive) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("pipeline_templates") as any)
      .update({ is_active: false }).eq("venue_id", venueId);
  }
  const { data, error } = await client.from("pipeline_templates")
    .insert({ venue_id: venueId, name: input.name.trim(), description: input.description.trim() || null, is_active: input.isActive })
    .select("id").single<{ id: string }>();
  if (error) throw error;

  await insertStages(client, venueId, data.id, input);
  return data.id;
}

export async function updateTemplate(client: DbClient, venueId: string, id: string, input: PipelineTemplateInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("pipeline_templates") as any)
    .update({ name: input.name.trim(), description: input.description.trim() || null, is_active: input.isActive })
    .eq("id", id).eq("venue_id", venueId);
  if (error) throw error;

  if (input.isActive) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("pipeline_templates") as any)
      .update({ is_active: false }).eq("venue_id", venueId).neq("id", id);
  }

  // Preserve stage row ids so leads.pipeline_stage_id stays valid across edits.
  const existing = await getTemplateWithStages(client, venueId, id);
  const existingById = new Map((existing?.stages ?? []).map((s) => [s.id, s]));
  const finalStages: { id: string; canonicalStage: PipelineStage["canonicalStage"] }[] = [];

  for (let i = 0; i < input.stages.length; i++) {
    const s = input.stages[i];
    const probability = s.probability.trim() ? Number(s.probability) : null;
    if (s.id && existingById.has(s.id)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (client.from("pipeline_stages") as any)
        .update({
          name: s.name.trim(),
          color: s.color,
          sort_order: i,
          canonical_stage: s.canonicalStage,
          probability,
        })
        .eq("id", s.id)
        .eq("venue_id", venueId)
        .eq("pipeline_template_id", id);
      if (updErr) throw updErr;
      finalStages.push({ id: s.id, canonicalStage: s.canonicalStage });
    } else {
      const { data: inserted, error: insErr } = await client.from("pipeline_stages")
        .insert({
          venue_id: venueId,
          pipeline_template_id: id,
          name: s.name.trim(),
          color: s.color,
          sort_order: i,
          canonical_stage: s.canonicalStage,
          probability,
        })
        .select("id")
        .single<{ id: string }>();
      if (insErr) throw insErr;
      finalStages.push({ id: inserted.id, canonicalStage: s.canonicalStage });
    }
  }

  const keptIdSet = new Set(finalStages.map((s) => s.id));
  const removed = [...existingById.keys()].filter((stageId) => !keptIdSet.has(stageId));
  if (removed.length > 0) {
    for (const removedId of removed) {
      const prior = existingById.get(removedId);
      const fallback =
        finalStages.find((s) => s.canonicalStage === prior?.canonicalStage)?.id
        ?? finalStages[0]?.id
        ?? null;
      if (fallback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client.from("leads") as any)
          .update({ pipeline_stage_id: fallback })
          .eq("venue_id", venueId)
          .eq("pipeline_stage_id", removedId);
      }
    }

    const { error: delErr } = await client.from("pipeline_stages")
      .delete()
      .eq("pipeline_template_id", id)
      .eq("venue_id", venueId)
      .in("id", removed);
    if (delErr) throw delErr;
  }
}

async function insertStages(client: DbClient, venueId: string, templateId: string, input: PipelineTemplateInput): Promise<void> {
  if (input.stages.length === 0) return;
  const { error } = await client.from("pipeline_stages").insert(
    input.stages.map((s, i) => ({
      venue_id: venueId, pipeline_template_id: templateId, name: s.name.trim(), color: s.color,
      sort_order: i, canonical_stage: s.canonicalStage,
      probability: s.probability.trim() ? Number(s.probability) : null,
    })),
  );
  if (error) throw error;
}

/**
 * Work Package D6 §57 — RLS's DELETE-role gate (Owner/Manager only,
 * pipeline_templates_delete_gate) blocks a disallowed delete by matching
 * zero rows, not by raising a Postgres error — `.select("id")` on the
 * delete is what makes a blocked delete distinguishable from a real one,
 * so Staff/Coordinator gets an honest denial instead of a false "deleted."
 */
export async function deleteTemplate(client: DbClient, venueId: string, id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await client.from("pipeline_templates").delete().eq("id", id).eq("venue_id", venueId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    return { ok: false, message: "Only an Owner or Manager can delete this template." };
  }
  return { ok: true };
}

// Template Platform — Release Readiness: Duplicate, mirroring the identical
// pattern Playbooks/Timeline Templates/Floor Plan Templates already use — a
// fresh, independent copy, always starting active (never inheriting the
// source's archived state, matching those three systems' own convention).
export async function duplicateTemplate(client: DbClient, venueId: string, sourceId: string, newName: string): Promise<string> {
  const source = await getTemplateWithStages(client, venueId, sourceId);
  if (!source) throw new Error("Template not found.");
  return insertTemplate(client, venueId, {
    name: newName,
    description: source.description ?? "",
    isActive: true,
    stages: source.stages.map((s) => ({
      name: s.name, color: s.color, canonicalStage: s.canonicalStage,
      probability: s.probability != null ? String(s.probability) : "",
    })),
  });
}

export async function setTemplateActive(client: DbClient, venueId: string, id: string, isActive: boolean): Promise<void> {
  if (isActive) {
    // Exactly one active pipeline at a time — deactivate others first.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: clearError } = await (client.from("pipeline_templates") as any)
      .update({ is_active: false }).eq("venue_id", venueId).neq("id", id);
    if (clearError) throw clearError;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("pipeline_templates") as any)
    .update({ is_active: isActive }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}
