import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { ProposalView } from "@/lib/booking-journey/proposal-view";
import { formatCurrency } from "@/lib/invoices/constants";

/**
 * The couple-facing proposal body. Venue preview and /offer/{token} share
 * this renderer so the review cannot drift from what the couple receives.
 */
export function ProposalArtifact({
  proposal,
  context,
  acceptSlot,
}: {
  proposal: ProposalView;
  context: "couple" | "venue-preview";
  acceptSlot?: ReactNode;
}) {
  const showDeposit = proposal.depositAmount > 0;
  const accepted = proposal.status === "accepted";

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Your proposal
      </p>
      {proposal.venueName ? (
        <p className="mt-2 text-sm text-muted-foreground">{proposal.venueName}</p>
      ) : null}
      <h1 className="mt-2 font-heading text-3xl text-heading">{proposal.name}</h1>
      <p className="mt-2 text-2xl font-semibold text-heading">
        {formatCurrency(proposal.totalAmount)}
      </p>
      {showDeposit ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Deposit {formatCurrency(proposal.depositAmount)} · Remaining{" "}
          {formatCurrency(proposal.remainingAmount)}
        </p>
      ) : null}
      {proposal.offerMessage ? (
        <p className="mt-6 whitespace-pre-wrap rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-heading">
          {proposal.offerMessage}
        </p>
      ) : null}
      {proposal.includedItems.length > 0 ? (
        <div className="mt-6">
          <p className="text-sm font-medium text-heading">What&apos;s included</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {proposal.includedItems.map((item, i) => (
              <li key={`${item.description}-${i}`}>
                • {item.description}
                {item.quantity ? ` × ${item.quantity}` : ""}
                {item.unit ? ` ${item.unit}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-8">
        {accepted ? (
          <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-heading">
            {showDeposit
              ? "You've accepted this package. Your venue will collect the deposit next. This acceptance is not itself a booking."
              : "You've accepted this package. Your venue will follow up on what comes next."}
          </p>
        ) : acceptSlot ? (
          acceptSlot
        ) : context === "venue-preview" ? (
          <Button type="button" size="lg" className="w-full" disabled>
            Accept proposal
          </Button>
        ) : null}
      </div>
    </div>
  );
}
