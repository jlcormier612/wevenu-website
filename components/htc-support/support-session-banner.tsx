import Link from "next/link";

import { createClient } from "@/integrations/supabase/server";
import { workspaceAppBaseUrl } from "@shared/support-access";

/**
 * Discreet internal banner while an HTC HQ support session is active.
 */
export async function SupportSessionBanner() {
  // Venue jar holds the HQ staff session used for support context (including
  // when viewing /p/* or /vendor/* under support).
  const supabase = await createClient("venue");
  const { data } = await supabase.rpc("htc_get_support_context");
  const ctx = data as {
    ok?: boolean;
    active?: boolean;
    mode?: string;
    portal?: string;
    venue_id?: string | null;
    relationship_id?: string | null;
    actor_staff_email?: string | null;
  } | null;

  if (!ctx?.ok || !ctx.active) return null;

  const modeLabel = ctx.mode === "assist" ? "Assist" : "Viewing";
  const returnTo = ctx.relationship_id
    ? `${workspaceAppBaseUrl()}/relationships/${encodeURIComponent(ctx.relationship_id)}`
    : `${workspaceAppBaseUrl()}/business`;

  return (
    <div
      className="flex items-center gap-3 border-b border-amber-700/30 bg-amber-50 px-4 py-2 text-sm text-amber-950"
      data-testid="htc-support-session-banner"
      role="status"
    >
      <p className="min-w-0 flex-1">
        <span className="font-semibold">HTC support — {modeLabel}</span>
        <span className="mx-1.5 text-amber-800/70">·</span>
        <span className="capitalize">{ctx.portal || "venue"} portal</span>
        {ctx.actor_staff_email ? (
          <>
            <span className="mx-1.5 text-amber-800/70">·</span>
            <span className="truncate">{ctx.actor_staff_email}</span>
          </>
        ) : null}
        {ctx.mode === "read" ? (
          <span className="ml-2 text-amber-800/80">(read-only)</span>
        ) : (
          <span className="ml-2 text-amber-800/80">(assistance — changes attributed to you)</span>
        )}
      </p>
      <Link
        href={`/api/htc-support/exit?returnTo=${encodeURIComponent(returnTo)}`}
        className="shrink-0 font-medium underline underline-offset-2"
        data-testid="htc-support-exit"
      >
        Return to CRM
      </Link>
    </div>
  );
}
