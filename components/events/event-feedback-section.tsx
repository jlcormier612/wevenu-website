"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  approveFeedbackPublicAction,
  approveMemoryAction,
  getEventPostWeddingDataAction,
  resolveFeedbackAction,
  updateReferralStatusAction,
  type EventPostWeddingData,
} from "@/app/(app)/events/[id]/feedback-actions";

// ── Star display ──────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <svg key={n} width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill={n <= rating ? "#D8A7AA" : "none"}
            stroke={n <= rating ? "#D8A7AA" : "#C4BAB5"}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}

// ── Permission label ──────────────────────────────────────────────────────────

const PERM_LABELS: Record<string, string> = {
  none:                "Keep private",
  review_only:         "Share anonymously",
  review_and_names:    "Share with names",
  review_and_photos:   "Share with names + photos",
};

const STATUS_LABELS: Record<string, string> = {
  new:       "New",
  contacted: "Contacted",
  booked:    "Booked",
};

// ── Feedback panel ────────────────────────────────────────────────────────────

function FeedbackPanel({
  feedback,
  onUpdate,
}: {
  feedback: NonNullable<EventPostWeddingData["feedback"]>;
  onUpdate: (updates: Partial<NonNullable<EventPostWeddingData["feedback"]>>) => void;
}) {
  const [response, setResponse]   = React.useState(feedback.venueResponse ?? "");
  const [saving, setSaving]       = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const isLowRating               = feedback.overallRating <= 2;
  const canApprove                = feedback.publicPermission !== "none" && !feedback.approvedForPublicAt;

  async function handleResolve() {
    setSaving(true);
    const res = await resolveFeedbackAction(feedback.id, "resolved", response);
    setSaving(false);
    if (res.ok) {
      toast.success("Marked as resolved.");
      onUpdate({ venueStatus: "resolved", venueResponse: response || null });
    } else {
      toast.error("Could not save. Please try again.");
    }
  }

  async function handleApprove() {
    setApproving(true);
    const res = await approveFeedbackPublicAction(feedback.id);
    setApproving(false);
    if (res.ok) {
      toast.success("Approved for public use.");
      onUpdate({ approvedForPublicAt: new Date().toISOString() });
    } else {
      toast.error("Could not approve. Please try again.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Rating + meta */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <Stars rating={feedback.overallRating} />
          <p className="text-xs text-muted-foreground">
            {new Date(feedback.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            feedback.venueStatus === "resolved"
              ? "bg-success/10 text-success"
              : isLowRating
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
          }`}>
            {feedback.venueStatus === "resolved" ? "Resolved" : isLowRating ? "Needs attention" : "Pending review"}
          </span>
          {feedback.wouldRecommend && (
            <span className="text-[10px] text-muted-foreground">Would recommend ✓</span>
          )}
        </div>
      </div>

      {/* Service recovery alert for low ratings */}
      {isLowRating && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm font-semibold text-destructive mb-1">💗 This is an opportunity.</p>
          <p className="text-xs text-muted-foreground">
            Reaching out personally can turn a difficult experience into a lasting relationship.
            Consider a direct follow-up before anything else.
          </p>
        </div>
      )}

      {/* Qualitative feedback */}
      {(feedback.lovedMost || feedback.couldImprove) && (
        <div className="space-y-3">
          {feedback.lovedMost && (
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                What they loved
              </p>
              <p className="text-sm text-foreground leading-relaxed">&ldquo;{feedback.lovedMost}&rdquo;</p>
            </div>
          )}
          {feedback.couldImprove && (
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Areas for improvement
              </p>
              <p className="text-sm text-foreground leading-relaxed">&ldquo;{feedback.couldImprove}&rdquo;</p>
            </div>
          )}
        </div>
      )}

      {/* Permission status */}
      <div className="flex items-center justify-between rounded-xl border px-4 py-3">
        <div>
          <p className="text-xs font-medium text-heading">Sharing permission</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {PERM_LABELS[feedback.publicPermission] ?? feedback.publicPermission}
          </p>
        </div>
        {feedback.approvedForPublicAt ? (
          <span className="text-[10px] font-semibold text-success bg-success/10 rounded-full px-2.5 py-0.5">
            Approved ✓
          </span>
        ) : canApprove ? (
          <button
            onClick={handleApprove}
            disabled={approving}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {approving ? "Approving…" : "Approve for public use"}
          </button>
        ) : null}
      </div>

      {/* Internal note / resolution */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-heading block">
          Internal note {feedback.venueStatus !== "resolved" && <span className="text-muted-foreground font-normal">(optional)</span>}
        </label>
        <textarea
          value={response}
          onChange={e => setResponse(e.target.value)}
          placeholder="Add a note about how this was handled…"
          rows={3}
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={handleResolve}
          disabled={saving || feedback.venueStatus === "resolved"}
          className="text-sm font-semibold px-4 py-2 rounded-xl border border-border transition-colors hover:bg-muted disabled:opacity-50"
        >
          {saving ? "Saving…" : feedback.venueStatus === "resolved" ? "Resolved ✓" : "Mark resolved"}
        </button>
      </div>
    </div>
  );
}

// ── Referrals panel ───────────────────────────────────────────────────────────

function ReferralsPanel({
  referrals,
  onStatusChange,
}: {
  referrals: EventPostWeddingData["referrals"];
  onStatusChange: (id: string, status: string) => void;
}) {
  const [updating, setUpdating] = React.useState<string | null>(null);

  async function handleStatus(id: string, status: "new" | "contacted" | "booked") {
    setUpdating(id);
    const res = await updateReferralStatusAction(id, status);
    setUpdating(null);
    if (res.ok) {
      onStatusChange(id, status);
    } else {
      toast.error("Could not update status.");
    }
  }

  return (
    <div className="space-y-3">
      {referrals.map(r => (
        <div key={r.id} className="rounded-xl border p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-heading">{r.referralName}</p>
              {r.referralEmail && <p className="text-xs text-muted-foreground">{r.referralEmail}</p>}
              {r.referralPhone && <p className="text-xs text-muted-foreground">{r.referralPhone}</p>}
              {r.note && <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{r.note}&rdquo;</p>}
            </div>
            <span className={`shrink-0 text-[10px] font-semibold rounded-full px-2.5 py-0.5 ${
              r.status === "booked"    ? "bg-success/10 text-success" :
              r.status === "contacted" ? "bg-primary/10 text-primary" :
              "bg-muted text-muted-foreground"
            }`}>
              {STATUS_LABELS[r.status] ?? r.status}
            </span>
          </div>
          <div className="flex gap-1.5">
            {(["new", "contacted", "booked"] as const).map(s => (
              <button key={s}
                onClick={() => handleStatus(r.id, s)}
                disabled={r.status === s || updating === r.id}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors disabled:opacity-40"
                style={r.status === s ? { background: "var(--primary)", color: "white", borderColor: "transparent" } : {}}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Memories panel ────────────────────────────────────────────────────────────

function MemoriesPanel({
  memories,
  onApprove,
}: {
  memories: EventPostWeddingData["memories"];
  onApprove: (id: string) => void;
}) {
  const [approving, setApproving] = React.useState<string | null>(null);

  async function handleApprove(id: string) {
    setApproving(id);
    const res = await approveMemoryAction(id);
    setApproving(null);
    if (res.ok) {
      toast.success("Memory approved for testimonial use.");
      onApprove(id);
    } else {
      toast.error("Could not approve.");
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {memories.map(m => (
        <div key={m.id} className="relative rounded-xl overflow-hidden border aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.storageUrl} alt={m.caption ?? "Shared memory"} className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex flex-col justify-end p-2"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)" }}>
            {m.caption && (
              <p className="text-[10px] text-white/90 leading-snug mb-1">{m.caption}</p>
            )}
            <div className="flex items-center justify-between gap-1">
              <span className={`text-[9px] font-semibold rounded-full px-1.5 py-0.5 ${
                m.visibility === "testimonial" ? "bg-rose-400/80 text-white" : "bg-white/20 text-white"
              }`}>
                {m.visibility === "testimonial" ? "Testimonial" : "Shared"}
              </span>
              {m.visibility === "testimonial" && !m.approvedAt && (
                <button
                  onClick={() => handleApprove(m.id)}
                  disabled={approving === m.id}
                  className="text-[9px] font-bold bg-white/90 text-heading rounded-full px-1.5 py-0.5 transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {approving === m.id ? "…" : "Approve"}
                </button>
              )}
              {m.approvedAt && (
                <span className="text-[9px] font-semibold text-white bg-green-500/70 rounded-full px-1.5 py-0.5">✓ Approved</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── EventFeedbackSection — main export ────────────────────────────────────────
// Self-fetching client component. Added to Feedback tab in event-detail.tsx.

export function EventFeedbackSection({ eventId }: { eventId: string }) {
  const [data, setData]     = React.useState<EventPostWeddingData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getEventPostWeddingDataAction(eventId)
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />
      </div>
    );
  }

  const noContent = !data || (!data.feedback && data.referrals.length === 0 && data.memories.length === 0);

  if (noContent) {
    return (
      <div className="rounded-2xl border border-dashed py-14 text-center px-6">
        <p className="text-2xl mb-3">💗</p>
        <p className="text-sm font-semibold text-heading mb-1">No feedback yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Feedback, referrals, and shared memories from the client will appear here
          after the wedding — when Luv gently prompts them in their portal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Venue Feedback ── */}
      {data?.feedback ? (
        <div className="rounded-2xl border p-5 space-y-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">💗</span>
            <p className="text-sm font-semibold text-heading">Client Feedback</p>
            <span className="ml-auto text-[10px] text-muted-foreground">Private · not public</span>
          </div>
          <FeedbackPanel
            feedback={data.feedback}
            onUpdate={updates => setData(prev => prev
              ? { ...prev, feedback: prev.feedback ? { ...prev.feedback, ...updates } : null }
              : null
            )}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-5 text-center">
          <p className="text-sm text-muted-foreground">No venue feedback submitted yet.</p>
        </div>
      )}

      {/* ── Referrals ── */}
      {data?.referrals && data.referrals.length > 0 && (
        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">💍</span>
            <p className="text-sm font-semibold text-heading">
              Referrals
              <span className="ml-1.5 text-muted-foreground font-normal">({data.referrals.length})</span>
            </p>
          </div>
          <ReferralsPanel
            referrals={data.referrals}
            onStatusChange={(id, status) => setData(prev => prev ? {
              ...prev,
              referrals: prev.referrals.map(r => r.id === id ? { ...r, status } : r),
            } : null)}
          />
        </div>
      )}

      {/* ── Shared Memories ── */}
      {data?.memories && data.memories.length > 0 && (
        <div className="rounded-2xl border p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">📸</span>
            <p className="text-sm font-semibold text-heading">
              Shared Memories
              <span className="ml-1.5 text-muted-foreground font-normal">({data.memories.length})</span>
            </p>
          </div>
          <MemoriesPanel
            memories={data.memories}
            onApprove={id => setData(prev => prev ? {
              ...prev,
              memories: prev.memories.map(m => m.id === id ? { ...m, approvedAt: new Date().toISOString() } : m),
            } : null)}
          />
        </div>
      )}

    </div>
  );
}
