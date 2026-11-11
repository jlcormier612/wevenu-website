import type { Metadata } from "next";
import Link from "next/link";

import { BillingPortalButton } from "@/components/billing/billing-portal-button";
import { OrganizationBillingCard } from "@/components/billing/organization-billing-card";
import { ReferralCreditsCard } from "@/components/billing/referral-credits-card";
import { SpecialPricingCard } from "@/components/billing/special-pricing-card";
import { SubscriptionStatusCard } from "@/components/billing/subscription-status-card";
import { TierUpgradeStatusCard } from "@/components/billing/tier-upgrade-status-card";
import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasCapability } from "@/lib/authorization";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { loadVenueEntitlementRow } from "@/lib/entitlement";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Subscription & Billing — Settings" };

export default async function SubscriptionBillingSettingsPage() {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const membership = await getActiveVenueMembership();
  const canBilling =
    membership?.isOwner === true ||
    (membership ? hasCapability(membership, "account.billing") : false);

  const entitlement = await loadVenueEntitlementRow(venue.id);

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Subscription & Billing"
          description="Manage your Hello to Cheers subscription, payment method, and cancellation."
        />
      </div>
      <SettingsTabs />

      {!canBilling ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing access required</CardTitle>
            <CardDescription>
              Only venue owners (or teammates with billing permission) can manage the
              Hello to Cheers subscription.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <SubscriptionStatusCard
            venueName={venue.name}
            entitlement={entitlement}
            saasStripeCustomerId={
              entitlement?.saas_stripe_customer_id ?? venue.saasStripeCustomerId
            }
          />

          <SpecialPricingCard />

          <ReferralCreditsCard />

          <TierUpgradeStatusCard />

          <OrganizationBillingCard />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manage billing securely</CardTitle>
              <CardDescription>
                Update your payment method, download invoices, or cancel your subscription
                in Stripe&apos;s Customer Portal. Cancellation stops future renewals and
                keeps access through the end of your current paid period. There is no
                cancellation fee and unused days are not refunded.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <BillingPortalButton
                disabled={!entitlement?.saas_stripe_customer_id && !venue.saasStripeCustomerId}
              />
              {!entitlement?.saas_stripe_customer_id && !venue.saasStripeCustomerId ? (
                <p className="text-sm text-muted-foreground">
                  Billing is not linked to this venue yet. If you recently subscribed,
                  try again shortly or contact Hello to Cheers support.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Need a copy of your venue records?{" "}
                <Link href="/settings/team" className="font-medium text-primary hover:underline">
                  Export my data
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
