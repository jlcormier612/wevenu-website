"use client";

import * as React from "react";
import { Loader2, RefreshCw, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { LuvRollUp, LuvRollUpObservations } from "@/lib/luv/roll-up-types";

// ── Quadrant config ───────────────────────────────────────────────────────────

type Quadrant = {
  key:    keyof LuvRollUpObservations;
  emoji:  string;
  label:  string;
  bg:     string;
  border: string;
  text:   string;
};

const QUADRANTS: Quadrant[] = [
  {
    key:    "whatIsWorking",
    emoji:  "💗",
    label:  "What's Working",
    bg:     "rgba(93,111,93,0.06)",
    border: "rgba(93,111,93,0.18)",
    text:   "#3D5040",
  },
  {
    key:    "needsAttention",
    emoji:  "⚠️",
    label:  "Needs Attention",
    bg:     "rgba(217,119,6,0.07)",
    border: "rgba(217,119,6,0.22)",
    text:   "#92400E",
  },
  {
    key:    "opportunities",
    emoji:  "🌟",
    label:  "Opportunities",
    bg:     "rgba(99,102,241,0.07)",
    border: "rgba(99,102,241,0.20)",
    text:   "#3730A3",
  },
  {
    key:    "customerLove",
    emoji:  "❤️",
    label:  "Customer Love",
    bg:     "rgba(220,106,106,0.07)",
    border: "rgba(220,106,106,0.20)",
    text:   "#9B1C1C",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Single quadrant ───────────────────────────────────────────────────────────

function QuadrantBlock({ q, text }: { q: Quadrant; text: string }) {
  return (
    <div className="rounded-2xl p-4 space-y-2"
      style={{ background: q.bg, border: `1px solid ${q.border}` }}>
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">{q.emoji}</span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: q.text }}>
          {q.label}
        </p>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: q.text }}>{text}</p>
    </div>
  );
}

// ── Roll-up history row ───────────────────────────────────────────────────────

function HistoryRow({ rollup, onView }: { rollup: LuvRollUp; onView: (r: LuvRollUp) => void }) {
  return (
    <button
      type="button"
      onClick={() => onView(rollup)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left group">
      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-heading truncate">
          {formatDate(rollup.generatedAt)} · {formatTime(rollup.generatedAt)}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{rollup.observations.whatIsWorking.slice(0, 80)}…</p>
      </div>
      <span className="text-[11px] text-muted-foreground group-hover:text-foreground shrink-0">View →</span>
    </button>
  );
}

// ── Skeleton while generating ─────────────────────────────────────────────────

function GeneratingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {QUADRANTS.map(q => (
        <div key={q.key} className="rounded-2xl p-4 space-y-2 animate-pulse"
          style={{ background: q.bg, border: `1px solid ${q.border}` }}>
          <div className="flex items-center gap-2">
            <span className="text-base">{q.emoji}</span>
            <div className="h-2.5 w-24 rounded-full bg-current opacity-20" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 rounded-full bg-current opacity-10 w-full" />
            <div className="h-3 rounded-full bg-current opacity-10 w-4/5" />
            <div className="h-3 rounded-full bg-current opacity-10 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function LuvRollUpCard() {
  const [rollups,    setRollups]    = React.useState<LuvRollUp[]>([]);
  const [current,   setCurrent]     = React.useState<LuvRollUp | null>(null);
  const [loading,   setLoading]     = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const [error,     setError]       = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/luv/roll-up")
      .then(r => r.json())
      .then((d: { rollups?: LuvRollUp[] }) => {
        const list = d.rollups ?? [];
        setRollups(list);
        if (list.length > 0) setCurrent(list[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res  = await fetch("/api/luv/roll-up", { method: "POST" });
      const data = await res.json() as LuvRollUp & { ok?: boolean; message?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.message ?? "Luv had trouble generating a roll-up. Try again.");
        return;
      }
      const newRollup: LuvRollUp = {
        id:           data.id,
        generatedAt:  data.generatedAt,
        observations: data.observations,
        modelUsed:    data.modelUsed,
      };
      setRollups(prev => [newRollup, ...prev]);
      setCurrent(newRollup);
    } catch {
      setError("Couldn't reach Luv right now. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  const prevRollups = rollups.slice(1); // everything except current

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl leading-none">💗</span>
            <div>
              <p className="text-sm font-semibold text-heading">Luv's Roll-Up</p>
              {current ? (
                <p className="text-[11px] text-muted-foreground">
                  {relativeTime(current.generatedAt)} · {formatDate(current.generatedAt)} {formatTime(current.generatedAt)}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Your weekly synthesis — what matters, what needs action, what to celebrate.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={generating || loading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-border hover:bg-muted/50 transition-colors disabled:opacity-50 shrink-0">
            {generating
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Luv is thinking…</>
              : <><RefreshCw className="h-3.5 w-3.5" /> {current ? "Refresh" : "Generate Roll-Up"}</>
            }
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Error state */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading first fetch */}
        {loading && !current && (
          <div className="py-6 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
          </div>
        )}

        {/* Generating skeleton */}
        {generating && <GeneratingSkeleton />}

        {/* Quadrants — shown when not generating */}
        {!generating && current && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUADRANTS.map(q => (
              <QuadrantBlock key={q.key} q={q} text={current.observations[q.key]} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !generating && !current && (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center space-y-3">
            <span className="text-3xl block">💗</span>
            <p className="text-sm font-medium text-heading">Luv is ready to synthesize</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
              Generate your first roll-up and Luv will synthesize your venue performance into four clear observations.
            </p>
          </div>
        )}

        {/* Previous roll-ups */}
        {prevRollups.length > 0 && !generating && (
          <div className="border-t border-border/50 pt-3">
            <button
              type="button"
              onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full mb-2">
              {showHistory
                ? <><ChevronUp className="h-3 w-3" /> Hide previous roll-ups</>
                : <><ChevronDown className="h-3 w-3" /> {prevRollups.length} previous roll-up{prevRollups.length !== 1 ? "s" : ""}</>
              }
            </button>
            {showHistory && (
              <div className="space-y-0.5">
                {prevRollups.map(r => (
                  <HistoryRow key={r.id} rollup={r} onView={r => setCurrent(r)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Luv footer note */}
        {!loading && (
          <p className="text-[10px] text-muted-foreground/50 text-center pt-1">
            Luv synthesizes your data — she doesn't replace your judgment. Every roll-up is saved for trend tracking.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
