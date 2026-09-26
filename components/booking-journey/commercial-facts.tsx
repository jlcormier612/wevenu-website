"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { describeCommercialFacts } from "@/lib/booking-journey/commercial-facts";
import type { BookingJourneyModel } from "@/lib/booking-journey/model";
import { collectsInitialPayment } from "@/lib/booking-journey/venue-prefs";
import { publicAppOrigin } from "@/lib/env";
import { toast } from "sonner";

export function CommercialFacts({
  journey,
  contractPending,
  onSelectPackage,
  onCreateProposal,
  onPreviewProposal,
  onCreateShareLink,
  onCopyShareLink,
  onResendProposalEmail,
  onCreateContract,
  onSetupPayments,
  onRecordDeposit,
}: {
  journey: BookingJourneyModel;
  contractPending?: boolean;
  onSelectPackage: () => void;
  onCreateProposal?: () => void;
  onPreviewProposal: () => void;
  onCreateShareLink: () => void;
  onCopyShareLink: () => void;
  onResendProposalEmail?: () => void;
  onCreateContract: () => void;
  onSetupPayments: () => void;
  onRecordDeposit: () => void;
}) {
  const selection = journey.selection;
  const proposal = journey.proposal;
  const rows = describeCommercialFacts({
    selection,
    proposal,
    contract: journey.contract,
    paymentLines: journey.paymentLines,
    prefs: journey.prefs,
  });
  const allowOffer = journey.prefs.agreementMethod === "offer" || journey.prefs.agreementMethod === "either";
  const allowContract = journey.prefs.agreementMethod === "contract" || journey.prefs.agreementMethod === "either";
  const allowSelectPackage =
    journey.prefs.agreementMethod === "contract" || journey.prefs.agreementMethod === "either";
  const depositLine = journey.paymentLines.find(
    (line) => line.obligationKind === "deposit" && line.status !== "cancelled",
  );
  const depositDue = Boolean(depositLine && depositLine.status !== "paid");
  const collectPayment = collectsInitialPayment(journey.prefs);

  function copyProposalLink() {
    const token = proposal?.acceptToken;
    if (!token) {
      toast.error("Send the proposal first to get a share link.");
      return;
    }
    const url = `${publicAppOrigin()}/offer/${token}`;
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Proposal link copied."),
      () => toast.error("Could not copy the link."),
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4 sm:px-5">
      <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Booking Details
      </h2>
      <p className="mt-2 text-sm font-medium text-heading">What they booked</p>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
        These records are separate from the sales pipeline. You mark a relationship Booked when you&apos;re ready — payment does not decide it.
      </p>
      <p className="mt-3 text-sm text-heading">{journey.direction}</p>

      {!selection && !proposal ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {allowOffer && onCreateProposal ? (
            <Button type="button" size="sm" onClick={onCreateProposal}>
              Create proposal
              <span className="ml-1.5 hidden text-xs font-normal opacity-80 sm:inline">
                — Let the couple choose
              </span>
            </Button>
          ) : null}
          {allowSelectPackage ? (
            <Button
              type="button"
              size="sm"
              variant={allowOffer ? "outline" : "default"}
              onClick={onSelectPackage}
            >
              Select package
              <span className="ml-1.5 hidden text-xs font-normal opacity-80 sm:inline">
                — Choose the package now
              </span>
            </Button>
          ) : null}
        </div>
      ) : null}

      <ul className="mt-4 divide-y divide-border">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-heading">{row.title}</p>
              <p className="text-sm text-heading">{row.state}</p>
              {row.detail ? <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {row.key === "package" && selection ? (
                <Button type="button" size="sm" variant="outline" onClick={onSelectPackage}>
                  View / Change package
                </Button>
              ) : null}
              {row.key === "package" && selection && !proposal && allowOffer && selection.status !== "accepted" ? (
                <Button type="button" size="sm" onClick={onCreateShareLink}>
                  Create share link
                </Button>
              ) : null}
              {row.key === "package" && selection?.acceptToken && !proposal ? (
                <Button type="button" size="sm" variant="outline" onClick={onCopyShareLink}>
                  Copy share link
                </Button>
              ) : null}
              {row.key === "package" && selection && !proposal ? (
                <Button type="button" size="sm" variant="outline" onClick={onPreviewProposal}>
                  Preview
                </Button>
              ) : null}

              {row.key === "proposal" && proposal ? (
                <>
                  {onCreateProposal && (proposal.status === "draft" || proposal.status === "superseded") ? (
                    <Button type="button" size="sm" onClick={onCreateProposal}>
                      {proposal.status === "draft" ? "Continue proposal" : "Create proposal"}
                    </Button>
                  ) : null}
                  {proposal.acceptToken ? (
                    <Button type="button" size="sm" variant="outline" onClick={copyProposalLink}>
                      Copy proposal link
                    </Button>
                  ) : null}
                  {onResendProposalEmail && (proposal.status === "sent" || proposal.status === "selected") ? (
                    <Button type="button" size="sm" variant="outline" onClick={onResendProposalEmail}>
                      Resend proposal email
                    </Button>
                  ) : null}
                </>
              ) : null}

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
              {row.key === "deposit" && !depositLine && selection && collectPayment && selection.depositAmount > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={onSetupPayments}>
                  Set up initial payment
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
