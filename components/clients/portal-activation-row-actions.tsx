"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  inviteClientAction,
  previewClientInviteAction,
  previewResendClientInviteAction,
  resendClientInvitationAction,
} from "@/app/(app)/clients/[id]/portal-actions";
import { ClientInvitePreviewOverlay } from "@/components/portal/client-invite-preview-overlay";
import { Button } from "@/components/ui/button";
import type { ClientInviteEmailContent } from "@/lib/client-auth/client-invite-email";
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
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState<"invite" | "resend">("invite");
  const [preview, setPreview] = React.useState<ClientInviteEmailContent | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const name = clientDisplayName(
    row.firstName,
    row.lastName,
    row.partnerFirstName,
    row.partnerLastName,
  );

  function closePreview() {
    if (pending) return;
    setPreviewOpen(false);
    setPreview(null);
  }

  async function openInvitePreview() {
    if (!row.email) {
      toast.error("Add an email on the client record before sending an invite.");
      return;
    }
    if (previewLoading || pending) return;
    setPreviewLoading(true);
    setPreviewMode("invite");
    setPreview(null);
    setPreviewOpen(true);
    const result = await previewClientInviteAction(row.email, name);
    setPreviewLoading(false);
    if (!result.ok) {
      setPreviewOpen(false);
      toast.error(result.error);
      return;
    }
    setPreview(result.preview);
  }

  async function openResendPreview() {
    if (!row.invitationId || previewLoading || pending) return;
    setPreviewLoading(true);
    setPreviewMode("resend");
    setPreview(null);
    setPreviewOpen(true);
    const result = await previewResendClientInviteAction(row.invitationId);
    setPreviewLoading(false);
    if (!result.ok) {
      setPreviewOpen(false);
      toast.error(result.error);
      return;
    }
    setPreview(result.preview);
  }

  function confirmSend() {
    if (!preview || pending) return;
    if (previewMode === "invite") {
      if (!row.email) return;
      startTransition(async () => {
        const result = await inviteClientAction(row.clientId, row.email!, name);
        if (!result.ok) toast.error(result.error);
        else {
          toast.success("Invitation sent.");
          setPreviewOpen(false);
          setPreview(null);
          router.refresh();
        }
      });
      return;
    }
    if (!row.invitationId) return;
    startTransition(async () => {
      const result = await resendClientInvitationAction(row.clientId, row.invitationId!);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Invitation resent.");
        setPreviewOpen(false);
        setPreview(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {row.state === "not_invited" ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || previewLoading}
          onClick={openInvitePreview}
          data-testid="open-client-invite-preview"
        >
          {previewLoading && previewMode === "invite" ? "Preparing…" : "Invite"}
        </Button>
      ) : null}
      {row.state === "invited_not_opened"
        && row.invitationStatus === "pending"
        && row.invitationId ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || previewLoading}
          onClick={openResendPreview}
          data-testid="open-client-invite-resend-preview"
        >
          {previewLoading && previewMode === "resend" ? "Preparing…" : "Resend"}
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" render={<Link href={`/clients/${row.clientId}`} />}>
        Open client
      </Button>

      <ClientInvitePreviewOverlay
        open={previewOpen}
        preview={preview}
        mode={previewMode}
        sending={pending}
        onBack={closePreview}
        onConfirmSend={confirmSend}
      />
    </div>
  );
}
