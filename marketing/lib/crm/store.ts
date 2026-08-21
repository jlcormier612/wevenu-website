/**
 * Durable venue enrollment records — Postgres venue_enrollments.
 *
 * Replaces the former marketing/.data/venue-enrollments.jsonl sidecar.
 * Idempotency for Stripe webhooks uses the same product SoT as activation.
 */

import { createClient } from "@supabase/supabase-js";

import type { VenueEnrollmentRecord } from "@/lib/crm/types";

function adminClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    throw new Error(
      "Marketing CRM enrollment store requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type EnrollmentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  venue_name: string;
  owner_email: string;
  plan: string | null;
  onboarding_type: string;
  status: string;
};

function rowToRecord(row: EnrollmentRow): VenueEnrollmentRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    venueName: row.venue_name,
    customerEmail: row.owner_email,
    plan: row.plan || "none",
    planName: null,
    // Founding / welcome-back live on the Relationship CRM row; enrollment
    // idempotency only needs identity + Stripe keys.
    foundingMember: false,
    welcomeBackRequested: false,
    welcomeBackVerified: "none",
    onboardingType: row.onboarding_type === "white_glove" ? "white_glove" : "self_guided",
    paymentStatus: row.status === "activated" ? "successful" : "successful",
  };
}

/**
 * Persist is a no-op for the local file era — durable write is
 * upsertVenueEnrollment (product bridge). Kept so call sites compile.
 */
export async function storeVenueEnrollment(_record: VenueEnrollmentRecord): Promise<void> {
  // Durable persistence happens via upsertVenueEnrollment in createVenueEnrollment.
}

export async function listVenueEnrollments(): Promise<VenueEnrollmentRecord[]> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("venue_enrollments")
    .select(
      "id, created_at, updated_at, stripe_subscription_id, stripe_customer_id, stripe_checkout_session_id, venue_name, owner_email, plan, onboarding_type, status",
    )
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as EnrollmentRow[]).map(rowToRecord);
}

/** Idempotency lookup — Stripe Checkout Session id is the durable purchase key. */
export async function findEnrollmentByCheckoutSessionId(
  checkoutSessionId: string | null | undefined,
): Promise<VenueEnrollmentRecord | null> {
  const id = checkoutSessionId?.trim();
  if (!id) return null;
  const admin = adminClient();
  const { data, error } = await admin
    .from("venue_enrollments")
    .select(
      "id, created_at, updated_at, stripe_subscription_id, stripe_customer_id, stripe_checkout_session_id, venue_name, owner_email, plan, onboarding_type, status",
    )
    .eq("stripe_checkout_session_id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToRecord(data as EnrollmentRow) : null;
}

/** Idempotency lookup by Stripe Subscription id. */
export async function findEnrollmentBySubscriptionId(
  subscriptionId: string | null | undefined,
): Promise<VenueEnrollmentRecord | null> {
  const id = subscriptionId?.trim();
  if (!id) return null;
  const admin = adminClient();
  const { data, error } = await admin
    .from("venue_enrollments")
    .select(
      "id, created_at, updated_at, stripe_subscription_id, stripe_customer_id, stripe_checkout_session_id, venue_name, owner_email, plan, onboarding_type, status",
    )
    .eq("stripe_subscription_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToRecord(data as EnrollmentRow) : null;
}

/** Update Welcome Back verification — now stored on the Relationship CRM row. */
export async function updateWelcomeBackVerified(
  _id: string,
  _status: VenueEnrollmentRecord["welcomeBackVerified"],
): Promise<VenueEnrollmentRecord | null> {
  console.warn(
    "[crm] updateWelcomeBackVerified is a no-op on venue_enrollments; use Relationship welcomeBackVerified via workspace.",
  );
  return null;
}
