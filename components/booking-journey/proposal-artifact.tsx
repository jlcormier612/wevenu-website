import type { CSSProperties, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { ProposalBrand, ProposalView } from "@/lib/booking-journey/proposal-view";
import { formatCurrency } from "@/lib/invoices/constants";

const DEFAULT_BRAND: ProposalBrand = {
  primaryColor: "#5D6F5D",
  secondaryColor: "#4F5F4F",
  accentColor: "#B8AEA1",
  neutralColor: "#F7F5F1",
};

/**
 * The couple-facing proposal body. Venue preview and /offer/{token} share
 * this renderer so the review cannot drift from what the couple receives.
 *
 * Venue Brand Colors roles:
 * - Primary: primary brand rule under the title
 * - Secondary: supporting eyebrow / venue name
 * - Accent: selective emphasis on the package total
 * - Neutral: soft venue-branded page surface
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
  const brand = proposal.brand ?? DEFAULT_BRAND;
  const brandStyle = {
    "--venue-primary": brand.primaryColor,
    "--venue-secondary": brand.secondaryColor,
    "--venue-accent": brand.accentColor,
    "--venue-neutral": brand.neutralColor,
    backgroundColor: "var(--venue-neutral)",
  } as CSSProperties;

  return (
    <div
      className="mx-auto min-h-full max-w-lg px-4 py-12"
      style={brandStyle}
      data-venue-brand="proposal"
    >
      <p
        className="text-xs font-medium uppercase tracking-widest"
        style={{ color: "var(--venue-secondary)" }}
      >
        Your proposal
      </p>
      {proposal.venueName ? (
        <p className="mt-2 text-sm" style={{ color: "var(--venue-secondary)" }}>
          {proposal.venueName}
        </p>
      ) : null}
      <h1
        className="mt-2 font-heading text-3xl text-foreground"
        style={{ borderBottom: "3px solid var(--venue-primary)", paddingBottom: "0.5rem" }}
      >
        {proposal.name}
      </h1>
      <p className="mt-4 text-2xl font-semibold" style={{ color: "var(--venue-accent)" }}>
        {formatCurrency(proposal.totalAmount)}
      </p>
      {showDeposit ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Deposit {formatCurrency(proposal.depositAmount)} · Remaining{" "}
          {formatCurrency(proposal.remainingAmount)}
        </p>
      ) : null}
      {proposal.offerMessage ? (
        <p
          className="mt-6 whitespace-pre-wrap rounded-lg border px-4 py-3 text-sm text-foreground"
          style={{
            borderColor: "var(--venue-primary)",
            backgroundColor: "color-mix(in srgb, var(--venue-neutral) 70%, white)",
          }}
        >
          {proposal.offerMessage}
        </p>
      ) : null}
      {proposal.includedItems.length > 0 ? (
        <div className="mt-6">
          <p className="text-sm font-medium" style={{ color: "var(--venue-secondary)" }}>
            What&apos;s included
          </p>
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
          <p className="rounded-lg border border-border bg-white/80 px-4 py-3 text-sm text-foreground">
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
