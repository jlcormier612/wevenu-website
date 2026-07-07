"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, CheckSquare, Circle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INQUIRY_STATUSES, INQUIRY_STATUS_VARIANT } from "@/lib/vendors/constants";
import { updateVendorInquiryAction, deleteVendorInquiryAction, createVendorInquiryAction } from "@/app/vendor/inquiries/actions";
import { createVendorTaskAction, completeVendorTaskAction } from "@/app/vendor/tasks/actions";
import type { VendorInquiry, InquiryStatus, VendorPersonalTask } from "@/lib/vendors/types";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function VendorInquiryDetail({
  inquiry,
  linkedTasks,
}: {
  inquiry:     VendorInquiry;
  linkedTasks: VendorPersonalTask[];
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = React.useState<InquiryStatus>(inquiry.status);
  const [notes, setNotes]   = React.useState(inquiry.notes ?? "");
  const [notesEdited, setNotesEdited] = React.useState(false);
  const [taskTitle, setTaskTitle] = React.useState("");
  const [taskDue, setTaskDue]     = React.useState("");
  const [taskPending, startTaskTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleStatusChange(newStatus: InquiryStatus) {
    setStatus(newStatus);
    startTransition(async () => {
      await updateVendorInquiryAction(inquiry.id, { status: newStatus });
    });
  }

  function handleSaveNotes() {
    startTransition(async () => {
      await updateVendorInquiryAction(inquiry.id, { notes });
      setNotesEdited(false);
    });
  }

  function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    startTaskTransition(async () => {
      await createVendorTaskAction({
        title:           taskTitle.trim(),
        dueDate:         taskDue,
        vendorInquiryId: inquiry.id,
        eventId:         "",
        notes:           "",
      });
      setTaskTitle("");
      setTaskDue("");
    });
  }

  function handleCompleteTask(taskId: string) {
    startTaskTransition(async () => { await completeVendorTaskAction(taskId); });
  }

  function handleDelete() {
    if (!confirm("Delete this inquiry? This cannot be undone.")) return;
    startDeleteTransition(async () => {
      await deleteVendorInquiryAction(inquiry.id);
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Link href="/vendor/inquiries" className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Inquiries
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{inquiry.contactName ?? "Unnamed Contact"}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
            {inquiry.contactEmail && <span>{inquiry.contactEmail}</span>}
            {inquiry.venueName   && <span>· {inquiry.venueName}</span>}
            {inquiry.eventDate   && <span>· {formatDate(inquiry.eventDate)}</span>}
            {inquiry.eventType   && <span>· {inquiry.eventType}</span>}
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deletePending}>
          {deletePending ? "Deleting…" : "Delete"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: details */}
        <div className="space-y-5">
          {/* Status */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Status</h2>
            <div className="flex flex-wrap gap-2">
              {INQUIRY_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => handleStatusChange(s.value)}
                  disabled={pending}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    status === s.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="pt-1">
              <Badge variant={INQUIRY_STATUS_VARIANT[status]} className="text-xs">
                {INQUIRY_STATUSES.find((s) => s.value === status)?.label}
              </Badge>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Notes</h2>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[120px] resize-none"
              placeholder="Add notes about this inquiry…"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesEdited(true); }}
            />
            {notesEdited && (
              <Button size="sm" onClick={handleSaveNotes} disabled={pending}>
                {pending ? "Saving…" : "Save Notes"}
              </Button>
            )}
          </div>

          {/* Follow-up */}
          {inquiry.followUpAt && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-1">Follow-up Scheduled</h2>
              <p className="text-sm text-muted-foreground">{formatDate(inquiry.followUpAt)}</p>
            </div>
          )}
        </div>

        {/* Right: linked tasks */}
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Tasks for this Inquiry</h2>

            {linkedTasks.length > 0 ? (
              <ul className="space-y-2">
                {linkedTasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => t.status === "pending" && handleCompleteTask(t.id)}
                      disabled={taskPending || t.status === "complete"}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {t.status === "complete"
                        ? <CheckSquare className="h-4 w-4 text-success" />
                        : <Circle className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${t.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {t.title}
                      </p>
                      {t.dueDate && (
                        <p className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No tasks yet.</p>
            )}

            {/* Add task */}
            <form onSubmit={handleAddTask} className="border-t border-border pt-3 space-y-2">
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Add a task…"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                />
                <Button type="submit" size="sm" disabled={taskPending || !taskTitle.trim()}>
                  {taskPending ? "…" : "Add"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
