"use client";

import * as React from "react";
import {
  Users, Plus, Trash2, Pencil, Loader2, X, Check, ChevronDown, ChevronUp, Copy, Mail,
} from "lucide-react";
import { toast } from "sonner";
import type { CoupleGuest, CoupleHousehold, GuestStats, RsvpInsights, RsvpQuestion } from "@/lib/portal/types";
import { getGuestObservations } from "@/lib/luv/portal-observations";

// ── Helpers ───────────────────────────────────────────────────────────────────

const RSVP_LABELS: Record<string, string> = {
  pending: "Pending", attending: "Attending", declined: "Declined", maybe: "Maybe",
};

const RSVP_COLORS: Record<string, string> = {
  pending: "#9CA3AF", attending: "#5D6F5D", declined: "#DC6A6A", maybe: "#D97706",
};

const NO_HOUSEHOLD = "";
const NEW_HOUSEHOLD = "__new__";

const QUESTION_TEMPLATES = [
  { key: "meal_choice",   text: "What meal would you prefer?",           type: "select"  as const, note: "Add meal options below"      },
  { key: "song_request",  text: "What song should we add to the playlist?", type: "text" as const,  note: ""                           },
  { key: "shuttle",       text: "Will you need shuttle transportation?",  type: "boolean" as const, note: ""                           },
  { key: "hotel_nights",  text: "Which nights are you staying at the hotel?", type: "text" as const, note: ""                          },
  { key: "sunday_brunch", text: "Will you be joining us for Sunday brunch?",  type: "boolean" as const, note: ""                       },
  { key: "message",       text: "Leave a message for the couple",         type: "textarea" as const, note: ""                          },
];

function parseCSV(text: string): { firstName: string; lastName?: string; email?: string; household?: string }[] {
  return text.split("\n")
    .map(l => l.trim()).filter(Boolean)
    .slice(1)
    .map(l => {
      const [firstName, lastName, email, household] = l.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
      if (!firstName) return null;
      return { firstName, lastName: lastName || undefined, email: email || undefined, household: household || undefined };
    }).filter(Boolean) as { firstName: string; lastName?: string; email?: string; household?: string }[];
}

// ── Progress ring (reused from budget-section) ────────────────────────────────

function ProgressRing({ pct, size = 80, stroke = 8, color = "#5D6F5D" }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EAE6E1" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

// ── RSVP Insights panel ───────────────────────────────────────────────────────

function InsightsPanel({ insights, onSendReminders }: {
  insights: RsvpInsights;
  onSendReminders: () => void;
}) {
  const responseRate = insights.total > 0
    ? Math.round((insights.responded / insights.total) * 100)
    : 0;

  const newMilestones = insights.milestones ?? [];

  return (
    <div className="space-y-4">
      {/* Milestone celebrations */}
      {newMilestones.includes("first_rsvp") && (
        <div className="rounded-2xl bg-[#5D6F5D]/8 border border-[#5D6F5D]/20 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-sm font-semibold text-[#3D5040]">Your first RSVP is in!</p>
            <p className="text-xs text-[#5D6F5D]">The RSVPs are starting to roll in.</p>
          </div>
        </div>
      )}
      {newMilestones.includes("attending_50") && (
        <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🥂</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">50 guests are coming!</p>
            <p className="text-xs text-amber-600">The party is growing.</p>
          </div>
        </div>
      )}
      {newMilestones.includes("all_responded") && (
        <div className="rounded-2xl bg-[#5D6F5D]/8 border border-[#5D6F5D]/20 px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">💌</span>
          <div>
            <p className="text-sm font-semibold text-[#3D5040]">Everyone has RSVPed!</p>
            <p className="text-xs text-[#5D6F5D]">{insights.attending} guests are celebrating with you.</p>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <ProgressRing pct={responseRate} size={80} stroke={8} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold leading-none">{responseRate}%</span>
              <span className="text-[9px] text-muted-foreground mt-0.5">responded</span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              { label: "Total",     n: insights.total,     color: "inherit" },
              { label: "Coming",    n: insights.attending, color: "#5D6F5D" },
              { label: "Declined",  n: insights.declined,  color: "#DC6A6A" },
              { label: "Pending",   n: insights.pending,   color: "#9CA3AF" },
            ].map(({ label, n, color }) => (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold" style={{ color }}>{n}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Meal counts */}
        {Object.keys(insights.mealCounts ?? {}).length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Meal Counts</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(insights.mealCounts).map(([meal, count]) => (
                <span key={meal} className="text-xs px-3 py-1 rounded-full bg-muted font-medium">
                  {meal}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Send reminders CTA */}
        {insights.pending > 0 && insights.sentCount > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {insights.pending} guests haven't responded yet
            </p>
            <button onClick={onSendReminders}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
              Send Reminders
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Question Manager ──────────────────────────────────────────────────────────

function QuestionManager({ token, questions, onUpdate }: {
  token: string;
  questions: RsvpQuestion[];
  onUpdate: () => Promise<void>;
}) {
  const [open, setOpen]       = React.useState(false);
  const [adding, setAdding]   = React.useState<typeof QUESTION_TEMPLATES[number] | null>(null);
  const [options, setOptions] = React.useState<string[]>([""]);
  const [saving, setSaving]   = React.useState(false);

  async function addQuestion(template: typeof QUESTION_TEMPLATES[number]) {
    if (template.type === "select") {
      setAdding(template);
      setOptions([""]);
      return;
    }
    setSaving(true);
    const res = await fetch("/api/portal/rsvp-questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        questionKey:  template.key,
        questionText: template.text,
        inputType:    template.type,
        displayOrder: questions.length,
      }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Could not add question."); return; }
    const result = await res.json() as { questionId?: string; error?: string };
    if (result.error) { toast.error("Could not add question."); return; }
    await onUpdate();
  }

  async function saveSelectQuestion() {
    if (!adding) return;
    const validOptions = options.filter(o => o.trim());
    if (!validOptions.length) { toast.error("Add at least one option."); return; }
    setSaving(true);
    const res = await fetch("/api/portal/rsvp-questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        questionKey:  adding.key,
        questionText: adding.text,
        inputType:    "select",
        options:      validOptions,
        appliesToPlusOne: true,
        displayOrder: questions.length,
      }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Could not save question."); return; }
    setAdding(null);
    await onUpdate();
  }

  async function deleteQuestion(id: string) {
    await fetch("/api/portal/rsvp-questions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, questionId: id }),
    });
    onUpdate();
  }

  const existingKeys = new Set(questions.map(q => q.questionKey));
  const availableTemplates = QUESTION_TEMPLATES.filter(t => !existingKeys.has(t.key));

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
        <span className="text-sm font-medium text-heading">RSVP Questions</span>
        <div className="flex items-center gap-2">
          {questions.length > 0 && (
            <span className="text-xs text-muted-foreground">{questions.length} active</span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {questions.length === 0 && !adding && (
            <p className="text-xs text-muted-foreground">No custom questions yet. Add one below to collect meal choices, song requests, and more.</p>
          )}

          {/* Active questions */}
          {questions.map(q => (
            <div key={q.id} className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm">{q.questionText}</p>
                {q.options && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Options: {q.options.join(", ")}
                  </p>
                )}
              </div>
              <button onClick={() => deleteQuestion(q.id)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Meal option builder */}
          {adding?.type === "select" && (
            <div className="rounded-xl border border-[#5D6F5D]/30 bg-[#5D6F5D]/5 p-3 space-y-2">
              <p className="text-sm font-medium">{adding.text}</p>
              <p className="text-[11px] text-muted-foreground">Add the meal options guests will choose from:</p>
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input value={opt} onChange={e => setOptions(p => p.map((o, idx) => idx === i ? e.target.value : o))}
                    placeholder={`Option ${i + 1} (e.g., Beef Tenderloin)`}
                    className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-[#5D6F5D]/40" />
                  {options.length > 1 && (
                    <button onClick={() => setOptions(p => p.filter((_, idx) => idx !== i))}
                      className="p-1.5 text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setOptions(p => [...p, ""])}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add option
              </button>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setAdding(null)}
                  className="flex-1 text-xs py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted">
                  Cancel
                </button>
                <button onClick={saveSelectQuestion} disabled={saving}
                  className="flex-1 text-xs py-1.5 rounded-lg text-white font-medium disabled:opacity-40"
                  style={{ backgroundColor: "#5D6F5D" }}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Template pills */}
          {availableTemplates.length > 0 && !adding && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Add a question</p>
              <div className="flex flex-wrap gap-1.5">
                {availableTemplates.map(t => (
                  <button key={t.key} onClick={() => addQuestion(t)} disabled={saving}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40">
                    + {t.text.replace("?", "").slice(0, 30)}{t.text.length > 33 ? "…" : "?"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Guest editor fields (shared shape between Add and Edit) ──────────────────

type GuestFields = {
  name: string; email: string; phone: string;
  householdChoice: string; newHouseholdName: string;
  isChild: boolean; plusOne: boolean; plusOneName: string; dietary: string;
};

function emptyGuestFields(): GuestFields {
  return { name: "", email: "", phone: "", householdChoice: NO_HOUSEHOLD, newHouseholdName: "", isChild: false, plusOne: false, plusOneName: "", dietary: "" };
}

function GuestFieldsForm({ fields, setFields, households, autoFocus, onEnter }: {
  fields: GuestFields;
  setFields: React.Dispatch<React.SetStateAction<GuestFields>>;
  households: CoupleHousehold[];
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const set = <K extends keyof GuestFields>(key: K, v: GuestFields[K]) => setFields(p => ({ ...p, [key]: v }));

  return (
    <div className="space-y-2.5">
      <input value={fields.name} onChange={e => set("name", e.target.value)} placeholder="Full name *" autoFocus={autoFocus}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      <div className="grid grid-cols-2 gap-2">
        <input value={fields.email} onChange={e => set("email", e.target.value)} placeholder="Email (optional)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <input value={fields.phone} onChange={e => set("phone", e.target.value)} placeholder="Phone (optional)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      <div className="space-y-1.5">
        <select value={fields.householdChoice} onChange={e => set("householdChoice", e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value={NO_HOUSEHOLD}>No household</option>
          {households.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          <option value={NEW_HOUSEHOLD}>+ New household…</option>
        </select>
        {fields.householdChoice === NEW_HOUSEHOLD && (
          <input value={fields.newHouseholdName} onChange={e => set("newHouseholdName", e.target.value)}
            placeholder="Household name — The Smiths, College Friends…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        )}
      </div>

      <input value={fields.dietary} onChange={e => set("dietary", e.target.value)} placeholder="Dietary restrictions (optional)"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />

      <div className="flex flex-wrap gap-x-5 gap-y-2 pt-0.5">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={fields.isChild} onChange={e => set("isChild", e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-[#5D6F5D]" />
          <span className="text-muted-foreground">Child guest</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={fields.plusOne} onChange={e => { set("plusOne", e.target.checked); if (!e.target.checked) set("plusOneName", ""); }}
            className="h-3.5 w-3.5 rounded accent-[#5D6F5D]" />
          <span className="text-muted-foreground">Brings a +1</span>
        </label>
      </div>

      {fields.plusOne && (
        <input value={fields.plusOneName} onChange={e => set("plusOneName", e.target.value)}
          placeholder="+1 name (optional — leave blank if unknown)"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      )}
    </div>
  );
}

// ── Guest row ─────────────────────────────────────────────────────────────────

function GuestRow({ guest, onDelete, onStatusChange, onEditStart }: {
  guest: CoupleGuest;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onEditStart: (guest: CoupleGuest) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const rsvpLink = `${typeof window !== "undefined" ? window.location.origin : ""}/rsvp/${guest.rsvpToken ?? ""}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(rsvpLink);
      toast.success("RSVP link copied!");
    } catch {
      toast.error("Could not copy link.");
    }
  }

  const hasDetails = guest.dietary || guest.mealChoice || guest.plusOneName || guest.rsvpNote || guest.phone;

  return (
    <div className="border-b border-border/50 last:border-0">
      <div className="px-4 py-3 flex items-center gap-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-heading leading-tight">
            {[guest.firstName, guest.lastName].filter(Boolean).join(" ")}
            {guest.isChild && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-1.5 py-px text-[9px] font-medium text-amber-700">child</span>
            )}
            {guest.plusOne && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-muted border border-border px-1.5 py-px text-[9px] font-medium text-muted-foreground">
                {guest.plusOneName ? `+1 ${guest.plusOneName}` : "+1"}
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">{guest.email ?? ""}</p>
        </div>

        {guest.mealChoice && (
          <span className="text-[10px] text-muted-foreground hidden sm:inline">{guest.mealChoice}</span>
        )}

        <select value={guest.rsvpStatus} onChange={e => onStatusChange(guest.id, e.target.value)}
          className="text-[10px] font-semibold rounded-full border px-1.5 py-0.5 focus:outline-none"
          style={{
            background: `${RSVP_COLORS[guest.rsvpStatus]}15`,
            color: RSVP_COLORS[guest.rsvpStatus],
            borderColor: `${RSVP_COLORS[guest.rsvpStatus]}40`,
          }}>
          {Object.entries(RSVP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <button type="button" onClick={copyLink}
          className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
          title="Copy RSVP link">
          <Copy className="h-3.5 w-3.5" />
        </button>

        <button type="button" onClick={() => onEditStart(guest)}
          className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
          title="Edit guest">
          <Pencil className="h-3.5 w-3.5" />
        </button>

        {hasDetails && (
          <button type="button" onClick={() => setExpanded(p => !p)}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}

        <button type="button" onClick={() => onDelete(guest.id)}
          className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && hasDetails && (
        <div className="px-4 pb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {guest.phone && <span>📞 {guest.phone}</span>}
          {guest.mealChoice && <span>🍽️ {guest.mealChoice}</span>}
          {guest.plusOneName && <span>+1: {guest.plusOneName}{guest.plusOneMeal ? ` (${guest.plusOneMeal})` : ""}</span>}
          {guest.dietary && <span>⚠️ {guest.dietary}</span>}
          {guest.rsvpNote && <span className="italic">"{guest.rsvpNote}"</span>}
        </div>
      )}
    </div>
  );
}

// ── Household group ────────────────────────────────────────────────────────────

function HouseholdGroupHeader({ name, count, onRename, onDelete }: {
  name: string; count: number;
  onRename?: () => void; onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/50">
      <p className="text-xs font-semibold text-heading">
        {name} <span className="font-normal text-muted-foreground">· {count} guest{count !== 1 ? "s" : ""}</span>
      </p>
      {(onRename || onDelete) && (
        <div className="flex items-center gap-1">
          {onRename && (
            <button type="button" onClick={onRename} className="p-1 text-muted-foreground hover:text-foreground rounded" title="Rename household">
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive rounded" title="Delete household (guests stay, become unassigned)">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main GuestSection export ──────────────────────────────────────────────────

export function GuestSection({ token }: { token: string }) {
  const [guests,     setGuests]     = React.useState<CoupleGuest[]>([]);
  const [households, setHouseholds] = React.useState<CoupleHousehold[]>([]);
  const [stats,      setStats]      = React.useState<GuestStats | null>(null);
  const [insights,   setInsights]   = React.useState<RsvpInsights | null>(null);
  const [questions,  setQuestions]  = React.useState<RsvpQuestion[]>([]);
  const [loading,    setLoading]    = React.useState(true);
  const [filter,     setFilter]     = React.useState<"all" | "attending" | "declined" | "pending">("all");

  const [showAdd,  setShowAdd]  = React.useState(false);
  const [addFields, setAddFields] = React.useState<GuestFields>(emptyGuestFields);
  const [adding,   setAdding]   = React.useState(false);

  const [editingId,  setEditingId]  = React.useState<string | null>(null);
  const [editFields, setEditFields] = React.useState<GuestFields>(emptyGuestFields);
  const [saving,      setSaving]     = React.useState(false);

  const [addingHousehold, setAddingHousehold] = React.useState(false);
  const [newHouseholdName, setNewHouseholdName] = React.useState("");
  const [renamingHouseholdId, setRenamingHouseholdId] = React.useState<string | null>(null);

  const [importing, setImporting] = React.useState(false);
  const csvRef = React.useRef<HTMLInputElement>(null);

  async function loadAll() {
    const [gRes, iRes, qRes, hRes] = await Promise.all([
      fetch(`/api/portal/guests?token=${token}`).then(r => r.json()) as Promise<{ guests?: CoupleGuest[]; stats?: GuestStats }>,
      fetch(`/api/portal/rsvp-insights?token=${token}`).then(r => r.json()) as Promise<{ insights?: RsvpInsights }>,
      fetch(`/api/portal/rsvp-questions?token=${token}`).then(r => r.json()) as Promise<{ questions?: RsvpQuestion[] }>,
      fetch(`/api/portal/households?token=${token}`).then(r => r.json()) as Promise<{ households?: CoupleHousehold[] }>,
    ]);
    setGuests(gRes.guests ?? []);
    setStats(gRes.stats ?? null);
    setInsights(iRes.insights ?? null);
    setQuestions(qRes.questions ?? []);
    setHouseholds(hRes.households ?? []);
    setLoading(false);
  }

  React.useEffect(() => { loadAll(); }, [token]);

  async function reloadGuests() {
    const d = await fetch(`/api/portal/guests?token=${token}`).then(r => r.json()) as { guests?: CoupleGuest[]; stats?: GuestStats };
    setGuests(d.guests ?? []);
    setStats(d.stats ?? null);
  }

  async function reloadHouseholds() {
    const d = await fetch(`/api/portal/households?token=${token}`).then(r => r.json()) as { households?: CoupleHousehold[] };
    setHouseholds(d.households ?? []);
  }

  async function reloadInsights() {
    const d = await fetch(`/api/portal/rsvp-insights?token=${token}`).then(r => r.json()) as { insights?: RsvpInsights };
    setInsights(d.insights ?? null);
  }

  /** Resolves a GuestFields' household choice into a real id, creating a new household first if needed. */
  async function resolveHouseholdId(fields: GuestFields): Promise<string | null> {
    if (fields.householdChoice === NEW_HOUSEHOLD) {
      if (!fields.newHouseholdName.trim()) return null;
      const res = await fetch("/api/portal/households", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, name: fields.newHouseholdName.trim() }),
      });
      const data = await res.json() as { ok: boolean; householdId?: string };
      if (data.ok && data.householdId) {
        await reloadHouseholds();
        return data.householdId;
      }
      return null;
    }
    return fields.householdChoice || null;
  }

  async function handleAdd() {
    if (!addFields.name.trim()) return;
    setAdding(true);
    const householdId = await resolveHouseholdId(addFields);
    const parts = addFields.name.trim().split(" ");
    const res = await fetch("/api/portal/guests", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        firstName:   parts[0],
        lastName:    parts.slice(1).join(" ") || undefined,
        email:       addFields.email || undefined,
        phone:       addFields.phone || undefined,
        householdId,
        isChild:     addFields.isChild,
        plusOne:     addFields.plusOne,
        plusOneName: addFields.plusOneName || undefined,
        dietary:     addFields.dietary || undefined,
      }),
    });
    const data = await res.json() as { ok: boolean };
    if (data.ok) {
      await reloadGuests();
      setAddFields(emptyGuestFields());
      setShowAdd(false);
    } else {
      toast.error("Could not add guest.");
    }
    setAdding(false);
  }

  function handleEditStart(guest: CoupleGuest) {
    setEditingId(guest.id);
    setEditFields({
      name: [guest.firstName, guest.lastName].filter(Boolean).join(" "),
      email: guest.email ?? "",
      phone: guest.phone ?? "",
      householdChoice: guest.householdId ?? NO_HOUSEHOLD,
      newHouseholdName: "",
      isChild: guest.isChild,
      plusOne: guest.plusOne,
      plusOneName: guest.plusOneName ?? "",
      dietary: guest.dietary ?? "",
    });
  }

  async function handleEditSave() {
    if (!editingId || !editFields.name.trim()) return;
    setSaving(true);
    const householdId = await resolveHouseholdId(editFields);
    const parts = editFields.name.trim().split(" ");
    const res = await fetch("/api/portal/guests", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token, guestId: editingId,
        firstName:   parts[0],
        lastName:    parts.slice(1).join(" ") || undefined,
        email:       editFields.email || undefined,
        phone:       editFields.phone || undefined,
        householdId,
        isChild:     editFields.isChild,
        plusOne:     editFields.plusOne,
        plusOneName: editFields.plusOneName || undefined,
        dietary:     editFields.dietary || undefined,
      }),
    });
    const data = await res.json() as { ok: boolean };
    if (data.ok) {
      await reloadGuests();
      setEditingId(null);
      toast.success("Guest updated.");
    } else {
      toast.error("Could not save changes.");
    }
    setSaving(false);
  }

  async function handleRsvp(guestId: string, status: string) {
    await fetch("/api/portal/guests", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, guestId, rsvpStatus: status }),
    });
    setGuests(g => g.map(x => x.id === guestId ? { ...x, rsvpStatus: status as CoupleGuest["rsvpStatus"] } : x));
    await reloadInsights();
  }

  async function handleDelete(guestId: string) {
    await fetch("/api/portal/guests", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, guestId }),
    });
    setGuests(g => g.filter(x => x.id !== guestId));
    await reloadInsights();
  }

  async function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text  = await file.text();
      const parsed = parseCSV(text);
      if (!parsed.length) { toast.error("No guests found in CSV."); return; }
      const res  = await fetch("/api/portal/guests", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, guests: parsed }),
      });
      const data = await res.json() as { ok: boolean; imported?: number };
      if (data.ok) { toast.success(`${data.imported} guests imported.`); await reloadGuests(); await reloadHouseholds(); }
      else toast.error("Import failed. Check your CSV format.");
    } finally { setImporting(false); if (csvRef.current) csvRef.current.value = ""; }
  }

  async function handleCreateHousehold() {
    if (!newHouseholdName.trim()) return;
    const res = await fetch("/api/portal/households", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, name: newHouseholdName.trim() }),
    });
    const data = await res.json() as { ok: boolean };
    if (data.ok) { await reloadHouseholds(); setNewHouseholdName(""); setAddingHousehold(false); }
    else toast.error("Could not create household.");
  }

  async function handleRenameHousehold(id: string, name: string) {
    if (!name.trim()) return;
    const res = await fetch("/api/portal/households", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, id, name: name.trim() }),
    });
    const data = await res.json() as { ok: boolean };
    if (data.ok) { await reloadHouseholds(); setRenamingHouseholdId(null); }
    else toast.error("Could not rename household.");
  }

  async function handleDeleteHousehold(id: string) {
    const res = await fetch("/api/portal/households", {
      method: "DELETE", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, householdId: id }),
    });
    const data = await res.json() as { ok: boolean };
    if (data.ok) { await reloadHouseholds(); await reloadGuests(); toast.success("Household removed — guests were kept, just unassigned."); }
    else toast.error("Could not delete household.");
  }

  async function sendReminders() {
    const pendingWithEmail = guests.filter(g => g.rsvpStatus === "pending" && g.email);
    if (!pendingWithEmail.length) { toast.info("No pending guests with email addresses."); return; }
    const res = await fetch("/api/portal/invite", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, guestIds: pendingWithEmail.map(g => g.id), emailType: "reminder" }),
    });
    const data = await res.json() as { ok: boolean; sent?: number };
    if (data.ok) toast.success(`Reminder sent to ${data.sent} guests.`);
    else toast.error("Could not send reminders.");
  }

  const filtered = filter === "all" ? guests : guests.filter(g => g.rsvpStatus === filter);

  // Organize by household — this is the primary organizational unit (Guest &
  // Household Foundation), not a re-typed label. Every household appears even
  // if none of its members survive the current filter, so the couple can see
  // their households are still there; a household with zero matching guests
  // just renders empty under the current filter.
  const householdGroups = households.map(h => ({
    household: h,
    guests: filtered.filter(g => g.householdId === h.id),
  }));
  const unassigned = filtered.filter(g => !g.householdId);

  if (loading) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">Loading guests…</p>
      </div>
    );
  }

  const luvObs = stats ? getGuestObservations({
    total: stats.total,
    attending: stats.attending,
    declined: stats.declined,
    pending: stats.pending,
  }) : [];

  return (
    <div className="space-y-5">
      {/* RSVP Insights */}
      {insights && insights.total > 0 && (
        <InsightsPanel insights={insights} onSendReminders={sendReminders} />
      )}

      {/* Luv observations */}
      {luvObs.length > 0 && (
        <div className="space-y-2">
          {luvObs.map(o => (
            <div key={o.id} className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
              style={{ background: "#FDF5F5", border: "1px solid #D8A7AA30", color: "#5A3235" }}>
              <span className="shrink-0 mt-0.5 text-base">💗</span>
              <span className="leading-relaxed">{o.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {guests.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "attending", "declined", "pending"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={filter === f
                ? { background: "#5D6F5D", color: "white" }
                : { background: "transparent", color: "#6A6460", border: "1px solid #E0DAD4" }}>
              {f === "all" ? `All (${guests.length})` : `${RSVP_LABELS[f]} (${guests.filter(g => g.rsvpStatus === f).length})`}
            </button>
          ))}
        </div>
      )}

      {/* Guest list — organized by household */}
      {guests.length === 0 && !showAdd ? (
        <div className="rounded-2xl border border-dashed border-border py-10 text-center space-y-3 px-4">
          <Users className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-heading">No guests yet</p>
          <p className="text-xs text-muted-foreground">Add guests one at a time or import a CSV file.</p>
          <p className="text-[10px] text-muted-foreground">CSV format: First Name, Last Name, Email, Household</p>
        </div>
      ) : (
        <div className="space-y-3">
          {householdGroups.filter(hg => hg.guests.length > 0 || filter === "all").map(({ household, guests: hGuests }) => (
            <div key={household.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              {renamingHouseholdId === household.id ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border/50">
                  <input
                    defaultValue={household.name}
                    autoFocus
                    onKeyDown={e => { if (e.key === "Enter") handleRenameHousehold(household.id, (e.target as HTMLInputElement).value); if (e.key === "Escape") setRenamingHouseholdId(null); }}
                    className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    id={`rename-${household.id}`}
                  />
                  <button type="button" onClick={() => handleRenameHousehold(household.id, (document.getElementById(`rename-${household.id}`) as HTMLInputElement).value)}
                    className="p-1 text-muted-foreground hover:text-foreground"><Check className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setRenamingHouseholdId(null)}
                    className="p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <HouseholdGroupHeader
                  name={household.name} count={hGuests.length}
                  onRename={() => setRenamingHouseholdId(household.id)}
                  onDelete={() => handleDeleteHousehold(household.id)}
                />
              )}
              {hGuests.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">No guests in this household{filter !== "all" ? ` are ${filter}` : " yet"}.</p>
              ) : hGuests.map(g => (
                editingId === g.id ? (
                  <div key={g.id} className="border-b border-border/50 last:border-0 p-4 space-y-2.5 bg-muted/10">
                    <GuestFieldsForm fields={editFields} setFields={setEditFields} households={households} />
                    <div className="flex gap-2 justify-end pt-1">
                      <button type="button" onClick={() => setEditingId(null)} className="text-sm text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted">Cancel</button>
                      <button type="button" onClick={handleEditSave} disabled={!editFields.name.trim() || saving}
                        className="text-sm font-medium px-4 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "#5D6F5D" }}>
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <GuestRow key={g.id} guest={g} onDelete={handleDelete} onStatusChange={handleRsvp} onEditStart={handleEditStart} />
                )
              ))}
            </div>
          ))}

          {(unassigned.length > 0 || households.length === 0) && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {households.length > 0 && (
                <HouseholdGroupHeader name="Unassigned" count={unassigned.length} />
              )}
              {unassigned.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">No {filter !== "all" ? `${filter} ` : ""}guests here.</p>
              ) : unassigned.map(g => (
                editingId === g.id ? (
                  <div key={g.id} className="border-b border-border/50 last:border-0 p-4 space-y-2.5 bg-muted/10">
                    <GuestFieldsForm fields={editFields} setFields={setEditFields} households={households} />
                    <div className="flex gap-2 justify-end pt-1">
                      <button type="button" onClick={() => setEditingId(null)} className="text-sm text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted">Cancel</button>
                      <button type="button" onClick={handleEditSave} disabled={!editFields.name.trim() || saving}
                        className="text-sm font-medium px-4 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "#5D6F5D" }}>
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <GuestRow key={g.id} guest={g} onDelete={handleDelete} onStatusChange={handleRsvp} onEditStart={handleEditStart} />
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add guest form */}
      {showAdd ? (
        <div className="rounded-2xl border border-ring bg-card p-4 space-y-2.5">
          <GuestFieldsForm fields={addFields} setFields={setAddFields} households={households} autoFocus onEnter={handleAdd} />
          <div className="flex gap-2 justify-end pt-0.5">
            <button type="button" onClick={() => { setShowAdd(false); setAddFields(emptyGuestFields()); }}
              className="text-sm text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted">Cancel</button>
            <button type="button" onClick={handleAdd} disabled={!addFields.name.trim() || adding}
              className="text-sm font-medium px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: "#5D6F5D" }}>
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

      {/* Household management */}
      <div className="border border-border rounded-2xl p-4 space-y-2.5">
        <p className="text-sm font-medium text-heading">Households</p>
        <p className="text-xs text-muted-foreground">
          Group guests into households — families, friend groups, whoever comes together — so you can organize your list the way you actually think about it.
        </p>
        {addingHousehold ? (
          <div className="flex gap-2">
            <input value={newHouseholdName} onChange={e => setNewHouseholdName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateHousehold()}
              placeholder="Household name — The Smiths, College Friends…" autoFocus
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            <button type="button" onClick={handleCreateHousehold} disabled={!newHouseholdName.trim()}
              className="text-sm font-medium px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "#5D6F5D" }}>
              Add
            </button>
            <button type="button" onClick={() => { setAddingHousehold(false); setNewHouseholdName(""); }}
              className="text-sm text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingHousehold(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40 transition-colors">
            <Plus className="h-3.5 w-3.5" /> New Household
          </button>
        )}
      </div>

      {/* RSVP Question Manager */}
      <QuestionManager token={token} questions={questions}
        onUpdate={async () => {
          const d = await fetch(`/api/portal/rsvp-questions?token=${token}`).then(r => r.json()) as { questions?: RsvpQuestion[] };
          setQuestions(d.questions ?? []);
        }}
      />
    </div>
  );
}
