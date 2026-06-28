"use client";

/**
 * LuvClientPanel — the Luv tab on Client detail.
 *
 * Combines:
 *   1. Planning Progress / Coordinator Briefing (LuvEventBriefing)
 *   2. Client-stage drafts (welcome email, planning kickoff, payment reminder, final details)
 */

import * as React from "react";

import { ArrowRight, Check, ClipboardCopy, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  generateClientDraftAction,
  updateClientDraftStatusAction,
} from "@/app/(app)/clients/[id]/luv-client-actions";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import { LuvEventBriefing } from "@/components/luv/luv-event-briefing";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ClientDraft, ClientDraftType } from "@/lib/luv/client-drafts";
import type { EventReadiness } from "@/lib/luv/event-readiness";

const DUSTY_ROSE = "#D8A7AA";

const DRAFT_OPTIONS: { type: ClientDraftType; label: string; description: string }[] = [
  { type: "welcome_email",     label: "Welcome email",       description: "A warm congratulations and introduction to the planning process." },
  { type: "planning_kickoff",  label: "Planning kickoff",    description: "Kick off the planning journey with next steps and what to expect." },
  { type: "payment_reminder",  label: "Payment reminder",    description: "A gentle, friendly nudge for an upcoming payment." },
  { type: "final_details",     label: "Final details",       description: "A warm check-in a few weeks before the event to finalize everything." },
];

function ClientDraftCard({
  draft,
  clientId,
  onDiscard,
}: {
  draft: ClientDraft;
  clientId: string;
  onDiscard: (id: string) => void;
}) {
  const [subject, setSubject] = React.useState(draft.subject ?? "");
  const [body, setBody] = React.useState(draft.content);
  const [copied, setCopied] = React.useState(false);
  const [discarding, startDiscard] = React.useTransition();

  async function handleCopy() {
    const full = draft.subject ? `Subject: ${subject}\n\n${body}` : body;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    await updateClientDraftStatusAction(draft.id, clientId, "accepted");
  }

  function handleDiscard() {
    startDiscard(async () => {
      await updateClientDraftStatusAction(draft.id, clientId, "discarded");
      onDiscard(draft.id);
    });
  }

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ border: `1px solid ${DUSTY_ROSE}30`, background: `color-mix(in oklch, ${DUSTY_ROSE} 5%, var(--card))` }}
    >
      <div className="flex items-center gap-1.5">
        <LuvHeart size={12} />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Luv drafted this {DRAFT_OPTIONS.find((d) => d.type === draft.draftType)?.label?.toLowerCase()}
        </p>
      </div>
      {draft.subject != null && (
        <input value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-heading focus:outline-none focus:ring-2 focus:ring-ring" />
      )}
      <Textarea value={body} onChange={(e) => setBody(e.target.value)}
        rows={9} className="font-sans text-sm leading-relaxed resize-none" />
      <p className="text-[11px] text-muted-foreground">
        💗 Review, personalize, and copy. Luv never sends anything.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={handleCopy}
          style={copied ? {} : { borderColor: `${DUSTY_ROSE}60`, backgroundColor: `${DUSTY_ROSE}15`, color: "#8B5A5C" }}
          className={copied ? "bg-success text-success-foreground" : "hover:opacity-90"}>
          {copied ? <><Check className="mr-1 h-3.5 w-3.5" />Copied!</> : <><ClipboardCopy className="mr-1 h-3.5 w-3.5" />Copy</>}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={handleDiscard} disabled={discarding}
          className="text-muted-foreground">
          {discarding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          <span className="ml-1">{discarding ? "Discarding…" : "Discard"}</span>
        </Button>
      </div>
    </div>
  );
}

export function LuvClientPanel({
  clientId,
  readiness,
  initialDrafts,
}: {
  clientId: string;
  readiness: EventReadiness | null;
  initialDrafts: ClientDraft[];
}) {
  const [drafts, setDrafts] = React.useState(initialDrafts);
  const [generating, setGenerating] = React.useState<ClientDraftType | null>(null);

  const pendingDrafts = drafts.filter((d) => d.status === "pending_review");
  const pastDrafts = drafts.filter((d) => d.status !== "pending_review");

  async function handleGenerate(draftType: ClientDraftType) {
    setGenerating(draftType);
    const result = await generateClientDraftAction(clientId, draftType);
    setGenerating(null);
    if (result.ok) {
      setDrafts((p) => [result.draft, ...p]);
      toast.success("Luv drafted a message for you to review.");
    } else {
      toast.error(result.message ?? "Luv couldn't generate a draft right now.");
    }
  }

  function handleDiscard(id: string) {
    setDrafts((p) => p.map((d) => d.id === id ? { ...d, status: "discarded" as const } : d));
  }

  return (
    <div className="space-y-6">
      {/* Planning Progress Briefing */}
      {readiness ? (
        <LuvEventBriefing readiness={readiness} />
      ) : (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ border: `1px solid ${DUSTY_ROSE}25`, background: `color-mix(in oklch, ${DUSTY_ROSE} 4%, var(--card))` }}
        >
          <LuvHeart size={14} />
          <p className="text-sm text-muted-foreground">
            No upcoming event linked to this client yet. Planning Progress will appear once an event is created.
          </p>
        </div>
      )}

      <Separator />

      {/* Draft panel */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5">
          <LuvHeart size={14} />
          <p className="text-sm font-medium text-heading">Ask Luv to draft a message</p>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Luv can help write planning-stage emails. You review, edit, and send — she never sends anything.
        </p>

        {/* Draft type buttons */}
        <div className="grid gap-2 sm:grid-cols-2">
          {DRAFT_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              disabled={!!generating}
              onClick={() => handleGenerate(option.type)}
              className="rounded-xl border border-border bg-card p-3 text-left hover:border-[#D8A7AA]/40 hover:bg-muted/30 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-heading">{option.label}</p>
                {generating === option.type
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: DUSTY_ROSE }} />
                  : <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
            </button>
          ))}
        </div>

        {/* Pending drafts */}
        {pendingDrafts.length > 0 && (
          <div className="space-y-3 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending review</p>
            {pendingDrafts.map((draft) => (
              <ClientDraftCard key={draft.id} draft={draft} clientId={clientId} onDiscard={handleDiscard} />
            ))}
          </div>
        )}

        {/* Past drafts */}
        {pastDrafts.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors list-none">
              Draft history ({pastDrafts.length}) ▸
            </summary>
            <div className="mt-2 space-y-1.5">
              {pastDrafts.map((draft) => (
                <div key={draft.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                  <span className="flex-1 truncate">{draft.subject ?? draft.content.slice(0, 50) + "…"}</span>
                  <span className="shrink-0">{DRAFT_OPTIONS.find((d) => d.type === draft.draftType)?.label}</span>
                  <span className={`shrink-0 ${draft.status === "accepted" ? "text-success" : ""}`}>
                    {draft.status === "accepted" ? "Used" : "Discarded"}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
