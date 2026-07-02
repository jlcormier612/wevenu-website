"use client";

import * as React from "react";

import { Copy, ExternalLink, Link, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createPortalSessionAction, revokePortalSessionAction } from "@/app/(app)/clients/[id]/portal-actions";
import { Button } from "@/components/ui/button";
import type { PortalSession } from "@/lib/portal/types";

const ROSE = "#D8A7AA";

function portalUrl(token: string): string {
  return `${window.location.origin}/p/${token}`;
}

export function PortalLinkWidget({
  clientId,
  coupleName,
  initialSessions,
}: {
  clientId: string;
  coupleName: string;
  initialSessions: PortalSession[];
}) {
  const [sessions, setSessions] = React.useState(initialSessions);
  const [creating, startCreate] = React.useTransition();
  const [revoking, setRevoking] = React.useState<string | null>(null);

  const primarySession = sessions[0] ?? null;

  function handleCopy(token: string) {
    navigator.clipboard.writeText(portalUrl(token));
    toast.success("Portal link copied to clipboard.");
  }

  function handleCreate() {
    startCreate(async () => {
      const session = await createPortalSessionAction(clientId, coupleName);
      if (session) {
        setSessions([session, ...sessions]);
        toast.success("Portal link created.");
      } else {
        toast.error("Could not create portal link.");
      }
    });
  }

  async function handleRevoke(sessionId: string) {
    if (!confirm("Revoke this portal link? The couple will no longer be able to access their workspace until a new link is created.")) return;
    setRevoking(sessionId);
    await revokePortalSessionAction(clientId, sessionId);
    setSessions((p) => p.filter((s) => s.id !== sessionId));
    setRevoking(null);
    toast.success("Portal link revoked.");
  }

  if (!primarySession) {
    return (
      <div className="rounded-xl border border-dashed border-border py-8 text-center space-y-3">
        <div className="h-9 w-9 rounded-full mx-auto flex items-center justify-center" style={{ background: `${ROSE}20` }}>
          <Link className="h-4 w-4" style={{ color: ROSE }} />
        </div>
        <div>
          <p className="text-sm font-medium text-heading">No portal link yet</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xs mx-auto">
            Create a link to give {coupleName} access to their wedding workspace.
          </p>
        </div>
        <Button type="button" size="sm" onClick={handleCreate} disabled={creating}>
          {creating ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Creating…</> : "Create Portal Link"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-heading">Wedding Workspace</p>
            <p className="text-xs text-muted-foreground">
              {primarySession.lastAccessedAt
                ? `Last visited ${new Date(primarySession.lastAccessedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                : "Not yet visited"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => window.open(portalUrl(primarySession.accessToken), "_blank")}
              aria-label="Open portal in new tab"
              className="h-9 w-9 p-0">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => handleCopy(primarySession.accessToken)}
              aria-label="Copy portal link"
              className="h-9 w-9 p-0">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm"
              onClick={() => handleRevoke(primarySession.id)}
              disabled={revoking === primarySession.id}
              aria-label="Revoke portal access"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive">
              {revoking === primarySession.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-[11px] font-mono text-muted-foreground break-all select-all">
            {typeof window !== "undefined" ? portalUrl(primarySession.accessToken) : `/p/${primarySession.accessToken}`}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => handleCopy(primarySession.accessToken)}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Link to Share
        </Button>
      </div>
    </div>
  );
}
