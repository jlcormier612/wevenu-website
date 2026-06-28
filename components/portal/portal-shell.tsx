"use client";

/**
 * PortalShell — the couple's wedding workspace.
 *
 * Design principles:
 *   • No coordinator sidebar — this is their space, not a client view of ours
 *   • Mobile-first — couples plan on phones
 *   • Venue-branded header — logo, venue name, Heritage Sage palette
 *   • Warm and personal — their names, their event, their workspace
 *   • Architecture assumes: Tasks, Payments, Documents, Messages, Timeline, Luv
 *     Each section is stubbed so the navigation shell is already correct
 */

import * as React from "react";

import { Check, Clock, Lock, AlertTriangle, ChevronRight, CalendarDays, ListChecks, CreditCard, FileText, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { PortalContext, PortalSection, PortalTask } from "@/lib/portal/types";

const SAGE = "#5D6F5D";
const SAGE_SOFT = "#B9D1C2";
const LINEN = "#F7F5F1";
const TAUPE = "#B8AEA1";
const ROSE = "#D8A7AA";
const CREAM = "#F5F4F2";

const NAV_ITEMS: { id: PortalSection; label: string; icon: React.ElementType; available: boolean }[] = [
  { id: "overview",   label: "Overview",   icon: CalendarDays,   available: true },
  { id: "tasks",      label: "Tasks",       icon: ListChecks,     available: true },
  { id: "payments",   label: "Payments",    icon: CreditCard,     available: false },
  { id: "documents",  label: "Documents",   icon: FileText,       available: false },
  { id: "messages",   label: "Messages",    icon: MessageCircle,  available: false },
];

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function ReadinessRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={CREAM} strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={SAGE} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize={14} fontWeight={600} fill={SAGE}>{score}%</text>
    </svg>
  );
}

// ---- Overview Section -------------------------------------------------------

function OverviewSection({ context, tasks }: { context: PortalContext; tasks: PortalTask[] }) {
  const du = context.event ? daysUntil(context.event.eventDate) : null;
  const required = tasks.filter((t) => t.isRequired);
  const completed = required.filter((t) => t.status === "complete").length;
  const score = required.length > 0 ? Math.round((completed / required.length) * 100) : 0;
  const actionNeeded = tasks.filter((t) => t.canComplete && t.status !== "complete");
  const upcoming = tasks.filter((t) => t.status !== "complete").slice(0, 3);

  const coupleName = [context.client.firstName, context.client.partnerFirstName].filter(Boolean).join(" & ");

  return (
    <div className="space-y-5">
      {/* Event hero */}
      {context.event ? (
        <div className="rounded-2xl overflow-hidden" style={{ background: `linear-gradient(135deg, ${SAGE} 0%, #4F5F4F 100%)` }}>
          <div className="px-6 py-6 text-white space-y-1">
            <p className="text-sm opacity-75">{context.venue.name}</p>
            <h2 className="text-2xl font-semibold tracking-tight">{coupleName}</h2>
            <p className="text-sm opacity-80">{context.event.eventType?.replace(/_/g, " ") ?? "Wedding"}</p>
          </div>
          <div className="bg-white/10 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/60 text-xs">Event date</p>
              <p className="text-white font-medium text-sm">{formatDate(context.event.eventDate)}</p>
            </div>
            {du !== null && (
              <div className="text-right">
                <p className="text-white text-2xl font-bold">{Math.abs(du)}</p>
                <p className="text-white/60 text-xs">{du >= 0 ? "days away" : "days ago"}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-card border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No upcoming event found. Contact your venue coordinator.</p>
        </div>
      )}

      {/* Planning progress */}
      {required.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <ReadinessRing score={score} />
            <div className="flex-1">
              <p className="font-semibold text-heading">Event Readiness</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {completed} of {required.length} planning steps complete
              </p>
              {actionNeeded.length > 0 && (
                <p className="text-xs mt-1.5" style={{ color: ROSE }}>
                  {actionNeeded.length} item{actionNeeded.length !== 1 ? "s" : ""} need your attention
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* What's next */}
      {upcoming.length > 0 && (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border/50">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What's next</p>
          </div>
          {upcoming.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-heading truncate">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {t.canComplete ? " · Your action needed" : ""}
                </p>
              </div>
              {t.canComplete && <ChevronRight className="shrink-0 h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Tasks Section ----------------------------------------------------------

function TaskStatusIcon({ status }: { status: PortalTask["status"] }) {
  if (status === "complete") return <Check className="h-4 w-4" style={{ color: SAGE }} />;
  if (status === "blocked")  return <Lock className="h-4 w-4" style={{ color: TAUPE }} />;
  if (status === "overdue")  return <AlertTriangle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4" style={{ color: TAUPE }} />;
}

function TasksSection({ token, initialTasks }: { token: string; initialTasks: PortalTask[] }) {
  const [tasks, setTasks] = React.useState(initialTasks);
  const [completing, setCompleting] = React.useState<string | null>(null);

  const actionNeeded = tasks.filter((t) => t.canComplete && t.status !== "complete" && t.status !== "blocked");
  const inProgress   = tasks.filter((t) => !t.canComplete && t.status !== "complete" && t.status !== "blocked");
  const done         = tasks.filter((t) => t.status === "complete");

  async function handleComplete(taskId: string) {
    setCompleting(taskId);
    const res = await fetch(`/api/portal/complete-task`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, taskId }),
    });
    const json = await res.json();
    setCompleting(null);
    if (json.ok) {
      setTasks((p) => p.map((t) => t.id === taskId ? { ...t, status: "complete", canComplete: false } : t));
      toast.success("Task marked complete.");
    } else {
      toast.error("Could not complete task. Please try again.");
    }
  }

  const TaskGroup = ({ label, groupTasks }: { label: string; groupTasks: PortalTask[] }) => {
    if (!groupTasks.length) return null;
    return (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: TAUPE }}>{label}</p>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border/50">
          {groupTasks.map((t) => (
            <div key={t.id} className="px-4 py-4 flex items-start gap-3">
              <div className="shrink-0 mt-0.5"><TaskStatusIcon status={t.status} /></div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${t.status === "complete" ? "text-muted-foreground line-through" : "text-heading"}`}>
                  {t.title}
                </p>
                {t.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.description}</p>}
                <p className="text-xs mt-1" style={{ color: TAUPE }}>
                  Due {new Date(t.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                </p>
              </div>
              {t.canComplete && t.status !== "complete" && (
                <button type="button" onClick={() => handleComplete(t.id)} disabled={completing === t.id}
                  className="shrink-0 mt-0.5 h-8 px-3 rounded-xl text-xs font-semibold transition-colors"
                  style={{ background: SAGE, color: "white", opacity: completing === t.id ? 0.7 : 1 }}>
                  {completing === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Done"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!tasks.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center px-6">
        <p className="text-sm font-medium text-heading">Your planning tasks will appear here.</p>
        <p className="text-xs text-muted-foreground mt-1">Your venue coordinator is setting this up for you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TaskGroup label="Your action needed" groupTasks={actionNeeded} />
      <TaskGroup label="In progress" groupTasks={inProgress} />
      <TaskGroup label="Completed" groupTasks={done} />
    </div>
  );
}

// ---- Coming Soon placeholder ------------------------------------------------

function ComingSoonSection({ section }: { section: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-16 text-center px-6">
      <p className="text-2xl mb-3">💗</p>
      <p className="text-sm font-medium text-heading capitalize">{section} coming soon</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
        Your coordinator will share access when this section is ready.
      </p>
    </div>
  );
}

// ---- Shell ------------------------------------------------------------------

export function PortalShell({ token, context, initialTasks }: { token: string; context: PortalContext; initialTasks: PortalTask[] }) {
  const [activeSection, setActiveSection] = React.useState<PortalSection>("overview");
  const coupleName = [context.client.firstName, context.client.partnerFirstName].filter(Boolean).join(" & ");
  const actionCount = initialTasks.filter((t) => t.canComplete && t.status !== "complete").length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: LINEN }}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#DED6CA]" style={{ background: "white" }}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs" style={{ color: SAGE }}>{context.venue.name}</p>
            <p className="text-sm font-semibold text-heading leading-tight">{coupleName}</p>
          </div>
          {context.event && (
            <div className="text-right">
              <p className="text-xs" style={{ color: TAUPE }}>
                {new Date(context.event.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          )}
        </div>

        {/* Tab nav */}
        <div className="max-w-lg mx-auto flex overflow-x-auto scrollbar-hide">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const badge = item.id === "tasks" && actionCount > 0 ? actionCount : 0;
            return (
              <button key={item.id} type="button"
                onClick={() => item.available && setActiveSection(item.id)}
                className="relative flex-shrink-0 flex flex-col items-center gap-1 px-4 pt-2 pb-2 text-[11px] font-medium transition-colors"
                style={{
                  color: isActive ? SAGE : TAUPE,
                  borderBottom: isActive ? `2px solid ${SAGE}` : "2px solid transparent",
                  opacity: !item.available ? 0.5 : 1,
                }}>
                <Icon className="h-4 w-4" />
                {item.label}
                {badge > 0 && (
                  <span className="absolute top-1 right-2.5 h-4 w-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                    style={{ background: ROSE }}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        {activeSection === "overview"  && <OverviewSection context={context} tasks={initialTasks} />}
        {activeSection === "tasks"     && <TasksSection token={token} initialTasks={initialTasks} />}
        {activeSection === "payments"  && <ComingSoonSection section="payments" />}
        {activeSection === "documents" && <ComingSoonSection section="documents" />}
        {activeSection === "messages"  && <ComingSoonSection section="messages" />}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-[10px]" style={{ color: TAUPE }}>
        Powered by Wevenu · {context.venue.name}
      </footer>
    </div>
  );
}
