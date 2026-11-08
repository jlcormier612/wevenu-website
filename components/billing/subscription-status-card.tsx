import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { VenueEntitlementRow } from "@/lib/entitlement";

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  return (
    t.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }) + " (UTC)"
  );
}

export function SubscriptionStatusCard({
  venueName,
  entitlement,
  saasStripeCustomerId,
}: {
  venueName: string;
  entitlement: VenueEntitlementRow | null;
  saasStripeCustomerId: string | null;
}) {
  const status = entitlement?.saas_subscription_status ?? "unknown";
  const cancelAtPeriodEnd = entitlement?.cancel_at_period_end === true;
  const entitlementStatus = entitlement?.entitlement_status ?? "active";
  const periodEnd = entitlement?.current_period_end ?? null;
  const accessEndsAt = entitlement?.access_ends_at ?? periodEnd;
  const overrideUntil = entitlement?.access_override_until ?? null;
  const locked = entitlement?.access_disabled === true;

  let headline = "Your subscription is active.";
  let detail = `Hello to Cheers for ${venueName} renews according to your Stripe billing period.`;

  if (locked) {
    headline = "Access is currently paused.";
    detail =
      "Your venue workspace is suspended. Update payment or contact Hello to Cheers to restore access. Your data is preserved.";
  } else if (overrideUntil) {
    headline = "Access is temporarily extended.";
    detail = `Hello to Cheers has extended access through ${formatUtc(overrideUntil)}. This does not change your Stripe invoices.`;
  } else if (cancelAtPeriodEnd) {
    headline = "Cancellation scheduled.";
    detail = `Your subscription will not renew. Access continues through ${formatUtc(accessEndsAt)}. You can reverse cancellation in the billing portal before that date.`;
  } else if (entitlementStatus === "grace") {
    headline = "Payment needs attention.";
    detail = `Your services remain available during the grace period. Access is scheduled to pause on ${formatUtc(accessEndsAt)} if payment stays unresolved.`;
  } else if (status === "past_due" || status === "unpaid") {
    headline = "Payment past due.";
    detail = "Please update your payment method to keep uninterrupted access.";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subscription status</CardTitle>
        <CardDescription>{headline}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground leading-relaxed">{detail}</p>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Stripe status</dt>
            <dd className="font-medium capitalize">{status.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">HTC access</dt>
            <dd className="font-medium capitalize">
              {entitlementStatus.replace(/_/g, " ")}
              {locked ? " (suspended)" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {cancelAtPeriodEnd ? "Access ends" : "Current period ends"}
            </dt>
            <dd className="font-medium">{formatUtc(accessEndsAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Billing customer linked</dt>
            <dd className="font-medium">{saasStripeCustomerId ? "Yes" : "No"}</dd>
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
