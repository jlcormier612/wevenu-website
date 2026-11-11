"use client";

import * as React from "react";

import { ArtifactReviewOverlay } from "@/components/artifacts/artifact-review-overlay";
import { Button } from "@/components/ui/button";
import {
  CLIENT_INVITE_ACCESS_WARNING,
  type ClientInviteEmailContent,
} from "@/lib/client-auth/client-invite-email";

/**
 * Prepare → preview → warn → confirm for client planning-workspace invitations.
 * Opening this must not send. Only the explicit primary action sends.
 */
export function ClientInvitePreviewOverlay({
  open,
  preview,
  mode,
  sending,
  onBack,
  onConfirmSend,
}: {
  open: boolean;
  preview: ClientInviteEmailContent | null;
  mode: "invite" | "resend";
  sending: boolean;
  onBack: () => void;
  onConfirmSend: () => void;
}) {
  return (
    <ArtifactReviewOverlay
      open={open}
      eyebrow={mode === "resend" ? "Resend client invitation" : "Client planning workspace invitation"}
      title="Preview and send"
      onBack={onBack}
      primary={
        <Button
          type="button"
          size="sm"
          disabled={sending || !preview}
          onClick={onConfirmSend}
          data-testid="confirm-send-client-invite"
        >
          {sending ? "Sending…" : mode === "resend" ? "Send invitation again" : "Send invitation"}
        </Button>
      }
    >
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6" data-testid="client-invite-preview">
        <div
          className="rounded-lg border px-4 py-3 text-sm leading-relaxed"
          style={{ borderColor: "#D8A7AA60", background: "#FDF8F8", color: "#3D2F30" }}
          data-testid="client-invite-access-warning"
        >
          <p className="font-medium text-heading mb-1">Before you send</p>
          <p>{CLIENT_INVITE_ACCESS_WARNING}</p>
          <p className="mt-2 text-muted-foreground">
            Finish preparing the workspace first if you still need to. Use Back to edit to return without sending.
          </p>
        </div>

        {preview ? (
          <div className="space-y-3 rounded-lg border border-border bg-background p-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">To</p>
              <p className="text-foreground" data-testid="client-invite-preview-to">{preview.to}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Subject</p>
              <p className="font-medium text-heading" data-testid="client-invite-preview-subject">
                {preview.subject}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Email</p>
              <div
                className="overflow-hidden rounded-md border border-border bg-white"
                data-testid="client-invite-preview-html"
                // Same HTML the send path builds — sandbox iframe not required for branded shell review.
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>
            {mode === "invite" ? (
              <p className="text-xs text-muted-foreground">
                The Create Your Account button will use a personal invitation link generated when you send.
                Drafts and items that still need a separate share action stay private until you share them.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Preparing preview…</p>
        )}
      </div>
    </ArtifactReviewOverlay>
  );
}
