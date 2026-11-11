/**
 * Phase 6 — Stripe Test credit issuance.
 *
 * Uses a subscription-scoped negative invoice item so the credit applies to the
 * referring venue's next SaaS subscription invoice — not a customer-wide balance
 * that could attach to White Glove or another venue's charges.
 */

export type StripeReferralInvoiceItem = {
  id: string;
  customer: string;
  subscription?: string | null;
  amount: number;
  currency: string;
  invoice?: string | null;
  description?: string | null;
  metadata?: Record<string, string> | null;
};

export type StripeReferralInvoice = {
  id: string;
  subscription?: string | null;
  customer?: string | null;
  status?: string | null;
  total?: number | null;
  amount_due?: number | null;
  lines?: {
    data?: Array<{
      id?: string;
      amount?: number;
      description?: string | null;
      invoice_item?: string | null;
      type?: string | null;
      metadata?: Record<string, string> | null;
    }>;
  } | null;
};

export type StripeReferralExecutor = {
  invoiceItems: {
    create(
      params: {
        customer: string;
        subscription: string;
        amount: number;
        currency: string;
        description: string;
        metadata?: Record<string, string>;
      },
      opts?: { idempotencyKey?: string },
    ): Promise<StripeReferralInvoiceItem>;
    retrieve(id: string): Promise<StripeReferralInvoiceItem>;
  };
  invoices: {
    retrieve(id: string): Promise<StripeReferralInvoice>;
    list(params: {
      customer: string;
      subscription?: string;
      status?: string;
      limit?: number;
    }): Promise<{ data: StripeReferralInvoice[] }>;
  };
};

export function referralCreditIdempotencyKey(rewardId: string): string {
  return `referral-credit:v1:${rewardId}`;
}

/**
 * Issue a one-time negative invoice item on the referring venue's SaaS subscription.
 * Amount must be positive cents; we negate when creating the Stripe item.
 */
export async function issueReferralSubscriptionCredit(
  stripe: StripeReferralExecutor,
  input: {
    rewardId: string;
    referralId: string;
    customerId: string;
    subscriptionId: string;
    amountCents: number;
    currency?: string;
    description?: string;
  },
): Promise<{ invoiceItemId: string; idempotencyKey: string }> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new Error("referral_credit_amount_invalid");
  }
  if (!input.customerId || !input.subscriptionId) {
    throw new Error("referral_credit_missing_billing_ids");
  }

  const idempotencyKey = referralCreditIdempotencyKey(input.rewardId);
  const item = await stripe.invoiceItems.create(
    {
      customer: input.customerId,
      subscription: input.subscriptionId,
      amount: -Math.round(input.amountCents),
      currency: (input.currency || "usd").toLowerCase(),
      description:
        input.description ||
        "Hello to Cheers — Refer a Venue thank-you credit (one month)",
      metadata: {
        htc_referral_reward_id: input.rewardId,
        htc_referral_id: input.referralId,
        htc_credit_kind: "refer_a_venue",
        htc_scope: "saas_subscription",
      },
    },
    { idempotencyKey },
  );

  if (!item?.id) throw new Error("referral_credit_create_failed");
  if (item.subscription && item.subscription !== input.subscriptionId) {
    throw new Error("referral_credit_subscription_mismatch");
  }

  return { invoiceItemId: item.id, idempotencyKey };
}

/**
 * Detect whether a pending invoice item has been attached to a paid/open invoice.
 */
export async function findAppliedReferralCreditInvoice(
  stripe: StripeReferralExecutor,
  input: {
    customerId: string;
    subscriptionId: string;
    invoiceItemId: string;
  },
): Promise<{ invoiceId: string; invoice: StripeReferralInvoice } | null> {
  const listed = await stripe.invoices.list({
    customer: input.customerId,
    subscription: input.subscriptionId,
    limit: 20,
  });

  for (const invoice of listed.data ?? []) {
    const lines = invoice.lines?.data ?? [];
    const hit = lines.some((line) => {
      if (line.invoice_item === input.invoiceItemId) return true;
      const meta = line.metadata ?? {};
      return false;
    });
    if (hit) {
      return { invoiceId: invoice.id, invoice };
    }
  }

  // Fallback: retrieve the invoice item — Stripe populates invoice when attached.
  try {
    const item = await stripe.invoiceItems.retrieve(input.invoiceItemId);
    if (item.invoice) {
      const invoice = await stripe.invoices.retrieve(item.invoice);
      if (
        !invoice.subscription ||
        invoice.subscription === input.subscriptionId
      ) {
        return { invoiceId: invoice.id, invoice };
      }
    }
  } catch {
    // ignore retrieve failures; caller can retry
  }
  return null;
}
