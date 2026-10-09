"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { inviteClientAction } from "@/app/(app)/clients/[id]/portal-actions";
import { Button } from "@/components/ui/button";
import { isBookingWorkspaceHref } from "@/lib/clients/booking-handoff";
import type { CommunicationsReviewModel } from "@/lib/clients/communications-review";

export function CommunicationsReviewPanel({
  communications,
}: {
  communications: CommunicationsReviewModel;
}) {
  const router = useRouter();
  const [invitePending, startInvite] = React.useTransition();
  const invite = communications.invite;

  function onInviteClient() {
    if (!invite.canInvite || !invite.email || invitePending) return;
    startInvite(async () => {
      const result = await inviteClientAction(invite.clientId, invite.email!, invite.coupleName);
      if (!result.ok) {
        toast.error(result.error ?? "Could not send the invitation.");
        return;
      }
      toast.success("Invitation sent.");
      router.refresh();
    });
  }

  return (
    <div
      id="communications"
      className="rounded-sm border px-6 py-5 text-left"
      style={{ borderColor: "#D8A7AA40", background: "#FDF8F8" }}
    >
      <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: "#9ca3af" }}>
        {communications.heading}
      </p>
      <p className="mb-4 text-sm" style={{ color: "#3D2F30" }}>
        {communications.summary}
      </p>
      <p className="mb-4 text-xs text-muted-foreground leading-relaxed">{communications.reviewNote}</p>
      <ul className="space-y-3">
        {communications.rows.map((row) => (
          <li key={row.key} className="flex items-start gap-3 text-sm">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={
                row.onFile
                  ? { background: "#D8A7AA20", color: "#5A3235" }
                  : { background: "transparent", color: "#9ca3af" }
              }
            >
              {row.onFile ? "✓" : "○"}
            </span>
            <div className="min-w-0 flex-1">
              <p style={{ color: row.onFile || row.needsAttention ? "#3D2F30" : "#9ca3af" }}>
                {row.label}
              </p>
              <p className="text-xs text-muted-foreground">{row.detail}</p>
              {row.key === "invitation" && invite.disabledReason && !invite.canInvite && !row.onFile ? (
                <p className="mt-1 text-xs" style={{ color: "#5A3235" }}>
                  {invite.disabledReason}
                </p>
              ) : null}
            </div>
            {row.key === "invitation" && invite.canInvite ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={invitePending}
                onClick={onInviteClient}
                className="shrink-0"
              >
                {invitePending ? "Sending…" : "Invite client"}
              </Button>
            ) : isBookingWorkspaceHref(row.href) ? null : (
              <Link
                href={row.href}
                className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
                style={{ color: "#5A3235" }}
              >
                {row.actionLabel}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
