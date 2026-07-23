/**
 * Stripe Customer object — created/reused on a client's first Checkout
 * Session, not eagerly on account connect (docs/venue-payment-processing-
 * architecture.md §6 decision 1). Mirrors lib/quickbooks/sync/customer.ts's
 * shape: raw admin-client table access, idempotency query before create.
 *
 * Direct Charges (Standard Connect): the Customer object must live on the
 * *connected* account, not Wevenu's platform account — created with the
 * `stripeAccount` request option throughout.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { getStripeClient } from "@/lib/stripe/config";
import { clientDisplayName } from "@/lib/clients/constants";

type ClientRow = {
  id: string;
  first_name: string; last_name: string;
  partner_first_name: string | null; partner_last_name: string | null;
  email: string | null;
  stripe_customer_id: string | null;
};

/** Returns the client's Stripe Customer id on the given connected account, creating one if needed. */
export async function ensureStripeCustomer(venueId: string, clientId: string, stripeAccountId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("clients")
    .select("id, first_name, last_name, partner_first_name, partner_last_name, email, stripe_customer_id")
    .eq("id", clientId).eq("venue_id", venueId).maybeSingle<ClientRow>();
  if (!data) return null;
  if (data.stripe_customer_id) return data.stripe_customer_id;

  const stripe = getStripeClient();
  const name = clientDisplayName(data.first_name, data.last_name, data.partner_first_name, data.partner_last_name);

  // Idempotency: a client re-checking out before the prior write landed
  // shouldn't create a second Customer object for the same person.
  if (data.email) {
    const existing = await stripe.customers.list(
      { email: data.email, limit: 1 },
      { stripeAccount: stripeAccountId },
    );
    if (existing.data[0]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from("clients") as any).update({ stripe_customer_id: existing.data[0].id }).eq("id", clientId).eq("venue_id", venueId);
      return existing.data[0].id;
    }
  }

  const customer = await stripe.customers.create(
    { name: name || undefined, email: data.email ?? undefined, metadata: { wevenu_client_id: clientId, wevenu_venue_id: venueId } },
    { stripeAccount: stripeAccountId },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from("clients") as any).update({ stripe_customer_id: customer.id }).eq("id", clientId).eq("venue_id", venueId);
  return customer.id;
}
