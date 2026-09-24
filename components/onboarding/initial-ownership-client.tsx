"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { declarePurchaserOwnershipAction } from "@/app/(app)/onboarding/actions";
import { VenueOwnersSection } from "@/components/settings/venue-owners-section";
import type { StaffMember } from "@/lib/team/types";

export function InitialOwnershipClient({
  setupPersonName,
  setupPersonEmail,
  askOwnershipQuestion,
  owners,
  actorStaffId,
}: {
  setupPersonName: string;
  setupPersonEmail: string;
  askOwnershipQuestion: boolean;
  owners: StaffMember[];
  actorStaffId: string;
}) {
  const router = useRouter();
  const [choice, setChoice] = React.useState<"" | "owner" | "on_behalf">(
    askOwnershipQuestion ? "" : "on_behalf",
  );
  const [busy, setBusy] = React.useState(false);

  async function choose(next: "owner" | "on_behalf") {
    setBusy(true);
    const result = await declarePurchaserOwnershipAction({
      isOwner: next === "owner",
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (next === "owner") {
      router.push("/onboarding/intake");
      router.refresh();
      return;
    }
    setChoice("on_behalf");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-heading">Who owns this venue?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;re setting up Hello to Cheers for:
        </p>
        <div className="mt-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm font-medium text-heading">{setupPersonName}</p>
          <p className="text-sm text-muted-foreground">{setupPersonEmail}</p>
        </div>
      </div>

      {askOwnershipQuestion && choice === "" ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-heading">Are you an owner of this venue?</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void choose("owner")}
            className="flex w-full flex-col items-start rounded-lg border border-border px-4 py-3 text-left hover:bg-muted/40"
          >
            <span className="text-sm font-medium text-heading">Yes, I&apos;m an owner</span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              I&apos;m one of the people who owns this venue.
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void choose("on_behalf")}
            className="flex w-full flex-col items-start rounded-lg border border-border px-4 py-3 text-left hover:bg-muted/40"
          >
            <span className="text-sm font-medium text-heading">
              No, I&apos;m setting this up for someone else
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              I&apos;ll manage the venue in HTC, and I&apos;ll add the owner(s).
            </span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You are the Administrator setting this up. Add the owner(s). You can
            invite them now or record them and invite later. You can still
            administer Hello to Cheers and manage the subscription you purchased.
          </p>
          <VenueOwnersSection
            initialOwners={owners}
            actorIsOwner={false}
            actorCanManageOwners
            actorStaffId={actorStaffId}
            setupMode
          />
          {owners.length > 0 ? (
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => router.push("/onboarding/intake")}
            >
              Continue setup
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add at least one owner to continue.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
