"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteTourAction,
  setTourArchivedAction,
} from "@/app/(app)/tours/actions";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryDeleteConfirmDialog } from "@/components/library/library-delete-confirm-dialog";
import { LibraryOverflowMenu } from "@/components/library/library-overflow-menu";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { canHardDeleteTourAppointment } from "@/lib/tours/delete-guard";
import { tourDisplayClockIso } from "@/lib/tours/list-order";
import { tourActualDiffersFromScheduled } from "@/lib/tours/occurrence-clock";
import type { TourAppointment, TourOutcome } from "@/lib/tours/types";
import { formatVenueLocalTourDisplay, utcToVenueLocalParts } from "@/lib/venue/timezone";
import {
  INTERNAL_NOTES_PRIVACY_HINT,
  internalNotesLabel,
} from "@/lib/notes/internal-notes-copy";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OUTCOME_LABELS: Record<TourOutcome, string> = {
  interested: "💚 Interested",
  considering: "🤔 Considering",
  not_a_fit: "❌ Not a fit",
  booked: "🎉 Booked!",
  unknown: "Unknown",
};

const STATUS_LABELS: Record<TourAppointment["status"], string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show:   "No Show",
};

const STATUS_COLORS: Record<TourAppointment["status"], string> = {
  scheduled: "amber",
  confirmed: "green",
  completed: "sage",
  cancelled: "muted",
  no_show:   "red",
};

function TourRow({
  appt,
  venueTimezone,
  onStatusChange,
  archivedView = false,
}: {
  appt: TourAppointment;
  venueTimezone: string | null;
  onStatusChange: (id: string, status: TourAppointment["status"]) => void;
  archivedView?: boolean;
}) {
  const router = useRouter();
  const [updating, setUpdating] = React.useState(false);
  const [overflowPending, setOverflowPending] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const [showOutcomeForm, setShowOutcomeForm] = React.useState(false);
  const [outcome, setOutcome] = React.useState<string>(appt.outcome ?? "");
  const [notes, setNotes] = React.useState(appt.notes ?? "");
  const [savingOutcome, setSavingOutcome] = React.useState(false);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const scheduledParts = appt.scheduledAt
    ? utcToVenueLocalParts(appt.scheduledAt, venueTimezone)
    : { date: "", time: "" };
  const [actualDate, setActualDate] = React.useState(scheduledParts.date);
  const [actualTime, setActualTime] = React.useState(scheduledParts.time);
  const clockIso = tourDisplayClockIso(appt);
  const { timeLabel } = formatVenueLocalTourDisplay(clockIso ?? "", venueTimezone);
  const venueParts = clockIso
    ? utcToVenueLocalParts(clockIso, venueTimezone)
    : { date: "", time: "" };
  const dayNum = venueParts.date ? Number(venueParts.date.slice(8, 10)) : 0;
  const monthShort = venueParts.date
    ? new Date(`${venueParts.date}T12:00:00`).toLocaleDateString("en-US", { month: "short" })
    : "";
  const deleteGuard = canHardDeleteTourAppointment(appt);
  const displayName = appt.contactName ?? "Unknown";
  const showScheduledAside =
    appt.status === "completed" && tourActualDiffersFromScheduled(appt) && appt.scheduledAt;
  const scheduledAside = appt.scheduledAt
    ? formatVenueLocalTourDisplay(appt.scheduledAt, venueTimezone)
    : null;

  async function handleSaveOutcome() {
    setSavingOutcome(true);
    try {
      const res = await fetch("/api/tours/outcome", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appointmentId: appt.id, outcome: outcome || null, notes: notes || null }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) { toast.success("Tour outcome saved."); setShowOutcomeForm(false); }
      else toast.error("Could not save outcome.");
    } catch { toast.error("Could not save outcome."); }
    finally { setSavingOutcome(false); }
  }

  async function handleMarkFollowUp() {
    await fetch("/api/tours/outcome", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appointmentId: appt.id, followUpSentAt: new Date().toISOString() }),
    });
    toast.success("Marked follow-up sent.");
  }

  async function patchStatus(
    newStatus: string,
    extras?: { actualDate?: string; actualTime?: string; reason?: string },
  ) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tours/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appointmentId: appt.id,
          status: newStatus,
          reason: extras?.reason,
          actualDate: extras?.actualDate,
          actualTime: extras?.actualTime,
        }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        onStatusChange(appt.id, newStatus as TourAppointment["status"]);
        toast.success(newStatus === "confirmed" ? "Tour marked confirmed." : "Status updated.");
        setCompleteOpen(false);
      } else toast.error(data.error ?? "Could not update status.");
    } catch { toast.error("Could not update status."); }
    finally { setUpdating(false); }
  }

  async function handleStatus(newStatus: string) {
    if (newStatus === "completed" && appt.status !== "completed") {
      const parts = appt.scheduledAt
        ? utcToVenueLocalParts(appt.scheduledAt, venueTimezone)
        : appt.actualOccurredAt
          ? utcToVenueLocalParts(appt.actualOccurredAt, venueTimezone)
          : { date: "", time: "" };
      setActualDate(parts.date);
      setActualTime(parts.time);
      setCompleteOpen(true);
      return;
    }
    await patchStatus(newStatus);
  }

  async function confirmComplete() {
    if (!actualDate.trim() || !actualTime.trim()) {
      toast.error("Enter when the tour actually occurred.");
      return;
    }
    await patchStatus("completed", { actualDate, actualTime });
  }

  // Confirmed is reached only through an explicit action (Send Confirmation
  // Request / Mark as Confirmed below), never a free-pick dropdown value —
  // same shape as this codebase's own precedent for Booked in the Sales
  // Pipeline, where a status with real meaning gets a dedicated action
  // instead of being one more option in a generic Select.
  async function handleMarkConfirmed() { await handleStatus("confirmed"); }

  async function handleRequestConfirmation() {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tours/confirmation-request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appointmentId: appt.id }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) toast.success("Confirmation request sent.");
      else toast.error(data.error ?? "Could not send the confirmation request.");
    } catch { toast.error("Could not send the confirmation request."); }
    finally { setUpdating(false); }
  }

  async function handleArchiveToggle() {
    setOverflowPending(true);
    const next = !appt.isArchived;
    const result = await setTourArchivedAction(appt.id, next);
    setOverflowPending(false);
    if (result.ok) {
      toast.success(next ? "Tour archived." : "Tour restored.");
      router.refresh();
    } else {
      toast.error(result.message ?? "Could not update archive state.");
    }
  }

  async function handleDeleteConfirmed() {
    setDeletePending(true);
    const result = await deleteTourAction(appt.id);
    setDeletePending(false);
    setDeleting(false);
    if (result.ok) {
      toast.success("Tour deleted.");
      router.refresh();
    } else {
      toast.error(result.message ?? "Could not delete tour.");
    }
  }

  const overflowItems = [
    {
      id: "archive",
      label: archiveToggleLabel(appt.isArchived),
      onClick: () => void handleArchiveToggle(),
      icon: appt.isArchived
        ? <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
        : <Archive className="mr-2 h-3.5 w-3.5" />,
    },
    ...(deleteGuard.allowed
      ? [{
          id: "delete",
          label: LIBRARY_LABELS.delete,
          onClick: () => setDeleting(true),
          destructive: true as const,
          separatorBefore: true,
          icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
        }]
      : []),
  ];

  return (
    <>
    <div className="py-4 border-b border-border/50 last:border-0">
      <div className="flex items-start gap-3">
        {/* Date block */}
        <div className="shrink-0 w-12 text-center">
          <p className="text-lg font-bold text-heading leading-none">{dayNum}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{monthShort}</p>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-heading truncate">{displayName}</p>
            <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_COLORS[appt.status] === "amber" ? "border-amber-300 text-amber-700 bg-amber-50" : STATUS_COLORS[appt.status] === "green" ? "border-green-300 text-green-700 bg-green-50" : "border-border text-muted-foreground"}`}>
              {STATUS_LABELS[appt.status]}
            </Badge>
            {appt.origin === "walk_in" && (
              <Badge variant="outline" className="text-[10px] shrink-0 border-border text-muted-foreground">Walk-in</Badge>
            )}
            {archivedView && (
              <Badge variant="muted" className="text-[10px] shrink-0">{LIBRARY_LABELS.archived}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {timeLabel} · {appt.durationMinutes} min
            {appt.eventType && ` · ${appt.eventType}`}
          </p>
          {showScheduledAside && scheduledAside ? (
            <p className="text-[11px] text-muted-foreground">
              Scheduled {scheduledAside.dateLabel} · {scheduledAside.timeLabel}
            </p>
          ) : null}
          {appt.status === "completed" && appt.completedAt ? (
            <p className="text-[11px] text-muted-foreground">
              Marked completed{" "}
              {new Date(appt.completedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          ) : null}
          {appt.contactEmail && <p className="text-xs text-muted-foreground">{appt.contactEmail}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!archivedView && (
            updating ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                {appt.status === "scheduled" && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => void handleRequestConfirmation()}>
                      Send Confirmation Request
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => void handleMarkConfirmed()}>
                      Mark as Confirmed
                    </Button>
                  </>
                )}
                {/* Confirmed is never a free-pick option here — see handleMarkConfirmed above. */}
                <Select value={appt.status} onValueChange={handleStatus} items={STATUS_LABELS}>
                  <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )
          )}
          {appt.leadId && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" render={<Link href={`/leads/${appt.leadId}`} />}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          <LibraryOverflowMenu items={overflowItems} pending={overflowPending} />
        </div>
      </div>

      {/* Completed tour: outcome + notes + follow-up */}
      {!archivedView && appt.status === "completed" && (
        <div className="mt-2 ml-12 space-y-2">
          {appt.outcome && (
            <p className="text-xs text-muted-foreground">
              Outcome: <span className="font-medium text-heading">{OUTCOME_LABELS[appt.outcome as TourOutcome]}</span>
              {appt.followUpSentAt && <span className="ml-2 text-green-600">· Follow-up sent</span>}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setShowOutcomeForm(!showOutcomeForm)}
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
              {appt.outcome ? "Edit outcome" : "Record outcome"}
            </button>
            {!appt.followUpSentAt && (
              <button type="button" onClick={handleMarkFollowUp}
                className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                Mark follow-up sent
              </button>
            )}
          </div>
          {showOutcomeForm && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <Select value={outcome} onValueChange={setOutcome} items={OUTCOME_LABELS}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Tour outcome…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interested">💚 Interested</SelectItem>
                  <SelectItem value="considering">🤔 Considering</SelectItem>
                  <SelectItem value="not_a_fit">❌ Not a fit</SelectItem>
                  <SelectItem value="booked">🎉 Booked!</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">{internalNotesLabel("tour")}</p>
                <p className="text-[11px] text-muted-foreground">{INTERNAL_NOTES_PRIVACY_HINT}</p>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes from the tour…" className="text-xs" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowOutcomeForm(false)}>Cancel</Button>
                <Button type="button" size="sm" className="h-6 text-xs" disabled={savingOutcome} onClick={handleSaveOutcome}>Save</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    {completeOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCompleteOpen(false)}>
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-semibold text-heading">Mark tour completed</p>
          {appt.scheduledAt && scheduledAside ? (
            <p className="text-xs text-muted-foreground">
              Scheduled {scheduledAside.dateLabel} · {scheduledAside.timeLabel}. Recording completion does not change that appointment.
            </p>
          ) : null}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Actually occurred (date)</Label>
            <Input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Actually occurred (time)</Label>
            <Input type="time" value={actualTime} onChange={(e) => setActualTime(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={updating} onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button type="button" size="sm" disabled={updating} onClick={() => void confirmComplete()}>
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark completed"}
            </Button>
          </div>
        </div>
      </div>
    ) : null}
    <LibraryDeleteConfirmDialog
      open={deleting}
      itemName={displayName}
      itemLabel="tour"
      permanent
      consequenceNote="Leads, clients, and events are not deleted. Tour reminders for this appointment are removed."
      pending={deletePending}
      onConfirm={() => void handleDeleteConfirmed()}
      onCancel={() => setDeleting(false)}
    />
    </>
  );
}

export function TourList({
  appointments,
  venueTimezone = null,
  archivedView = false,
}: {
  appointments: TourAppointment[];
  venueTimezone?: string | null;
  archivedView?: boolean;
}) {
  const router = useRouter();
  const [appts, setAppts] = React.useState(appointments);
  React.useEffect(() => { setAppts(appointments); }, [appointments]);

  function handleStatusChange(id: string, status: TourAppointment["status"]) {
    setAppts((p) => p.map((a) => a.id === id ? { ...a, status } : a));
    router.refresh();
  }

  return (
    <div className="divide-y divide-border/50">
      {appts.map((appt) => (
        <TourRow
          key={appt.id}
          appt={appt}
          venueTimezone={venueTimezone}
          onStatusChange={handleStatusChange}
          archivedView={archivedView}
        />
      ))}
    </div>
  );
}

export function TourArchivedSection({
  appointments,
  venueTimezone = null,
}: {
  appointments: TourAppointment[];
  venueTimezone?: string | null;
}) {
  return (
    <LibraryArchivedSection
      count={appointments.length}
      hint="Archived tours stay in reporting and history. Restore one to return it to Upcoming or Past."
    >
      <TourList appointments={appointments} venueTimezone={venueTimezone} archivedView />
    </LibraryArchivedSection>
  );
}
