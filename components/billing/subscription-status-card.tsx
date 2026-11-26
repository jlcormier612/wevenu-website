import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { VenueEntitlementRow } from "@/lib/entitlement";
import {
  buildSubscriptionStatusPresentation,
  formatSubscriptionPeriodEnd,
} from "@/lib/billing/subscription-status-presentation";

export function SubscriptionStatusCard({
  venueName,
  entitlement,
  saasStripeCustomerId,
}: {
  venueName: string;
  entitlement: VenueEntitlementRow | null;
  saasStripeCustomerId: string | null;
}) {
  const view = buildSubscriptionStatusPresentation({
    venueName,
    saasSubscriptionStatus: entitlement?.saas_subscription_status,
    saasStripeCustomerId:
      saasStripeCustomerId ?? entitlement?.saas_stripe_customer_id ?? null,
    entitlementStatus: entitlement?.entitlement_status,
    cancelAtPeriodEnd: entitlement?.cancel_at_period_end === true,
    accessDisabled: entitlement?.access_disabled === true,
    accessOverrideUntil: entitlement?.access_override_until,
    currentPeriodEnd: entitlement?.current_period_end,
    accessEndsAt: entitlement?.access_ends_at,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subscription status</CardTitle>
        <CardDescription>{view.headline}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground leading-relaxed">{view.detail}</p>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Stripe status</dt>
            <dd className="font-medium capitalize">{view.stripeStatusLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">HTC access</dt>
            <dd className="font-medium capitalize">{view.entitlementStatusLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{view.periodEndLabelKey}</dt>
            <dd className="font-medium">
              {formatSubscriptionPeriodEnd(view.periodEndIso)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Billing customer linked</dt>
            <dd className="font-medium">{view.billingCustomerLinked ? "Yes" : "No"}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Dates above are stored in UTC from Stripe. Your invoices use Stripe&apos;s billing
          timezone.
        </p>
      </CardContent>
    </Card>
  );
}
