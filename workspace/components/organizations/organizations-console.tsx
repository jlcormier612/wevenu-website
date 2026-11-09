"use client";

import { useEffect, useState } from "react";

type OrgRow = {
  id: string;
  name: string;
  status: string;
  reviewStatus: string;
  groupEligible: boolean;
  qualifyingVenueCount: number;
  reason: string;
  members: Array<{
    venueId: string;
    venueName: string;
    status: string;
    planKey: string | null;
    subscriptionStatus: string | null;
    reviewRequired: boolean;
    reviewReason: string | null;
  }>;
  adjustments: Array<{
    id: string;
    venueId: string;
    status: string;
    desiredOfferType: string | null;
    expectedRecurringAmountCents: number | null;
    errorMessage: string | null;
  }>;
  lastSnapshot: {
    evaluatedAt: string;
    groupEligible: boolean;
    reason: string;
    triggerEvent: string | null;
  } | null;
};

type Payload = {
  ok: boolean;
  organizations: OrgRow[];
  error?: string;
  gates?: { groupPricingFlag?: boolean; durableStore?: boolean };
};

function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function OrganizationsConsole() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/relationships/organizations");
        const json = (await res.json()) as Payload;
        if (!res.ok) throw new Error(json.error || "Unable to load organizations.");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6 text-sm">
      <div className="rounded-lg border p-4">
        <div>
          <span className="font-medium">Group pricing flag: </span>
          {data.gates?.groupPricingFlag ? "on" : "off"}
        </div>
        <div>
          <span className="font-medium">Durable store: </span>
          {data.gates?.durableStore ? "postgres" : "memory (local)"}
        </div>
        <div className="text-muted-foreground mt-1">
          Organizations: {data.organizations.length}
        </div>
      </div>

      {data.organizations.length === 0 ? (
        <p className="text-muted-foreground">
          No billing organizations yet. They appear after Add Another Venue
          creates an explicit organization membership.
        </p>
      ) : (
        data.organizations.map((org) => (
          <article key={org.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">{org.name}</h2>
              <span className="text-muted-foreground">
                {org.groupEligible
                  ? `Group eligible · ${org.qualifyingVenueCount} properties`
                  : `Not eligible · ${org.qualifyingVenueCount} qualifying`}
              </span>
            </div>
            <p className="text-muted-foreground">{org.reason}</p>
            {org.reviewStatus !== "none" ? (
              <p className="text-amber-700">Review: {org.reviewStatus}</p>
            ) : null}

            <div>
              <div className="font-medium">Member venues</div>
              <ul className="mt-1 space-y-1">
                {org.members.map((m) => (
                  <li key={m.venueId}>
                    {m.venueName} · {m.planKey ?? "—"} · {m.subscriptionStatus ?? "—"} ·{" "}
                    {m.status}
                    {m.reviewRequired ? (
                      <span className="text-amber-700">
                        {" "}
                        (review: {m.reviewReason})
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            {org.adjustments.length > 0 ? (
              <div>
                <div className="font-medium">Billing adjustments</div>
                <ul className="mt-1 space-y-1">
                  {org.adjustments.map((a) => (
                    <li key={a.id}>
                      {a.status} · {a.desiredOfferType ?? "none"} ·{" "}
                      {formatCents(a.expectedRecurringAmountCents)}
                      {a.errorMessage ? (
                        <span className="text-red-600"> — {a.errorMessage}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {org.lastSnapshot ? (
              <p className="text-xs text-muted-foreground">
                Last eligibility snapshot: {org.lastSnapshot.evaluatedAt}
                {org.lastSnapshot.triggerEvent
                  ? ` (${org.lastSnapshot.triggerEvent})`
                  : ""}
              </p>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
