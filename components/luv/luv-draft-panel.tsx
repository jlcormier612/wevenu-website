"use client";

/**
 * LuvDraftPanel — Luv Phase 2: Draft a follow-up.
 *
 * Generates AI-powered email drafts for coordinator review.
 * Coordinator reviews, edits, and sends manually.
 * Luv never sends anything.
 */

import * as React from "react";

import { Check, ClipboardCopy, Heart, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  generateFollowUpDraftAction,
  updateDraftStatusAction,
} from "@/app/(app)/leads/[id]/luv-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { LuvDraft } from "@/lib/luv/drafts";
import type { Lead } from "@/lib/leads/types";

const DUSTY_ROSE = "#D8A7AA";

function LuvHeart({ size = 14 }: { size?: number }) {
  return <Heart aria-hidden style={{ width: size, height: size, color: DUSTY_ROSE, fill: DUSTY_ROSE }} className="shrink-0" />;
}

function DraftCard({
  draft,
  leadId,
  onDiscard,
}: {
  draft: LuvDraft;
  leadId: string;
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

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={handleCopy}
          className={copied ? "bg-success text-success-foreground" : ""}>
          {copied
            ? <><Check className="mr-1 h-3.5 w-3.5" />Copied!</>
            : <><ClipboardCopy className="mr-1 h-3.5 w-3.5" />Copy to clipboard</>}
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

export function LuvDraftPanel({
  lead,
  initialDrafts,
}: {
  lead: Lead;
  initialDrafts: LuvDraft[];
}) {
  const [drafts, setDrafts] = React.useState(
    initialDrafts.filter((d) => d.status === "pending_review"),
  );
  const [generating, startGenerate] = React.useTransition();
  const isEnabled = !!(process.env.NEXT_PUBLIC_LUV_DRAFTS_ENABLED ?? true);

  function handleGenerate() {
    startGenerate(async () => {
      const result = await generateFollowUpDraftAction(lead);
      if (result.ok) {
        setDrafts((p) => [result.draft, ...p]);
        toast.success("Luv drafted a follow-up for you to review.");
      } else {
        toast.error(result.message ?? "Luv couldn't generate a draft right now.");
      }
    });
  }

  function handleDiscard(id: string) {
    setDrafts((p) => p.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Intro */}
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
        <div className="mt-3">
          <Button
            type="button"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            style={{ borderColor: `${DUSTY_ROSE}60`, backgroundColor: `${DUSTY_ROSE}15`, color: "#8B5A5C" }}
            className="hover:opacity-90"
          >
            {generating ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Luv is drafting…</>
            ) : (
              <><LuvHeart size={12} /><span className="ml-1.5">Draft a follow-up email</span></>
            )}
          </Button>
          {drafts.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="ml-2 text-muted-foreground"
              onClick={handleGenerate} disabled={generating}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Draft another
            </Button>
          )}
        </div>
      </div>

      {/* Generated drafts */}
      {drafts.length > 0 && (
        <div className="space-y-4">
          <Separator />
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              leadId={lead.id}
              onDiscard={handleDiscard}
            />
          ))}
        </div>
      )}
    </div>
  );
}
