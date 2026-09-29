"use client";

/**
 * LuvAskSection — "Ask Luv" in the couple portal.
 *
 * Knowledge layers: HTC product, Venue Guide, and this couple's portal context
 * (payments / contracts / documents). Luv Intelligence V1: structured outcomes
 * and bounded information-gap next steps (no send / no web fetch).
 */

import * as React from "react";
import { Loader2, Send } from "lucide-react";

import { LuvHeart } from "@/components/dashboard/luv-widget";
import { Button } from "@/components/ui/button";
import {
  LUV_ASK_NEXT_STEP_LABELS,
  PHRASE_QUESTION_FOLLOW_UP,
  type LuvAskNextStepType,
  type LuvAskOutcome,
} from "@/lib/luv/ask-outcome";
import {
  buildLuvAskPortalContext,
  resolveLuvAskSuggestedChips,
  type LuvAskPortalContext,
} from "@/lib/luv/portal-context";
import type { PortalPaymentScheduleLike } from "@/lib/portal/payment-schedules";
import type { PortalInvoiceRef } from "@/lib/portal/payment-obligations";

const DUSTY_ROSE = "#D8A7AA";
const ROSE_DEEP = "#8B5456";
const SAGE = "var(--venue-primary)";

const GUIDE_SECTIONS: Record<string, { emoji: string; label: string }> = {
  parking: { emoji: "🚗", label: "Parking & Transportation" },
  accommodations: { emoji: "🏨", label: "Accommodations" },
  weather: { emoji: "🌧️", label: "Weather & Rain Plan" },
  policies: { emoji: "📋", label: "Policies & Rules" },
  ceremony: { emoji: "⛪", label: "Ceremony & Arrival" },
  things_to_know: { emoji: "🍽️", label: "Things To Know" },
  faqs: { emoji: "❓", label: "FAQs" },
  contacts: { emoji: "📞", label: "Important Contacts" },
};

type QA = {
  id: string;
  question: string;
  answer: string;
  guideSection?: string | null;
  outcome?: LuvAskOutcome | null;
  nextSteps?: LuvAskNextStepType[];
};

export type LuvAskNavigateTarget = "guide" | "payments" | "documents";

function AnswerBubble({
  qa,
  onNavigateToGuide,
  onNavigate,
  onPhraseQuestion,
  loading,
}: {
  qa: QA;
  onNavigateToGuide?: () => void;
  onNavigate?: (target: LuvAskNavigateTarget) => void;
  onPhraseQuestion?: () => void;
  loading: boolean;
}) {
  const section = qa.guideSection ? GUIDE_SECTIONS[qa.guideSection] : null;
  const isLoading = qa.answer === "…";
  const gapSteps =
    qa.outcome === "information_gap" && Array.isArray(qa.nextSteps) ? qa.nextSteps : [];

  function runNextStep(step: LuvAskNextStepType) {
    if (step === "phrase_question") {
      onPhraseQuestion?.();
      return;
    }
    if (step === "browse_venue_guide" || step === "contact_venue") {
      if (onNavigate) onNavigate("guide");
      else onNavigateToGuide?.();
      return;
    }
    if (step === "open_payments") {
      onNavigate?.("payments");
      return;
    }
    if (step === "open_documents") {
      onNavigate?.("documents");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white"
          style={{ background: SAGE }}
        >
          {qa.question}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">
          <LuvHeart size={16} />
        </div>
        <div className="max-w-[90%] space-y-2">
          <div
            className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-heading"
            style={{
              background: `color-mix(in oklch, ${DUSTY_ROSE} 8%, var(--card))`,
              border: `1px solid ${DUSTY_ROSE}25`,
            }}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Luv is thinking…
              </span>
            ) : (
              qa.answer
            )}
          </div>

          {!isLoading && section && (onNavigateToGuide || onNavigate) && (
            <button
              type="button"
              onClick={() => {
                if (onNavigate) onNavigate("guide");
                else onNavigateToGuide?.();
              }}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors hover:opacity-80"
              style={{
                background: `${DUSTY_ROSE}12`,
                color: ROSE_DEEP,
                border: `1px solid ${DUSTY_ROSE}30`,
              }}
            >
              <span>{section.emoji}</span>
              <span>{section.label} in your Venue Guide →</span>
            </button>
          )}

          {!isLoading && gapSteps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {gapSteps.map((step) => (
                <button
                  key={step}
                  type="button"
                  disabled={loading}
                  onClick={() => runNextStep(step)}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{
                    background: `${DUSTY_ROSE}12`,
                    color: ROSE_DEEP,
                    border: `1px solid ${DUSTY_ROSE}30`,
                  }}
                >
                  {LUV_ASK_NEXT_STEP_LABELS[step]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LuvAskSection({
  token,
  onNavigateToGuide,
  onNavigate,
}: {
  token: string;
  onNavigateToGuide?: () => void;
  /** Optional deeper navigation for gap next steps (payments / documents / guide). */
  onNavigate?: (target: LuvAskNavigateTarget) => void;
}) {
  const [answers, setAnswers] = React.useState<QA[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [suggested, setSuggested] = React.useState<string[]>(() =>
    resolveLuvAskSuggestedChips(null),
  );
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/portal/payments?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d: {
        schedules?: PortalPaymentScheduleLike[];
        invoices?: PortalInvoiceRef[];
        onlinePaymentsReady?: boolean;
      }) => {
        if (cancelled) return;
        const ctx: LuvAskPortalContext = buildLuvAskPortalContext({
          schedules: d.schedules ?? [],
          invoices: d.invoices ?? [],
          onlinePaymentsReady: d.onlinePaymentsReady ?? null,
        });
        setSuggested(resolveLuvAskSuggestedChips(ctx));
      })
      .catch(() => {
        if (!cancelled) setSuggested(resolveLuvAskSuggestedChips(null));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setInput("");
    const id = Date.now().toString();
    setAnswers((p) => [...p, { id, question: q, answer: "…" }]);

    try {
      const res = await fetch("/api/portal/luv-ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, question: q }),
      });
      const data = (await res.json()) as {
        answer?: string;
        guideSection?: string | null;
        outcome?: LuvAskOutcome;
        nextSteps?: LuvAskNextStepType[];
        error?: string;
      };
      const answer =
        data.answer?.trim() ||
        "I'm not sure about that one. Try asking your coordinator directly.";
      setAnswers((p) =>
        p.map((a) =>
          a.id === id
            ? {
                ...a,
                answer,
                guideSection: data.guideSection ?? null,
                outcome: data.outcome ?? null,
                nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
              }
            : a,
        ),
      );
    } catch {
      setAnswers((p) =>
        p.map((a) =>
          a.id === id ? { ...a, answer: "Something went wrong. Please try again." } : a,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (answers.length > 0) {
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }),
        100,
      );
    }
  }, [answers]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  }

  const unusedSuggestions = suggested.filter((q) => !answers.some((a) => a.question === q));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <LuvHeart size={18} />
          <h2 className="font-heading text-xl font-medium text-heading">Ask Luv</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Ask how Hello to Cheers works — Documents, contracts, payments, questionnaires, Your
          Choices — or anything in your Venue Guide. Luv answers from those sources only.
        </p>
        {(onNavigateToGuide || onNavigate) && (
          <button
            type="button"
            onClick={() => {
              if (onNavigate) onNavigate("guide");
              else onNavigateToGuide?.();
            }}
            className="inline-flex items-center gap-1.5 text-xs mt-1 transition-colors hover:opacity-80"
            style={{ color: ROSE_DEEP }}
          >
            <span>🏛️</span>
            <span className="underline underline-offset-2">
              Browse everything in your Venue Guide
            </span>
          </button>
        )}
      </div>

      {answers.length > 0 ? (
        <div className="space-y-5">
          {answers.map((qa) => (
            <AnswerBubble
              key={qa.id}
              qa={qa}
              loading={loading}
              onNavigateToGuide={onNavigateToGuide}
              onNavigate={onNavigate}
              onPhraseQuestion={() => ask(PHRASE_QUESTION_FOLLOW_UP)}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Try asking:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggested.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="text-sm px-3 py-1.5 rounded-full border border-border bg-card hover:border-[#D8A7AA]/50 hover:bg-[#D8A7AA]/8 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className="rounded-2xl border overflow-hidden focus-within:ring-2 focus-within:ring-ring"
        style={{ borderColor: `${DUSTY_ROSE}40` }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about Hello to Cheers or your venue…"
          rows={2}
          className="w-full resize-none bg-card px-4 pt-3 pb-1 text-sm text-heading placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center justify-between px-3 pb-2.5 bg-card">
          <p className="text-[11px] text-muted-foreground">
            Press Enter to send · Shift+Enter for new line
          </p>
          <Button
            type="button"
            size="sm"
            disabled={!input.trim() || loading}
            onClick={() => ask(input)}
            style={{ backgroundColor: DUSTY_ROSE, borderColor: DUSTY_ROSE }}
            className="text-white hover:opacity-90"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {answers.length > 0 && unusedSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            More to ask:
          </p>
          <div className="flex flex-wrap gap-2">
            {unusedSuggestions.slice(0, 4).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-[#D8A7AA]/50 transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
