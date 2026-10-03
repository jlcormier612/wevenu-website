"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  inviteClientAction,
  resendClientInvitationAction,
} from "@/app/(app)/clients/[id]/portal-actions";
import { Button } from "@/components/ui/button";
import type { PortalActivationState } from "@/lib/activation/portal-open-milestone";
import { clientDisplayName } from "@/lib/clients/constants";

export type PortalActivationRow = {
  clientId: string;
  firstName: string;
  lastName: string;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  email: string | null;
  state: PortalActivationState;
  invitationId: string | null;
  /** Only pending invitations can be resent by the existing workflow. */
  invitationStatus: "pending" | "accepted" | "revoked" | null;
};

export function PortalActivationRowActions({ row }: { row: PortalActivationRow }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const name = clientDisplayName(
    row.firstName,
    row.lastName,
    row.partnerFirstName,
    row.partnerLastName,
  );

  function invite() {
    if (!row.email) {
      toast.error("Add an email on the client record before sending an invite.");
      return;
    }
    startTransition(async () => {
      const result = await inviteClientAction(row.clientId, row.email!, name);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Invitation sent.");
        router.refresh();
      }
    });
  }

  function resend() {
    if (!row.invitationId) return;
    startTransition(async () => {
      const result = await resendClientInvitationAction(row.clientId, row.invitationId!);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Invitation resent.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {row.state === "not_invited" ? (
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={invite}>
          Invite
        </Button>
      ) : null}
      {row.state === "invited_not_opened"
        && row.invitationStatus === "pending"
        && row.invitationId ? (
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={resend}>
          Resend
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" render={<Link href={`/clients/${row.clientId}`} />}>
        Open client
      </Button>
    </div>
  );
}
