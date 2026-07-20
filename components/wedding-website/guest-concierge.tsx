"use client";

/**
 * GuestConciergeWidget — "Questions about the day?" for a looked-up guest.
 *
 * Hosted Experience Platform Phase 5 — deliberately a concierge, not a
 * chat interface (see docs/hosted-experience-platform-architecture-spec.md
 * §9): collapsed by default, a handful of curated common questions, and
 * exactly one question/answer visible at a time rather than a growing
 * thread. Guest-token authenticated via /api/rsvp/concierge.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";

type ConciergeThemeConfig = {
  dark: boolean;
  text: string;
  cardRadius: string | number;
  buttonRadius: string | number;
};

const SUGGESTED = [
  "What should I wear?",
  "Is there parking?",
  "What's the weather backup plan?",
  "Any hotel recommendations?",
];

export function GuestConciergeWidget({ rsvpToken, accentColor, tc }: {
  rsvpToken: string; accentColor: string; tc: ConciergeThemeConfig;
}) {
  const [open, setOpen]         = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [asked, setAsked]       = React.useState<string | null>(null);
  const [answer, setAnswer]     = React.useState<string | null>(null);
  const [loading, setLoading]   = React.useState(false);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setAsked(trimmed);
    setAnswer(null);
    setQuestion("");
    try {
      const res = await fetch("/api/rsvp/concierge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rsvpToken, question: trimmed }),
      });
      const data = await res.json() as { answer?: string };
      setAnswer(data.answer ?? "I'm not sure about that one — feel free to ask the couple directly.");
    } catch {
      setAnswer("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setAsked(null);
    setAnswer(null);
    setQuestion("");
  }

  const cardStyle: React.CSSProperties = {
    background: tc.dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
    borderRadius: tc.cardRadius,
    color: tc.dark ? tc.text : "#333",
  };

  if (!open) {
    return (
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: tc.dark ? tc.text : "#555" }}
        >
          Questions about the day? Ask Luv →
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3" style={cardStyle}>
      <p className="text-sm font-medium">Questions about the day?</p>

      {!asked ? (
        <>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="text-xs px-3 py-1.5 rounded-full border opacity-80 hover:opacity-100 transition-opacity"
                style={{ borderColor: tc.dark ? "rgba(255,255,255,0.2)" : "#DED6CA" }}
              >
                {q}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Or ask your own question…"
              className="flex-1 min-w-0 px-3 py-2 text-sm focus:outline-none"
              style={{
                background: tc.dark ? "rgba(255,255,255,0.08)" : "#fff",
                border: `1px solid ${tc.dark ? "rgba(255,255,255,0.15)" : "#DED6CA"}`,
                borderRadius: tc.buttonRadius,
                color: "inherit",
              }}
            />
            <button
              type="submit"
              disabled={!question.trim() || loading}
              className="shrink-0 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: accentColor, borderRadius: tc.buttonRadius }}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ask"}
            </button>
          </form>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs italic opacity-70">&quot;{asked}&quot;</p>
          <div
            className="text-sm leading-relaxed rounded-xl px-4 py-3"
            style={{ background: tc.dark ? "rgba(255,255,255,0.05)" : "#F7F5F1" }}
          >
            {loading ? (
              <span className="inline-flex items-center gap-1.5 opacity-70">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </span>
            ) : answer}
          </div>
          {!loading && (
            <button
              type="button"
              onClick={reset}
              className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100 transition-opacity"
            >
              Ask something else
            </button>
          )}
        </div>
      )}
    </div>
  );
}
