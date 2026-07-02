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

// ── Palette ───────────────────────────────────────────────────────────────────

const SLATE  = "#1A1A1A";
const MID    = "#555";
const LIGHT  = "#F5F4F2";
const BORDER = "#E5E5E5";
const ACCENT = "#2C3E6B";  // professional navy
const GREEN  = "#3D6B4F";

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
    <div className="rounded-xl border-2 overflow-hidden"
      style={{ borderColor: isToday ? ACCENT : BORDER }}>
      {isToday && (
        <div className="px-4 py-2 text-center text-xs font-bold uppercase tracking-widest text-white"
          style={{ background: ACCENT }}>
          Today's Event — Check In
        </div>
      )}
      <div className="p-4 space-y-3" style={{ background: isToday ? "#F8F9FC" : "#FAFAFA" }}>
        <div className="grid grid-cols-2 gap-3">
          <button type="button"
            onClick={() => toggle("checked_in")}
            disabled={!!loading}
            className="flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all disabled:opacity-60"
            style={checkedIn
              ? { borderColor: GREEN, background: `${GREEN}10` }
              : { borderColor: BORDER, background: "white" }}>
            {loading === "checked_in"
              ? <Loader2 className="h-7 w-7 animate-spin" style={{ color: GREEN }} />
              : checkedIn
                ? <CheckCircle className="h-7 w-7" style={{ color: GREEN }} />
                : <Circle className="h-7 w-7" style={{ color: "#CCC" }} />}
            <span className="text-sm font-semibold" style={{ color: checkedIn ? GREEN : SLATE }}>
              {checkedIn ? "Arrived ✓" : "I've Arrived"}
            </span>
          </button>
          <button type="button"
            onClick={() => toggle("setup_complete")}
            disabled={!!loading}
            className="flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all disabled:opacity-60"
            style={setupDone
              ? { borderColor: GREEN, background: `${GREEN}10` }
              : { borderColor: BORDER, background: "white" }}>
            {loading === "setup_complete"
              ? <Loader2 className="h-7 w-7 animate-spin" style={{ color: GREEN }} />
              : setupDone
                ? <CheckCircle className="h-7 w-7" style={{ color: GREEN }} />
                : <Circle className="h-7 w-7" style={{ color: "#CCC" }} />}
            <span className="text-sm font-semibold" style={{ color: setupDone ? GREEN : SLATE }}>
              {setupDone ? "Setup Done ✓" : "Setup Complete"}
            </span>
          </button>
        </div>
        {checkedIn && setupDone && (
          <p className="text-xs text-center font-medium py-1" style={{ color: GREEN }}>
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
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: BORDER, background: "#FAFAFA" }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#999" }}>
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
          Welcome, {context.vendor.name}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: MID }}>
          Your assignments at {context.venue.name}.
        </p>
      </div>

      {upcoming.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center" style={{ borderColor: BORDER }}>
          <CalendarDays className="h-8 w-8 mx-auto mb-2" style={{ color: "#999" }} />
          <p className="text-sm font-medium" style={{ color: SLATE }}>No upcoming events</p>
          <p className="text-xs mt-1" style={{ color: "#999" }}>
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
                <div className="rounded-xl border overflow-hidden"
                  style={{ borderColor: isToday ? ACCENT : BORDER }}>
                  {isToday && (
                    <div className="px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-widest text-white"
                      style={{ background: ACCENT }}>
                      Today
                    </div>
                  )}
                  {isTomorrow && (
                    <div className="px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-widest"
                      style={{ background: "#FFF8E6", color: "#B8860B" }}>
                      Tomorrow
                    </div>
                  )}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold" style={{ color: SLATE }}>
                          {ev.coupleNames || ev.eventName}
                        </p>
                        <p className="text-sm mt-0.5" style={{ color: MID }}>{formatDate(ev.eventDate)}</p>
                      </div>
                      {!isToday && !isTomorrow && (
                        <div className="text-right shrink-0">
                          <p className="text-xl font-bold"
                            style={{ color: du <= 7 ? "#C0392B" : du <= 30 ? "#C7A66A" : ACCENT }}>
                            {du}
                          </p>
                          <p className="text-[10px]" style={{ color: "#999" }}>days away</p>
                        </div>
                      )}
                    </div>

                    {/* Arrival info inline */}
                    {(ev.arrivalTime || ev.setupLocation) && (
                      <div className="flex flex-wrap gap-3 text-xs" style={{ color: MID }}>
                        {ev.arrivalTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" style={{ color: ACCENT }} />
                            Arrive {formatTime(ev.arrivalTime)}
                          </span>
                        )}
                        {ev.setupLocation && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" style={{ color: ACCENT }} />
                            {ev.setupLocation}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Nav shortcuts */}
                    <div className="flex items-center gap-2 pt-1">
                      <button type="button"
                        onClick={() => { onSelectEvent(ev); onNavigate("timeline"); }}
                        className="flex-1 text-center text-xs font-semibold rounded-lg py-1.5 border transition-colors hover:bg-muted/20"
                        style={{ borderColor: BORDER, color: ACCENT }}>
                        Timeline
                      </button>
                      <button type="button"
                        onClick={() => { onSelectEvent(ev); onNavigate("tasks"); }}
                        className="flex-1 text-center text-xs font-semibold rounded-lg py-1.5 border transition-colors hover:bg-muted/20"
                        style={{ borderColor: BORDER, color: ACCENT }}>
                        Tasks
                      </button>
                      <button type="button"
                        onClick={() => { onSelectEvent(ev); onNavigate("documents"); }}
                        className="flex-1 text-center text-xs font-semibold rounded-lg py-1.5 border transition-colors hover:bg-muted/20"
                        style={{ borderColor: BORDER, color: ACCENT }}>
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
          icon={<Clock className="h-7 w-7 mx-auto mb-2" style={{ color: "#999" }} />}
          title="No timeline items yet"
          body="The coordinator will mark timeline entries as vendor-relevant as the event approaches."
        />
      ) : (
        <div className="space-y-0">
          {entries.map((e, i) => (
            <div key={e.id} className="flex gap-4 items-start">
              <div className="flex flex-col items-center shrink-0 w-16">
                <p className="text-xs font-semibold" style={{ color: ACCENT }}>
                  {e.time ? formatTime(e.time) : "—"}
                </p>
                {i < entries.length - 1 && (
                  <div className="w-px flex-1 mt-1 min-h-[24px]" style={{ background: BORDER }} />
                )}
              </div>
              <div className="pb-4 flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: SLATE }}>{e.title}</p>
                {e.description && (
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: MID }}>{e.description}</p>
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
          icon={<Check className="h-7 w-7 mx-auto mb-2" style={{ color: "#999" }} />}
          title="No tasks assigned yet"
          body="Tasks assigned to vendors will appear here."
        />
      ) : (
        <div className="space-y-4">
          {actionNeeded.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#C0392B" }}>
                Needs your action ({actionNeeded.length})
              </p>
              <div className="space-y-2">
                {actionNeeded.map(t => (
                  <div key={t.id}
                    className="flex items-start gap-3 rounded-xl border p-4"
                    style={{ borderColor: "#C0392B30", background: "#FFF8F8" }}>
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#C0392B" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: SLATE }}>{t.title}</p>
                      {t.description && <p className="text-xs mt-0.5" style={{ color: MID }}>{t.description}</p>}
                      {t.dueDate && <p className="text-xs mt-1" style={{ color: "#888" }}>Due {formatDateShort(t.dueDate)}</p>}
                    </div>
                    <button type="button"
                      onClick={() => handleComplete(t.id)}
                      disabled={completing === t.id}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                      style={{ background: ACCENT }}>
                      {completing === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Done"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tracking.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#999" }}>
                In Progress
              </p>
              <div className="space-y-2">
                {tracking.map(t => (
                  <div key={t.id}
                    className="flex items-start gap-3 rounded-xl border p-3.5"
                    style={{ borderColor: BORDER }}>
                    <Clock className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#999" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: SLATE }}>{t.title}</p>
                      {t.dueDate && <p className="text-xs mt-0.5" style={{ color: "#888" }}>Due {formatDateShort(t.dueDate)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#999" }}>
                Completed ({done.length})
              </p>
              <div className="space-y-1.5">
                {done.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl" style={{ background: "#F5F5F5" }}>
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
                    <p className="text-sm line-through" style={{ color: "#999" }}>{t.title}</p>
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
          icon={<FileText className="h-7 w-7 mx-auto mb-2" style={{ color: "#999" }} />}
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
              className="flex items-center gap-3 p-3.5 rounded-xl border transition-colors hover:bg-muted/20"
              style={{ borderColor: BORDER }}>
              <span className="text-xl shrink-0">{docIcon(doc.category)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: SLATE }}>{doc.name}</p>
                {doc.notes && <p className="text-xs truncate" style={{ color: MID }}>{doc.notes}</p>}
              </div>
              <span className="text-xs font-medium shrink-0" style={{ color: ACCENT }}>Open →</span>
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
      <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#999" }}>{label}</p>
      <p className="font-semibold" style={{ color: SLATE }}>{event.coupleNames || event.eventName}</p>
      <p className="text-sm" style={{ color: MID }}>{formatDate(event.eventDate)}</p>
    </div>
  );
}

function EmptyEventPrompt() {
  return (
    <p className="text-sm py-8 text-center" style={{ color: MID }}>
      Select an event from the dashboard.
    </p>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#999" }} />
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed py-10 text-center" style={{ borderColor: BORDER }}>
      {icon}
      <p className="text-sm font-medium" style={{ color: SLATE }}>{title}</p>
      <p className="text-xs mt-1 max-w-[240px] mx-auto leading-relaxed" style={{ color: "#999" }}>{body}</p>
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
    <div className="min-h-screen flex flex-col" style={{ background: LIGHT }}>
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10" style={{ borderColor: BORDER }}>
        <div className="max-w-lg mx-auto px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#999" }}>
            {context.venue.name}
          </p>
          <p className="text-base font-semibold leading-tight" style={{ color: SLATE }}>
            {context.vendor.name}
          </p>
        </div>
        {/* Nav */}
        <div className="max-w-lg mx-auto flex border-t" style={{ borderColor: BORDER }}>
          {NAV.map(item => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setSection(item.id)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors"
                style={{
                  color: isActive ? ACCENT : "#999",
                  borderBottom: isActive ? `2px solid ${ACCENT}` : "2px solid transparent",
                }}>
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
            <MessageCircle className="h-8 w-8 mx-auto" style={{ color: "#999" }} />
            <p className="text-sm font-medium" style={{ color: SLATE }}>Messages coming soon</p>
            <p className="text-xs" style={{ color: "#999" }}>
              Contact {context.venue.name} directly in the meantime.
            </p>
          </div>
        )}
      </main>

      <footer className="text-center py-3 text-[10px]" style={{ color: "#bbb" }}>
        Powered by Wevenu · {context.venue.name}
      </footer>
    </div>
  );
}
