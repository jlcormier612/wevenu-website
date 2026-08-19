/**
 * CRM venue record scaffold for subscription enrollment.
 *
 * Checkout only writes `welcome_back` (request flag). Verification status
 * starts as `pending` and is updated later by staff (or future automation) —
 * never during checkout.
 */

import type { OnboardingType, WelcomeBackVerifiedStatus } from "@/lib/marketing/enrollment";
import type { SubscriptionPlanId } from "@/lib/marketing/pricing-page";

export type VenueEnrollmentRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Stripe subscription id when available */
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  stripeCheckoutSessionId: string | null;
  venueName: string;
  customerEmail: string | null;
  /** Subscriber first/last name, collected at checkout — never split from a combined string. */
  customerFirstName: string | null;
  customerLastName: string | null;
  /** Plan tier id (starter | growing | professional) */
  plan: SubscriptionPlanId | string;
  /** Display name when known (Gather | Celebrate | Flourish) */
  planName: string | null;
  /** Automatic while Founder Program is active; not a pending approval. */
  foundingMember: boolean;
  /** Self-identified Welcome Back request from checkout (`welcome_back`). */
  welcomeBackRequested: boolean;
  /**
   * Manual (or future automated) verification of Welcome Back.
   * When requested at checkout/form → starts `pending` (never auto-verified).
   * When not requested → `none`.
   */
  welcomeBackVerified: WelcomeBackVerifiedStatus;
  onboardingType: OnboardingType;
  paymentStatus: "successful" | "pending" | "failed";
  /** Monthly recurring revenue in cents from Stripe price when known */
  mrrCents?: number | null;
};

export type CreateVenueEnrollmentInput = {
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  venueName?: string | null;
  customerEmail?: string | null;
  plan: SubscriptionPlanId | string;
  planName?: string | null;
  foundingMember: boolean;
  welcomeBackRequested: boolean;
  onboardingType: OnboardingType;
  paymentStatus?: VenueEnrollmentRecord["paymentStatus"];
  mrrCents?: number | null;
  /**
   * Subscriber first/last name, collected directly at checkout (never split
   * from Stripe's billing name). Used to greet the person in the welcome
   * email and stored on the enrollment row.
   */
  customerFirstName?: string | null;
  customerLastName?: string | null;
};
