/**
 * Webhook-driven reconciliation for Phase 3 upgrades.
 */

import { createCrmAdminClient, crmSupabaseConfigured } from "../relationships/pg-client";
import {
  classifyUpgradeWebhookEvidence,
  confirmUpgradeAppliedFromStripe,
} from "./tier-upgrade-stripe-plan";
import type { TierUpgradeStore } from "./tier-upgrade-store";
import type { TierUpgradeRecord } from "./tier-upgrade-types";
import type { SaasPlanKey } from "./types";

export type TierUpgradeReconcileResult =
  | {
      ok: true;
      action: "mark_applied" | "ignore_duplicate" | "ignore_premature";
      upgrade: TierUpgradeRecord | null;
      reason: string;
    }
  | {
      ok: false;
      action: "mark_failed" | "none";
      upgrade: TierUpgradeRecord | null;
      reason: string;
    };

function looksLikeUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

async function persistVenueSaasPlanKey(input: {
  venueId: string;
  planKey: SaasPlanKey;
}): Promise<void> {
  if (!crmSupabaseConfigured() || !looksLikeUuid(input.venueId)) return;
  const admin = createCrmAdminClient();
  const { error } = await admin
    .from("venues")
    .update({ saas_plan_key: input.planKey })
    .eq("id", input.venueId);
  if (error) {
    console.warn("[tier-upgrade] saas_plan_key update failed", error.message);
  }
}

/**
 * Correlate an invoice.paid (or equivalent) with a scheduled upgrade and mark applied.
 * Never invents success — requires price id + invoice amount evidence.
 */
export async function reconcileTierUpgradeFromInvoice(input: {
  store: TierUpgradeStore;
  stripeEventId: string;
  subscriptionId: string;
  subscriptionPriceId: string | null;
  invoiceId: string;
  invoiceAmountExcludingTaxCents: number | null;
  invoiceAmountPaidCents: number | null;
  invoiceStatus: string | null;
  onApplied?: (input: {
    venueId: string;
    planKey: SaasPlanKey;
    subscriptionId: string;
    invoiceId: string;
  }) => Promise<void>;
}): Promise<TierUpgradeReconcileResult> {
  const active = await input.store.getActiveUpgradeForSubscription(
    input.subscriptionId,
  );
  // Include recently applied rows so duplicate invoice.paid webhooks stay idempotent.
  const appliedMatch = (
    await input.store.listUpgradesByStatus("applied", 50)
  ).find((u) => u.stripeSubscriptionId === input.subscriptionId);
  const scheduledMatch = (
    await input.store.listUpgradesByStatus("scheduled", 50)
  ).find((u) => u.stripeSubscriptionId === input.subscriptionId);
  const candidate = active ?? scheduledMatch ?? appliedMatch ?? null;

  if (!candidate) {
    return {
      ok: true,
      action: "ignore_premature",
      upgrade: null,
      reason: "No pending/scheduled tier upgrade for this subscription.",
    };
  }

  const alreadyProcessed = Array.isArray(candidate.metadata?.processedStripeEventIds)
    ? (candidate.metadata.processedStripeEventIds as string[])
    : [];

  const confirmation = confirmUpgradeAppliedFromStripe({
    subscriptionPriceId: input.subscriptionPriceId,
    expectedPriceId: candidate.requiredStripePriceId ?? "",
    invoiceAmountPaidCents: input.invoiceAmountPaidCents,
    expectedRecurringAmountCents: candidate.expectedRecurringAmountCents,
    invoiceAmountExcludingTaxCents: input.invoiceAmountExcludingTaxCents,
    subscriptionId: input.subscriptionId,
    expectedSubscriptionId: candidate.stripeSubscriptionId,
  });

  const classified = classifyUpgradeWebhookEvidence({
    upgradeStatus: candidate.status,
    stripeEventId: input.stripeEventId,
    alreadyProcessedEventIds: alreadyProcessed,
    confirmation,
  });

  if (classified.action === "ignore_duplicate") {
    return {
      ok: true,
      action: "ignore_duplicate",
      upgrade: candidate,
      reason: classified.reason,
    };
  }
  if (classified.action === "ignore_premature") {
    return {
      ok: true,
      action: "ignore_premature",
      upgrade: candidate,
      reason: classified.reason,
    };
  }
  if (classified.action === "mark_failed") {
    const failed = await input.store.updateUpgradeStatus({
      id: candidate.id,
      status: "failed",
      error: {
        at: new Date().toISOString(),
        code: "invoice_mismatch",
        message: classified.reason,
        retryable: true,
      },
      audit: {
        at: new Date().toISOString(),
        by: "system",
        action: "reconcile_failed",
        note: classified.reason,
        detail: {
          stripeEventId: input.stripeEventId,
          invoiceId: input.invoiceId,
          invoiceStatus: input.invoiceStatus,
        },
      },
    });
    return {
      ok: false,
      action: "mark_failed",
      upgrade: failed,
      reason: classified.reason,
    };
  }

  const processed = [...alreadyProcessed, input.stripeEventId];
  const applied = await input.store.updateUpgradeStatus({
    id: candidate.id,
    status: "applied",
    patch: {
      metadata: {
        ...candidate.metadata,
        processedStripeEventIds: processed,
        appliedInvoiceId: input.invoiceId,
        appliedSubscriptionPriceId: input.subscriptionPriceId,
        appliedAmountExcludingTaxCents: input.invoiceAmountExcludingTaxCents,
        appliedAmountPaidCents: input.invoiceAmountPaidCents,
      },
    },
    audit: {
      at: new Date().toISOString(),
      by: "system",
      action: "applied",
      note: `Confirmed via Stripe invoice ${input.invoiceId}`,
      detail: {
        stripeEventId: input.stripeEventId,
        invoiceId: input.invoiceId,
        invoiceStatus: input.invoiceStatus,
        subscriptionPriceId: input.subscriptionPriceId,
        amountExcludingTax: input.invoiceAmountExcludingTaxCents,
        amountPaid: input.invoiceAmountPaidCents,
      },
    },
  });

  await persistVenueSaasPlanKey({
    venueId: applied.venueId,
    planKey: applied.requiredPlanKey,
  });

  if (input.onApplied) {
    await input.onApplied({
      venueId: applied.venueId,
      planKey: applied.requiredPlanKey,
      subscriptionId: applied.stripeSubscriptionId,
      invoiceId: input.invoiceId,
    });
  }

  return {
    ok: true,
    action: "mark_applied",
    upgrade: applied,
    reason: classified.reason,
  };
}
