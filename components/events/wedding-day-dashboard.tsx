"use client";

/**
 * WeddingDayDashboard — Venue mission control for the wedding day.
 *
 * Sections:
 *   Hero          — couple + date + ceremony countdown + live vendor stats
 *   Luv           — operational observations (updated every 30s)
 *   Guest Summary — headcount, meal choices, dietary notes, table estimate
 *   [2-col grid]
 *     Left:  Run of Show (timeline with status toggles) + Grouped Task Checklist
 *     Right: Vendor Check-In + Key Contacts + Quick Documents
 */

import * as React from "react";

import { CheckCircle, Circle, Clock, Phone, Mail, FileText, LayoutGrid, RefreshCw, Users, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { shiftEntriesAfterAction } from "@/app/(app)/events/[id]/timeline-actions";
import type { VenueEvent } from "@/lib/events/types";
import type { Document } from "@/lib/documents/types";
import type { FloorPlan } from "@/lib/floor-plans/types";

// ── Palette ───────────────────────────────────────────────────────────────────

const SAGE      = "#5D6F5D";
const ROSE      = "#D8A7AA";
const ROSE_DEEP = "#C17F84";
const GOLD      = "#C7A66A";
const LINEN     = "#F7F5F1";

// ── Types returned by get_wedding_day_ops RPC ─────────────────────────────────

type TimelineEntry = {
  id: string;
  title: string;
  description: string | null;
  entryTime: string | null;
  sortOrder: number;
  status: "not_started" | "in_progress" | "complete";
  assignedToStaffId: string | null;
  assignedToName: string | null;
};

type VendorAssignment = {
  assignmentId: string;
  vendorId: string;
  vendorName: string;
  category: string | null;
  contactName: string | null;
  phone: string | null;
  arrivalTime: string | null;
  notes: string | null;
  checkedInAt: string | null;
  setupCompleteAt: string | null;
};

// A lightweight, page-local version of docs/luv-platform-reconciliation.md
// §4's kind model — just the four kinds this page's own observations
// actually produce, not the full six-kind shared envelope (out of scope
// here; this stays this page's own bespoke computation, same as before).
type LuvObservationKind = "fact" | "celebration" | "waiting" | "risk";
type LuvObservation = { kind: LuvObservationKind; text: string };

type DayTask = {
  id: string;
  title: string;
  description: string | null;
  ownerType: string | null;
  status: string;
  completedAt: string | null;
  assignedToStaffId: string | null;
  assignedToName: string | null;
};

type DayRequest = { id: string; title: string; status: string };

type Contact = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  roleLabel: string | null;
  isEmergency?: boolean;
};

type DietaryRow = {
  choice: string | null;
  restriction: string | null;
  count: number;
};

type OpsData = {
  timeline: TimelineEntry[];
  vendors:  VendorAssignment[];
  tasks:    DayTask[];
  contacts: Contact[];
  dietary:  DietaryRow[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hNum = parseInt(h, 10);
  return `${hNum % 12 || 12}:${m} ${hNum >= 12 ? "PM" : "AM"}`;
}

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function getCeremonyEntry(entries: TimelineEntry[]): TimelineEntry | null {
  return entries.find(e =>
    e.entryTime && /ceremony|processional|i do/i.test(e.title)
  ) ?? entries.find(e => e.entryTime) ?? null;
}

function computeCountdown(entry: TimelineEntry | null): { mins: number; label: string } | null {
  if (!entry?.entryTime) return null;
  const [h, m] = entry.entryTime.split(":");
  const target = new Date();
  target.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
  const mins = Math.round((target.getTime() - Date.now()) / 60_000);
  if (mins < 0) return null;
  const label = mins === 0 ? "Now" : mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return { mins, label };
}

function relationshipLabel(rel: string | null): string {
  const map: Record<string, string> = {
    partner: "Partner", planner: "Wedding Planner",
    maid_of_honor: "Maid of Honor", best_man: "Best Man",
    parent: "Parent", sibling: "Sibling", family: "Family",
  };
  return rel ? (map[rel] ?? rel) : "Contact";
}

// Task grouping — maps ownerType values to display group
const OWNER_GROUPS: { key: string; label: string; emoji: string; matches: string[] }[] = [
  { key: "venue",  label: "Venue",   emoji: "🏛️", matches: ["coordinator", "team", "venue"] },
  { key: "vendor", label: "Vendors", emoji: "🤝", matches: ["vendor"] },
  { key: "couple", label: "Client",  emoji: "💍", matches: ["couple", "client"] },
];

function groupTasks(tasks: DayTask[]): { group: typeof OWNER_GROUPS[0]; tasks: DayTask[] }[] {
  const groups = OWNER_GROUPS.map(g => ({
    group: g,
    tasks: tasks.filter(t => {
      const ot = (t.ownerType ?? "").toLowerCase();
      return g.matches.some(m => ot.includes(m));
    }),
  }));
  // Catch-all: tasks that didn't match any group → add to Venue
  const matched = new Set(groups.flatMap(g => g.tasks.map(t => t.id)));
  const unmatched = tasks.filter(t => !matched.has(t.id));
  if (unmatched.length > 0) groups[0].tasks.push(...unmatched);
  return groups.filter(g => g.tasks.length > 0);
}

// ── Status cycle ──────────────────────────────────────────────────────────────

const STATUS_CYCLE: Record<TimelineEntry["status"], TimelineEntry["status"]> = {
  not_started: "in_progress",
  in_progress: "complete",
  complete:    "not_started",
};

const STATUS_CONFIG: Record<TimelineEntry["status"], { icon: React.ReactNode; label: string; color: string }> = {
  not_started: { icon: <Circle      className="h-5 w-5" />, label: "Not started", color: "#DED6CA" },
  in_progress: { icon: <Clock       className="h-5 w-5" />, label: "In progress", color: GOLD },
  complete:    { icon: <CheckCircle className="h-5 w-5" />, label: "Complete",    color: SAGE },
};

// ── Ceremony countdown chip ───────────────────────────────────────────────────

function CeremonyCountdownChip({ entries }: { entries: TimelineEntry[] }) {
  const [countdown, setCountdown] = React.useState(() => computeCountdown(getCeremonyEntry(entries)));

  React.useEffect(() => {
    const entry = getCeremonyEntry(entries);
    setCountdown(computeCountdown(entry));
    const t = setInterval(() => setCountdown(computeCountdown(entry)), 60_000);
    return () => clearInterval(t);
  }, [entries]);

  if (!countdown) return null;

  return (
    <div className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white"
      style={{ background: countdown.mins === 0 ? ROSE_DEEP : SAGE }}>
      <Clock className="h-3.5 w-3.5 shrink-0" />
      {countdown.mins === 0 ? "Ceremony starting now" : `Ceremony in ${countdown.label}`}
    </div>
  );
}

// ── Live Timeline ─────────────────────────────────────────────────────────────

function LiveTimeline({
  entries, onStatusChange, onDelay,
}: {
  entries: TimelineEntry[];
  onStatusChange: (id: string, status: TimelineEntry["status"]) => void;
  onDelay: (entryId: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center italic">
        No timeline entries yet. Add them in the event's Timeline tab.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {entries.map(entry => {
        const cfg    = STATUS_CONFIG[entry.status];
        const isActive = entry.status === "in_progress";
        const isDone   = entry.status === "complete";

        return (
          <div key={entry.id}
            className="group flex items-start gap-4 py-3"
            style={isActive ? { background: `${GOLD}0A` } : undefined}>
            <div className="w-14 shrink-0 text-right pt-0.5">
              <p className="text-xs font-semibold" style={{ color: isActive ? GOLD : "#9A938D" }}>
                {fmtTime(entry.entryTime)}
              </p>
            </div>
            <button type="button"
              onClick={() => onStatusChange(entry.id, STATUS_CYCLE[entry.status])}
              className="shrink-0 mt-0.5 transition-transform hover:scale-110"
              style={{ color: cfg.color }}
              title={`Mark ${STATUS_CYCLE[entry.status].replace(/_/g, " ")}`}>
              {cfg.icon}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug ${isDone ? "line-through text-muted-foreground" : "text-heading"}`}>
                {entry.title}
                {isActive && (
                  <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white align-middle"
                    style={{ background: GOLD }}>
                    In progress
                  </span>
                )}
              </p>
              {entry.description && !isDone && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.description}</p>
              )}
              {entry.assignedToName && (
                <p className="text-[11px] text-muted-foreground mt-0.5">👤 {entry.assignedToName}</p>
              )}
            </div>
            {entry.entryTime && !isDone && (
              <button type="button"
                onClick={() => onDelay(entry.id)}
                className="shrink-0 self-center text-[11px] text-muted-foreground opacity-0 transition-opacity hover:text-heading group-hover:opacity-100"
                title="Push this and everything after it back">
                Running late?
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Task Checklist (grouped by actor) ────────────────────────────────────────

function GroupedTaskList({
  tasks, onComplete,
}: {
  tasks: DayTask[];
  onComplete: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center italic">
        No wedding day tasks. Add tasks with the "Wedding Day" phase in the playbook editor.
      </p>
    );
  }

  const pending  = tasks.filter(t => t.status !== "complete");
  const complete = tasks.filter(t => t.status === "complete");
  const groups   = groupTasks(pending);
  const [showDone, setShowDone] = React.useState(false);

  return (
    <div className="space-y-4">
      {groups.map(({ group, tasks: gTasks }) => (
        <div key={group.key}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center gap-1.5">
            <span>{group.emoji}</span>
            {group.label}
          </p>
          <div className="space-y-0.5">
            {gTasks.map(t => (
              <button key={t.id} type="button" onClick={() => onComplete(t.id)}
                className="w-full text-left flex items-start gap-3 py-2.5 px-2 rounded-xl hover:bg-muted/30 group transition-colors">
                <div className="h-4 w-4 rounded border-2 shrink-0 mt-0.5 group-hover:border-primary transition-colors"
                  style={{ borderColor: "#DED6CA" }} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-heading">{t.title}</p>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                  {t.assignedToName && <p className="text-[11px] text-muted-foreground mt-0.5">👤 {t.assignedToName}</p>}
                </div>
                <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1"
                  style={{ color: SAGE }}>
                  Done
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {complete.length > 0 && (
        <div>
          <button type="button"
            onClick={() => setShowDone(s => !s)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`h-3 w-3 transition-transform ${showDone ? "rotate-180" : ""}`} />
            {complete.length} completed
          </button>
          {showDone && (
            <div className="mt-2 space-y-0.5">
              {complete.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-1.5 px-2 opacity-50">
                  <CheckCircle className="h-4 w-4 shrink-0" style={{ color: SAGE }} />
                  <p className="text-sm text-muted-foreground line-through">{t.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vendor Check-In ───────────────────────────────────────────────────────────

function VendorCheckinList({
  vendors, onToggle,
}: {
  vendors: VendorAssignment[];
  onToggle: (assignmentId: string, field: "checked_in" | "setup_complete") => void;
}) {
  if (vendors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center italic">
        No vendors assigned to this event yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {vendors.map(v => {
        const checkedIn = !!v.checkedInAt;
        const setupDone = !!v.setupCompleteAt;
        const allGood   = checkedIn && setupDone;

        return (
          <div key={v.assignmentId} className="py-3.5 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-heading">{v.vendorName}</p>
                  {v.category && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: `${SAGE}15`, color: SAGE }}>
                      {v.category}
                    </span>
                  )}
                  {allGood && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ background: SAGE }}>
                      ✓ Ready
                    </span>
                  )}
                </div>
                {v.contactName && (
                  <p className="text-xs text-muted-foreground mt-0.5">{v.contactName}</p>
                )}
                {v.arrivalTime && (
                  <p className="text-xs text-muted-foreground">ETA {fmtTime(v.arrivalTime)}</p>
                )}
              </div>
              {v.phone && (
                <a href={`tel:${v.phone}`}
                  className="flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1.5 border transition-colors hover:bg-muted/40 shrink-0"
                  style={{ color: SAGE, borderColor: `${SAGE}30` }}>
                  <Phone className="h-3 w-3" />
                  Call
                </a>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button type="button"
                onClick={() => onToggle(v.assignmentId, "checked_in")}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all"
                style={checkedIn
                  ? { background: `${SAGE}15`, borderColor: `${SAGE}40`, color: SAGE }
                  : { borderColor: "#DED6CA", color: "#8A837D" }}>
                {checkedIn ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                Arrived
              </button>
              <button type="button"
                onClick={() => onToggle(v.assignmentId, "setup_complete")}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all"
                style={setupDone
                  ? { background: `${SAGE}15`, borderColor: `${SAGE}40`, color: SAGE }
                  : { borderColor: "#DED6CA", color: "#8A837D" }}>
                {setupDone ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                Setup done
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Guest Summary ─────────────────────────────────────────────────────────────

function GuestSummary({
  guestCount, dietary,
}: {
  guestCount: number;
  dietary: DietaryRow[];
}) {
  const mealChoices    = dietary.filter(d => d.choice && !d.restriction);
  const restrictions   = dietary.filter(d => d.restriction);
  const estimatedTables = Math.ceil(guestCount / 8);

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {/* Headcount + tables */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Attendance</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Final count
            </span>
            <span className="text-sm font-semibold text-heading">{guestCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estimated tables</span>
            <span className="text-sm font-semibold text-heading">~{estimatedTables}</span>
          </div>
        </div>
      </div>

      {/* Meal choices */}
      {mealChoices.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Meal Choices</p>
          <div className="space-y-1.5">
            {mealChoices.map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{d.choice}</span>
                <span className="text-sm font-semibold text-heading">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dietary restrictions */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Dietary Notes {restrictions.length > 0 ? `(${restrictions.reduce((s, d) => s + d.count, 0)})` : ""}
        </p>
        {restrictions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {restrictions.map((d, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1"
                style={{ background: `${GOLD}15`, color: "#8A6A30" }}>
                {d.count}× {d.restriction}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">None noted</p>
        )}
      </div>
    </div>
  );
}

// ── Key Contacts ──────────────────────────────────────────────────────────────

function KeyContacts({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center italic">
        No contacts listed. Add contacts in the client record.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {contacts.map(c => (
        <div key={c.id} className="rounded-xl border bg-card p-3.5 space-y-2"
          style={{ borderColor: c.isEmergency ? `${ROSE}50` : "#E8E3DC" }}>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-heading">
                {[c.firstName, c.lastName].filter(Boolean).join(" ")}
              </p>
              {c.isEmergency && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                  style={{ background: ROSE_DEEP }}>
                  Emergency
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {c.roleLabel ?? relationshipLabel(c.relationship)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {c.phone && (
              <a href={`tel:${c.phone}`}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
                style={{ background: SAGE }}>
                <Phone className="h-3 w-3" />
                {c.phone}
              </a>
            )}
            {c.email && (
              <a href={`mailto:${c.email}`}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-muted/30"
                style={{ borderColor: `${SAGE}30`, color: SAGE }}>
                <Mail className="h-3 w-3" />
                Email
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Quick Documents ───────────────────────────────────────────────────────────

const DOC_PRIORITY = ["floor plan", "timeline", "contract", "rain", "catering", "coi"];

function QuickDocuments({ documents }: { documents: Document[] }) {
  const sorted = [...documents].sort((a, b) => {
    const ai = DOC_PRIORITY.findIndex(k => a.name.toLowerCase().includes(k));
    const bi = DOC_PRIORITY.findIndex(k => b.name.toLowerCase().includes(k));
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-2">No documents uploaded yet.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {sorted.map(doc => (
        <a key={doc.id} href={doc.storageUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2.5 p-3 rounded-xl border bg-card text-sm font-medium text-heading hover:shadow-sm transition-all"
          style={{ borderColor: "#E8E3DC" }}>
          <FileText className="h-4 w-4 shrink-0" style={{ color: ROSE }} />
          <span className="truncate">{doc.name}</span>
        </a>
      ))}
    </div>
  );
}

// Requests had zero presence on this page before this — a pending
// Approval/Selection/etc. tied to this booking was invisible to a
// coordinator running the day (Wedding Day Release Readiness, UX
// Improvement #2). Read-only, links out to the Request itself — this page
// reveals Requests, it doesn't reimplement the Request Center.
const REQUEST_STATUS_LABEL: Record<string, string> = {
  sent: "Sent", viewed: "Viewed", in_progress: "In progress",
  submitted: "Submitted — needs review", reviewed: "Reviewed",
};

function QuickRequests({ requests }: { requests: DayRequest[] }) {
  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-2">No outstanding requests for this booking.</p>;
  }
  return (
    <div className="space-y-2">
      {requests.map(r => (
        <a key={r.id} href={`/requests/${r.id}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-card hover:shadow-sm transition-all"
          style={{ borderColor: "#E8E3DC" }}>
          <div className="min-w-0">
            <p className="text-sm font-medium text-heading truncate">{r.title}</p>
            <p className="text-[11px] text-muted-foreground">{REQUEST_STATUS_LABEL[r.status] ?? r.status}</p>
          </div>
          {r.status === "submitted" && (
            <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: GOLD }}>
              Needs review
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

// Floor Plans had no wedding-day surface at all before this — the print
// view existed but was undiscoverable from the one page a coordinator
// actually uses on the day itself. This mirrors QuickDocuments' shape
// exactly: a link out, never an embedded editor.
function QuickFloorPlans({ eventId, floorPlans }: { eventId: string; floorPlans: FloorPlan[] }) {
  if (floorPlans.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-2">No floor plans yet.</p>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {floorPlans.map(plan => (
        <div key={plan.id} className="flex items-center justify-between gap-2 p-3 rounded-xl border bg-card text-sm"
          style={{ borderColor: "#E8E3DC" }}>
          <span className="flex min-w-0 items-center gap-2 truncate font-medium text-heading">
            <LayoutGrid className="h-4 w-4 shrink-0" style={{ color: ROSE }} />
            <span className="truncate">{plan.name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <a href={`/events/${eventId}/floor-plans/${plan.id}`} className="text-xs font-medium hover:underline" style={{ color: ROSE_DEEP }}>
              View
            </a>
            <a href={`/events/${eventId}/floor-plan-print/${plan.id}`} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium hover:underline" style={{ color: ROSE_DEEP }}>
              Print
            </a>
          </span>
        </div>
      ))}
    </div>
  );
}

// Wedding Day Seating — a fast lookup workspace for staff (Seating Final
// Release Completion), distinct from Floor Plans: this links to guest-level
// rosters, not room geometry. Same link-out shape as QuickFloorPlans/
// QuickDocuments — never an embedded editor.
function QuickSeating({ eventId }: { eventId: string }) {
  return (
    <div className="flex items-center justify-between gap-2 p-3 rounded-xl border bg-card text-sm"
      style={{ borderColor: "#E8E3DC" }}>
      <span className="flex min-w-0 items-center gap-2 truncate font-medium text-heading">
        <LayoutGrid className="h-4 w-4 shrink-0" style={{ color: ROSE }} />
        <span className="truncate">Table rosters, meal counts &amp; accessibility notes</span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <a href={`/events/${eventId}/seating`} className="text-xs font-medium hover:underline" style={{ color: ROSE_DEEP }}>
          Look Up
        </a>
        <a href={`/events/${eventId}/seating-print`} target="_blank" rel="noopener noreferrer"
          className="text-xs font-medium hover:underline" style={{ color: ROSE_DEEP }}>
          Print
        </a>
      </span>
    </div>
  );
}

// ── Luv Observations ──────────────────────────────────────────────────────────

// Celebration > Risk > Waiting > Fact — same precedence
// docs/luv-platform-reconciliation.md §4 establishes for the shared model,
// applied here to sort order: the thing most worth a coordinator's
// attention reads first, not whatever order the computation happened to
// push it in.
const LUV_KIND_ORDER: Record<LuvObservationKind, number> = { celebration: 0, risk: 1, waiting: 2, fact: 3 };
const LUV_KIND_STYLE: Record<LuvObservationKind, { emoji: string; color: string }> = {
  celebration: { emoji: "🎉", color: SAGE },
  risk:        { emoji: "⚠️", color: ROSE_DEEP },
  waiting:     { emoji: "⏳", color: GOLD },
  fact:        { emoji: "💗", color: "#5A3235" },
};

function LuvObsPanel({ observations }: { observations: LuvObservation[] }) {
  if (observations.length === 0) return null;
  const sorted = [...observations].sort((a, b) => LUV_KIND_ORDER[a.kind] - LUV_KIND_ORDER[b.kind]);
  return (
    <section className="rounded-2xl border p-5 space-y-3"
      style={{ background: "#FDF5F5", borderColor: `${ROSE}30` }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ROSE_DEEP }}>
        💗 Luv
      </p>
      {sorted.map((obs, i) => (
        <p key={i} className="text-sm leading-relaxed flex items-start gap-2" style={{ color: LUV_KIND_STYLE[obs.kind].color }}>
          <span className="shrink-0">{LUV_KIND_STYLE[obs.kind].emoji}</span>
          <span>{obs.text}</span>
        </p>
      ))}
    </section>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: "#E8E3DC" }}>
      <div className="px-5 py-3.5 flex items-center gap-2 border-b" style={{ borderColor: "#E8E3DC", background: LINEN }}>
        <span>{emoji}</span>
        <h2 className="text-sm font-semibold text-heading">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function WeddingDayDashboard({
  event,
  documents,
  floorPlans,
  coupleName,
  outstandingRequests = [],
}: {
  event: VenueEvent;
  documents: Document[];
  floorPlans: FloorPlan[];
  coupleName: string;
  outstandingRequests?: DayRequest[];
}) {
  const [data, setData]               = React.useState<OpsData | null>(null);
  const [loading, setLoading]         = React.useState(true);
  const [lastRefresh, setLastRefresh] = React.useState(Date.now());

  function fetchData() {
    fetch(`/api/events/${event.id}/wedding-day`)
      .then(r => r.json())
      .then((d: OpsData) => { setData(d); setLastRefresh(Date.now()); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  React.useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  // ── Optimistic mutations ──────────────────────────────────────────────────

  // Every mutation here follows the same shape: apply optimistically, capture
  // what the screen looked like before, and on any failure (network drop, an
  // expired session, an RLS rejection) revert to that snapshot and surface a
  // toast — never leave the coordinator believing a write landed when it
  // didn't. This is the live wedding-day surface; the next 30s poll would
  // otherwise silently "undo" an unnoticed failed write mid-event with zero
  // explanation (Timeline Release Readiness, Release Blocker #2).

  async function handleTimelineStatus(entryId: string, status: TimelineEntry["status"]) {
    const previous = data;
    setData(d => d ? { ...d, timeline: d.timeline.map(e => e.id === entryId ? { ...e, status } : e) } : d);
    try {
      const res = await fetch(`/api/events/${event.id}/wedding-day`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "timeline_status", entryId, status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Request failed");
    } catch {
      setData(previous);
      toast.error("Could not update the timeline — please try again.");
    }
  }

  async function handleVendorToggle(assignmentId: string, field: "checked_in" | "setup_complete") {
    const key = field === "checked_in" ? "checkedInAt" : "setupCompleteAt";
    const previous = data;
    setData(d => d ? {
      ...d,
      vendors: d.vendors.map(v => v.assignmentId === assignmentId
        ? { ...v, [key]: v[key] ? null : new Date().toISOString() }
        : v),
    } : d);
    try {
      const res = await fetch(`/api/events/${event.id}/wedding-day`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "vendor_checkin", assignmentId, field }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Request failed");
    } catch {
      setData(previous);
      toast.error("Could not update vendor check-in — please try again.");
    }
  }

  async function handleTaskComplete(taskId: string) {
    const previous = data;
    setData(d => d ? {
      ...d,
      tasks: d.tasks.map(t => t.id === taskId
        ? { ...t, status: "complete", completedAt: new Date().toISOString() }
        : t),
    } : d);
    try {
      const res = await fetch(`/api/events/${event.id}/wedding-day`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "complete_task", taskId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Request failed");
    } catch {
      setData(previous);
      toast.error("Could not complete the task — please try again.");
    }
  }

  // Delay recovery — Timeline entries have no duration/dependency model, so
  // "the ceremony ran late" means re-typing every later entry's time by hand
  // today. This is the one bulk operation that doesn't require either
  // (Timeline Release Readiness, UX Improvement #1): shift every entry after
  // this one by N minutes in a single write, refetching afterward since a
  // shift touches rows this component doesn't hold optimistic state for.
  async function handleDelay(entryId: string) {
    const raw = window.prompt("Push this and everything after it back by how many minutes?", "15");
    if (raw === null) return;
    const minutes = parseInt(raw, 10);
    if (!Number.isFinite(minutes) || minutes === 0) return;
    const result = await shiftEntriesAfterAction(event.id, entryId, minutes);
    if (result.ok) { toast.success(`Shifted ${result.shiftedCount ?? 0} later ${result.shiftedCount === 1 ? "entry" : "entries"}.`); fetchData(); }
    else toast.error(result.message ?? "Could not shift the schedule.");
  }

  // ── Luv observations ──────────────────────────────────────────────────────

  const luvObs: LuvObservation[] = React.useMemo(() => {
    if (!data) return [];
    const obs: LuvObservation[] = [];

    // Ceremony countdown — lead observation. "Starting now" is the one
    // moment worth calling out as a risk-toned interrupt; otherwise a
    // routine fact.
    const ceremony = getCeremonyEntry(data.timeline);
    const countdown = computeCountdown(ceremony);
    if (countdown) {
      obs.push({
        kind: countdown.mins === 0 ? "risk" : "fact",
        text: countdown.mins === 0
          ? "Ceremony is starting now."
          : `${ceremony?.title ?? "Ceremony"} begins in ${countdown.label}.`,
      });
    }
    // Inside 30 minutes of the ceremony, an unresolved vendor or task stops
    // being routine "waiting" and becomes something worth flagging as risk —
    // the same fact, a different urgency, per docs/luv-platform-
    // reconciliation.md §4's kind model (a Risk is a Fact plus a crossed
    // threshold, never invented from nothing).
    const isCloseToCeremony = countdown !== null && countdown.mins <= 30;

    // Vendor status
    const totalVendors   = data.vendors.length;
    const readyVendors   = data.vendors.filter(v => v.checkedInAt && v.setupCompleteAt).length;
    const pendingVendors = data.vendors.filter(v => !v.checkedInAt);

    if (totalVendors > 0 && readyVendors === totalVendors) {
      obs.push({ kind: "celebration", text: `All ${totalVendors} vendor${totalVendors === 1 ? "" : "s"} have checked in and are set up.` });
    } else if (pendingVendors.length > 0) {
      const names = pendingVendors.slice(0, 2).map(v => v.vendorName).join(", ");
      obs.push({
        kind: isCloseToCeremony ? "risk" : "waiting",
        text: `Still waiting on ${names}${pendingVendors.length > 2 ? ` and ${pendingVendors.length - 2} more` : ""}.`,
      });
    }

    // Guest count
    if (event.guestCount) {
      obs.push({ kind: "fact", text: `Final guest count is ${event.guestCount}.` });
    }

    // Dietary
    const totalRestrictions = data.dietary.filter(d => d.restriction).reduce((s, d) => s + d.count, 0);
    if (totalRestrictions > 0) {
      obs.push({ kind: "fact", text: `${totalRestrictions} dietary note${totalRestrictions === 1 ? "" : "s"} for today's service. Confirm catering has the list.` });
    }

    // Tasks
    const pendingTasks = data.tasks.filter(t => t.status !== "complete");
    if (pendingTasks.length === 0 && data.tasks.length > 0) {
      obs.push({ kind: "celebration", text: "All wedding day tasks are complete." });
    } else if (pendingTasks.length > 0) {
      obs.push({
        kind: isCloseToCeremony ? "risk" : "waiting",
        text: `${pendingTasks.length} task${pendingTasks.length === 1 ? "" : "s"} still on the checklist.`,
      });
    }

    return obs;
  }, [data, event.guestCount]);

  const guestCount = event.guestCount ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Hero ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: `linear-gradient(135deg, #3D4F3D 0%, ${SAGE} 100%)` }}>
        <div className="p-6 sm:p-8 text-white space-y-5">

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] opacity-50">Today's Event</p>
              <p className="font-heading text-3xl sm:text-4xl font-medium leading-tight mt-1">{coupleName}</p>
              <p className="text-sm opacity-55 mt-1">{fmtDate(event.eventDate)}</p>
            </div>
            <button type="button" onClick={fetchData}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-white/20 text-white/50 hover:text-white/80 transition-colors">
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>

          {/* Live stats row */}
          <div className="flex flex-wrap items-center gap-3">
            {data && <CeremonyCountdownChip entries={data.timeline} />}
            <div className="flex items-center gap-1.5 text-sm font-medium text-white/80">
              <span>👥</span>
              <span>{guestCount} attending</span>
            </div>
            {data && data.vendors.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-white/80">
                <span>🤝</span>
                <span>
                  {data.vendors.filter(v => v.checkedInAt).length}/{data.vendors.length} vendors in
                </span>
              </div>
            )}
            {data && data.tasks.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-white/80">
                <span>✅</span>
                <span>
                  {data.tasks.filter(t => t.status === "complete").length}/{data.tasks.length} tasks done
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Luv ── */}
      <LuvObsPanel observations={luvObs} />

      {/* ── Guest Summary ── */}
      <Section title="Guest Summary" emoji="👥">
        <GuestSummary guestCount={guestCount} dietary={data?.dietary ?? []} />
      </Section>

      {/* ── Two-column on desktop ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">

          <Section title="Run of Show" emoji="📋">
            <LiveTimeline entries={data?.timeline ?? []} onStatusChange={handleTimelineStatus} onDelay={handleDelay} />
          </Section>

          <Section title="Wedding Day Tasks" emoji="✅">
            <GroupedTaskList tasks={data?.tasks ?? []} onComplete={handleTaskComplete} />
          </Section>

        </div>

        <div className="space-y-5">

          <Section title="Vendor Check-In" emoji="🤝">
            <VendorCheckinList vendors={data?.vendors ?? []} onToggle={handleVendorToggle} />
          </Section>

          <Section title="Key Contacts" emoji="📱">
            <KeyContacts contacts={data?.contacts ?? []} />
          </Section>

          <Section title="Requests" emoji="📝">
            <QuickRequests requests={outstandingRequests} />
          </Section>

          <Section title="Floor Plans" emoji="🪑">
            <QuickFloorPlans eventId={event.id} floorPlans={floorPlans} />
          </Section>

          <Section title="Seating" emoji="💺">
            <QuickSeating eventId={event.id} />
          </Section>

          <Section title="Documents" emoji="📁">
            <QuickDocuments documents={documents} />
          </Section>

        </div>
      </div>

      {/* ── Footer ── */}
      <p className="text-center text-[10px] text-muted-foreground pb-2">
        Auto-refreshes every 30 seconds · Last updated {new Date(lastRefresh).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </p>

    </div>
  );
}
