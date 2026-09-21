/**
 * Idempotent provisioning step ledger (service_role only).
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import {
  TEXTING_PROVISIONING_STEPS,
  type TextingProvisioningStep,
} from "@/lib/texting-provisioning/steps";

export type ProvisioningStepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";

export type ProvisioningStepRow = {
  id: string;
  venueId: string;
  generation: number;
  step: TextingProvisioningStep;
  status: ProvisioningStepStatus;
  resourceSid: string | null;
  attemptCount: number;
  nextAttemptAt: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  supportDebug: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
};

type DbRow = {
  id: string;
  venue_id: string;
  generation: number;
  step: string;
  status: ProvisioningStepStatus;
  resource_sid: string | null;
  attempt_count: number;
  next_attempt_at: string;
  last_error_code: string | null;
  last_error_message: string | null;
  support_debug: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
};

function mapRow(row: DbRow): ProvisioningStepRow {
  return {
    id: row.id,
    venueId: row.venue_id,
    generation: row.generation,
    step: row.step as TextingProvisioningStep,
    status: row.status,
    resourceSid: row.resource_sid,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    lastErrorCode: row.last_error_code,
    lastErrorMessage: row.last_error_message,
    supportDebug: row.support_debug,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export async function ensureProvisioningSteps(
  venueId: string,
  generation = 1,
): Promise<void> {
  const admin = createAdminClient();
  const rows = TEXTING_PROVISIONING_STEPS.map((step) => ({
    venue_id: venueId,
    generation,
    step,
    status: "pending",
    updated_at: new Date().toISOString(),
  }));
  const { error } = await admin
    .from("venue_texting_provisioning_steps")
    .upsert(rows, { onConflict: "venue_id,generation,step", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function listProvisioningSteps(
  venueId: string,
  generation = 1,
): Promise<ProvisioningStepRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("venue_texting_provisioning_steps")
    .select("*")
    .eq("venue_id", venueId)
    .eq("generation", generation)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as DbRow[] | null)?.map(mapRow) ?? [];
}

export async function getProvisioningStep(
  venueId: string,
  step: TextingProvisioningStep,
  generation = 1,
): Promise<ProvisioningStepRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("venue_texting_provisioning_steps")
    .select("*")
    .eq("venue_id", venueId)
    .eq("generation", generation)
    .eq("step", step)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as DbRow) : null;
}

export async function markStepRunning(
  venueId: string,
  step: TextingProvisioningStep,
  generation = 1,
): Promise<ProvisioningStepRow> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const existing = await getProvisioningStep(venueId, step, generation);
  const { data, error } = await admin
    .from("venue_texting_provisioning_steps")
    .update({
      status: "running",
      attempt_count: (existing?.attemptCount ?? 0) + 1,
      started_at: now,
      updated_at: now,
    })
    .eq("venue_id", venueId)
    .eq("generation", generation)
    .eq("step", step)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as DbRow);
}

export async function markStepSucceeded(input: {
  venueId: string;
  step: TextingProvisioningStep;
  generation?: number;
  resourceSid?: string | null;
  supportDebug?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "succeeded",
    completed_at: now,
    updated_at: now,
    last_error_code: null,
    last_error_message: null,
  };
  if (input.resourceSid !== undefined) patch.resource_sid = input.resourceSid;
  if (input.supportDebug) patch.support_debug = input.supportDebug;
  const { error } = await admin
    .from("venue_texting_provisioning_steps")
    .update(patch)
    .eq("venue_id", input.venueId)
    .eq("generation", input.generation ?? 1)
    .eq("step", input.step);
  if (error) throw new Error(error.message);
}

export async function markStepFailed(input: {
  venueId: string;
  step: TextingProvisioningStep;
  generation?: number;
  errorCode?: string | null;
  errorMessage: string;
  retryAt?: Date;
  supportDebug?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const retryAt = input.retryAt ?? new Date(Date.now() + 60_000);
  const { error } = await admin
    .from("venue_texting_provisioning_steps")
    .update({
      status: "failed",
      last_error_code: input.errorCode ?? null,
      last_error_message: input.errorMessage.slice(0, 500),
      next_attempt_at: retryAt.toISOString(),
      updated_at: now,
      support_debug: input.supportDebug ?? null,
    })
    .eq("venue_id", input.venueId)
    .eq("generation", input.generation ?? 1)
    .eq("step", input.step);
  if (error) throw new Error(error.message);
}

export async function claimDueProvisioningVenueIds(limit = 10): Promise<string[]> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("venue_texting_provisioning_steps")
    .select("venue_id")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", now)
    .limit(limit * 4);
  if (error) throw new Error(error.message);
  const ids = [...new Set((data ?? []).map((r: { venue_id: string }) => r.venue_id))];
  return ids.slice(0, limit);
}
