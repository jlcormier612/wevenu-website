"use client";

import * as React from "react";
import { MessageCircle, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type FeedbackType = "support" | "bug" | "feature" | "nps" | "general";

type FeatureRequest = {
  id: string;
  subject: string | null;
  body: string;
  vote_count: number;
  i_voted: boolean;
};

const TYPES: { value: FeedbackType; label: string; emoji: string; placeholder: string }[] = [
  { value: "support", label: "Get Help",        emoji: "🙋", placeholder: "Describe what you need help with…" },
  { value: "bug",     label: "Report a Bug",    emoji: "🐛", placeholder: "What happened? What did you expect?" },
  { value: "feature", label: "Suggest an Idea", emoji: "💡", placeholder: "What would make Wevenu better for you?" },
  { value: "nps",     label: "Rate Wevenu",     emoji: "⭐", placeholder: "Any comments? (optional)" },
];

export function FeedbackSheet({ children }: { children?: React.ReactNode }) {
  const [open,     setOpen]     = React.useState(false);
  const [type,     setType]     = React.useState<FeedbackType>("general");
  const [subject,  setSubject]  = React.useState("");
  const [body,     setBody]     = React.useState("");
  const [rating,   setRating]   = React.useState<number | null>(null);
  const [sending,  setSending]  = React.useState(false);
  const [features, setFeatures] = React.useState<FeatureRequest[]>([]);
  const [votingId, setVotingId] = React.useState<string | null>(null);

  const selected = TYPES.find(t => t.value === type) ?? TYPES[0];
  const isNps    = type === "nps";
  const isFeature = type === "feature";
  const canSend  = isNps ? rating != null : body.trim().length > 0;

  // Load feature requests when feature tab is selected
  React.useEffect(() => {
    if (!isFeature || !open) return;
    fetch("/api/feedback/features")
      .then(r => r.json())
      .then((d: { features?: FeatureRequest[] }) => setFeatures(d.features ?? []))
      .catch(() => {});
  }, [isFeature, open]);

  function reset() {
    setType("general");
    setSubject("");
    setBody("");
    setRating(null);
    setSending(false);
    setFeatures([]);
  }

  async function submit() {
    if (!canSend || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          subject: subject.trim() || null,
          body:    body.trim(),
          rating,
          metadata: {
            current_url: window.location.href,
            user_agent:  navigator.userAgent,
          },
        }),
      });
      if (!res.ok) throw new Error("failed");
      toast.success("Feedback sent — thank you!");
      setOpen(false);
      reset();
    } catch {
      toast.error("Couldn't send feedback. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function toggleVote(featureId: string) {
    setVotingId(featureId);
    try {
      const res = await fetch(`/api/feedback/features/${featureId}/vote`, { method: "POST" });
      const d = await res.json() as { ok: boolean; voted: boolean };
      if (d.ok) {
        setFeatures(prev => prev.map(f =>
          f.id === featureId
            ? { ...f, i_voted: d.voted, vote_count: f.vote_count + (d.voted ? 1 : -1) }
            : f
        ));
      }
    } catch {
      toast.error("Couldn't register vote.");
    } finally {
      setVotingId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <SheetTrigger render={<span />} nativeButton={false}>
        {children ?? (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span>Give feedback</span>
          </button>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b">
          <SheetTitle>Share Feedback</SheetTitle>
          <SheetDescription>Help us make Wevenu better for your venue.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Type picker */}
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  type === t.value
                    ? "border-primary bg-primary/8 text-heading"
                    : "border-border bg-background hover:bg-muted text-muted-foreground",
                )}
              >
                <span className="text-base">{t.emoji}</span>
                <span className="leading-tight">{t.label}</span>
              </button>
            ))}
          </div>

          {/* NPS rating */}
          {isNps && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-heading">How likely are you to recommend Wevenu?</p>
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={cn(
                      "h-9 w-9 rounded-lg border text-sm font-semibold transition-colors",
                      rating === n
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted text-muted-foreground",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                <span>Not likely</span>
                <span>Very likely</span>
              </div>
            </div>
          )}

          {/* Subject — hidden for NPS */}
          {!isNps && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-heading" htmlFor="fb-subject">
                Subject <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="fb-subject"
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Brief summary"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
          )}

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-heading" htmlFor="fb-body">
              {isNps ? "Any comments?" : "Tell us more"}
              {!isNps && <span className="text-destructive ml-0.5">*</span>}
              {isNps  && <span className="text-muted-foreground font-normal"> (optional)</span>}
            </label>
            <textarea
              id="fb-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              placeholder={selected.placeholder}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>

          {/* Feature voting — shown when type = feature */}
          {isFeature && features.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Other venues have requested
              </p>
              <div className="space-y-2">
                {features.map(f => (
                  <div
                    key={f.id}
                    className="flex items-start gap-3 rounded-xl border bg-muted/30 px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">
                        {f.subject ?? f.body.slice(0, 80)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={votingId === f.id}
                      onClick={() => void toggleVote(f.id)}
                      className={cn(
                        "shrink-0 flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors",
                        f.i_voted
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <ThumbsUp className="h-3 w-3" />
                      <span>{f.vote_count}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="px-5 pb-5 pt-3 border-t">
          <Button
            className="w-full"
            disabled={!canSend || sending}
            onClick={() => void submit()}
          >
            {sending ? "Sending…" : "Send Feedback"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
