"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { selectActiveVenueAction } from "@/app/(app)/select-venue/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VenueMembershipSummary } from "@/lib/venue/active-context";
import { offersPersistentVenueSwitch } from "@/lib/venue/venue-switcher";

/**
 * Header control for the already-authorized venue list.
 * Selection goes through set_active_venue (venue_staff membership).
 * One membership renders the name only.
 */
export function VenueSwitcher({
  venueName,
  venueLogo,
  activeVenueId,
  memberships,
}: {
  venueName?: string;
  venueLogo?: string | null;
  activeVenueId?: string;
  memberships: VenueMembershipSummary[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const canSwitch = offersPersistentVenueSwitch(memberships);

  async function onSelect(venueId: string) {
    if (!venueId || venueId === activeVenueId || pendingId) return;
    setPendingId(venueId);
    const result = await selectActiveVenueAction(venueId);
    setPendingId(null);
    if (!result.ok) {
      toast.error(
        result.error === "not_a_member"
          ? "You are not an active member of that venue."
          : "Could not switch venues.",
      );
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const label = venueName?.trim() || "Venue";

  if (!canSwitch) {
    if (!venueLogo && !venueName) return null;
    return (
      <div className="hidden min-w-0 items-center gap-2 lg:flex">
        {venueLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venueLogo}
            alt={label}
            className="hidden h-12 w-auto max-w-[200px] rounded-md object-contain lg:block"
          />
        ) : (
          <>
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium text-heading">{label}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {venueLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={venueLogo}
          alt=""
          className="hidden h-12 w-auto max-w-[160px] rounded-md object-contain lg:block"
        />
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="h-9 max-w-[16rem] gap-1.5 px-2"
              aria-label="Switch venue"
              disabled={pendingId !== null}
            />
          }
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-heading">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          {memberships.map((membership) => {
            const current = membership.venueId === activeVenueId;
            return (
              <DropdownMenuItem
                key={membership.venueId}
                disabled={pendingId !== null}
                onClick={() => {
                  void onSelect(membership.venueId);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{membership.venueName}</span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">
                  {pendingId === membership.venueId ? "Selecting…" : membership.role}
                </span>
                {current ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
