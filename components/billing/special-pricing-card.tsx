"use client";

import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Payload = {
  ok: boolean;
  currentTier?: { name: string };
  standardRecurringPrice?: string;
  appliedDiscount?: { label: string; source: string };
  actualRecurringPrice?: string;
  nextRenewal?: string | null;
  scheduledChanges?: Array<{
    label: string;
    effectiveAt: string;
    expiresAt: string | null;
    reconciled: boolean;
  }>;
  activeSpecialPricing?: Array<{
    label: string;
    effectiveAt: string;
    expiresAt: string | null;
    reconciled: boolean;
  }>;
  error?: string;
};

function formatUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function SpecialPricingCard() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/special-pricing");
        const json = (await res.json()) as Payload;
        if (!res.ok) throw new Error(json.error || "Unable to load pricing.");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load pricing.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your pricing</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your pricing</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your pricing</CardTitle>
        <CardDescription>
          Current plan, any special arrangement, and what renews next.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Current tier</dt>
            <dd className="font-medium">{data.currentTier?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Standard recurring price</dt>
            <dd className="font-medium">
              {data.standardRecurringPrice
                ? `${data.standardRecurringPrice}/month`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Applied pricing</dt>
            <dd className="font-medium">
              {data.appliedDiscount?.label ?? "Standard pricing"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Your recurring price</dt>
            <dd className="font-medium">
              {data.actualRecurringPrice
                ? `${data.actualRecurringPrice}/month`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Next renewal</dt>
            <dd className="font-medium">{formatUtc(data.nextRenewal)}</dd>
          </div>
        </dl>

        {(data.activeSpecialPricing ?? []).length > 0 ? (
          <div className="rounded-md border border-border/70 bg-muted/30 p-3 space-y-1">
            {(data.activeSpecialPricing ?? []).map((row, i) => (
              <p key={`${row.label}-${i}`}>
                {row.label}
                {row.expiresAt
                  ? ` through ${formatUtc(row.expiresAt)}`
                  : " (ongoing)"}
                {!row.reconciled
                  ? " — pending billing confirmation"
                  : ""}
              </p>
            ))}
          </div>
        ) : null}

        {(data.scheduledChanges ?? []).length > 0 ? (
          <div className="rounded-md border border-border/70 p-3 space-y-1">
            <p className="font-medium">Scheduled changes</p>
            {(data.scheduledChanges ?? []).map((row, i) => (
              <p key={`${row.effectiveAt}-${i}`} className="text-muted-foreground">
                {row.label} starts {formatUtc(row.effectiveAt)}
                {row.expiresAt ? `, ends ${formatUtc(row.expiresAt)}` : ""}
                . Not yet reflected on your Stripe invoice until confirmed.
              </p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
