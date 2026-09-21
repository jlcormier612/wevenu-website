"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { selectActiveVenueAction } from "@/app/(app)/select-venue/actions";
import { Button } from "@/components/ui/button";
import type { VenueMembershipSummary } from "@/lib/venue/active-context";

export function VenueSelectForm({ memberships }: { memberships: VenueMembershipSummary[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onSelect(venueId: string) {
    setPendingId(venueId);
    const result = await selectActiveVenueAction(venueId);
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error === "not_a_member"
        ? "You are not an active member of that venue."
        : "Could not switch venues.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <ul className="space-y-2">
      {memberships.map((m) => (
        <li key={m.venueId}>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            disabled={pendingId !== null}
            onClick={() => onSelect(m.venueId)}
          >
            <span className="truncate font-medium">{m.venueName}</span>
            <span className="ml-2 shrink-0 text-xs text-muted-foreground capitalize">
              {pendingId === m.venueId ? "Selecting…" : m.role}
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
