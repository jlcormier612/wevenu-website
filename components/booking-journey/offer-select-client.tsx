"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { approveOfferChoicesAction } from "@/app/offer/actions";
import { MultiOptionProposalView } from "@/components/booking-journey/multi-option-proposal-view";
import type { OfferView } from "@/lib/booking-journey/offer";

/**
 * Couple multi-option proposal: choose package + add-ons → see total → approve.
 * Legacy single-package offers still use OfferAcceptClient.
 * Presentation is shared with venue Preview via MultiOptionProposalView.
 */
export function OfferSelectClient({
  token,
  offer,
}: {
  token: string;
  offer: OfferView;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function handleApprove(choices: { optionId: string; quantity: number }[]) {
    if (!choices.some((c) => {
      const opt = offer.options?.find((o) => o.id === c.optionId);
      return opt?.offerRole === "primary";
    })) {
      toast.error("Choose a package to continue.");
      return;
    }
    startTransition(async () => {
      const result = await approveOfferChoicesAction(token, choices);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Thank you — your selection is approved.");
      router.refresh();
    });
  }

  return (
    <MultiOptionProposalView
      offer={offer}
      mode="live"
      pending={pending}
      onApprove={handleApprove}
    />
  );
}
