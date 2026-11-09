"use client";

import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TierUpgradePayload = {
  ok: boolean;
  currentPlan?: {
    key: string | null;
    name: string | null;
    available: boolean;
    source?: string;
  };
  currentRecurringAmount?: string | null;
  scheduledEffectivePlan?: {
    key: string;
    name: string;
    effectiveAt: string;
    activeNow: boolean;
  } | null;
  volume?: {
    peakCount: number;
    peakYear: number | null;
    recommendedPlanName: string;
  };
  pendingUpgrade?: {
    status: string;
    currentPlanName: string;
    requiredPlanName: string;
    effectiveAt: string | null;
    noticeSentAt: string | null;
    noticeDeliveryStatus?: string | null;
    currentAmount: string;
    newAmount: string;
    discountPercent: number | null;
    skippedImminentRenewal: boolean;
    activeNow: boolean;
  } | null;
  lastAppliedUpgrade?: {
    id: string;
    status: string;
    fromPlanName: string;
    toPlanName: string;
    effectiveAt: string | null;
    invoiceId: string | null;
    amount?: string | null;
  } | null;
  holdActive?: boolean;
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

export function TierUpgradeStatusCard() {
  const [data, setData] = useState<TierUpgradePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/tier-upgrade");
        const json = (await res.json()) as TierUpgradePayload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Unable to load plan growth status.");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load plan growth status.");
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
          <CardTitle className="text-base">Plan growth</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan growth</CardTitle>
          <CardDescription>Loading booking volume…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const pending = data.pendingUpgrade;
  const lastApplied = data.lastAppliedUpgrade;
  const volume = data.volume;
  const currentName = data.currentPlan?.available
    ? data.currentPlan.name
    : "Unavailable";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plan growth</CardTitle>
        <CardDescription>
          {pending
            ? `A plan change is scheduled — still on ${pending.currentPlanName} until the effective renewal.`
            : "Your plan stays aligned with your qualifying booked celebrations."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Current billed plan</dt>
            <dd className="font-medium">
              {currentName}
              {!data.currentPlan?.available ? (
                <span className="block text-xs font-normal text-muted-foreground">
                  Subscription plan snapshot not yet reconciled
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Current recurring price</dt>
            <dd className="font-medium">
              {data.currentRecurringAmount
                ? `${data.currentRecurringAmount}/month`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Peak qualifying bookings</dt>
            <dd className="font-medium">
              {volume ? `${volume.peakCount}${volume.peakYear ? ` in ${volume.peakYear}` : ""}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Required by bookings</dt>
            <dd className="font-medium">{volume?.recommendedPlanName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scheduled effective plan</dt>
            <dd className="font-medium">
              {data.scheduledEffectivePlan
                ? `${data.scheduledEffectivePlan.name} on ${formatUtc(data.scheduledEffectivePlan.effectiveAt)}`
                : "None"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Automatic upgrade hold</dt>
            <dd className="font-medium">{data.holdActive ? "Yes" : "No"}</dd>
          </div>
        </dl>

        {pending ? (
          <div className="rounded-md border border-border/70 bg-muted/30 p-3 space-y-2">
            <p className="font-medium">
              Pending: {pending.currentPlanName} → {pending.requiredPlanName}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Effective renewal: {formatUtc(pending.effectiveAt)}. Current amount{" "}
              {pending.currentAmount}/mo → {pending.newAmount}/mo
              {pending.discountPercent
                ? ` (includes your ${pending.discountPercent}% lifetime discount)`
                : ""}
              . There is no immediate charge
              {pending.skippedImminentRenewal
                ? "; the next bill keeps your current rate so you have full notice."
                : "."}
            </p>
            <p className="text-xs text-muted-foreground">
              Status: {pending.status.replace(/_/g, " ")}
              {pending.noticeSentAt
                ? ` · Notice sent ${formatUtc(pending.noticeSentAt)}`
                : " · Notice not sent yet"}
              {" · "}
              Not active yet
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground leading-relaxed">
            No pending upgrade. Hello to Cheers only moves plans upward when your
            qualifying booked volume grows — never as a surprise mid-cycle charge.
          </p>
        )}

        {lastApplied ? (
          <div className="rounded-md border border-border/70 p-3 space-y-1">
            <p className="font-medium">
              Last completed upgrade: {lastApplied.fromPlanName} →{" "}
              {lastApplied.toPlanName}
            </p>
            <p className="text-muted-foreground">
              Effective {formatUtc(lastApplied.effectiveAt)}
              {lastApplied.amount ? ` · ${lastApplied.amount}/month` : ""}
              {lastApplied.invoiceId
                ? ` · Invoice ${lastApplied.invoiceId}`
                : ""}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
