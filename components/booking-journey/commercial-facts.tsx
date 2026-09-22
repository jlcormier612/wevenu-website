"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { describeCommercialFacts } from "@/lib/booking-journey/commercial-facts";
import type { BookingJourneyModel } from "@/lib/booking-journey/model";

export function CommercialFacts({
  journey,
  contractPending,
  onSelectPackage,
  onPreviewProposal,
  onCreateShareLink,
  onCopyShareLink,
  onCreateContract,
  onSetupPayments,
  onRecordDeposit,
}: {
  journey: BookingJourneyModel;
  contractPending?: boolean;
  onSelectPackage: () => void;
  onPreviewProposal: () => void;
  onCreateShareLink: () => void;
  onCopyShareLink: () => void;
  onCreateContract: () => void;
  onSetupPayments: () => void;
  onRecordDeposit: () => void;
}) {
  const selection = journey.selection;
  const rows = describeCommercialFacts({
    selection,
    contract: journey.contract,
    paymentLines: journey.paymentLines,
    prefs: journey.prefs,
  });
  const allowOffer = journey.prefs.agreementMethod === "offer" || journey.prefs.agreementMethod === "either";
  const allowContract = journey.prefs.agreementMethod === "contract" || journey.prefs.agreementMethod === "either";
  const depositLine = journey.paymentLines.find(
    (line) => line.obligationKind === "deposit" && line.status !== "cancelled",
  );
  const depositDue = Boolean(depositLine && depositLine.status !== "paid");

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4 sm:px-5">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Booking Details
      </h2>
      <p className="mt-2 text-sm font-medium text-heading">What they booked</p>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
        These records are separate from the sales pipeline. Your venue&apos;s booking workflow determines when a relationship becomes Booked. This is not a required sequence.
      </p>
      <p className="mt-3 text-sm text-heading">{journey.direction}</p>
      <ul className="mt-4 divide-y divide-border">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-heading">{row.title}</p>
              <p className="text-sm text-heading">{row.state}</p>
              {row.detail ? <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {row.key === "package" && (
                <Button type="button" size="sm" variant={selection ? "outline" : "default"} onClick={onSelectPackage}>
                  {selection ? "View / Change package" : "Select package"}
                </Button>
              )}
              {row.key === "proposal" && selection && (
                <Button type="button" size="sm" variant="outline" onClick={onPreviewProposal}>
                  Preview
                </Button>
              )}
              {row.key === "proposal" && selection && allowOffer && selection.status !== "accepted" && (
                <Button type="button" size="sm" onClick={onCreateShareLink}>
                  Create share link
                </Button>
              )}
              {row.key === "proposal" && selection?.acceptToken && (
                <Button type="button" size="sm" variant="outline" onClick={onCopyShareLink}>
                  Copy share link
                </Button>
              )}
              {row.key === "contract" && !journey.contract && selection && allowContract && (
                <Button type="button" size="sm" variant="outline" disabled={contractPending} onClick={onCreateContract}>
                  {contractPending ? "Preparing…" : "Create contract"}
                </Button>
              )}
              {row.key === "contract" && journey.contract && (
                <Button type="button" size="sm" variant="outline" render={<Link href={`/contracts/${journey.contract.id}`} />}>
                  {journey.contract.status === "draft" ? "Preview and send" : "Open contract"}
                </Button>
              )}
              {row.key === "invoice" && selection?.invoiceId && (
                <>
                  <Button type="button" size="sm" variant="outline" render={<Link href={`/invoices/${selection.invoiceId}/print`} />}>
                    Preview
                  </Button>
                  <Button type="button" size="sm" variant="outline" render={<Link href={`/invoices/${selection.invoiceId}`} />}>
                    Open invoice
                  </Button>
                </>
              )}
              {row.key === "payment_plan" && selection && journey.paymentLines.length === 0 && (
                <Button type="button" size="sm" variant="outline" onClick={onSetupPayments}>
                  Set up payments
                </Button>
              )}
              {row.key === "deposit" && depositDue && journey.prefs.paymentCollection !== "online" && (
                <Button type="button" size="sm" variant="outline" onClick={onRecordDeposit}>
                  Record deposit received
                </Button>
              )}
              {row.key === "deposit" && !depositLine && selection && journey.prefs.initialPaymentRequired && selection.depositAmount > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={onSetupPayments}>
                  Set up deposit
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
