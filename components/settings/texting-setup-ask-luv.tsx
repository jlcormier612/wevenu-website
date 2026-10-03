"use client";

import * as React from "react";
import { MessageCircle } from "lucide-react";

import { LuvHeart } from "@/components/dashboard/luv-widget";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  answerTextingSetupLuvQuestion,
  textingLuvSuggestions,
  type TextingSetupLuvContext,
} from "@/lib/texting-registration/human-facing";

/**
 * Compact contextual Ask Luv for Texting Setup.
 * Answers are grounded in authoritative TextingSetupLuvContext only.
 */
export function TextingSetupAskLuv({ context }: { context: TextingSetupLuvContext }) {
  const [open, setOpen] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<string | null>(null);
  const suggestions = textingLuvSuggestions(context);

  function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    setAnswer(answerTextingSetupLuvQuestion(trimmed, context));
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
        data-testid="texting-ask-luv-toggle"
      >
        <LuvHeart size={14} />
        <span className="text-xs font-medium text-heading flex-1">Ask Luv about texting setup</span>
        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div className="space-y-2 pt-1" data-testid="texting-ask-luv-panel">
          <p className="text-xs text-muted-foreground">
            Luv answers from your current texting status on this page — not guesses about timelines or carrier review.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => ask(s.label)}
                className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-heading hover:bg-muted/40"
              >
                {s.label}
              </button>
            ))}
          </div>
          <Textarea
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about status, next steps, or consent…"
            className="text-xs"
            data-testid="texting-ask-luv-input"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => ask(question)}
              data-testid="texting-ask-luv-submit"
            >
              Ask Luv
            </Button>
          </div>
          {answer && (
            <div
              className="rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground leading-relaxed"
              data-testid="texting-ask-luv-answer"
            >
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
