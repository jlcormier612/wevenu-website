"use client";

import * as React from "react";

import { Loader2, Mail, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import {
  getClientInvitationAction, inviteClientAction, resendClientInvitationAction,
  revokeClientInvitationAction, revokeClientAccessAction,
  getSupportAccessGrantsAction, openSupportAccessAction,
} from "@/app/(app)/clients/[id]/portal-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClientInvitation, SupportAccessGrant } from "@/lib/client-auth/types";

const ROSE = "#D8A7AA";

/**
 * The client owns their workspace. This widget only lets the venue invite,
 * resend, or revoke access — never open or copy a link into the client's
 * workspace directly. The one exception is a client-granted, time-boxed
 * "temporary support access" window (see the gated section below), which is
 * logged every time it's used.
 */
export function PortalLinkWidget({
  clientId,
  coupleName,
}: {
  clientId: string;
  coupleName: string;
}) {
  const [invitation, setInvitation] = React.useState<ClientInvitation | null>(null);
  const [grants, setGrants] = React.useState<SupportAccessGrant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [email, setEmail] = React.useState("");
  const [inviting, setInviting] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [revoking, setRevoking] = React.useState(false);
  const [opening, setOpening] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    Promise.all([
      getClientInvitationAction(clientId),
      getSupportAccessGrantsAction(clientId),
    ]).then(([inv, g]) => { setInvitation(inv); setGrants(g); setLoading(false); });
  }, [clientId]);

  React.useEffect(() => { refresh(); }, [refresh]);

  async function handleInvite() {
    if (!email.trim()) { toast.error("An email address is required to invite the client."); return; }
    setInviting(true);
    const result = await inviteClientAction(clientId, email.trim(), coupleName);
    setInviting(false);
    if (result.ok) { toast.success(`Invitation sent to ${email.trim()}.`); setEmail(""); refresh(); }
    else toast.error(result.error);
  }

  async function handleResend() {
    if (!invitation) return;
    setResending(true);
    const result = await resendClientInvitationAction(clientId, invitation.id);
    setResending(false);
    if (result.ok) { toast.success(`Invitation resent to ${invitation.email}.`); refresh(); }
    else toast.error(result.error);
  }

  async function handleRevokeInvitation() {
    if (!invitation) return;
    if (!confirm("Revoke this invitation? The link will stop working.")) return;
    setRevoking(true);
    const result = await revokeClientInvitationAction(clientId, invitation.id);
    setRevoking(false);
    if (result.ok) { toast.success("Invitation revoked."); refresh(); }
    else toast.error(result.error);
  }

  async function handleRevokeAccess() {
    if (!confirm(`Revoke ${coupleName}'s access to their workspace? They will need a new invitation to get back in.`)) return;
    setRevoking(true);
    const result = await revokeClientAccessAction(clientId);
    setRevoking(false);
    if (result.ok) { toast.success("Access revoked."); refresh(); }
    else toast.error(result.error);
  }

  const activeGrant = grants.find((g) => !g.revokedAt && new Date(g.expiresAt) > new Date()) ?? null;

  async function handleOpenSupportAccess() {
    if (!activeGrant) return;
    setOpening(activeGrant.id);
    const result = await openSupportAccessAction(activeGrant.id);
    setOpening(null);
    if (result.ok) window.open(result.url, "_blank");
    else toast.error(result.error);
  }

  if (loading) {
    return <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div>;
  }

  return (
    <div className="space-y-3">
      {!invitation || invitation.status === "revoked" ? (
        <div className="rounded-xl border border-dashed border-border p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-heading">No account yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Invite {coupleName} to create their own account and own their planning workspace.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="email" placeholder="couple@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} className="h-9" />
            <Button type="button" size="sm" onClick={handleInvite} disabled={inviting}>
              {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Invite"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-heading">{invitation.email}</p>
              <p className="text-xs text-muted-foreground">
                {invitation.status === "accepted"
                  ? `Account created${invitation.acceptedAt ? ` ${new Date(invitation.acceptedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`
                  : "Invitation sent · awaiting account creation"}
              </p>
            </div>
            {invitation.status === "pending" && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${ROSE}18`, color: "#8A4B4F" }}>
                Pending
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {invitation.status === "pending" && (
              <button type="button" onClick={handleResend} disabled={resending}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50">
                {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />} Resend invite
              </button>
            )}
            {invitation.status === "pending" && (
              <button type="button" onClick={handleRevokeInvitation} disabled={revoking}
                className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 disabled:opacity-50">
                <X className="h-3 w-3" /> Revoke invitation
              </button>
            )}
            {invitation.status === "accepted" && (
              <button type="button" onClick={handleRevokeAccess} disabled={revoking}
                className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 disabled:opacity-50">
                {revoking ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />} Revoke access
              </button>
            )}
          </div>
        </div>
      )}

      {/* Temporary support access — only usable while the client has an active grant */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-heading">Support Access</p>
        </div>
        {activeGrant ? (
          <>
            <p className="text-xs text-muted-foreground">
              {coupleName} granted temporary access, expiring {new Date(activeGrant.expiresAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
              Every use is logged.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={handleOpenSupportAccess} disabled={opening === activeGrant.id}>
              {opening === activeGrant.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              View workspace (support access)
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            No active support access grant. The venue cannot view {coupleName}&apos;s workspace unless they explicitly grant temporary access from their Account settings.
          </p>
        )}
      </div>
    </div>
  );
}
