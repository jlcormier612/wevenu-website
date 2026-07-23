"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CheckSquare, Circle, Clock, FileText, Phone, Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/vendors/constants";
import {
  completeEventTaskAction,
  completePersonalTaskAction,
  uncompletePersonalTaskAction,
  updateAssignmentNotesAction,
  getVendorHandbookForEventAction,
} from "@/app/vendor/events/actions";
import { createVendorTaskAction } from "@/app/vendor/tasks/actions";
import {
  getVendorConversationAction,
  getVendorConversationIdForEventAction,
} from "@/app/vendor/messages/actions";
import { getVendorSharedFloorPlansForEventAction } from "@/app/vendor/floor-plans/actions";
import { VendorConversationThread } from "@/components/vendor-app/vendor-conversation-thread";
import { VendorHandbookView } from "@/components/vendor-app/vendor-handbook-view";
import type { VendorEventDetail } from "@/lib/vendors/types";
import type { VendorConversationMessage } from "@/lib/conversations/types";
import type { VendorFloorPlanSummary } from "@/lib/floor-plans/types";
import type { VendorHandbook } from "@/lib/vendor-handbook/service";

// Vendor Workspace Realignment, Phase 5 (2026-07-22): tabs mirror the
// Client Workspace shape (Overview/Messages/Timeline/Tasks/Documents/Venue
// Information), plus Notes — private vendor-side notes with no equivalent
// anywhere else in the workspace, kept per the Phase 1 audit. Floor Plans
// folded into Documents (it's a document category, not a separate
// concept); Activity folded into Overview.
type Tab = "overview" | "messages" | "timeline" | "tasks" | "documents" | "venueinfo" | "notes";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",  label: "Overview"          },
  { id: "messages",  label: "Messages"          },
  { id: "timeline",  label: "Timeline"          },
  { id: "tasks",     label: "Tasks"             },
  { id: "documents", label: "Documents"         },
  { id: "venueinfo", label: "Venue Information" },
  { id: "notes",     label: "Notes"             },
];

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function VendorEventWorkspace({ detail }: { detail: VendorEventDetail }) {
  const [tab, setTab] = React.useState<Tab>("overview");

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link href="/vendor/events" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Events
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-foreground">{detail.eventName}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-0.5 text-sm text-muted-foreground">
          <span>{detail.venueName}</span>
          {detail.eventDate && <span>· {formatDate(detail.eventDate)}</span>}
          {detail.eventType && <span>· {detail.eventType}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {label}
              {id === "tasks" && detail.eventTasks.filter((t) => t.status !== "complete").length + detail.personalTasks.filter((t) => t.status !== "complete").length > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-bold text-primary">
                  {detail.eventTasks.filter((t) => t.status !== "complete").length + detail.personalTasks.filter((t) => t.status !== "complete").length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {tab === "overview"  && <OverviewTab   detail={detail} />}
        {tab === "messages"  && <MessagesTab   detail={detail} />}
        {tab === "timeline"  && <TimelineTab   detail={detail} />}
        {tab === "tasks"     && <TasksTab      detail={detail} />}
        {tab === "documents" && <DocumentsTab  detail={detail} />}
        {tab === "venueinfo" && <VenueInfoTab  detail={detail} />}
        {tab === "notes"     && <NotesTab      detail={detail} />}
      </div>
    </div>
  );
}

function OverviewTab({ detail }: { detail: VendorEventDetail }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Assignment info */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Your Assignment</h2>
        <div className="space-y-2 text-sm">
          {detail.arrivalTime && (
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-foreground">Arrival at {formatTime(detail.arrivalTime)}</span>
            </div>
          )}
          {detail.setupLocation && (
            <div>
              <p className="text-xs text-muted-foreground">Setup Location</p>
              <p className="text-foreground">{detail.setupLocation}</p>
            </div>
          )}
          {detail.loadInNotes && (
            <div>
              <p className="text-xs text-muted-foreground">Load-in Notes</p>
              <p className="text-foreground">{detail.loadInNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Venue + client */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Venue & Client</h2>
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">{detail.venueName}</p>
          {detail.coupleName && <p className="text-muted-foreground">{detail.coupleName}</p>}
          {detail.coupleEmail && (
            <a href={`mailto:${detail.coupleEmail}`} className="flex items-center gap-1.5 text-primary hover:underline text-xs">
              <Mail className="h-3.5 w-3.5" /> {detail.coupleEmail}
            </a>
          )}
          {detail.couplePhone && (
            <a href={`tel:${detail.couplePhone}`} className="flex items-center gap-1.5 text-primary hover:underline text-xs">
              <Phone className="h-3.5 w-3.5" /> {detail.couplePhone}
            </a>
          )}
          {!detail.coupleEmail && !detail.couplePhone && !detail.coupleName && (
            <p className="text-xs text-muted-foreground">Client contact not shared by venue.</p>
          )}
        </div>
      </div>

      {/* Payment summary — Sprint 2, Vendor Payment Visibility. A summary
          only: what you're being paid, and whether it's been paid. No
          installments, no invoices, no history — the venue hasn't set a
          fee yet if this card doesn't appear. */}
      {detail.agreedFee != null && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 sm:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Payment</h2>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-semibold text-foreground">${detail.agreedFee.toLocaleString()}</p>
            <Badge
              className={detail.paymentStatus === "paid" ? "bg-primary/10 text-primary border-primary/40" : "bg-amber-50 text-amber-700 border-amber-300"}
              variant="outline"
            >
              {detail.paymentStatus === "paid" ? "Paid" : "Pending"}
            </Badge>
          </div>
        </div>
      )}

      {/* Recent activity — folded in from the old standalone Activity tab
          (Phase 5: an event has too little activity to justify its own
          destination; it belongs with everything else about the event). */}
      {detail.activityFeed.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-2 sm:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          <div className="space-y-2">
            {detail.activityFeed.slice(0, 5).map((item) => (
              <div key={item.id} className="text-sm">
                <p className="text-foreground">{item.description}</p>
                <p className="text-xs text-muted-foreground">
                  {item.actor === "venue" ? "Venue" : "You"} · {formatDateShort(item.occurredAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineTab({ detail }: { detail: VendorEventDetail }) {
  if (detail.timeline.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <p className="text-sm text-muted-foreground">No timeline items assigned to you yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {detail.timeline.map((entry) => (
        <div key={entry.id} className="flex gap-4 rounded-xl border border-border bg-card px-4 py-3">
          <div className="w-16 shrink-0 text-xs font-medium text-muted-foreground pt-0.5">
            {entry.time ? formatTime(entry.time) : "—"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{entry.title}</p>
            {entry.description && <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TasksTab({ detail }: { detail: VendorEventDetail }) {
  const [pending, startTransition] = useTransition();
  const [newTitle, setNewTitle]   = React.useState("");
  const [newDue, setNewDue]       = React.useState("");

  function handleCompleteEvent(taskId: string) {
    startTransition(async () => { await completeEventTaskAction(taskId, detail.assignmentId); });
  }
  function handleCompletePersonal(taskId: string) {
    startTransition(async () => { await completePersonalTaskAction(taskId, detail.assignmentId); });
  }
  function handleUncompletePersonal(taskId: string) {
    startTransition(async () => { await uncompletePersonalTaskAction(taskId, detail.assignmentId); });
  }
  function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    startTransition(async () => {
      await createVendorTaskAction({
        title:           newTitle.trim(),
        dueDate:         newDue,
        vendorInquiryId: "",
        eventId:         detail.eventId,
        notes:           "",
      });
      setNewTitle("");
      setNewDue("");
    });
  }

  const allEmpty = detail.eventTasks.length === 0 && detail.personalTasks.length === 0;

  return (
    <div className="space-y-4">
      {/* Venue-assigned tasks */}
      {detail.eventTasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned by Venue</h3>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {detail.eventTasks.map((t) => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => t.canComplete && t.status !== "complete" && handleCompleteEvent(t.id)}
                  disabled={!t.canComplete || t.status === "complete" || pending}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-default"
                >
                  {t.status === "complete"
                    ? <CheckSquare className="h-4 w-4 text-success" />
                    : <Circle className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${t.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {t.title}
                  </p>
                  {t.dueDate && <p className="text-xs text-muted-foreground">{t.dueDate}</p>}
                </div>
                {t.isRequired && <Badge variant="outline" className="text-xs shrink-0">Required</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Personal tasks */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personal Tasks</h3>
        {detail.personalTasks.length > 0 ? (
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {detail.personalTasks.map((t) => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    t.status === "pending"
                      ? handleCompletePersonal(t.id)
                      : handleUncompletePersonal(t.id)
                  }
                  disabled={pending}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                >
                  {t.status === "complete"
                    ? <CheckSquare className="h-4 w-4 text-success" />
                    : <Circle className="h-4 w-4" />}
                </button>
                <p className={`text-sm flex-1 ${t.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {t.title}
                </p>
                {t.dueDate && <p className="text-xs text-muted-foreground shrink-0">{t.dueDate}</p>}
              </div>
            ))}
          </div>
        ) : (
          !allEmpty && <p className="text-xs text-muted-foreground py-2">No personal tasks for this event.</p>
        )}

        {/* Add task — Sprint 2 mobile pass: the date input's fixed w-36
            used to sit next to the title input with no wrap, crushing the
            title field at phone width. Stacks below it under sm instead. */}
        <form onSubmit={handleAddTask} className="flex flex-col gap-2 pt-1 sm:flex-row">
          <input
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Add a personal task…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <input
            type="date"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:w-36"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={pending || !newTitle.trim()}>Add</Button>
        </form>
      </div>
    </div>
  );
}

/**
 * RC2, Milestone 5 (Rollout verification) — this was a static placeholder
 * ("coming in Sprint 107") left over from before RC2 Milestone 3 shipped a
 * real, populated Conversation for every event assignment. Found by
 * verifying every entry point that represents a conversation actually
 * opens one — it didn't. Now it does: the same canonical thread the vendor
 * portal's own Messages nav item uses (components/vendor-app/
 * vendor-conversation-thread.tsx), embedded inline.
 */
function MessagesTab({ detail }: { detail: VendorEventDetail }) {
  const [conversationId, setConversationId] = React.useState<string | null | undefined>(undefined);
  const [messages, setMessages] = React.useState<VendorConversationMessage[] | null>(null);

  React.useEffect(() => {
    void getVendorConversationIdForEventAction(detail.eventId).then((id) => {
      setConversationId(id);
      if (id) void getVendorConversationAction(id).then((r) => setMessages(r.ok ? r.conversation.messages : []));
    });
  }, [detail.eventId]);

  if (conversationId === undefined || (conversationId && messages === null)) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (!conversationId) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <p className="text-sm font-medium text-foreground">Messages</p>
        <p className="text-xs text-muted-foreground mt-1">No conversation for this event yet.</p>
      </div>
    );
  }
  return <VendorConversationThread conversationId={conversationId} initialMessages={messages ?? []} showHeader={false} />;
}

/**
 * Documents + Floor Plans, unified (Phase 5/8: a Floor Plan is a document
 * category — a structured layout built in the coordinator's own Floor Plan
 * editor and shared via its own shared_with_vendors flag, not a PDF — not a
 * reason for a separate tab). "Open" on a floor plan renders the same
 * read-only SVG canvas the coordinator's print view uses.
 */
function DocumentsTab({ detail }: { detail: VendorEventDetail }) {
  const [plans, setPlans] = React.useState<VendorFloorPlanSummary[] | null>(null);

  React.useEffect(() => {
    void getVendorSharedFloorPlansForEventAction(detail.eventId).then(setPlans);
  }, [detail.eventId]);

  const loading = plans === null;
  const hasDocuments = detail.documents.length > 0;
  const hasPlans = (plans ?? []).length > 0;

  if (!loading && !hasDocuments && !hasPlans) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No documents or floor plans shared for this event yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border">
      {detail.documents.map((d) => (
        <a
          key={d.id}
          href={d.storageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
        >
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{d.name}</p>
            {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
          </div>
          <Badge variant="outline" className="text-xs shrink-0">{d.category}</Badge>
        </a>
      ))}
      {(plans ?? []).map((p) => (
        <a
          key={p.id}
          href={`/vendor/floor-plans/${p.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
        >
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{p.name}</p>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">Floor Plan</Badge>
        </a>
      ))}
    </div>
  );
}

function VenueInfoTab({ detail }: { detail: VendorEventDetail }) {
  const [handbook, setHandbook] = React.useState<VendorHandbook | null | undefined>(undefined);

  React.useEffect(() => {
    void getVendorHandbookForEventAction(detail.eventId).then(setHandbook);
  }, [detail.eventId]);

  if (handbook === undefined) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }
  if (!handbook) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <p className="text-sm text-muted-foreground">Venue information isn&apos;t available for this event.</p>
      </div>
    );
  }
  return <VendorHandbookView handbook={handbook} />;
}

function NotesTab({ detail }: { detail: VendorEventDetail }) {
  const [notes, setNotes]     = React.useState(detail.internalNotes ?? "");
  const [edited, setEdited]   = React.useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateAssignmentNotesAction(detail.assignmentId, notes);
      setEdited(false);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Private notes visible only to you, not the venue.</p>
      <textarea
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[200px] resize-none"
        placeholder="Add your private notes for this event…"
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setEdited(true); }}
      />
      {edited && (
        <Button size="sm" onClick={handleSave} disabled={pending}>
          {pending ? "Saving…" : "Save Notes"}
        </Button>
      )}
    </div>
  );
}
