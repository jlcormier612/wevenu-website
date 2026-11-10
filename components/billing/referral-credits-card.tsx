"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ReferralRow = {
  id: string;
  referredVenueName: string;
  statusLabel: string;
  rewardAmountCents: number | null;
  appliedInvoiceId: string | null;
};

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function ReferralCreditsCard() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/referrals");
        const json = (await res.json()) as {
          referrals?: ReferralRow[];
          enabled?: boolean;
        };
        if (!cancelled && json.enabled !== false) {
          setRows(
            (json.referrals ?? []).filter(
              (r) =>
                r.rewardAmountCents != null ||
                r.statusLabel.toLowerCase().includes("credit") ||
                r.statusLabel.toLowerCase().includes("joined"),
            ),
          );
        }
      } catch {
        // optional card — ignore
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Referral thank-you credits</CardTitle>
        <CardDescription>
          One-time credits earned when a referred venue joins and qualifies.{" "}
          <Link href="/settings/referrals" className="font-medium text-primary hover:underline">
            Refer a venue
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.length === 0 ? (
          <p className="text-muted-foreground">
            No thank-you credits yet. When a referral qualifies, the credit appears
            here and on your next eligible SaaS invoice.
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-start justify-between gap-3 border-b border-border/50 py-2 last:border-0"
            >
              <div>
                <p className="font-medium">{row.referredVenueName}</p>
                <p className="text-muted-foreground">{row.statusLabel}</p>
              </div>
              <div className="text-right">
                {row.rewardAmountCents != null ? (
                  <p>{formatUsd(row.rewardAmountCents)}</p>
                ) : null}
                {row.appliedInvoiceId ? (
                  <p className="text-xs text-muted-foreground">
                    Invoice {row.appliedInvoiceId}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
