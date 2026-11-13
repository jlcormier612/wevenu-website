import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { BRING_YOUR_BUSINESS_GUIDE_HREF } from "@/lib/setup-hub/bring-your-business-guide";

/**
 * Early Setup Hub starting directions — not a second wizard and not a lock-in.
 * White Glove pending owners never reach this Hub (layout gate). Activated
 * White Glove owners see a quieter note so self-service import is available
 * without implying the paid service is required to use the tools.
 */
export function SetupHubStartingChoice({
  isWhiteGlove,
  hasExistingBusiness,
}: {
  isWhiteGlove: boolean;
  hasExistingBusiness: boolean;
}) {
  if (isWhiteGlove) {
    return (
      <div
        className="htc-surface-guidance space-y-2 px-4 py-3"
        data-testid="setup-hub-starting-choice"
      >
        <p className="text-sm font-medium text-heading">Bringing your business over</p>
        <p className="text-sm text-muted-foreground">
          White Glove includes personal help moving your records into Hello to Cheers.
          You can still use the import tools yourself whenever you want — the paid
          service is not required to bring clients and events over.
        </p>
        <Link
          href={BRING_YOUR_BUSINESS_GUIDE_HREF}
          className="htc-setup-quiet-action inline-flex items-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1.5 text-xs font-medium text-heading"
        >
          Open Bring Your Business
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  if (hasExistingBusiness) {
    return (
      <div
        className="htc-surface-guidance space-y-2 px-4 py-3"
        data-testid="setup-hub-starting-choice"
      >
        <p className="text-sm font-medium text-heading">Continue bringing your business</p>
        <p className="text-sm text-muted-foreground">
          You already have records in Hello to Cheers. Pick up the guided path, or keep
          using the chapters below. You can switch anytime — nothing here is a permanent choice.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={BRING_YOUR_BUSINESS_GUIDE_HREF}
            className="htc-setup-quiet-action inline-flex items-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1.5 text-xs font-medium text-heading"
          >
            Continue Bring Your Business
            <ChevronRight className="h-3 w-3" />
          </Link>
          <a
            href="#setup-hub-chapters"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Keep using prepared resources
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-3"
      data-testid="setup-hub-starting-choice"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Where would you like to start?
      </p>
      <p className="text-xs text-muted-foreground">
        Two directions into the same Setup Hub. You can switch anytime — this is not a permanent choice.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="htc-surface-guidance space-y-2 p-4">
          <p className="text-sm font-medium text-heading">Starting fresh?</p>
          <p className="text-sm text-muted-foreground">
            Use Hello to Cheers prepared resources to build your venue experience.
          </p>
          <a
            href="#setup-hub-chapters"
            className="htc-setup-quiet-action inline-flex items-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1.5 text-xs font-medium text-heading"
          >
            Continue with Setup
            <ChevronRight className="h-3 w-3" />
          </a>
        </div>
        <div className="htc-surface-guidance space-y-2 p-4">
          <p className="text-sm font-medium text-heading">Bringing an existing business?</p>
          <p className="text-sm text-muted-foreground">
            Bring over your clients, events, and other business information, then get everything ready to manage in Hello to Cheers.
          </p>
          <Link
            href={BRING_YOUR_BUSINESS_GUIDE_HREF}
            className="htc-setup-quiet-action inline-flex items-center gap-1 rounded-md border border-[color:var(--htc-eucalyptus)] bg-[var(--htc-eucalyptus-surface)] px-2.5 py-1.5 text-xs font-medium text-heading"
          >
            Bring Your Business
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
