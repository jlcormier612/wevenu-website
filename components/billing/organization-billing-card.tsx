"use client";

import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OrgPayload = {
  ok: boolean;
  organization: { id: string; name: string; status: string } | null;
  groupEligible?: boolean;
  qualifyingVenueCount?: number;
  reason?: string;
  members?: Array<{
    venueId: string;
    venueName: string;
    planKey: string;
    subscriptionStatus?: string | null;
    appliedOfferLabel?: string | null;
    listAmountCents?: number | null;
    appliedRecurringCents?: number | null;
    pendingAdjustmentCents?: number | null;
    isCurrent: boolean;
    groupRecurringPreviewCents: number | null;
  }>;
  pendingAdjustments?: Array<{
    venueId: string;
    status: string;
    expectedRecurringAmountCents: number | null;
    desiredOfferType: string | null;
  }>;
  addAnotherVenueAvailable?: boolean;
  message?: string;
  error?: string;
};

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function planLabel(planKey: string): string {
  if (planKey === "growing") return "Celebrate";
  if (planKey === "professional") return "Flourish";
  return "Gather";
}

export function OrganizationBillingCard() {
  const [data, setData] = useState<OrgPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [planKey, setPlanKey] = useState<"starter" | "growing" | "professional">(
    "starter",
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/organization");
        const json = (await res.json()) as OrgPayload;
        if (!res.ok) throw new Error(json.error || "Unable to load organization.");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startAddVenue() {
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/billing/organization/add-venue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposedVenueName: venueName.trim(),
          planKey,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        checkoutUrl?: string;
        message?: string;
      };
      if (!res.ok || !json.checkoutUrl) {
        throw new Error(json.error || "Unable to start Add Another Venue.");
      }
      window.location.href = json.checkoutUrl;
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization & group pricing</CardTitle>
        <CardDescription>
          {data.organization
            ? data.organization.name
            : data.message ||
              "Independent venue — add another property to unlock group pricing."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <div className="font-medium">Group eligibility</div>
          <p className="text-muted-foreground">
            {data.groupEligible
              ? `Eligible (${data.qualifyingVenueCount} qualifying properties) — 10% on each venue’s tier when it is the best offer.`
              : data.reason ||
                "Not yet eligible (need two active properties)."}
          </p>
        </div>

        {data.members && data.members.length > 0 ? (
          <ul className="space-y-3">
            {data.members.map((m) => (
              <li key={m.venueId} className="rounded-md border p-3">
                <div className="flex justify-between gap-4 font-medium">
                  <span>
                    {m.venueName}
                    {m.isCurrent ? " (this venue)" : ""}
                  </span>
                  <span>{planLabel(m.planKey)}</span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {m.appliedOfferLabel
                    ? `Applied offer: ${m.appliedOfferLabel}`
                    : "Standard pricing"}
                  {m.appliedRecurringCents != null
                    ? ` · ${formatCents(m.appliedRecurringCents)}/mo`
                    : m.groupRecurringPreviewCents != null
                      ? ` · ${formatCents(m.groupRecurringPreviewCents)}/mo with group`
                      : ""}
                </div>
                {m.pendingAdjustmentCents != null ? (
                  <div className="mt-1 text-xs text-amber-700">
                    Pending next renewal: {formatCents(m.pendingAdjustmentCents)}
                    /mo (not yet applied)
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {data.pendingAdjustments && data.pendingAdjustments.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {data.pendingAdjustments.length} pending billing adjustment
            {data.pendingAdjustments.length === 1 ? "" : "s"} for the next
            renewal — no mid-cycle charge.
          </div>
        ) : null}

        {data.addAnotherVenueAvailable && !showForm ? (
          <Button type="button" onClick={() => setShowForm(true)}>
            Add Another Venue
          </Button>
        ) : null}

        {showForm ? (
          <div className="space-y-3 rounded-md border p-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-venue-name">New property name</Label>
              <Input
                id="new-venue-name"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="e.g. Willow Barn"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-venue-plan">Subscription plan</Label>
              <select
                id="new-venue-plan"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={planKey}
                onChange={(e) =>
                  setPlanKey(
                    e.target.value as "starter" | "growing" | "professional",
                  )
                }
                disabled={busy}
              >
                <option value="starter">Gather — $199/mo</option>
                <option value="growing">Celebrate — $249/mo</option>
                <option value="professional">Flourish — $349/mo</option>
              </select>
            </div>
            <p className="text-muted-foreground text-xs">
              Each property has its own subscription, Setup Hub, and staff
              permissions. Group pricing (10%) applies when you have two or more
              active properties — and never stacks with a better Founding or
              Weven offer.
            </p>
            {formError ? (
              <p className="text-sm text-red-600">{formError}</p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={busy || !venueName.trim()}
                onClick={() => void startAddVenue()}
              >
                {busy ? "Continuing…" : "Continue to Checkout"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
