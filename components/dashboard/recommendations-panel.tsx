"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, X } from "lucide-react";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import { LuvDraftSheet } from "@/components/dashboard/luv-draft-sheet";
import type { VenueRecommendation, RecommendationCta } from "@/lib/luv/recommendation-types";

const DUSTY_ROSE = "#D8A7AA";

type DraftState = {
  open:     boolean;
  action:   string;
  context:  Record<string, unknown>;
  title:    string;
  actionId: string | null;
  recId:    string;
};

function CtaButton({
  cta,
  metadata,
  recTitle,
  recId,
  onGenerate,
}: {
  cta:        RecommendationCta;
  metadata:   Record<string, unknown>;
  recTitle:   string;
  recId:      string;
  onGenerate: (action: string, context: Record<string, unknown>, title: string, recId: string) => void;
}) {
  const sharedClass = "inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70";

  if (cta.type === "generate") {
    return (
      <button
        type="button"
        onClick={() => onGenerate(cta.target, metadata, recTitle, recId)}
        className={sharedClass}
        style={{ color: DUSTY_ROSE }}
      >
        {cta.label}
        <ArrowRight className="h-3 w-3 shrink-0" />
      </button>
    );
  }

  return (
    <Link
      href={cta.target}
      className={sharedClass}
      style={{ color: DUSTY_ROSE }}
    >
      {cta.label}
      <ArrowRight className="h-3 w-3 shrink-0" />
    </Link>
  );
}

function RecommendationCard({
  rec,
  onDismiss,
  onGenerate,
}: {
  rec:        VenueRecommendation;
  onDismiss:  (id: string) => void;
  onGenerate: (action: string, context: Record<string, unknown>, title: string, recId: string) => void;
}) {
  const [dismissing, setDismissing] = React.useState(false);
  const [showWhy,    setShowWhy]    = React.useState(false);

  const evidenceBullets = Array.isArray(rec.metadata?.evidenceBullets)
    ? (rec.metadata.evidenceBullets as string[])
    : [];

  async function handleDismiss() {
    setDismissing(true);
    await fetch(`/api/recommendations/${rec.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "dismiss" }),
    });
    onDismiss(rec.id);
  }

  return (
    <div className="py-3 border-b border-border/60 last:border-0 space-y-2.5">
      <div className="flex items-start gap-3">
        <LuvHeart size={14} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-heading leading-snug">{rec.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{rec.body}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleDismiss()}
          disabled={dismissing}
          aria-label="Dismiss recommendation"
          className="shrink-0 mt-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors disabled:opacity-30"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {rec.ctas.length > 0 && (
        <div className="ml-5 flex flex-wrap gap-3">
          {rec.ctas.map((cta, i) => (
            <CtaButton
              key={i}
              cta={cta}
              metadata={rec.metadata}
              recTitle={rec.title}
              recId={rec.id}
              onGenerate={onGenerate}
            />
          ))}
        </div>
      )}

      {evidenceBullets.length > 0 && (
        <div className="ml-5 space-y-1.5">
          <button
            type="button"
            onClick={() => setShowWhy(prev => !prev)}
            className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-150${showWhy ? " rotate-180" : ""}`}
            />
            Why is Luv recommending this?
          </button>

          {showWhy && (
            <div
              className="rounded-lg px-3 py-2.5 space-y-1.5"
              style={{
                background: `color-mix(in oklch, ${DUSTY_ROSE} 6%, var(--card))`,
                border:     `1px solid ${DUSTY_ROSE}20`,
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Based on
              </p>
              {evidenceBullets.map((bullet, i) => (
                <p key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <span className="shrink-0 mt-px" style={{ color: DUSTY_ROSE }}>•</span>
                  {bullet}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RecommendationsPanel({
  recommendations,
}: {
  recommendations: VenueRecommendation[];
}) {
  const [visible, setVisible] = React.useState<string[]>(
    () => recommendations.map(r => r.id)
  );
  const [draft, setDraft] = React.useState<DraftState>({
    open: false, action: "", context: {}, title: "", actionId: null, recId: "",
  });
  const pendingCompleteRef = React.useRef(false);

  const shown = recommendations.filter(r => visible.includes(r.id));
  if (shown.length === 0) return null;

  function openDraft(action: string, context: Record<string, unknown>, title: string, recId: string) {
    // Open the sheet immediately (best UX — don't wait on the API)
    pendingCompleteRef.current = false;
    setDraft({ open: true, action, context, title, actionId: null, recId });

    // Record the action in the background; update actionId when it resolves
    fetch("/api/luv/actions", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ recommendationId: recId, actionType: action }),
    })
      .then(res => res.ok ? res.json() : null)
      .then((body: { id?: string } | null) => {
        if (body?.id) {
          const id = body.id;
          // If the user already copied before actionId arrived, complete now
          if (pendingCompleteRef.current) {
            fetch(`/api/luv/actions/${id}`, {
              method:  "PATCH",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ action: "complete" }),
            }).catch(() => {/* best effort */});
            pendingCompleteRef.current = false;
          }
          setDraft(prev => ({ ...prev, actionId: id }));
        }
      })
      .catch(() => {/* best effort */});
  }

  return (
    <>
      <div className="mt-4 border-t border-[#D8A7AA]/20 pt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <LuvHeart size={12} />
          <p className="text-xs font-semibold text-heading tracking-wide">
            Recommended next steps
          </p>
        </div>
        {shown.map(rec => (
          <RecommendationCard
            key={rec.id}
            rec={rec}
            onDismiss={id => setVisible(prev => prev.filter(v => v !== id))}
            onGenerate={openDraft}
          />
        ))}
      </div>

      <LuvDraftSheet
        open={draft.open}
        onOpenChange={open => setDraft(prev => ({ ...prev, open }))}
        action={draft.action}
        context={draft.context}
        title={draft.title}
        actionId={draft.actionId}
        onCopiedWithoutActionId={() => { pendingCompleteRef.current = true; }}
      />
    </>
  );
}
