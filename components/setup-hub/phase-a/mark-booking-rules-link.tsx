"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markBookingRulesReviewedAction } from "@/app/(app)/setup-hub/actions";
import { Button } from "@/components/ui/button";

/** Persists booking-rules review then navigates to Availability rules section. */
export function MarkBookingRulesLink({ href }: { href: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending}
      data-testid="phase-a-review-booking-rules"
      onClick={() => {
        startTransition(async () => {
          await markBookingRulesReviewedAction();
          router.push(href);
        });
      }}
    >
      Review booking rules
    </Button>
  );
}
