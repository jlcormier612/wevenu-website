import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatPresetPercent,
  formatTimingLabel,
  getAdditionalSchedulePresets,
  getPaymentPlanStarters,
} from "@/lib/payments/starters";

export const metadata: Metadata = { title: "Payment plan starters" };

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
        title="Payment plan starters"
        description="Starting structures for how you collect money — percentages and timing (at booking, or days before the event). Nothing here is sent to a couple until you attach a real schedule to their invoice."
      />

      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-2">
        <p>
          <span className="font-medium text-foreground">Starter</span>
          {" "}— a reusable starting point (for example: about ⅓ at booking, about ⅓ mid-way, about ⅓ near the Event).
          You cannot edit these library cards themselves; they are Hello to Cheers starting structures.
        </p>
        <p>
          <span className="font-medium text-foreground">Payment schedule</span>
          {" "}— the real installment plan for one booking (Sara &amp; Peter&apos;s wedding), with dollar amounts
          from their invoice and calendar due dates calculated from their booking date and Event date. That is what you customize
          and what the couple eventually sees.
        </p>
        <p>
          <span className="font-medium text-foreground">Start with this plan</span>
          {" "}opens a flow where you pick their invoice (must already have a total greater than $0), then creates
          their schedule from this starter. You can rename lines, change dates, and adjust amounts after that.
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
                <ul className="space-y-2 text-sm">
                  {preset.items.map((item) => (
                    <li key={item.label} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-foreground">{item.label}</span>
                        <span className="shrink-0 text-xs font-medium text-heading">
                          {formatPresetPercent(item.pctOfTotal)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatTimingLabel(item.timing)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Start blank on a real invoice — you name each payment, set amounts and due dates yourself,
                  and Hello to Cheers keeps the schedule total matched to the invoice.
                </p>
              )}
              <Button size="sm" render={<Link href={`/payments/new?preset=${preset.id}`} />}>
                Start with this plan
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Next: choose the couple&apos;s invoice → review calculated dates → create their schedule.
                Nothing is emailed from this page.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {additional.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              More starting splits
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Extra certified percentage splits. Same idea as above — starting points for a real booking schedule,
              not separately editable templates.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {additional.map((preset) => (
              <Card key={preset.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">{preset.label}</CardTitle>
                    <Badge variant="muted" className="text-[10px]">Starter</Badge>
                  </div>
                  <CardDescription>{preset.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <ul className="space-y-1.5 text-xs">
                    {preset.items.map((item) => (
                      <li key={item.label} className="flex justify-between gap-2 text-muted-foreground">
                        <span>
                          {item.label}
                          {" · "}
                          {formatTimingLabel(item.timing)}
                        </span>
                        <span className="shrink-0 font-medium text-foreground">
                          {formatPresetPercent(item.pctOfTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" variant="outline" render={<Link href={`/payments/new?preset=${preset.id}`} />}>
                    Start with this plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" render={<Link href="/payments/new" />}>
          Create a schedule from an invoice
        </Button>
        <p className="text-xs text-muted-foreground">
          Preferred when you already have the couple&apos;s invoice open — or start from the invoice itself
          with &quot;Create a payment schedule.&quot;
        </p>
      </div>
    </div>
  );
}
