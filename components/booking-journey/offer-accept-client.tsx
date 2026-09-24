"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { acceptOfferAction } from "@/app/offer/actions";
import { ProposalArtifact } from "@/components/booking-journey/proposal-artifact";
import { Button } from "@/components/ui/button";
import type { ProposalView } from "@/lib/booking-journey/proposal-view";

/**
 * Direct (Path B) package share link — venue already chose the package.
 * Neutral "Review and accept" language — not a multi-option proposal.
 */
export function OfferAcceptClient({
  token,
  offer,
}: {
  token: string;
  offer: ProposalView;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const accepted = offer.status === "accepted";

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptOfferAction(token);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Thank you — your package is accepted.");
      router.refresh();
    });
  }

  return (
    <ProposalArtifact
      proposal={offer}
      context="couple"
      eyebrow="Review and accept"
      previewAcceptLabel="Accept"
      acceptSlot={
        accepted ? undefined : (
          <Button type="button" size="lg" className="w-full" onClick={handleAccept} disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accepting…
              </>
            ) : (
              "Accept"
            )}
          </Button>
        )
      }
    />
  );
}
