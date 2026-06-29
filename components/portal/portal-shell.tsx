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

  return (
    <div className="space-y-4">
      {/* Hero — warm, celebratory, personal */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${SAGE} 0%, #4F5F4F 100%)` }}>
        <div className="px-5 py-5 text-white">
          <p className="text-xs opacity-60 mb-1">{context.venue.name}</p>
          <p className="text-xl font-semibold">Welcome back, {context.client.firstName}{context.client.partnerFirstName ? ` & ${context.client.partnerFirstName}` : ""}!</p>
          {context.event && du !== null && du > 0 && (
            <p className="text-sm opacity-80 mt-1.5">✨ {du} days until your wedding day.</p>
          )}
          {readinessScore > 0 && (
            <p className="text-sm opacity-70 mt-0.5">
              🌿 You're {readinessScore}% through your planning journey.
            </p>
          )}
        </div>
        {context.event && (
          <div className="bg-white/10 px-5 py-2.5">
            <p className="text-white text-sm font-medium">
              {new Date(context.event.eventDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        )}
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => onNavigate("guests")}
          className="rounded-2xl border border-border bg-card p-3 text-center space-y-1 active:bg-muted/40 transition-colors">
          <p className="text-xl font-bold text-heading">{guestStats?.total ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">Guests</p>
          {guestStats && guestStats.attending > 0 && (
            <p className="text-[10px]" style={{ color: SAGE }}>{guestStats.attending} confirmed</p>
          )}
        </button>
        <button type="button" onClick={() => onNavigate("todos")}
          className="rounded-2xl border border-border bg-card p-3 text-center space-y-1 active:bg-muted/40 transition-colors">
          <p className="text-xl font-bold text-heading">{todoCount}</p>
          <p className="text-[11px] text-muted-foreground">To-do items</p>
        </button>
        <button type="button" onClick={() => onNavigate("tasks")}
          className="rounded-2xl border border-border bg-card p-3 text-center space-y-1 active:bg-muted/40 transition-colors">
          <ReadinessRing score={readinessScore} size={44} />
          <p className="text-[11px] text-muted-foreground">Event ready</p>
        </button>
      </div>

      {/* Action needed */}
      {actionNeeded.length > 0 && (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border/50">
          <div className="px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Needs your attention
            </p>
          </div>
          {actionNeeded.slice(0, 3).map(t => (
            <button key={t.id} type="button" onClick={() => onNavigate("tasks")}
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-heading">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  Due {new Date(t.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              <span className="shrink-0 text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: `${ROSE}20`, color: ROSE }}>
                Action needed
              </span>
            </button>
          ))}
        </div>
      )}
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
  const defaultSlug = [context.client.firstName, context.client.partnerFirstName]
    .filter(Boolean).join("-and-").toLowerCase().replace(/[^a-z0-9-]/g, "") + "-wedding";

  React.useEffect(() => {
    fetch(`/api/portal/website?token=${token}`)
      .then(r => r.json())
      .then((d: import("@/lib/wedding-website/types").CoupleWebsite) => {
        // Initialize with default slug if new
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

  if (loading || !site) {
    return <div className="py-12 text-center"><p className="text-sm text-muted-foreground">Loading your website…</p></div>;
  }

  const { WebsiteEditor } = require("@/components/portal/website-editor");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <WebsiteEditor token={token} initialSite={site} origin={origin} />
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

type NavGroup = { label: string; items: { id: PortalSection; icon: string; label: string; available: boolean }[] };

export function PortalShell({ token, context, initialTasks }: { token: string; context: PortalContext; initialTasks: PortalTask[] }) {
  const [activeSection, setActiveSection] = React.useState<PortalSection>("overview");
  const [guestStats, setGuestStats] = React.useState<GuestStats | null>(null);
  const [todoCount, setTodoCount] = React.useState(0);

  // Fetch guest stats for overview
  React.useEffect(() => {
    fetch(`/api/portal/guests?token=${token}`)
      .then(r => r.json())
      .then((d: { stats?: GuestStats }) => setGuestStats(d.stats ?? null))
      .catch(() => {});
  }, [token]);

  const coupleName = [context.client.firstName, context.client.partnerFirstName].filter(Boolean).join(" & ");
  const actionCount = initialTasks.filter(t => t.canComplete && t.status !== "complete").length;

  const NAV_GROUPS: NavGroup[] = [
    {
      label: "Your Planning",
      items: [
        { id: "overview",  icon: "🏠", label: "Overview",   available: true },
        { id: "guests",    icon: "👥", label: "Guests",     available: true },
        { id: "todos",     icon: "✅", label: "To-Do",      available: true },
        { id: "website",   icon: "🌐", label: "Website",    available: true },
        { id: "people",    icon: "💗", label: "Our People", available: true },
      ],
    },
    {
      label: `With ${context.venue.name}`,
      items: [
        { id: "tasks",     icon: "📋", label: "Tasks",     available: true },
        { id: "payments",  icon: "💳", label: "Payments",  available: false },
        { id: "documents", icon: "📄", label: "Documents", available: false },
        { id: "messages",  icon: "💬", label: "Messages",  available: false },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: LINEN }}>
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-[#DED6CA]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px]" style={{ color: SAGE }}>{context.venue.name}</p>
            <p className="text-sm font-semibold text-heading leading-tight">{coupleName}</p>
          </div>
          {context.event && (
            <p className="text-xs text-muted-foreground">
              {new Date(context.event.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        {/* Navigation — grouped with section labels */}
        <div className="max-w-lg mx-auto overflow-x-auto scrollbar-hide">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={`flex items-center ${gi > 0 ? "border-t border-border/30" : ""}`}>
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 min-w-[72px]">
                {gi === 0 ? "Yours" : "Venue"}
              </span>
              {group.items.map(item => {
                const isActive = activeSection === item.id;
                const badge = item.id === "tasks" && actionCount > 0 ? actionCount : 0;
                return (
                  <button key={item.id} type="button"
                    onClick={() => item.available && setActiveSection(item.id)}
                    className="relative flex-shrink-0 flex flex-col items-center gap-0.5 px-3 pt-1.5 pb-1.5 text-[11px] font-medium transition-colors"
                    style={{ color: isActive ? SAGE : TAUPE, borderBottom: isActive ? `2px solid ${SAGE}` : "2px solid transparent", opacity: !item.available ? 0.4 : 1 }}>
                    <span>{item.icon}</span>
                    {item.label}
                    {badge > 0 && (
                      <span className="absolute top-0.5 right-1 h-3.5 w-3.5 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
                        style={{ background: ROSE }}>{badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5">
        {activeSection === "overview"  && <OverviewSection context={context} tasks={initialTasks} guestStats={guestStats} todoCount={todoCount} onNavigate={setActiveSection} />}
        {activeSection === "guests"    && <GuestListSection token={token} />}
        {activeSection === "todos"     && <TodoSection token={token} onCountChange={setTodoCount} eventDate={context.event?.eventDate} />}
        {activeSection === "website"   && <WebsiteSection token={token} context={context} />}
        {activeSection === "people"    && <OurPeopleSection context={context} />}
        {activeSection === "tasks"     && <VenueTasksSection token={token} initialTasks={initialTasks} />}
        {activeSection === "payments"  && <ComingSoon label="Payments" />}
        {activeSection === "documents" && <ComingSoon label="Documents" />}
        {activeSection === "messages"  && <ComingSoon label="Messages" />}
      </main>

      <footer className="text-center py-3 text-[10px]" style={{ color: TAUPE }}>
        Powered by Wevenu · {context.venue.name}
      </footer>
    </div>
  );
}
