/**
 * Shared automation tick — sequences, workflows, and optional lifecycle sweeps.
 * Used by `/api/cron/automations`, individual tick routes, and `npm run tick:automations`.
 */
import { tickPaymentDunning, tickRenewalStages } from "@shared/relationships";
import { sendDunningCheckpointEmail } from "@shared/relationships/dunning-notify";
import type { DunningDay } from "@shared/relationships/types";

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
  dunningEmails: Array<{
    relationshipId: string;
    day: number;
    sent: boolean;
    skipped: boolean;
    error?: string;
  }>;
  tickedAt: string;
};

async function createBillingPortalUrl(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId?.trim()) return null;
  const base = (
    process.env.MARKETING_URL ||
    process.env.NEXT_PUBLIC_MARKETING_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  ).replace(/\/$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/stripe/portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId }),
    });
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}

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
  const dunningEmails: TickAutomationsResult["dunningEmails"] = [];

  if (includeLifecycle) {
    renewals = await tickRenewalStages();
    dunning = await tickPaymentDunning();

    // Emails are required for a complete dunning experience. Suspension from
    // tickPaymentDunning must not be silent — attempt notify for each due day.
    for (const row of dunning ?? []) {
      if (row.reminderDay == null && !row.shouldSuspend) continue;
      const day = (row.reminderDay ?? 21) as DunningDay;
      const rel = await getRelationship(row.relationshipId);
      const portalUrl = await createBillingPortalUrl(rel?.stripeCustomerId);
      const result = await sendDunningCheckpointEmail({
        relationshipId: row.relationshipId,
        day,
        shouldSuspend: row.shouldSuspend,
        billingPortalUrl: portalUrl,
      });
      dunningEmails.push({
        relationshipId: row.relationshipId,
        day,
        sent: result.sent,
        skipped: result.skipped,
        error: result.error,
      });
    }
  }

  return {
    ok: true,
    sequences,
    workflows,
    renewals,
    dunning,
    dunningEmails,
    tickedAt: new Date().toISOString(),
  };
}
