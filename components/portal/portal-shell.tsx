"use client";

/**
 * PortalShell — the couple's wedding planning workspace.
 *
 * Navigation model (Sprint 50):
 *
 * COUPLE-OWNED (their space):
 *   Overview    — combined dashboard: guests, todos, upcoming milestones
 *   Guest List  — their guest list with RSVP tracking
 *   To-Do       — personal planning tasks (separate from venue tasks)
 *   Our People  — who else has access to their planning workspace
 *
 * SHARED WITH VENUE:
 *   Tasks       — venue-assigned tasks requiring couple action
 *   Payments    — invoices + payment schedule
 *   Documents   — shared documents
 *   Messages    — shared communication thread
 *
 * Design: mobile-first, Heritage Sage palette, venue-branded header.
 * "The client portal is not the venue portal filtered for the couple."
 */

import * as React from "react";

import {
  CalendarDays, Check, CheckSquare, Clock, Loader2,
  Lock, Plus, Trash2, Users, X,
} from "lucide-react";
import { toast } from "sonner";

import type {
  CoupleTodo, CoupleGuest, GuestStats,
  PortalContext, PortalSection, PortalTask, TodoCategory,
} from "@/lib/portal/types";

const SAGE = "#5D6F5D";
const LINEN = "#F7F5F1";
const TAUPE = "#B8AEA1";
const ROSE  = "#D8A7AA";
const CREAM = "#F5F4F2";

// ── Shared utilities ──────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000);
}

function ReadinessRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CREAM} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SAGE} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={SAGE}>{score}%</text>
    </svg>
  );
}

// ── Luv message generator (contextual, warm) ─────────────────────────────────

function getLuvMessage(du: number | null, guestTotal: number, readiness: number): string {
  if (du === null) return "Your wedding planning is underway. You're doing beautifully.";
  if (du > 365) return "You have a beautiful journey ahead. The earlier you start, the more you can enjoy every moment.";
  if (du > 270) return "This is such an exciting time. Most couples at your stage are locking in their venue and photographer.";
  if (du > 180 && guestTotal === 0) return "Your guest list is the heart of your celebration. Now is a wonderful time to start building it.";
  if (du > 180) return `With ${guestTotal} guests on your list, you're building something beautiful. Invitations typically go out 2–3 months out.`;
  if (du > 90 && readiness < 50) return "You have everything you need to make this incredible. A few focused weeks of planning will bring it all together.";
  if (du > 90) return "You're making wonderful progress. The details are coming together exactly as they should.";
  if (du > 30) return "The final weeks before a wedding are often the most magical. Your special day is almost here.";
  return "Your wedding day is so close. Breathe, celebrate, and enjoy every moment of this journey.";
}

// ── Planning journey milestone path ──────────────────────────────────────────

const MILESTONES = [
  { label: "12 mo", threshold: 365 },
  { label: "9 mo",  threshold: 270 },
  { label: "6 mo",  threshold: 180 },
  { label: "3 mo",  threshold: 90  },
  { label: "1 mo",  threshold: 30  },
  { label: "Day",   threshold: 0   },
];

function PlanningJourney({ du, readiness }: { du: number | null; readiness: number }) {
  if (du === null) return null;
  const activeIdx = MILESTONES.findIndex(m => du > m.threshold);
  const pct = readiness;

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-heading">Planning Journey</p>
        <p className="text-xs font-semibold" style={{ color: SAGE }}>{pct}% complete</p>
      </div>
      {/* Milestone dots */}
      <div className="flex items-center gap-0">
        {MILESTONES.map((m, i) => {
          const isPast = activeIdx > 0 && i < activeIdx;
          const isCurrent = i === activeIdx || activeIdx === -1 && i === MILESTONES.length - 1;
          return (
            <React.Fragment key={m.label}>
              <div className="flex flex-col items-center gap-1">
                <div className={`h-3 w-3 rounded-full border-2 transition-all ${
                  isCurrent ? "scale-125" : ""
                }`}
                  style={{
                    background: isPast || isCurrent ? SAGE : "white",
                    borderColor: isPast || isCurrent ? SAGE : "#DED6CA",
                  }} />
                <p className="text-[9px] font-medium" style={{ color: isCurrent ? SAGE : "#B8AEA1" }}>{m.label}</p>
              </div>
              {i < MILESTONES.length - 1 && (
                <div className="flex-1 h-0.5 mb-3" style={{ background: isPast ? SAGE : "#DED6CA" }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewSection({
  context, tasks, guestStats, todoCount, onNavigate,
}: {
  context: PortalContext;
  tasks: PortalTask[];
  guestStats: GuestStats | null;
  todoCount: number;
  onNavigate: (s: PortalSection) => void;
}) {
  const du = context.event ? daysUntil(context.event.eventDate) : null;
  const required = tasks.filter(t => t.isRequired);
  const readinessScore = required.length > 0
    ? Math.round(required.filter(t => t.status === "complete").length / required.length * 100)
    : 0;
  const actionNeeded = tasks.filter(t => t.canComplete && t.status !== "complete");
  const coupleName = [context.client.firstName, context.client.partnerFirstName].filter(Boolean).join(" & ");
  const bracket = getSuggestionBracket(du);
  const suggestions = (SUGGESTIONS_BY_BRACKET[bracket] ?? []).slice(0, 4);

  const wins: string[] = [];
  if ((guestStats?.total ?? 0) > 0) wins.push(`👥 ${guestStats!.total} guest${guestStats!.total !== 1 ? "s" : ""} on your wedding list`);
  if ((guestStats?.attending ?? 0) > 0) wins.push(`💌 ${guestStats!.attending} guest${guestStats!.attending !== 1 ? "s have" : " has"} confirmed attendance`);
  if (readinessScore >= 25) wins.push(`🌿 ${readinessScore}% of your planning milestones are complete`);

  return (
    <div className="space-y-6">

      {/* ── HERO — The emotional anchor ── */}
      <div className="rounded-3xl overflow-hidden relative" style={{
        background: `linear-gradient(155deg, #3D4F3D 0%, ${SAGE} 40%, #6B8F6B 100%)`,
        minHeight: "min(55vh, 440px)",
      }}>
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }} />
        <div className="relative flex flex-col justify-between h-full p-7 sm:p-10" style={{ minHeight: "min(55vh, 440px)" }}>
          {/* Top: venue name */}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50 font-medium">{context.venue.name}</p>
          </div>
          {/* Middle: couple names in beautiful serif */}
          <div className="space-y-1">
            <p className="text-white/60 text-sm">Welcome back,</p>
            <p className="font-heading text-4xl sm:text-5xl md:text-6xl font-medium text-white leading-none tracking-tight">
              {coupleName}
            </p>
          </div>
          {/* Bottom: countdown */}
          {context.event && du !== null && du >= 0 ? (
            <div className="space-y-2">
              <div className="flex items-baseline gap-3">
                <p className="font-heading text-7xl sm:text-8xl font-semibold text-white leading-none">{du}</p>
                <div>
                  <p className="text-white/80 text-lg font-light">days until</p>
                  <p className="text-white/80 text-lg font-light">you say "I do"</p>
                </div>
              </div>
              <p className="text-white/55 text-sm">
                {new Date(context.event.eventDate + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                })}
              </p>
            </div>
          ) : (
            <p className="text-white/50 text-sm">Your planning journey has begun.</p>
          )}
        </div>
      </div>

      {/* ── Planning Journey ── */}
      {context.event && du !== null && (
        <PlanningJourney du={du} readiness={readinessScore} />
      )}

      {/* ── Mobile-only quick cards (hidden on desktop — sidebar handles it) ── */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        {[
          { id: "guests"  as PortalSection, emoji: "👥", n: guestStats?.total ?? 0,  sub: guestStats?.attending ? `${guestStats.attending} confirmed` : "Start your list", warn: false },
          { id: "todos"   as PortalSection, emoji: "✨", n: todoCount,                 sub: "personal to-dos",  warn: false },
          { id: "website" as PortalSection, emoji: "🌐", n: null,                      sub: "your wedding site", warn: false },
          { id: "tasks"   as PortalSection, emoji: "📋", n: actionNeeded.length,       sub: actionNeeded.length > 0 ? "need attention" : "all on track", warn: actionNeeded.length > 0 },
        ].map(card => (
          <button key={card.id} type="button" onClick={() => onNavigate(card.id)}
            className="rounded-2xl border bg-card p-4 text-left space-y-2 active:opacity-80 transition-all"
            style={card.warn ? { borderColor: `${ROSE}60`, background: `${ROSE}06` } : { borderColor: "#E8E3DC" }}>
            <p className="text-2xl">{card.emoji}</p>
            <div>
              {card.n !== null
                ? <p className="text-2xl font-bold text-heading">{card.n}</p>
                : <p className="text-sm font-semibold text-heading">Website</p>}
              <p className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</p>
            </div>
            <p className="text-[11px] font-semibold" style={{ color: card.warn ? ROSE : SAGE }}>
              {card.warn ? "Action needed →" : "View →"}
            </p>
          </button>
        ))}
      </div>

      {/* ── Action needed (both mobile and desktop) ── */}
      {actionNeeded.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${ROSE}35`, background: `${ROSE}06` }}>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold" style={{ color: ROSE }}>📋 Your venue has tasks waiting</p>
          </div>
          {actionNeeded.slice(0, 3).map(t => (
            <button key={t.id} type="button" onClick={() => onNavigate("tasks")}
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 border-t"
              style={{ borderColor: `${ROSE}20` }}>
              <p className="text-sm text-heading truncate">{t.title}</p>
              <span className="shrink-0 text-[10px] px-2.5 py-1 rounded-full font-semibold text-white" style={{ background: ROSE }}>
                Complete →
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── This Month — editorial style ── */}
      <div className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, #F7F5F0 0%, #F0EDE6 100%)", border: "1px solid #E8E2D8" }}>
        <div className="p-6 sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">✨ This Month</p>
          <p className="font-heading text-2xl text-heading mb-5 leading-snug">
            {bracket === "12+" ? "Laying a beautiful foundation" :
             bracket === "9-12" ? "Locking in your most important vendors" :
             bracket === "6-9"  ? "The details that make it unforgettable" :
             bracket === "3-6"  ? "Bringing it all together beautifully" :
             bracket === "1-3"  ? "The final, wonderful stretch" :
             "Last touches before the magic begins"}
          </p>
          <div className="space-y-3">
            {suggestions.map(s => (
              <button key={s.title} type="button" onClick={() => onNavigate("todos")}
                className="w-full text-left flex items-center gap-4 group">
                <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform">{s.emoji}</span>
                <div className="flex-1 border-b border-[#E8E2D8] pb-3">
                  <p className="text-sm font-medium text-heading">{s.title}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground group-hover:text-heading transition-colors">+ Add</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Wins ── */}
      {wins.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">🎉 Your Progress</p>
          {wins.map((w, i) => (
            <p key={i} className="text-sm text-heading">{w}</p>
          ))}
        </div>
      )}

      {/* ── From Luv — handwritten note feel ── */}
      <div className="rounded-3xl p-6 sm:p-8 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${ROSE}18 0%, ${ROSE}08 100%)`, border: `1px solid ${ROSE}30` }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: ROSE }}>💗 From Luv</p>
        <p className="font-heading text-xl sm:text-2xl text-heading leading-relaxed italic">
          "{getLuvMessage(du, guestStats?.total ?? 0, readinessScore)}"
        </p>
        <p className="mt-4 text-[11px] font-medium" style={{ color: ROSE, opacity: 0.6 }}>
          — Luv, your venue's planning companion
        </p>
      </div>

    </div>
  );
}

// ── Guest List ────────────────────────────────────────────────────────────────

const RSVP_COLORS: Record<string, string> = { pending: TAUPE, attending: SAGE, declined: "#C0392B", maybe: "#C7A66A" };
const RSVP_LABELS: Record<string, string> = { pending: "Pending", attending: "Coming", declined: "Declined", maybe: "Maybe" };

function parseCSV(text: string): { firstName: string; lastName?: string; email?: string; groupLabel?: string }[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/[^a-z]/g, ""));
  const fi = headers.findIndex(h => h.includes("first") || h === "name");
  const li = headers.findIndex(h => h.includes("last"));
  const ei = headers.findIndex(h => h.includes("email"));
  const gi = headers.findIndex(h => h.includes("group"));
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
    const firstName = fi >= 0 ? cols[fi] ?? "" : cols[0] ?? "";
    const [fn, ...rest] = firstName.split(" ");
    return {
      firstName: fn || firstName,
      lastName: li >= 0 ? cols[li] : rest.join(" ") || undefined,
      email: ei >= 0 ? cols[ei] || undefined : undefined,
      groupLabel: gi >= 0 ? cols[gi] || undefined : undefined,
    };
  }).filter(g => g.firstName);
}

function GuestListSection({ token }: { token: string }) {
  const [guests, setGuests] = React.useState<CoupleGuest[]>([]);
  const [stats, setStats] = React.useState<GuestStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [showAdd, setShowAdd] = React.useState(false);
  const [addName, setAddName] = React.useState("");
  const [addEmail, setAddEmail] = React.useState("");
  const [addGroup, setAddGroup] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const csvRef = React.useRef<HTMLInputElement>(null);

  function reload() {
    fetch(`/api/portal/guests?token=${token}`)
      .then(r => r.json())
      .then((d: { guests?: CoupleGuest[]; stats?: GuestStats }) => {
        setGuests(d.guests ?? []);
        setStats(d.stats ?? null);
      });
  }

  React.useEffect(() => {
    fetch(`/api/portal/guests?token=${token}`)
      .then(r => r.json())
      .then((d: { guests?: CoupleGuest[]; stats?: GuestStats }) => {
        setGuests(d.guests ?? []);
        setStats(d.stats ?? null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAdd() {
    if (!addName.trim()) return;
    setAdding(true);
    const parts = addName.trim().split(" ");
    const res = await fetch("/api/portal/guests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, firstName: parts[0], lastName: parts.slice(1).join(" ") || undefined, email: addEmail || undefined, groupLabel: addGroup || undefined }) });
    const data = await res.json() as { ok: boolean; guestId?: string };
    if (data.ok) { reload(); setAddName(""); setAddEmail(""); setAddGroup(""); setShowAdd(false); }
    else toast.error("Could not add guest.");
    setAdding(false);
  }

  async function handleRsvp(guestId: string, status: string) {
    await fetch("/api/portal/guests", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, guestId, rsvpStatus: status }) });
    setGuests(g => g.map(x => x.id === guestId ? { ...x, rsvpStatus: status as CoupleGuest["rsvpStatus"] } : x));
    setStats(s => {
      if (!s) return s;
      const prev = guests.find(x => x.id === guestId)?.rsvpStatus ?? "pending";
      return { ...s, [prev]: Math.max(0, (s[prev as keyof GuestStats] as number) - 1), [status]: ((s[status as keyof GuestStats] as number) || 0) + 1 };
    });
  }

  async function handleDelete(guestId: string) {
    await fetch("/api/portal/guests", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, guestId }) });
    setGuests(g => g.filter(x => x.id !== guestId));
    setStats(s => s ? { ...s, total: Math.max(0, s.total - 1) } : null);
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (!parsed.length) { toast.error("No guests found in CSV."); return; }
      const res = await fetch("/api/portal/guests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, guests: parsed }) });
      const data = await res.json() as { ok: boolean; imported?: number };
      if (data.ok) { toast.success(`${data.imported} guests imported.`); reload(); }
      else toast.error("Import failed. Check your CSV format.");
    } finally { setImporting(false); if (csvRef.current) csvRef.current.value = ""; }
  }

  return (
    <div className="space-y-4">
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[{ label: "Total", n: stats.total }, { label: "Coming", n: stats.attending }, { label: "Declined", n: stats.declined }, { label: "Pending", n: stats.pending }].map(({ label, n }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-2.5 text-center">
              <p className="text-lg font-bold text-heading">{n}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? <p className="text-sm text-muted-foreground text-center py-6">Loading guests…</p>
      : guests.length === 0 && !showAdd ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center space-y-3 px-4">
          <Users className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-heading">No guests yet</p>
          <p className="text-xs text-muted-foreground">Add guests one at a time or import a CSV file.</p>
          <p className="text-[10px] text-muted-foreground">CSV format: First Name, Last Name, Email, Group</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border/50">
          {guests.map(g => (
            <div key={g.id} className="px-4 py-3 flex items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-heading leading-tight">{[g.firstName, g.lastName].filter(Boolean).join(" ")}</p>
                <p className="text-[11px] text-muted-foreground">{g.email ?? g.groupLabel ?? ""}</p>
              </div>
              <select value={g.rsvpStatus} onChange={e => handleRsvp(g.id, e.target.value)}
                className="text-[10px] font-semibold rounded-full border px-1.5 py-0.5 focus:outline-none"
                style={{ background: `${RSVP_COLORS[g.rsvpStatus]}15`, color: RSVP_COLORS[g.rsvpStatus], borderColor: `${RSVP_COLORS[g.rsvpStatus]}40` }}>
                {Object.entries(RSVP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button type="button" onClick={() => handleDelete(g.id)} className="shrink-0 p-1 text-muted-foreground hover:text-destructive rounded">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="rounded-2xl border border-ring bg-card p-4 space-y-3">
          <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Full name *" autoFocus
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <input value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="Email (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <input value={addGroup} onChange={e => setAddGroup(e.target.value)} placeholder="Group — Family, College Friends…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="text-sm text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted">Cancel</button>
            <button type="button" onClick={handleAdd} disabled={!addName.trim() || adding}
              className="text-sm font-medium px-4 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: SAGE }}>
              {adding ? "Adding…" : "Add Guest"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-border hover:bg-muted/40 transition-colors">
            <Plus className="h-4 w-4" /> Add Guest
          </button>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground px-4 py-2 rounded-xl border border-border hover:bg-muted/40 transition-colors cursor-pointer">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "↑"} Import CSV
            <input ref={csvRef} type="file" accept=".csv" className="sr-only" onChange={handleCSV} disabled={importing} />
          </label>
        </div>
      )}
    </div>
  );
}

// ── Personal To-Do ────────────────────────────────────────────────────────────

const TODO_CATEGORIES: { value: TodoCategory; label: string }[] = [
  { value: "venue", label: "Venue" }, { value: "attire", label: "Attire" },
  { value: "florals", label: "Florals" }, { value: "music", label: "Music" },
  { value: "catering", label: "Catering" }, { value: "photography", label: "Photography" },
  { value: "travel", label: "Travel" }, { value: "invitations", label: "Invitations" },
  { value: "beauty", label: "Beauty" }, { value: "other", label: "Other" },
];

// Dynamic to-do suggestions by time bracket.
// "No ML required. Just thoughtful, curated guidance."
const SUGGESTIONS_BY_BRACKET: Record<string, { title: string; category: TodoCategory; emoji: string }[]> = {
  "12+": [
    { title: "Book photographer", category: "photography", emoji: "📷" },
    { title: "Book videographer", category: "photography", emoji: "🎬" },
    { title: "Choose ceremony venue", category: "venue", emoji: "🌿" },
    { title: "Set a wedding budget", category: "other", emoji: "💰" },
    { title: "Create your guest list", category: "other", emoji: "👥" },
    { title: "Start venue research", category: "venue", emoji: "🏡" },
    { title: "Schedule engagement photos", category: "photography", emoji: "💗" },
    { title: "Choose your wedding date", category: "other", emoji: "📅" },
  ],
  "9-12": [
    { title: "Book florist", category: "florals", emoji: "🌸" },
    { title: "Book caterer or confirm venue catering", category: "catering", emoji: "🍽️" },
    { title: "Book officiant", category: "other", emoji: "📜" },
    { title: "Start dress shopping", category: "attire", emoji: "👗" },
    { title: "Book transportation", category: "travel", emoji: "🚗" },
    { title: "Research honeymoon destinations", category: "travel", emoji: "✈️" },
    { title: "Choose your wedding party", category: "other", emoji: "💗" },
    { title: "Schedule suit fittings", category: "attire", emoji: "🤵" },
  ],
  "6-9": [
    { title: "Order wedding invitations", category: "invitations", emoji: "✉️" },
    { title: "Reserve hotel block for guests", category: "travel", emoji: "🏨" },
    { title: "Book hair & makeup", category: "beauty", emoji: "💄" },
    { title: "Plan rehearsal dinner", category: "other", emoji: "🍷" },
    { title: "Book honeymoon travel", category: "travel", emoji: "✈️" },
    { title: "Order wedding cake", category: "catering", emoji: "🎂" },
    { title: "Choose ceremony music", category: "music", emoji: "🎵" },
    { title: "Schedule dress fitting", category: "attire", emoji: "👗" },
  ],
  "3-6": [
    { title: "Address and mail invitations", category: "invitations", emoji: "📬" },
    { title: "Finalize guest list", category: "other", emoji: "✅" },
    { title: "Plan wedding day timeline", category: "other", emoji: "📋" },
    { title: "Confirm all vendor bookings", category: "other", emoji: "📞" },
    { title: "Schedule makeup trial", category: "beauty", emoji: "💄" },
    { title: "Arrange guest transportation", category: "travel", emoji: "🚌" },
    { title: "Create wedding website", category: "other", emoji: "🌐" },
    { title: "Order wedding favors", category: "other", emoji: "🎁" },
  ],
  "1-3": [
    { title: "Write personal vows", category: "other", emoji: "📝" },
    { title: "Schedule rehearsal dinner", category: "other", emoji: "🍽️" },
    { title: "Confirm vendor arrival times", category: "other", emoji: "⏰" },
    { title: "Finalize seating arrangements", category: "other", emoji: "🪑" },
    { title: "Send final guest count to caterer", category: "catering", emoji: "🍽️" },
    { title: "Prepare ceremony programs", category: "invitations", emoji: "📄" },
    { title: "Break in wedding shoes", category: "attire", emoji: "👠" },
    { title: "Pack an emergency kit", category: "other", emoji: "🧴" },
  ],
  "<1": [
    { title: "Write vows (final version)", category: "other", emoji: "💌" },
    { title: "Pack overnight bag", category: "other", emoji: "🧳" },
    { title: "Confirm wedding day timeline with all vendors", category: "other", emoji: "📋" },
    { title: "Prepare tips for vendors", category: "other", emoji: "💵" },
    { title: "Arrange day-of emergency contact list", category: "other", emoji: "📱" },
    { title: "Get a good night's sleep the night before", category: "other", emoji: "😴" },
  ],
};

function getSuggestionBracket(daysUntil: number | null): string {
  if (daysUntil === null || daysUntil > 365) return "12+";
  if (daysUntil > 270) return "9-12";
  if (daysUntil > 180) return "6-9";
  if (daysUntil > 90) return "3-6";
  if (daysUntil > 30) return "1-3";
  return "<1";
}

function getBracketLabel(bracket: string): string {
  const labels: Record<string, string> = {
    "12+": "12+ months out — laying the foundation",
    "9-12": "9–12 months out — the big decisions",
    "6-9": "6–9 months out — invitations and details",
    "3-6": "3–6 months out — finalizing everything",
    "1-3": "1–3 months out — the final stretch",
    "<1": "Less than a month to go — last touches",
  };
  return labels[bracket] ?? "Suggested for your planning stage";
}

function TodoSection({ token, onCountChange, eventDate }: { token: string; onCountChange?: (n: number) => void; eventDate?: string | null }) {
  const [todos, setTodos] = React.useState<CoupleTodo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAdd, setShowAdd] = React.useState(false);
  const [addTitle, setAddTitle] = React.useState("");
  const [addCategory, setAddCategory] = React.useState<string>("");
  const [addDue, setAddDue] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/portal/todos?token=${token}`)
      .then(r => r.json())
      .then((d: { todos?: CoupleTodo[] }) => {
        const t = d.todos ?? [];
        setTodos(t);
        onCountChange?.(t.filter(x => !x.completed).length);
      })
      .finally(() => setLoading(false));
  }, [token, onCountChange]);

  async function handleAdd() {
    if (!addTitle.trim()) return;
    setAdding(true);
    const res = await fetch("/api/portal/todos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, title: addTitle.trim(), category: addCategory || undefined, dueDate: addDue || undefined }) });
    const data = await res.json() as { ok: boolean; todoId?: string };
    if (data.ok) {
      const newTodo: CoupleTodo = { id: data.todoId!, title: addTitle.trim(), notes: null, dueDate: addDue || null, category: (addCategory as TodoCategory) || null, completed: false, completedAt: null };
      setTodos(t => [newTodo, ...t]);
      onCountChange?.(todos.filter(x => !x.completed).length + 1);
      setAddTitle(""); setAddCategory(""); setAddDue(""); setShowAdd(false);
    }
    setAdding(false);
  }

  async function handleToggle(todo: CoupleTodo) {
    const next = !todo.completed;
    setTodos(t => t.map(x => x.id === todo.id ? { ...x, completed: next, completedAt: next ? new Date().toISOString() : null } : x));
    onCountChange?.(todos.filter(x => !x.completed).length + (next ? -1 : 1));
    await fetch("/api/portal/todos", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, todoId: todo.id, completed: next }) });
  }

  async function handleDelete(todoId: string) {
    setTodos(t => t.filter(x => x.id !== todoId));
    await fetch("/api/portal/todos", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, todoId }) });
  }

  const open = todos.filter(t => !t.completed);
  const done = todos.filter(t => t.completed);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Your personal planning checklist — separate from tasks assigned by the venue.</p>

      {loading ? <p className="text-sm text-muted-foreground text-center py-6">Loading…</p> : (
        <>
          {todos.length === 0 && !showAdd ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center space-y-2">
              <CheckSquare className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-heading">Your planning list is empty</p>
              <p className="text-xs text-muted-foreground">Add "Book florist", "Choose dress", or anything you need to track.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {open.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/30 group">
                  <button type="button" onClick={() => handleToggle(t)}
                    className="shrink-0 h-5 w-5 rounded border border-border flex items-center justify-center hover:border-primary transition-colors">
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-heading">{t.title}</p>
                    {(t.dueDate || t.category) && (
                      <p className="text-[11px] text-muted-foreground">
                        {t.category && <span className="capitalize">{t.category}</span>}
                        {t.category && t.dueDate && <span> · </span>}
                        {t.dueDate && <span>Due {formatDate(t.dueDate)}</span>}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {done.length > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-3 py-1">Completed ({done.length})</p>
                  {done.map(t => (
                    <div key={t.id} className="flex items-center gap-3 py-2 px-3 rounded-xl opacity-50">
                      <button type="button" onClick={() => handleToggle(t)} className="shrink-0 h-5 w-5 rounded border flex items-center justify-center" style={{ background: SAGE, borderColor: SAGE }}>
                        <Check className="h-3 w-3 text-white" />
                      </button>
                      <p className="text-sm text-muted-foreground line-through">{t.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showAdd ? (
            <div className="rounded-2xl border border-ring bg-card p-4 space-y-3">
              <input value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="What needs to get done? *" autoFocus
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              <div className="flex gap-2">
                <select value={addCategory} onChange={e => setAddCategory(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Category…</option>
                  {TODO_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input type="date" value={addDue} onChange={e => setAddDue(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAdd(false)} className="text-sm text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted">Cancel</button>
                <button type="button" onClick={handleAdd} disabled={!addTitle.trim() || adding}
                  className="text-sm font-medium px-4 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: SAGE }}>
                  {adding ? "Adding…" : "Add To-Do"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-border hover:bg-muted/40 transition-colors">
              <Plus className="h-4 w-4" /> Add To-Do
            </button>
          )}

          {/* Dynamic to-do suggestions — time-bracket aware */}
          {todos.length === 0 && !showAdd && (
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Suggested for your stage</p>
                {eventDate && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    💗 {getBracketLabel(getSuggestionBracket(daysUntil(eventDate)))}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(SUGGESTIONS_BY_BRACKET[getSuggestionBracket(eventDate ? daysUntil(eventDate) : null)] ?? SUGGESTIONS_BY_BRACKET["6-9"])
                  .filter(s => !todos.some(t => t.title.toLowerCase().includes(s.title.toLowerCase().slice(0, 12))))
                  .slice(0, 8)
                  .map(s => (
                  <button key={s.title} type="button"
                    onClick={async () => {
                      const res = await fetch("/api/portal/todos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, title: s.title, category: s.category }) });
                      const data = await res.json() as { ok: boolean; todoId?: string };
                      if (data.ok) {
                        const newTodo: CoupleTodo = { id: data.todoId!, title: s.title, notes: null, dueDate: null, category: s.category as TodoCategory, completed: false, completedAt: null };
                        setTodos(t => [...t, newTodo]);
                        onCountChange?.(1);
                      }
                    }}
                    className="text-left text-xs px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors text-heading flex items-center gap-1.5">
                    <span>{s.emoji}</span><span>+ {s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Our People ────────────────────────────────────────────────────────────────

// ── Website Section ───────────────────────────────────────────────────────────

function WebsiteSection({ token, context }: { token: string; context: PortalContext }) {
  const [site, setSite] = React.useState<import("@/lib/wedding-website/types").CoupleWebsite | null>(null);
  const [loading, setLoading] = React.useState(true);
  // Hooks must all be before any early returns (Rules of Hooks)
  const [guestData, setGuestData] = React.useState<{ guests: { id: string; firstName: string; lastName: string | null; email: string | null; rsvpStatus: string; rsvpSentAt?: string | null }[] } | null>(null);
  const defaultSlug = [context.client.firstName, context.client.partnerFirstName]
    .filter(Boolean).join("-and-").toLowerCase().replace(/[^a-z0-9-]/g, "") + "-wedding";

  React.useEffect(() => {
    fetch(`/api/portal/website?token=${token}`)
      .then(r => r.json())
      .then((d: import("@/lib/wedding-website/types").CoupleWebsite) => {
        if (!d.exists || !d.slug) {
          fetch("/api/portal/website", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, slug: defaultSlug }) })
            .then(r => r.json())
            .then(() => fetch(`/api/portal/website?token=${token}`).then(r => r.json()).then(setSite));
        } else {
          setSite(d);
        }
      })
      .finally(() => setLoading(false));
  }, [token, defaultSlug]);

  React.useEffect(() => {
    fetch(`/api/portal/guests?token=${token}`)
      .then(r => r.json())
      .then(setGuestData);
  }, [token]);

  if (loading || !site) {
    return <div className="py-12 text-center"><p className="text-sm text-muted-foreground">Loading your website…</p></div>;
  }

  const { WebsiteEditor } = require("@/components/portal/website-editor");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <WebsiteEditor token={token} initialSite={site} origin={origin} initialGuests={guestData?.guests} />
  );
}

function OurPeopleSection({ context }: { context: PortalContext }) {
  const coupleName = [context.client.firstName, context.client.partnerFirstName].filter(Boolean).join(" & ");
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Everyone who has access to your planning workspace and their permissions.
      </p>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border/50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-heading">{coupleName}</p>
            <p className="text-xs text-muted-foreground">Couple · Primary</p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: `${SAGE}15`, color: SAGE }}>Full access</span>
        </div>
        {context.contact && (
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-heading">{[context.contact.firstName, context.contact.lastName].filter(Boolean).join(" ")}</p>
              <p className="text-xs text-muted-foreground">{context.contact.roleLabel ?? "Additional contact"}</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: `${SAGE}15`, color: SAGE }}>
              {context.contact.portalRole?.replace("_", " ") ?? "Access"}
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        To add family members or your wedding planner, contact your venue coordinator.
      </p>
    </div>
  );
}

// ── Venue tasks ───────────────────────────────────────────────────────────────

function VenueTasksSection({ token, initialTasks }: { token: string; initialTasks: PortalTask[] }) {
  const [tasks, setTasks] = React.useState(initialTasks);
  const [completing, setCompleting] = React.useState<string | null>(null);

  async function handleComplete(taskId: string) {
    setCompleting(taskId);
    const res = await fetch("/api/portal/complete-task", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, taskId }) });
    const data = await res.json() as { ok: boolean };
    setCompleting(null);
    if (data.ok) setTasks(p => p.map(t => t.id === taskId ? { ...t, status: "complete" as const, canComplete: false } : t));
    else toast.error("Could not complete task.");
  }

  const actionNeeded = tasks.filter(t => t.canComplete && t.status !== "complete");
  const tracking = tasks.filter(t => !t.canComplete && t.status !== "complete");
  const done = tasks.filter(t => t.status === "complete");

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No tasks from your venue yet.</p>;
  }

  const Group = ({ label, items }: { label: string; items: PortalTask[] }) => items.length === 0 ? null : (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1">{label}</p>
      {items.map(t => (
        <div key={t.id} className={`flex items-center gap-3 py-3 px-3 rounded-xl ${t.status === "complete" ? "opacity-50" : "bg-card border border-border/60"}`}>
          {t.status === "complete" ? <Check className="h-4 w-4 shrink-0" style={{ color: SAGE }} /> : t.status === "blocked" ? <Lock className="h-4 w-4 shrink-0" style={{ color: TAUPE }} /> : <Clock className="h-4 w-4 shrink-0" style={{ color: TAUPE }} />}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${t.status === "complete" ? "text-muted-foreground line-through" : "text-heading"}`}>{t.title}</p>
            <p className="text-[11px] text-muted-foreground">Due {formatDate(t.dueDate)}</p>
          </div>
          {t.canComplete && (
            <button type="button" onClick={() => handleComplete(t.id)} disabled={completing === t.id}
              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-xl text-white"
              style={{ background: SAGE, opacity: completing === t.id ? 0.7 : 1 }}>
              {completing === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Done"}
            </button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Tasks assigned by {""}<span className="font-medium">{""}</span> that need your attention or are in progress.</p>
      <Group label="Your action needed" items={actionNeeded} />
      <Group label="In progress" items={tracking} />
      <Group label="Completed" items={done} />
    </div>
  );
}

// ── Coming soon ───────────────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-16 text-center px-6 space-y-2">
      <p className="text-2xl">💗</p>
      <p className="text-sm font-medium text-heading capitalize">{label} coming soon</p>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto">Your coordinator will share access when this section is ready.</p>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: PortalSection; icon: string; label: string; available: boolean; group: "yours" | "venue" }[] = [
  { id: "overview",  icon: "🏠", label: "Home",       available: true,  group: "yours" },
  { id: "guests",    icon: "👥", label: "Guests",     available: true,  group: "yours" },
  { id: "todos",     icon: "✨", label: "Plans",      available: true,  group: "yours" },
  { id: "website",   icon: "🌐", label: "Website",    available: true,  group: "yours" },
  { id: "people",    icon: "💗", label: "People",     available: true,  group: "yours" },
  { id: "tasks",     icon: "📋", label: "Tasks",      available: true,  group: "venue" },
  { id: "payments",  icon: "💳", label: "Payments",   available: false, group: "venue" },
  { id: "messages",  icon: "💬", label: "Messages",   available: false, group: "venue" },
];

export function PortalShell({ token, context, initialTasks }: { token: string; context: PortalContext; initialTasks: PortalTask[] }) {
  const [activeSection, setActiveSection] = React.useState<PortalSection>("overview");
  const [guestStats, setGuestStats] = React.useState<GuestStats | null>(null);
  const [todoCount, setTodoCount] = React.useState(0);

  React.useEffect(() => {
    fetch(`/api/portal/guests?token=${token}`)
      .then(r => r.json())
      .then((d: { stats?: GuestStats }) => setGuestStats(d.stats ?? null))
      .catch(() => {});
  }, [token]);

  const firstName = context.client.firstName;
  const partnerName = context.client.partnerFirstName;
  const coupleName = [firstName, partnerName].filter(Boolean).join(" & ");
  const actionCount = initialTasks.filter(t => t.canComplete && t.status !== "complete").length;
  const isOverview = activeSection === "overview";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: LINEN }}>

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#DED6CA]">
        {/* Venue + couple identity */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <p className="text-sm font-semibold text-heading leading-tight font-heading">{coupleName}</p>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <p className="text-xs text-muted-foreground">{context.venue.name}</p>
          </div>
          {context.event && (
            <p className="text-xs text-muted-foreground hidden sm:block">
              {new Date(context.event.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="max-w-4xl mx-auto px-2 sm:px-4 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-0 py-0.5">
            {/* Yours */}
            <div className="flex items-center">
              {NAV_ITEMS.filter(i => i.group === "yours").map(item => {
                const isActive = activeSection === item.id;
                return (
                  <button key={item.id} type="button"
                    onClick={() => item.available && setActiveSection(item.id)}
                    className="relative flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all rounded-lg mx-0.5"
                    style={{
                      color: isActive ? SAGE : "#888",
                      background: isActive ? `${SAGE}12` : "transparent",
                      fontWeight: isActive ? 600 : 400,
                    }}>
                    <span className="text-sm">{item.icon}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                    <span className="sm:hidden text-[11px]">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="h-5 w-px mx-2 shrink-0" style={{ background: "#E0D8D0" }} />

            {/* Venue */}
            <div className="flex items-center">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-1.5 shrink-0 hidden sm:inline">
                Venue
              </span>
              {NAV_ITEMS.filter(i => i.group === "venue").map(item => {
                const isActive = activeSection === item.id;
                const badge = item.id === "tasks" && actionCount > 0 ? actionCount : 0;
                return (
                  <button key={item.id} type="button"
                    onClick={() => item.available && setActiveSection(item.id)}
                    className="relative flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all rounded-lg mx-0.5"
                    style={{
                      color: isActive ? SAGE : "#aaa",
                      background: isActive ? `${SAGE}12` : "transparent",
                      opacity: !item.available ? 0.4 : 1,
                      fontWeight: isActive ? 600 : 400,
                    }}>
                    <span className="text-sm">{item.icon}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                    <span className="sm:hidden text-[11px]">{item.label}</span>
                    {badge > 0 && (
                      <span className="h-4 w-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
                        style={{ background: ROSE }}>{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 w-full">
        {/* Overview gets a full-canvas layout */}
        {isOverview ? (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            {/* Desktop: 2-column hero layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
              {/* Left: Hero + planning journey */}
              <OverviewSection context={context} tasks={initialTasks} guestStats={guestStats} todoCount={todoCount} onNavigate={setActiveSection} />
              {/* Right: Quick actions sidebar (desktop only) */}
              <div className="hidden lg:flex flex-col gap-4">
                <QuickActionsSidebar context={context} tasks={initialTasks} guestStats={guestStats} todoCount={todoCount} onNavigate={setActiveSection} />
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
            {activeSection === "guests"    && <GuestListSection token={token} />}
            {activeSection === "todos"     && <TodoSection token={token} onCountChange={setTodoCount} eventDate={context.event?.eventDate} />}
            {activeSection === "website"   && <WebsiteSection token={token} context={context} />}
            {activeSection === "people"    && <OurPeopleSection context={context} />}
            {activeSection === "tasks"     && <VenueTasksSection token={token} initialTasks={initialTasks} />}
            {activeSection === "payments"  && <ComingSoon label="Payments" />}
            {activeSection === "documents" && <ComingSoon label="Documents" />}
            {activeSection === "messages"  && <ComingSoon label="Messages" />}
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-[10px] border-t border-border/30" style={{ color: TAUPE }}>
        Powered by Wevenu · {context.venue.name}
      </footer>
    </div>
  );
}

// ── Desktop Quick Actions Sidebar ─────────────────────────────────────────────

function QuickActionsSidebar({
  context, tasks, guestStats, todoCount, onNavigate,
}: {
  context: PortalContext; tasks: PortalTask[]; guestStats: GuestStats | null; todoCount: number; onNavigate: (s: PortalSection) => void;
}) {
  const actionNeeded = tasks.filter(t => t.canComplete && t.status !== "complete");
  const du = context.event ? daysUntil(context.event.eventDate) : null;
  const bracket = getSuggestionBracket(du);
  const suggestions = (SUGGESTIONS_BY_BRACKET[bracket] ?? []).slice(0, 3);

  return (
    <>
      {/* Section cards */}
      {[
        { id: "guests" as PortalSection, emoji: "👥", label: "Guest List", value: guestStats?.total ?? 0, sub: guestStats?.attending ? `${guestStats.attending} confirmed` : "Start your list", color: SAGE },
        { id: "todos"  as PortalSection, emoji: "✨", label: "Planning",   value: todoCount,              sub: "personal to-dos",                                                                   color: SAGE },
        { id: "tasks"  as PortalSection, emoji: "📋", label: "Venue Tasks", value: actionNeeded.length,   sub: actionNeeded.length > 0 ? "need attention" : "all on track",                        color: actionNeeded.length > 0 ? ROSE : SAGE },
      ].map(card => (
        <button key={card.id} type="button" onClick={() => onNavigate(card.id)}
          className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:shadow-sm transition-all group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xl">{card.emoji}</span>
            <span className="text-[11px] font-medium group-hover:underline" style={{ color: card.color }}>View →</span>
          </div>
          <p className="text-2xl font-bold text-heading">{card.value}</p>
          <p className="text-xs font-medium text-heading mt-0.5">{card.label}</p>
          <p className="text-[11px] text-muted-foreground">{card.sub}</p>
        </button>
      ))}

      {/* This Month — sidebar version */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">✨ This Month</p>
        <div className="space-y-1.5">
          {suggestions.map(s => (
            <button key={s.title} type="button" onClick={() => onNavigate("todos")}
              className="w-full text-left flex items-center gap-2 py-1.5 text-xs hover:text-heading transition-colors text-muted-foreground">
              <span>{s.emoji}</span>
              <span>{s.title}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
