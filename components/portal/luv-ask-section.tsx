"use client";

/**
 * LuvAskSection — "Ask Luv" venue knowledge assistant in the couple portal.
 *
 * Couples type a question; Luv searches the venue's operational info
 * (FAQs, policies, parking, hotels, contacts) and replies warmly.
 * When an answer comes from a specific Venue Guide section, a "View in Guide →"
 * chip appears so couples can explore further in one tap.
 */

import * as React from "react";
import { Loader2, Send } from "lucide-react";

import { LuvHeart } from "@/components/dashboard/luv-widget";
import { Button } from "@/components/ui/button";

const DUSTY_ROSE = "#D8A7AA";
const ROSE_DEEP  = "#8B5456";
const SAGE       = "#5D6F5D";

// Must match the guideSection keys returned by /api/portal/luv-ask
const GUIDE_SECTIONS: Record<string, { emoji: string; label: string }> = {
  parking:        { emoji: "🚗", label: "Parking & Transportation" },
  accommodations: { emoji: "🏨", label: "Accommodations" },
  weather:        { emoji: "🌧️", label: "Weather & Rain Plan" },
  policies:       { emoji: "📋", label: "Policies & Rules" },
  ceremony:       { emoji: "⛪", label: "Ceremony & Arrival" },
  things_to_know: { emoji: "🍽️", label: "Things To Know" },
  faqs:           { emoji: "❓", label: "FAQs" },
  contacts:       { emoji: "📞", label: "Important Contacts" },
};

const SUGGESTED = [
  "Can we have sparklers?",
  "Is there parking for guests?",
  "What hotels do you recommend?",
  "What's the rain plan?",
  "When is our final payment due?",
  "Can we bring our own caterer?",
];

type QA = {
  id: string;
  question: string;
  answer: string;
  guideSection?: string | null;
};

function AnswerBubble({ qa, onNavigateToGuide }: { qa: QA; onNavigateToGuide?: () => void }) {
  const section = qa.guideSection ? GUIDE_SECTIONS[qa.guideSection] : null;
  const isLoading = qa.answer === "…";

  return (
    <div className="space-y-2">
      {/* Question — right-aligned */}
      <div className="flex justify-end">
        <div
          className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white"
          style={{ background: SAGE }}
        >
          {qa.question}
        </div>
      </div>

      {/* Answer — left-aligned with Luv icon */}
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

          {/* Guide chip — appears when answer references a specific section */}
          {!isLoading && section && onNavigateToGuide && (
            <button
              type="button"
              onClick={onNavigateToGuide}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors hover:opacity-80"
              style={{
                background: `${DUSTY_ROSE}12`,
                color:       ROSE_DEEP,
                border:      `1px solid ${DUSTY_ROSE}30`,
              }}
            >
              <span>{section.emoji}</span>
              <span>{section.label} in your Venue Guide →</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function LuvAskSection({
  token,
  onNavigateToGuide,
}: {
  token: string;
  /** Called when the couple taps "View in Venue Guide →". Navigate to the guide tab. */
  onNavigateToGuide?: () => void;
}) {
  const [answers, setAnswers]   = React.useState<QA[]>([]);
  const [input, setInput]       = React.useState("");
  const [loading, setLoading]   = React.useState(false);
  const bottomRef               = React.useRef<HTMLDivElement>(null);

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
      const data = await res.json() as { answer?: string; guideSection?: string | null; error?: string };
      const answer = data.answer?.trim() || "I'm not sure about that one. Try asking your coordinator directly.";
      setAnswers((p) => p.map((a) => a.id === id ? { ...a, answer, guideSection: data.guideSection ?? null } : a));
    } catch {
      setAnswers((p) => p.map((a) => a.id === id ? { ...a, answer: "Something went wrong. Please try again." } : a));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (answers.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 100);
    }
  }, [answers]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(input);
    }
  }

  const unusedSuggestions = SUGGESTED.filter((q) => !answers.some((a) => a.question === q));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <LuvHeart size={18} />
          <h2 className="font-heading text-xl font-medium text-heading">Ask Luv</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Ask anything about your venue — policies, parking, hotel recommendations, what to expect on the day. Luv searches the venue&apos;s information and answers right here.
        </p>
        {onNavigateToGuide && (
          <button
            type="button"
            onClick={onNavigateToGuide}
            className="inline-flex items-center gap-1.5 text-xs mt-1 transition-colors hover:opacity-80"
            style={{ color: ROSE_DEEP }}
          >
            <span>🏛️</span>
            <span className="underline underline-offset-2">Browse everything in your Venue Guide</span>
          </button>
        )}
      </div>

      {/* Conversation or empty state */}
      {answers.length > 0 ? (
        <div className="space-y-5">
          {answers.map((qa) => (
            <AnswerBubble key={qa.id} qa={qa} onNavigateToGuide={onNavigateToGuide} />
          ))}
          <div ref={bottomRef} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((q) => (
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

      {/* Input */}
      <div
        className="rounded-2xl border overflow-hidden focus-within:ring-2 focus-within:ring-ring"
        style={{ borderColor: `${DUSTY_ROSE}40` }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about the venue…"
          rows={2}
          className="w-full resize-none bg-card px-4 pt-3 pb-1 text-sm text-heading placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center justify-between px-3 pb-2.5 bg-card">
          <p className="text-[11px] text-muted-foreground">Press Enter to send · Shift+Enter for new line</p>
          <Button
            type="button"
            size="sm"
            disabled={!input.trim() || loading}
            onClick={() => ask(input)}
            style={{ backgroundColor: DUSTY_ROSE, borderColor: DUSTY_ROSE }}
            className="text-white hover:opacity-90"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Suggested follow-ups */}
      {answers.length > 0 && unusedSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">More to ask:</p>
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
