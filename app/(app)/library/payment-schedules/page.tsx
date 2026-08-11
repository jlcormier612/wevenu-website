import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAdditionalSchedulePresets,
  getPaymentPlanStarters,
} from "@/lib/payments/starters";

export const metadata: Metadata = { title: "Payment Schedules" };

/**
 * Browse Hello to Cheers payment-plan starters.
 * These are code masters (SCHEDULE_PRESETS) — not a second DB template system.
 * Applying a schedule always happens from a real Invoice so amounts reconcile.
 */
export default function PaymentSchedulesLibraryPage() {
  const starters = getPaymentPlanStarters();
  const additional = getAdditionalSchedulePresets();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Schedules"
        description="Choose a starting schedule, then adjust it to match the way your venue collects payments. Amounts always come from the linked invoice — never retyped."
      />

      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Payment Plan</span> = overall schedule.{" "}
          <span className="font-medium text-foreground">Invoice</span> = what you&apos;re asking for now.{" "}
          <span className="font-medium text-foreground">Payment</span> = what was actually received.
        </p>
        <p className="mt-1">
          These starters are venue-safe structures only — no cancellation fees, late fees, or legal payment language.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {starters.map((preset) => (
          <Card key={preset.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{preset.label}</CardTitle>
                <Badge variant="muted" className="text-[10px]">Starter</Badge>
              </div>
              <CardDescription>{preset.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {preset.items.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {preset.items.map((item) => (
                    <li key={item.label} className="flex justify-between gap-2 border-b border-border/50 pb-1.5 last:border-0">
                      <span className="text-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {item.offsetDaysFromEvent != null
                          ? `${Math.abs(item.offsetDaysFromEvent)} days before event`
                          : "Date set when applied"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Start blank — add payments, name them, set amounts and due dates, and review the total against the invoice.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {additional.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional certified splits</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {additional.map((preset) => (
              <Card key={preset.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{preset.label}</CardTitle>
                  <CardDescription>{preset.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" render={<Link href="/payments/new" />}>
          Create a Payment Plan
        </Button>
        <p className="text-xs text-muted-foreground">
          Starts from an invoice so the schedule total always matches the financial commitment.
        </p>
      </div>
    </div>
  );
}
