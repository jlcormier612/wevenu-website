"use client";

/**
 * LuvDraftPanel — Luv Phase 2: Draft a follow-up.
 *
 * Generates AI-powered email drafts for coordinator review.
 * Coordinator reviews, edits, and sends manually.
 * Luv never sends anything.
 */

import * as React from "react";

import { ArrowRight, Check, ChevronDown, ChevronRight, ClipboardCopy, Loader2, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  generateFollowUpDraftAction,
  updateDraftStatusAction,
} from "@/app/(app)/leads/[id]/luv-actions";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import { LeadMomentumCard } from "@/components/luv/lead-momentum-card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { LuvDraft } from "@/lib/luv/drafts";
import type { Lead } from "@/lib/leads/types";

const DUSTY_ROSE = "#D8A7AA";

function DraftCard({
  draft,
  leadId,
  onDiscard,
  onUseDraft,
}: {
  draft: LuvDraft;
  leadId: string;
  onDiscard: (id: string) => void;
  onUseDraft?: (subject: string | null, body: string) => void;
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
    // Mark as accepted when copied — they're using it
    await updateDraftStatusAction(draft.id, leadId, "accepted");
  }

  function handleDiscard() {
    startDiscard(async () => {
      await updateDraftStatusAction(draft.id, leadId, "discarded");
      onDiscard(draft.id);
    });
  }

  return (
    <div className="rounded-xl border border-[#D8A7AA]/30 bg-[#D8A7AA]/5 p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <LuvHeart size={12} />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Luv drafted this follow-up
        </p>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {new Date(draft.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>

      {draft.subject != null && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Subject line</Label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-heading focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Email body — edit freely before copying</Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          className="font-sans text-sm leading-relaxed resize-none"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        💗 Review, personalize, and copy to your email client. Luv does not send anything.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {onUseDraft && (
          <Button type="button" size="sm"
            style={{ borderColor: `${DUSTY_ROSE}60`, backgroundColor: `${DUSTY_ROSE}15`, color: "#8B5A5C" }}
            className="hover:opacity-90"
            onClick={() => onUseDraft(draft.subject, body)}>
            <ArrowRight className="mr-1 h-3.5 w-3.5" /> Send this →
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={handleCopy}
          className={copied ? "border-success text-success" : ""}>
          {copied
            ? <><Check className="mr-1 h-3.5 w-3.5" />Copied!</>
            : <><ClipboardCopy className="mr-1 h-3.5 w-3.5" />Copy</>}
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

function PastDraftRow({
  draft, leadId, onRestore,
}: { draft: LuvDraft; leadId: string; onRestore: (d: LuvDraft) => void }) {
  const [expanded, setExpanded] = React.useState(false);
  const [restoring, startRestore] = React.useTransition();
  const date = new Date(draft.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  function handleRestore() {
    startRestore(async () => {
      await updateDraftStatusAction(draft.id, leadId, "accepted");
      onRestore({ ...draft, status: "pending_review" });
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors rounded-lg">
        {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        <span className="flex-1 text-xs text-muted-foreground truncate">
          {draft.subject ?? draft.content.slice(0, 60) + "…"}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{date}</span>
      </button>
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
          {draft.subject && <p className="text-xs font-medium text-heading">Subject: {draft.subject}</p>}
          <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{draft.content}</p>
          <Button type="button" variant="outline" size="sm" onClick={handleRestore} disabled={restoring}>
            {restoring ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Restoring…</> : <><RotateCcw className="mr-1 h-3.5 w-3.5" />Restore to review</>}
          </Button>
        </div>
      )}
    </div>
  );
}

export function LuvDraftPanel({
  lead,
  initialDrafts,
  onUseDraft,
  autoGenerateDraftType,
}: {
  lead: Lead;
  initialDrafts: LuvDraft[];
  onUseDraft?: (subject: string | null, body: string) => void;
  autoGenerateDraftType?: string;  // e.g. "follow_up_email" from ?luv= URL param
}) {
  // Auto-trigger draft generation when arriving via a Luv recommendation link
  const [allDrafts, setAllDrafts] = React.useState(initialDrafts);
  const [generating, startGenerate] = React.useTransition();
  const autoTriggered = React.useRef(false);

  // Auto-generate draft when arriving from a Luv recommendation (?luv=follow_up_email)
  React.useEffect(() => {
    if (autoGenerateDraftType && !autoTriggered.current && !generating) {
      autoTriggered.current = true;
      handleGenerate(); // uses the default follow_up_email type
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerateDraftType]);

  const pendingDrafts = allDrafts.filter((d) => d.status === "pending_review");
  const pastDrafts = allDrafts.filter((d) => d.status !== "pending_review");

  function handleGenerate() {
    startGenerate(async () => {
      const result = await generateFollowUpDraftAction(lead);
      if (result.ok) {
        setAllDrafts((p) => [result.draft, ...p]);
        toast.success("Luv drafted a follow-up for you to review.");
      } else {
        toast.error(result.message ?? "Luv couldn't generate a draft right now.");
      }
    });
  }

  function handleDiscard(id: string) {
    setAllDrafts((p) => p.map((d) => d.id === id ? { ...d, status: "discarded" as const } : d));
  }

  function handleRestore(updated: LuvDraft) {
    setAllDrafts((p) => p.map((d) => d.id === updated.id ? updated : d));
  }

  return (
    <div className="space-y-5">
      {/* Relationship Health momentum card */}
      <LeadMomentumCard
        firstName={lead.firstName}
        commitmentScore={lead.commitmentScore}
        responsivenessScore={lead.responsivenessScore}
        interestScore={lead.interestScore}
        lastContactedAt={lead.lastContactedAt}
        createdAt={lead.createdAt}
      />

      {/* Generate button */}
      <div className="rounded-xl border border-[#D8A7AA]/25 bg-[#D8A7AA]/5 px-4 py-4">
        <div className="flex items-start gap-3">
          <LuvHeart size={16} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-heading">Ask Luv to draft a follow-up</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Luv will write a warm, personalized follow-up email based on what she knows about
              this inquiry. You review, edit, and send it yourself — Luv never sends anything.
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button type="button" size="sm" onClick={handleGenerate} disabled={generating}
            style={{ borderColor: `${DUSTY_ROSE}60`, backgroundColor: `${DUSTY_ROSE}15`, color: "#8B5A5C" }}
            className="hover:opacity-90">
            {generating
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Luv is drafting…</>
              : <><LuvHeart size={12} /><span className="ml-1.5">Draft a follow-up email</span></>}
          </Button>
          {pendingDrafts.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground"
              onClick={handleGenerate} disabled={generating}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Draft another
            </Button>
          )}
        </div>
      </div>

      {/* Pending drafts */}
      {pendingDrafts.length > 0 && (
        <div className="space-y-4">
          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending review</p>
          {pendingDrafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} leadId={lead.id} onDiscard={handleDiscard} onUseDraft={onUseDraft} />
          ))}
        </div>
      )}

      {/* Past drafts (accepted + discarded) */}
      {pastDrafts.length > 0 && (
        <div className="space-y-2">
          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Draft history ({pastDrafts.length})
          </p>
          {pastDrafts.map((draft) => (
            <PastDraftRow key={draft.id} draft={draft} leadId={lead.id} onRestore={handleRestore} />
          ))}
        </div>
      )}
    </div>
  );
}
