"use client";

/**
 * VendorPortalShell — vendor's dedicated workspace.
 *
 * Design: professional, clean, action-oriented.
 * Answers ONE question: "What do I need to do for this event?"
 *
 * Different from the couple portal (warm, celebratory) —
 * vendors are professionals who need clarity and efficiency.
 */

import * as React from "react";
import { AlertTriangle, CalendarDays, Check, Clock, FileText, Loader2, Lock, MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import type { VendorEvent, VendorPortalContext, VendorTask, VendorTimelineEntry } from "@/lib/vendor-portal/types";

const SLATE = "#1A1A1A";
const MID   = "#555";
const LIGHT = "#F5F4F2";
const BORDER = "#E5E5E5";
const ACCENT = "#2C3E6B";  // professional navy for vendor portal

type VendorSection = "dashboard" | "timeline" | "tasks" | "documents" | "messages";

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function daysUntil(iso: string) {
  return Math.ceil((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000);
}
function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function DashboardSection({ context, onNavigate, onSelectEvent }: {
  context: VendorPortalContext;
  onNavigate: (s: VendorSection) => void;
  onSelectEvent: (e: VendorEvent) => void;
}) {
  const upcoming = context.events.filter(e => e.status !== "cancelled").sort(
    (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold" style={{ color: SLATE }}>
          Welcome back, {context.vendor.name}!
        </h2>
        <p className="text-sm mt-0.5" style={{ color: MID }}>
          Here's what's on your schedule at {context.venue.name}.
        </p>
      </div>

      {upcoming.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center" style={{ borderColor: BORDER }}>
          <CalendarDays className="h-8 w-8 mx-auto mb-2" style={{ color: "#999" }} />
          <p className="text-sm font-medium" style={{ color: SLATE }}>No upcoming events</p>
          <p className="text-xs mt-1" style={{ color: "#999" }}>You'll see your assignments here when the venue adds them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map(ev => {
            const du = daysUntil(ev.eventDate);
            return (
              <button key={ev.eventId} type="button" onClick={() => { onSelectEvent(ev); onNavigate("timeline"); }}
                className="w-full text-left rounded-xl border p-4 hover:bg-[#F9F9F9] transition-colors"
                style={{ borderColor: BORDER }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: SLATE }}>{ev.coupleNames || ev.eventName}</p>
                    <p className="text-xs mt-0.5" style={{ color: MID }}>{formatDate(ev.eventDate)}</p>
                    {ev.role && <p className="text-xs mt-0.5" style={{ color: "#888" }}>Role: {ev.role}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold" style={{ color: du <= 7 ? "#C0392B" : du <= 30 ? "#C7A66A" : ACCENT }}>{du}</p>
                    <p className="text-[10px]" style={{ color: "#999" }}>days away</p>
                  </div>
                </div>
                <div className="mt-2 text-[11px] font-medium" style={{ color: ACCENT }}>
                  View timeline & tasks →
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

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

  if (!event) return <p className="text-sm py-8 text-center" style={{ color: MID }}>Select an event from the dashboard.</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#999" }}>Day-of Timeline</p>
        <p className="font-semibold" style={{ color: SLATE }}>{event.coupleNames || event.eventName}</p>
        <p className="text-sm" style={{ color: MID }}>{formatDate(event.eventDate)}</p>
      </div>
      {loading ? <p className="text-sm py-6 text-center" style={{ color: MID }}>Loading timeline…</p>
      : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed py-10 text-center" style={{ borderColor: BORDER }}>
          <p className="text-sm" style={{ color: "#999" }}>No timeline items marked for vendors yet.</p>
          <p className="text-xs mt-1" style={{ color: "#aaa" }}>The coordinator will update your schedule as the event approaches.</p>
        </div>
      ) : (
        <div className="space-y-0">
          {entries.map((e, i) => (
            <div key={e.id} className="flex gap-4 items-start">
              <div className="flex flex-col items-center shrink-0 w-16">
                <p className="text-xs font-semibold" style={{ color: ACCENT }}>{e.time ? formatTime(e.time) : "—"}</p>
                {i < entries.length - 1 && <div className="w-px flex-1 mt-1 min-h-[24px]" style={{ background: BORDER }} />}
              </div>
              <div className="pb-4 flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: SLATE }}>{e.title}</p>
                {e.description && <p className="text-xs mt-0.5" style={{ color: MID }}>{e.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

function TasksSection({ token, event }: { token: string; event: VendorEvent | null }) {
  const [tasks, setTasks] = React.useState<VendorTask[]>([]);
  const [loading, setLoading] = React.useState(false);
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
    } else toast.error("Could not complete task.");
  }

  if (!event) return <p className="text-sm py-8 text-center" style={{ color: MID }}>Select an event from the dashboard.</p>;

  const actionNeeded = tasks.filter(t => t.canComplete && t.status !== "complete");
  const tracking = tasks.filter(t => !t.canComplete && t.status !== "complete" && t.status !== "waived");
  const done = tasks.filter(t => t.status === "complete");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#999" }}>Your Tasks</p>
        <p className="font-semibold" style={{ color: SLATE }}>{event.coupleNames || event.eventName}</p>
      </div>
      {loading ? <p className="text-sm py-6 text-center" style={{ color: MID }}>Loading tasks…</p>
      : tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed py-10 text-center" style={{ borderColor: BORDER }}>
          <p className="text-sm" style={{ color: "#999" }}>No tasks assigned to you yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {actionNeeded.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#C0392B" }}>
                Needs your action ({actionNeeded.length})
              </p>
              <div className="space-y-2">
                {actionNeeded.map(t => (
                  <div key={t.id} className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: "#C0392B30", background: "#FFF8F8" }}>
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#C0392B" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: SLATE }}>{t.title}</p>
                      {t.description && <p className="text-xs mt-0.5" style={{ color: MID }}>{t.description}</p>}
                      {t.dueDate && <p className="text-xs mt-1" style={{ color: "#888" }}>Due {formatDate(t.dueDate)}</p>}
                    </div>
                    <button type="button" onClick={() => handleComplete(t.id)} disabled={completing === t.id}
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
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#999" }}>In Progress</p>
              <div className="space-y-2">
                {tracking.map(t => (
                  <div key={t.id} className="flex items-start gap-3 rounded-xl border p-3.5" style={{ borderColor: BORDER }}>
                    <Clock className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#999" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: SLATE }}>{t.title}</p>
                      {t.dueDate && <p className="text-xs mt-0.5" style={{ color: "#888" }}>Due {formatDate(t.dueDate)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {done.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#999" }}>Completed</p>
              <div className="space-y-1.5">
                {done.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: "#F9F9F9" }}>
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
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

// ── Documents ─────────────────────────────────────────────────────────────────

function DocumentsSection() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#999" }}>Documents</p>
        <p className="font-semibold" style={{ color: SLATE }}>Required Documents</p>
      </div>
      <div className="rounded-xl border border-dashed py-10 text-center" style={{ borderColor: BORDER }}>
        <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: "#999" }} />
        <p className="text-sm font-medium" style={{ color: SLATE }}>Document management coming soon</p>
        <p className="text-xs mt-1" style={{ color: "#999" }}>
          Upload COIs, licenses, and required files when this feature is ready.
        </p>
      </div>
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

const NAV: { id: VendorSection; icon: React.ElementType; label: string }[] = [
  { id: "dashboard",  icon: CalendarDays,    label: "Events" },
  { id: "timeline",   icon: Clock,           label: "Timeline" },
  { id: "tasks",      icon: Check,           label: "Tasks" },
  { id: "documents",  icon: FileText,        label: "Documents" },
  { id: "messages",   icon: MessageCircle,   label: "Messages" },
];

export function VendorPortalShell({ token, context }: { token: string; context: VendorPortalContext }) {
  const [section, setSection] = React.useState<VendorSection>("dashboard");
  const [selectedEvent, setSelectedEvent] = React.useState<VendorEvent | null>(
    context.events.length === 1 ? context.events[0] : null
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: LIGHT }}>
      {/* Header */}
      <header className="bg-white border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-lg mx-auto px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#999" }}>{context.venue.name}</p>
          <p className="text-base font-semibold leading-tight" style={{ color: SLATE }}>{context.vendor.name}</p>
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
          <DashboardSection context={context} onNavigate={setSection} onSelectEvent={setSelectedEvent} />
        )}
        {section === "timeline"  && <TimelineSection token={token} event={selectedEvent} />}
        {section === "tasks"     && <TasksSection token={token} event={selectedEvent} />}
        {section === "documents" && <DocumentsSection />}
        {section === "messages"  && (
          <div className="py-10 text-center space-y-2">
            <MessageCircle className="h-8 w-8 mx-auto" style={{ color: "#999" }} />
            <p className="text-sm font-medium" style={{ color: SLATE }}>Messages coming soon</p>
            <p className="text-xs" style={{ color: "#999" }}>Contact {context.venue.name} directly in the meantime.</p>
          </div>
        )}
      </main>

      <footer className="text-center py-3 text-[10px]" style={{ color: "#bbb" }}>
        Powered by Wevenu · {context.venue.name}
      </footer>
    </div>
  );
}
