/**
 * Shared automation tick — sequences, workflows, and optional lifecycle sweeps.
 * Used by `/api/cron/automations`, individual tick routes, and `npm run tick:automations`.
 */
import { tickPaymentDunning, tickRenewalStages } from "@shared/relationships";

import { getRelationship } from "@/lib/data/store";
import { tickWorkflows } from "@/lib/program3/engine";
import { tickSequences } from "@/lib/program3/sequence-engine";
import { ensureProgram3Data } from "@/lib/program3/store";

export type TickAutomationsResult = {
  ok: true;
  sequences: Awaited<ReturnType<typeof tickSequences>>;
  workflows: Awaited<ReturnType<typeof tickWorkflows>>;
  renewals: Awaited<ReturnType<typeof tickRenewalStages>> | null;
  dunning: Awaited<ReturnType<typeof tickPaymentDunning>> | null;
  tickedAt: string;
};

export async function tickAutomations(opts?: {
  /** Include renewal anniversary + payment dunning sweeps (default true). */
  includeLifecycle?: boolean;
}): Promise<TickAutomationsResult> {
  const includeLifecycle = opts?.includeLifecycle !== false;

  await ensureProgram3Data();

  const sequences = await tickSequences(getRelationship);
  const workflows = await tickWorkflows(getRelationship);

  let renewals: TickAutomationsResult["renewals"] = null;
  let dunning: TickAutomationsResult["dunning"] = null;

  if (includeLifecycle) {
    renewals = await tickRenewalStages();
    dunning = await tickPaymentDunning();
  }

  return {
    ok: true,
    sequences,
    workflows,
    renewals,
    dunning,
    tickedAt: new Date().toISOString(),
  };
}
