"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";

type FeedbackRow = {
  id: string;
  type: string;
  subject: string | null;
  body: string;
  rating: number | null;
  status: string;
  vote_count: number;
  created_at: string;
  venues: { name: string } | null;
  metadata: Record<string, string | number | null>;
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  support: { label: "Support",   color: "bg-info/20 text-info-foreground border-info/30" },
  bug:     { label: "Bug",       color: "bg-destructive/15 text-destructive border-destructive/30" },
  feature: { label: "Feature",   color: "bg-success/15 text-success border-success/30" },
  nps:     { label: "NPS",       color: "bg-accent/30 text-accent-foreground border-accent/30" },
  general: { label: "General",   color: "bg-muted text-muted-foreground border-border" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  open:         { label: "Open",         color: "bg-warning/20 text-warning-foreground border-warning/30" },
  acknowledged: { label: "Acknowledged", color: "bg-info/20 text-info-foreground border-info/30" },
  resolved:     { label: "Resolved",     color: "bg-success/15 text-success border-success/30" },
};

const FILTERS = ["all", "support", "bug", "feature", "nps", "general"] as const;
type Filter = typeof FILTERS[number];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminFeedbackPage() {
  const [rows,      setRows]      = React.useState<FeedbackRow[]>([]);
  const [loading,   setLoading]   = React.useState(true);
  const [filter,    setFilter]    = React.useState<Filter>("all");
  const [expanded,  setExpanded]  = React.useState<string | null>(null);
  const [forbidden, setForbidden] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/admin/feedback")
      .then(r => {
        if (r.status === 403) { setForbidden(true); return null; }
        return r.json() as Promise<{ feedback: FeedbackRow[] }>;
      })
      .then(d => { if (d) setRows(d.feedback); })
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/admin/feedback", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, status }),
    });
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  const filtered = filter === "all" ? rows : rows.filter(r => r.type === filter);

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-2xl">🔒</p>
        <p className="text-sm font-medium text-heading">Access restricted</p>
        <p className="text-xs text-muted-foreground">This page is only available to Wevenu team members.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-heading">Venue Feedback</h1>
        <p className="text-sm text-muted-foreground mt-1">All submissions from venue teams across the platform.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors border ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {f === "all" ? `All (${rows.length})` : `${TYPE_META[f]?.label ?? f} (${rows.filter(r => r.type === f).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: "#DDD9D2", borderTopColor: "#5D6F5D" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-3xl">📭</p>
          <p className="text-sm font-medium text-heading">No submissions yet</p>
          <p className="text-xs text-muted-foreground">Feedback from venues will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(row => {
            const tm = TYPE_META[row.type]   ?? TYPE_META.general;
            const sm = STATUS_META[row.status] ?? STATUS_META.open;
            const isOpen = expanded === row.id;
            return (
              <div
                key={row.id}
                className="rounded-xl border bg-card overflow-hidden"
              >
                <button
                  type="button"
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : row.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tm.color}`}>
                        {tm.label}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sm.color}`}>
                        {sm.label}
                      </span>
                      {row.rating != null && (
                        <span className="text-xs font-medium text-muted-foreground">⭐ {row.rating}/10</span>
                      )}
                      {row.type === "feature" && row.vote_count > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          👍 {row.vote_count} {row.vote_count === 1 ? "vote" : "votes"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-heading truncate">
                      {row.subject ?? row.body.slice(0, 80)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {row.venues?.name ?? "Unknown venue"} · {formatDate(row.created_at)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 shrink-0">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t bg-muted/20 space-y-3">
                    {row.subject && (
                      <p className="text-xs text-muted-foreground pt-3">Subject: <span className="font-medium text-foreground">{row.subject}</span></p>
                    )}
                    <p className="text-sm text-foreground whitespace-pre-wrap pt-2">{row.body || <em className="text-muted-foreground">No message body.</em>}</p>

                    {/* Context metadata */}
                    {row.metadata && Object.keys(row.metadata).length > 0 && (
                      <div className="mt-3 rounded-lg border bg-muted/30 px-3 py-2 space-y-0.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Context</p>
                        {Object.entries(row.metadata).filter(([, v]) => v != null).map(([k, v]) => (
                          <div key={k} className="flex gap-2 text-xs">
                            <span className="text-muted-foreground w-32 shrink-0 capitalize">{k.replace(/_/g, " ")}</span>
                            <span className="text-foreground truncate">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      {["open", "acknowledged", "resolved"].map(s => (
                        <button
                          key={s}
                          type="button"
                          disabled={row.status === s}
                          onClick={() => void updateStatus(row.id, s)}
                          className="rounded-lg border px-2.5 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-40 hover:bg-muted border-border text-muted-foreground"
                        >
                          Mark {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
