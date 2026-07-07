"use client";

/**
 * VendorPortalShell — vendor's dedicated workspace.
 *
 * Sprint 58: Foundation — events, timeline, tasks
 * Sprint 82: Collaboration — arrival info, check-in, documents
 *
 * Design: professional, clean, action-oriented.
 * One question: "What do I need to do for this event?"
 */

import * as React from "react";
import {
  AlertTriangle, CalendarDays, Check, CheckCircle, Circle,
  Clock, FileText, Loader2, MapPin, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

import type {
  VendorDocument, VendorEvent, VendorPortalContext, VendorTask, VendorTimelineEntry,
} from "@/lib/vendor-portal/types";

// ── Palette (CSS variables — adapts to light/dark mode) ──────────────────────

const SLATE  = "var(--foreground)";
const MID    = "var(--muted-foreground)";
const ACCENT = "var(--primary)";
const GREEN  = "var(--success)";

type VendorSection = "dashboard" | "timeline" | "tasks" | "documents" | "messages";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function formatDateShort(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000);
}

function formatTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function docIcon(category: string): string {
  const icons: Record<string, string> = {
    contract: "📋", insurance: "🛡️", floor_plan: "🗺️",
    menu: "🍽️", permit: "📜", questionnaire: "📝", other: "📄",
  };
  return icons[category] ?? "📄";
}

// ── Check-In Station ──────────────────────────────────────────────────────────
// Shown prominently when event is today (du === 0) or tomorrow (du === 1)

function CheckInStation({
  event, token, onUpdate,
}: {
  event: VendorEvent;
  token: string;
  onUpdate: (checkedInAt: string | null, setupCompleteAt: string | null) => void;
}) {
  const [loading, setLoading] = React.useState<string | null>(null);

  async function toggle(field: "checked_in" | "setup_complete") {
    setLoading(field);
    try {
      const res = await fetch("/api/vendor/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, eventId: event.eventId, field }),
      });
      const data = await res.json() as { ok: boolean; checkedInAt: string | null; setupCompleteAt: string | null };
      if (data.ok) {
        onUpdate(data.checkedInAt, data.setupCompleteAt);
        toast.success(field === "checked_in"
          ? (data.checkedInAt ? "Marked as arrived." : "Arrival status cleared.")
          : (data.setupCompleteAt ? "Setup complete!" : "Setup status cleared."));
      } else {
        toast.error("Could not update status.");
      }
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setLoading(null);
    }
  }

  const checkedIn  = !!event.checkedInAt;
  const setupDone  = !!event.setupCompleteAt;
  const du = daysUntil(event.eventDate);
  const isToday = du === 0;

  return (
    <div className={`rounded-xl border-2 overflow-hidden ${isToday ? "border-primary" : "border-border"}`}>
      {isToday && (
        <div className="px-4 py-2 text-center text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground">
          Today's Event — Check In
        </div>
      )}
      <div className={`p-4 space-y-3 ${isToday ? "bg-muted/30" : "bg-card"}`}>
        <div className="grid grid-cols-2 gap-3">
          <button type="button"
            onClick={() => toggle("checked_in")}
            disabled={!!loading}
            aria-label={checkedIn ? "Clear arrival status" : "Mark yourself as arrived"}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all disabled:opacity-60 ${
              checkedIn ? "border-success bg-success/5" : "border-border bg-card"
            }`}>
            {loading === "checked_in"
              ? <Loader2 className="h-7 w-7 animate-spin" style={{ color: GREEN }} />
              : checkedIn
                ? <CheckCircle className="h-7 w-7" style={{ color: GREEN }} />
                : <Circle className="h-7 w-7 text-muted-foreground/30" />}
            <span className="text-sm font-semibold" style={{ color: checkedIn ? GREEN : undefined }}>
              {checkedIn ? "Arrived ✓" : "I've Arrived"}
            </span>
          </button>
          <button type="button"
            onClick={() => toggle("setup_complete")}
            disabled={!!loading}
            aria-label={setupDone ? "Clear setup status" : "Mark setup as complete"}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all disabled:opacity-60 ${
              setupDone ? "border-success bg-success/5" : "border-border bg-card"
            }`}>
            {loading === "setup_complete"
              ? <Loader2 className="h-7 w-7 animate-spin" style={{ color: GREEN }} />
              : setupDone
                ? <CheckCircle className="h-7 w-7" style={{ color: GREEN }} />
                : <Circle className="h-7 w-7 text-muted-foreground/30" />}
            <span className="text-sm font-semibold" style={{ color: setupDone ? GREEN : undefined }}>
              {setupDone ? "Setup Done ✓" : "Setup Complete"}
            </span>
          </button>
        </div>
        {checkedIn && setupDone && (
          <p className="text-xs text-center font-medium py-1 text-success">
            You're all set. The venue coordinator has been notified.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Arrival Info Card ─────────────────────────────────────────────────────────

function ArrivalCard({ event }: { event: VendorEvent }) {
  if (!event.arrivalTime && !event.setupLocation && !event.loadInNotes) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Your Arrival Details
      </p>
      <div className="space-y-2">
        {event.arrivalTime && (
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
            <div>
              <p className="text-[10px] text-muted-foreground">Arrival time</p>
              <p className="text-sm font-semibold" style={{ color: SLATE }}>{formatTime(event.arrivalTime)}</p>
            </div>
          </div>
        )}
        {event.setupLocation && (
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
            <div>
              <p className="text-[10px] text-muted-foreground">Setup location</p>
              <p className="text-sm font-semibold" style={{ color: SLATE }}>{event.setupLocation}</p>
            </div>
          </div>
        )}
        {event.loadInNotes && (
          <div className="flex items-start gap-2.5">
            <FileText className="h-4 w-4 shrink-0 mt-0.5" style={{ color: ACCENT }} />
            <div>
              <p className="text-[10px] text-muted-foreground">Load-in instructions</p>
              <p className="text-sm leading-relaxed" style={{ color: MID }}>{event.loadInNotes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dashboard Section ─────────────────────────────────────────────────────────

function DashboardSection({
  token, context, onNavigate, onSelectEvent,
}: {
  token: string;
  context: VendorPortalContext;
  onNavigate: (s: VendorSection) => void;
  onSelectEvent: (e: VendorEvent) => void;
}) {
  const [events, setEvents] = React.useState(context.events);

  function handleCheckinUpdate(
    eventId: string,
    checkedInAt: string | null,
    setupCompleteAt: string | null,
  ) {
    setEvents(prev => prev.map(e =>
      e.eventId === eventId ? { ...e, checkedInAt, setupCompleteAt } : e
    ));
  }

  const upcoming = events
    .filter(e => e.status !== "cancelled")
    .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold" style={{ color: SLATE }}>
          Welcome, {context.vendor.businessName}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: MID }}>
          Your assignments at {context.venue.name}.
        </p>
      </div>

      {upcoming.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium" style={{ color: SLATE }}>No upcoming events</p>
          <p className="text-xs mt-1 text-muted-foreground">
            You'll see your assignments here when the venue adds them.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {upcoming.map(ev => {
            const du = daysUntil(ev.eventDate);
            const isToday    = du === 0;
            const isTomorrow = du === 1;
            const showCheckin = du <= 1 && du >= 0;

            return (
              <div key={ev.eventId} className="space-y-3">
                {/* Event header card */}
                <div className={`rounded-xl border-2 overflow-hidden ${isToday ? "border-primary" : "border-border"}`}>
                  {isToday && (
                    <div className="px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-widest bg-primary text-primary-foreground">
                      Today
                    </div>
                  )}
                  {isTomorrow && (
                    <div className="px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-widest bg-warning/20 text-warning-foreground">
                      Tomorrow
                    </div>
                  )}
                  <div className="p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-foreground">
                          {ev.coupleNames || ev.eventName}
                        </p>
                        <p className="text-sm mt-0.5 text-muted-foreground">{formatDate(ev.eventDate)}</p>
                      </div>
                      {!isToday && !isTomorrow && (
                        <div className="text-right shrink-0">
                          <p className={`text-xl font-bold ${du <= 7 ? "text-destructive" : du <= 30 ? "text-warning-foreground" : "text-primary"}`}>
                            {du}
                          </p>
                          <p className="text-[10px] text-muted-foreground">days away</p>
                        </div>
                      )}
                    </div>

                    {/* Arrival info inline */}
                    {(ev.arrivalTime || ev.setupLocation) && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {ev.arrivalTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-primary" />
                            Arrive {formatTime(ev.arrivalTime)}
                          </span>
                        )}
                        {ev.setupLocation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-primary" />
                            {ev.setupLocation}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Nav shortcuts */}
                    <div className="flex items-center gap-2 pt-1">
                      <button type="button"
                        onClick={() => { onSelectEvent(ev); onNavigate("timeline"); }}
                        className="flex-1 text-center text-xs font-semibold rounded-lg py-2 border border-border text-primary transition-colors hover:bg-muted/20">
                        Timeline
                      </button>
                      <button type="button"
                        onClick={() => { onSelectEvent(ev); onNavigate("tasks"); }}
                        className="flex-1 text-center text-xs font-semibold rounded-lg py-2 border border-border text-primary transition-colors hover:bg-muted/20">
                        Tasks
                      </button>
                      <button type="button"
                        onClick={() => { onSelectEvent(ev); onNavigate("documents"); }}
                        className="flex-1 text-center text-xs font-semibold rounded-lg py-2 border border-border text-primary transition-colors hover:bg-muted/20">
                        Docs
                      </button>
                    </div>
                  </div>
                </div>

                {/* Check-In Station */}
                {showCheckin && (
                  <CheckInStation
                    event={ev}
                    token={token}
                    onUpdate={(ci, sc) => handleCheckinUpdate(ev.eventId, ci, sc)}
                  />
                )}

                {/* Arrival details card (for non-today events) */}
                {!showCheckin && <ArrivalCard event={ev} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Timeline Section ──────────────────────────────────────────────────────────

function TimelineSection({ token, event }: { token: string; event: VendorEvent | null }) {
  const [entries, setEntries] = React.useState<VendorTimelineEntry[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!event) return;
    setLoading(true);
    fetch(`/api/vendor/timeline?token=${token}&eventId=${event.eventId}`)
      .then(r => r.json())
      .then((d: { entries?: VendorTimelineEntry[] }) => setEntries(d.entries ?? []))
      .finally(() => setLoading(false));
  }, [token, event?.eventId]);

  if (!event) return <EmptyEventPrompt />;

  return (
    <div className="space-y-4">
      <EventHeader event={event} label="Day-of Timeline" />
      {loading ? <LoadingSpinner /> : entries.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />}
          title="No timeline items yet"
          body="The coordinator will mark timeline entries as vendor-relevant as the event approaches."
        />
      ) : (
        <div className="space-y-0">
          {entries.map((e, i) => (
            <div key={e.id} className="flex gap-4 items-start">
              <div className="flex flex-col items-center shrink-0 w-16">
                <p className="text-xs font-semibold text-primary">
                  {e.time ? formatTime(e.time) : "—"}
                </p>
                {i < entries.length - 1 && (
                  <div className="w-px flex-1 mt-1 min-h-[24px] bg-border" />
                )}
              </div>
              <div className="pb-4 flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{e.title}</p>
                {e.description && (
                  <p className="text-xs mt-0.5 leading-relaxed text-muted-foreground">{e.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tasks Section ─────────────────────────────────────────────────────────────

function TasksSection({ token, event }: { token: string; event: VendorEvent | null }) {
  const [tasks, setTasks]       = React.useState<VendorTask[]>([]);
  const [loading, setLoading]   = React.useState(false);
  const [completing, setCompleting] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!event) return;
    setLoading(true);
    fetch(`/api/vendor/tasks?token=${token}&eventId=${event.eventId}`)
      .then(r => r.json())
      .then((d: { tasks?: VendorTask[] }) => setTasks(d.tasks ?? []))
      .finally(() => setLoading(false));
  }, [token, event?.eventId]);

  async function handleComplete(taskId: string) {
    setCompleting(taskId);
    const res = await fetch("/api/vendor/complete-task", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, taskId }),
    });
    const data = await res.json() as { ok: boolean };
    setCompleting(null);
    if (data.ok) {
      setTasks(p => p.map(t => t.id === taskId ? { ...t, status: "complete", canComplete: false } : t));
      toast.success("Task marked complete.");
    } else {
      toast.error("Could not complete task.");
    }
  }

  if (!event) return <EmptyEventPrompt />;

  const actionNeeded = tasks.filter(t => t.canComplete && t.status !== "complete");
  const tracking     = tasks.filter(t => !t.canComplete && t.status !== "complete" && t.status !== "waived");
  const done         = tasks.filter(t => t.status === "complete");

  return (
    <div className="space-y-4">
      <EventHeader event={event} label="Your Tasks" />
      {loading ? <LoadingSpinner /> : tasks.length === 0 ? (
        <EmptyState
          icon={<Check className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />}
          title="No tasks assigned yet"
          body="Tasks assigned to vendors will appear here."
        />
      ) : (
        <div className="space-y-4">
          {actionNeeded.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 text-destructive">
                Needs your action ({actionNeeded.length})
              </p>
              <div className="space-y-2">
                {actionNeeded.map(t => (
                  <div key={t.id}
                    className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      {t.description && <p className="text-xs mt-0.5 text-muted-foreground">{t.description}</p>}
                      {t.dueDate && <p className="text-xs mt-1 text-muted-foreground">Due {formatDateShort(t.dueDate)}</p>}
                    </div>
                    <button type="button"
                      onClick={() => handleComplete(t.id)}
                      disabled={completing === t.id}
                      aria-label={`Mark "${t.title}" as done`}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-60 min-h-[36px]">
                      {completing === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Done"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tracking.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
                In Progress
              </p>
              <div className="space-y-2">
                {tracking.map(t => (
                  <div key={t.id}
                    className="flex items-start gap-3 rounded-xl border border-border p-3.5">
                    <Clock className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      {t.dueDate && <p className="text-xs mt-0.5 text-muted-foreground">Due {formatDateShort(t.dueDate)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
                Completed ({done.length})
              </p>
              <div className="space-y-1.5">
                {done.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-muted/30">
                    <CheckCircle className="h-4 w-4 shrink-0 text-success" />
                    <p className="text-sm line-through text-muted-foreground">{t.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Documents Section ─────────────────────────────────────────────────────────

function DocumentsSection({ token, event }: { token: string; event: VendorEvent | null }) {
  const [docs, setDocs]       = React.useState<VendorDocument[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!event) return;
    setLoading(true);
    fetch(`/api/vendor/documents?token=${token}&eventId=${event.eventId}`)
      .then(r => r.json())
      .then((d: { documents?: VendorDocument[] }) => setDocs(d.documents ?? []))
      .finally(() => setLoading(false));
  }, [token, event?.eventId]);

  if (!event) return <EmptyEventPrompt />;

  return (
    <div className="space-y-4">
      <EventHeader event={event} label="Shared Documents" />
      {loading ? <LoadingSpinner /> : docs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />}
          title="No documents shared yet"
          body="The venue will share floor plans, menus, and other event documents here."
        />
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <a key={doc.id}
              href={doc.storageUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${doc.name}`}
              className="flex items-center gap-3 p-3.5 rounded-xl border border-border transition-colors hover:bg-muted/20">
              <span className="text-xl shrink-0">{docIcon(doc.category)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-foreground">{doc.name}</p>
                {doc.notes && <p className="text-xs truncate text-muted-foreground">{doc.notes}</p>}
              </div>
              <span className="text-xs font-medium shrink-0 text-primary">Open →</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function EventHeader({ event, label }: { event: VendorEvent; label: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5 text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{event.coupleNames || event.eventName}</p>
      <p className="text-sm text-muted-foreground">{formatDate(event.eventDate)}</p>
    </div>
  );
}

function EmptyEventPrompt() {
  return (
    <p className="text-sm py-8 text-center text-muted-foreground">
      Select an event from the dashboard.
    </p>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-10 text-center">
      {icon}
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs mt-1 max-w-[240px] mx-auto leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

// ── Navigation ────────────────────────────────────────────────────────────────

const NAV: { id: VendorSection; icon: React.ElementType; label: string }[] = [
  { id: "dashboard",  icon: CalendarDays,  label: "Events" },
  { id: "timeline",   icon: Clock,         label: "Timeline" },
  { id: "tasks",      icon: Check,         label: "Tasks" },
  { id: "documents",  icon: FileText,      label: "Documents" },
  { id: "messages",   icon: MessageCircle, label: "Messages" },
];

// ── Shell ─────────────────────────────────────────────────────────────────────

export function VendorPortalShell({ token, context }: { token: string; context: VendorPortalContext }) {
  const [section, setSection] = React.useState<VendorSection>("dashboard");
  const [selectedEvent, setSelectedEvent] = React.useState<VendorEvent | null>(
    context.events.length === 1 ? context.events[0] : null
  );

  return (
    <div className="min-h-screen flex flex-col bg-muted">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {context.venue.name}
          </p>
          <p className="text-base font-semibold leading-tight text-foreground">
            {context.vendor.businessName}
          </p>
        </div>
        {/* Nav */}
        <div className="max-w-lg mx-auto flex border-t border-border">
          {NAV.map(item => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setSection(item.id)}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors border-b-2 ${
                  isActive
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}>
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5">
        {section === "dashboard" && (
          <DashboardSection
            token={token}
            context={context}
            onNavigate={setSection}
            onSelectEvent={setSelectedEvent}
          />
        )}
        {section === "timeline"  && <TimelineSection token={token} event={selectedEvent} />}
        {section === "tasks"     && <TasksSection    token={token} event={selectedEvent} />}
        {section === "documents" && <DocumentsSection token={token} event={selectedEvent} />}
        {section === "messages"  && (
          <div className="py-10 text-center space-y-2">
            <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Messages coming soon</p>
            <p className="text-xs text-muted-foreground">
              Contact {context.venue.name} directly in the meantime.
            </p>
          </div>
        )}
      </main>

      <footer className="text-center py-3 text-[10px] text-muted-foreground/60">
        Powered by Wevenu · {context.venue.name}
      </footer>
    </div>
  );
}
