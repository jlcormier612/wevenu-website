"use client";

/**
 * FinalizeGuestCountCard — the Guest List's Commitment Lifecycle Submit
 * action (docs/commitment-lifecycle-architecture.md §2/§8). The couple's
 * live guest list/RSVP data stays exactly as private as it already was —
 * this card only ever shows *their own* live count as a suggestion; nothing
 * here grants the venue any new continuous visibility. Submitting is the
 * one deliberate act that becomes the venue's operational guest count and
 * completes the "Submit your guest count" Playbook task as a side effect.
 */

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { celebrateLuv } from "@/lib/luv/celebrate";
import { coupleCelebrationMessage } from "@/lib/luv/celebrations";

type GuestCountStatus = {
  liveSuggestedCount: number;
  currentEventGuestCount: number | null;
  lastSubmission: { count: number; note: string | null; submittedAt: string } | null;
};

export function FinalizeGuestCountCard({ token }: { token: string }) {
  const [status, setStatus]       = React.useState<GuestCountStatus | null>(null);
  const [editing, setEditing]     = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [count, setCount]         = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    fetch(`/api/portal/guest-count?token=${token}`)
      .then(r => r.json())
      .then((d: GuestCountStatus) => {
        setStatus(d);
        setCount(String(d.lastSubmission?.count ?? d.liveSuggestedCount ?? 0));
      })
      .catch(() => {});
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  async function submit() {
    const n = parseInt(count, 10);
    if (Number.isNaN(n) || n < 0) { toast.error("Enter a valid guest count."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/guest-count", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, count: n }),
      });
      const data = await res.json() as { ok?: boolean; celebrated?: boolean };
      if (data.ok) {
        if (data.celebrated) {
          celebrateLuv(coupleCelebrationMessage("guest_list_submitted"));
        } else {
          toast.success("Your guest count is submitted — your venue has it now.");
        }
        setEditing(false);
        setConfirming(false);
        load();
      } else {
        toast.error("Couldn't submit your guest count. Please try again.");
      }
    } finally { setSubmitting(false); }
  }

  if (!status) return null;

  const hasSubmission = !!status.lastSubmission;
  const suggestionDiffers = !hasSubmission || status.lastSubmission!.count !== status.liveSuggestedCount;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-heading">Guest Count</p>
          {hasSubmission ? (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--venue-primary)" }} />
              You submitted {status.lastSubmission!.count} guests on{" "}
              {new Date(status.lastSubmission!.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Not yet submitted to your venue.</p>
          )}
        </div>
        <p className="text-2xl font-semibold text-heading shrink-0">{status.liveSuggestedCount}</p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {status.liveSuggestedCount} currently attending, based on your live RSVPs — this is only visible to you until you submit.
      </p>

      {!editing ? (
        <Button type="button" variant={hasSubmission ? "outline" : "default"} size="sm"
          onClick={() => { setCount(String(status.liveSuggestedCount)); setEditing(true); }}>
          {hasSubmission ? (suggestionDiffers ? "Update Submission" : "Resubmit") : "Finalize Guest Count"}
        </Button>
      ) : !confirming ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Final guest count</label>
          <input type="number" min={0} value={count} onChange={e => setCount(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="button" size="sm" onClick={() => setConfirming(true)}>Continue</Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-muted/40 p-3 space-y-2.5">
          <p className="text-sm text-foreground">
            You&apos;re submitting <strong>{count}</strong> guests. This becomes visible to your venue — continue?
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={submitting}>Back</Button>
            <Button type="button" size="sm" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit Final Guest Count"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
