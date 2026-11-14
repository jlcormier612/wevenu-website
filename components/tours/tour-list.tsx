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
import { prefillActualFromScheduled, tourActualDiffersFromScheduled } from "@/lib/tours/occurrence-clock";
import type { TourAppointment, TourOutcome } from "@/lib/tours/types";
import { formatVenueLocalTourDisplay, utcToVenueLocalParts } from "@/lib/venue/timezone";
import {
  INTERNAL_NOTES_PRIVACY_HINT,
  internalNotesLabel,
} from "@/lib/notes/internal-notes-copy";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OUTCOME_LABELS: Record<TourOutcome, string> = {
  interested: "Interested",
  considering: "Considering",
  not_a_fit: "Not a fit",
  booked: "Booked",
  unknown: "Unknown",
};

const STATUS_LABELS: Record<TourAppointment["status"], string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show:   "No Show",
};

export function TourSectionEmpty({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="htc-tours-section-empty" data-tours-empty="section">
      <p data-tours-empty-title="">{title}</p>
      <p data-tours-empty-copy="">{copy}</p>
      {action}
    </div>
  );
}

function TourRow({
  appt,
  venueTimezone,
  onStatusChange,
  archivedView = false,
}: {
  appt: TourAppointment;
  venueTimezone: string | null;
  onStatusChange: (
    id: string,
    status: TourAppointment["status"],
    clocks?: { scheduledAt?: string | null; actualOccurredAt?: string | null; completedAt?: string | null },
  ) => void;
  archivedView?: boolean;
}) {
  const router = useRouter();
  const [updating, setUpdating] = React.useState(false);
  const [overflowPending, setOverflowPending] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const isPostTour = appt.status === "completed" || appt.status === "no_show";
  const [detailsOpen, setDetailsOpen] = React.useState(isPostTour && !archivedView);
  const [showOutcomeForm, setShowOutcomeForm] = React.useState(false);
  const [outcome, setOutcome] = React.useState<string>(appt.outcome ?? "");
  const [notes, setNotes] = React.useState(appt.notes ?? "");
  const [savedNotes, setSavedNotes] = React.useState(appt.notes ?? "");
  const [savedOutcome, setSavedOutcome] = React.useState(appt.outcome ?? "");
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
  /*
   * Status Select visibility (presentation only — backend updateTourStatus has no FSM gate):
   * - scheduled / confirmed: open work — Select offers completed / cancelled / no_show
   *   (and scheduled). Confirmed is never a free-pick option.
   * - completed / cancelled: terminal for this workspace — badge only; no Select.
   *   Archive/restore remain via overflow. Details / notes remain for completed and no-show.
   * - no_show: keep Select for staff corrections among post-tour outcomes only
   *   (completed / cancelled / no_show). Do not offer scheduled reopen here.
   */
  const showStatusSelect =
    !archivedView &&
    (appt.status === "scheduled" || appt.status === "confirmed" || appt.status === "no_show");
  const statusSelectItems =
    appt.status === "no_show"
      ? ({
          completed: STATUS_LABELS.completed,
          cancelled: STATUS_LABELS.cancelled,
          no_show: STATUS_LABELS.no_show,
        } as const)
      : ({
          scheduled: STATUS_LABELS.scheduled,
          completed: STATUS_LABELS.completed,
          cancelled: STATUS_LABELS.cancelled,
          no_show: STATUS_LABELS.no_show,
        } as const);

  async function handleSaveOutcome() {
    setSavingOutcome(true);
    try {
      const res = await fetch("/api/tours/outcome", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appointmentId: appt.id,
          notes: notes || null,
          ...(isPostTour ? { outcome: outcome || null } : {}),
        }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        toast.success("Tour notes saved.");
        setSavedNotes(notes);
        setSavedOutcome(outcome);
        setShowOutcomeForm(false);
        router.refresh();
      }
      else toast.error("Could not save notes.");
    } catch { toast.error("Could not save notes."); }
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
      const data = await res.json() as {
        ok: boolean;
        error?: string;
        status?: TourAppointment["status"];
        scheduledAt?: string | null;
        actualOccurredAt?: string | null;
        completedAt?: string | null;
      };
      if (data.ok) {
        onStatusChange(appt.id, (data.status ?? newStatus) as TourAppointment["status"], {
          scheduledAt: data.scheduledAt,
          actualOccurredAt: data.actualOccurredAt,
          completedAt: data.completedAt,
        });
        toast.success(newStatus === "confirmed" ? "Tour marked confirmed." : "Status updated.");
        setCompleteOpen(false);
        if (newStatus === "completed" || newStatus === "no_show") {
          setDetailsOpen(true);
          setShowOutcomeForm(true);
        }
      } else toast.error(data.error ?? "Could not update status.");
    } catch { toast.error("Could not update status."); }
    finally { setUpdating(false); }
  }

  async function handleStatus(newStatus: string) {
    if (newStatus === "completed" && appt.status !== "completed") {
      const prefill = prefillActualFromScheduled({
        scheduledAt: appt.scheduledAt,
        timezone: venueTimezone,
        utcToParts: utcToVenueLocalParts,
      });
      if (prefill.fromScheduled) {
        setActualDate(prefill.date);
        setActualTime(prefill.time);
      } else {
        setActualDate("");
        setActualTime("");
      }
      setCompleteOpen(true);
      return;
    }
    await patchStatus(newStatus);
  }

  async function confirmComplete() {
    const hasDate = Boolean(actualDate.trim());
    const hasTime = Boolean(actualTime.trim());
    if (hasDate !== hasTime) {
      toast.error("Enter when the tour actually occurred.");
      return;
    }
    await patchStatus("completed", hasDate ? { actualDate, actualTime } : undefined);
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
    <div
      className="htc-tours-row"
      data-tours-row=""
      data-tours-status={appt.status}
      data-tours-archived={archivedView ? "true" : "false"}
    >
      <div className="htc-tours-row-main">
        <div className="htc-tours-row-identity">
          <div className="htc-tours-date" aria-hidden={dayNum === 0}>
            <p data-tours-day="">{dayNum || "—"}</p>
            <p data-tours-month="">{monthShort || "—"}</p>
          </div>

          <div className="htc-tours-row-content">
            <div className="htc-tours-row-title">
              {appt.leadId ? (
                <Link
                  href={`/leads/${appt.leadId}`}
                  className="htc-record-link"
                  data-tours-name=""
                >
                  {displayName}
                </Link>
              ) : (
                <p data-tours-name="">{displayName}</p>
              )}
              <span
                className="htc-tours-status-badge"
                data-tours-status-badge={appt.status}
              >
                {STATUS_LABELS[appt.status]}
              </span>
              {appt.origin === "walk_in" && (
                <Badge variant="outline" className="htc-tours-meta-badge" data-tours-walk-in="">
                  Walk-in
                </Badge>
              )}
              {archivedView && (
                <Badge variant="muted" className="htc-tours-meta-badge">{LIBRARY_LABELS.archived}</Badge>
              )}
            </div>
            <p data-tours-meta="">
              {timeLabel} · {appt.durationMinutes} min
              {appt.eventType && ` · ${appt.eventType}`}
            </p>
            {showScheduledAside && scheduledAside ? (
              <p data-tours-aside="">
                Scheduled {scheduledAside.dateLabel} · {scheduledAside.timeLabel}
              </p>
            ) : null}
            {appt.status === "completed" && appt.completedAt ? (
              <p data-tours-aside="">
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
            {savedNotes.trim() && !detailsOpen ? (
              <p data-tours-notes-preview="">{savedNotes.trim()}</p>
            ) : null}
            {!appt.leadId && appt.origin === "walk_in" && (
              <p data-tours-aside="">
                Walk-in — use {showStatusSelect ? "status and " : ""}archive actions on this row.
              </p>
            )}
          </div>
        </div>

        <div className="htc-tours-row-actions" data-tours-actions="">
          {!archivedView && updating ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
          {!archivedView && !updating && appt.status === "scheduled" ? (
            <div className="htc-tours-confirm-actions" data-tours-confirm-actions="">
              <Button
                size="sm"
                className="htc-tours-confirm-btn htc-tours-confirm-primary"
                onClick={() => void handleMarkConfirmed()}
              >
                Mark as Confirmed
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="htc-tours-confirm-btn"
                onClick={() => void handleRequestConfirmation()}
              >
                Send Confirmation Request
              </Button>
            </div>
          ) : null}
          {/* Confirmed is never a free-pick option here — see handleMarkConfirmed above. */}
          {!archivedView && !updating && showStatusSelect ? (
            <Select value={appt.status} onValueChange={handleStatus} items={statusSelectItems}>
              <SelectTrigger className="htc-tours-status-select" data-tours-status-select="">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {"scheduled" in statusSelectItems ? (
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                ) : null}
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          <div className="htc-tours-row-tools" data-tours-row-tools="">
            {!archivedView ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="htc-tours-details-toggle"
                aria-expanded={detailsOpen}
                aria-controls={`tour-details-${appt.id}`}
                data-tours-details-toggle=""
                onClick={() => {
                  setDetailsOpen((open) => {
                    const next = !open;
                    if (next && isPostTour) setShowOutcomeForm(true);
                    return next;
                  });
                }}
              >
                {detailsOpen ? "Hide details" : isPostTour ? "Tour notes" : "Details"}
              </Button>
            ) : null}
            {appt.leadId ? (
              <Button
                size="sm"
                variant="ghost"
                className="htc-tours-lead-link"
                render={<Link href={`/leads/${appt.leadId}`} />}
                aria-label={`Open lead workspace for ${displayName}`}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : null}
            <LibraryOverflowMenu items={overflowItems} pending={overflowPending} />
          </div>
        </div>
      </div>

      {!archivedView && detailsOpen && (
        <div
          className="htc-tours-outcome"
          id={`tour-details-${appt.id}`}
          data-tours-details=""
        >
          {appt.contactEmail ? (
            <p data-tours-email="">
              <a href={`mailto:${appt.contactEmail}`}>{appt.contactEmail}</a>
            </p>
          ) : null}
          {(savedOutcome && isPostTour) ? (
            <p data-tours-outcome-summary="">
              Outcome: <span>{OUTCOME_LABELS[savedOutcome as TourOutcome] ?? savedOutcome}</span>
              {appt.followUpSentAt && <span data-tours-followup-sent=""> · Follow-up sent</span>}
            </p>
          ) : null}
          {savedNotes.trim() && !showOutcomeForm ? (
            <p data-tours-saved-notes="">{savedNotes.trim()}</p>
          ) : null}
          <div className="htc-tours-outcome-links">
            <button
              type="button"
              data-tours-notes-action=""
              onClick={() => setShowOutcomeForm(!showOutcomeForm)}
            >
              {showOutcomeForm
                ? "Close notes"
                : savedNotes.trim() || savedOutcome
                  ? "Edit notes"
                  : (isPostTour ? "Record what happened" : "Add notes")}
            </button>
            {isPostTour && !appt.followUpSentAt && (
              <button type="button" onClick={handleMarkFollowUp}>
                Mark follow-up sent
              </button>
            )}
          </div>
          {showOutcomeForm && (
            <div className="htc-tours-outcome-form" data-tours-notes-form="">
              {isPostTour ? (
                <Select value={outcome} onValueChange={setOutcome} items={OUTCOME_LABELS}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tour outcome…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interested">Interested</SelectItem>
                    <SelectItem value="considering">Considering</SelectItem>
                    <SelectItem value="not_a_fit">Not a fit</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">{internalNotesLabel("tour")}</p>
                <p className="text-[11px] text-muted-foreground">{INTERNAL_NOTES_PRIVACY_HINT}</p>
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes from the tour…"
                  className="text-xs"
                  data-tours-notes-input=""
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowOutcomeForm(false)}>Cancel</Button>
                <Button type="button" size="sm" className="h-7 text-xs" disabled={savingOutcome} onClick={handleSaveOutcome} data-tours-notes-save="">Save</Button>
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
              {appt.scheduledAt && Date.parse(appt.scheduledAt) > Date.now()
                ? " That time is still ahead. Enter when it happened, or leave both fields empty if you don't know yet."
                : " The fields start from the scheduled time. Change them if it happened at a different time."}
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

  function handleStatusChange(
    id: string,
    status: TourAppointment["status"],
    clocks?: { scheduledAt?: string | null; actualOccurredAt?: string | null; completedAt?: string | null },
  ) {
    setAppts((p) => p.map((a) => a.id === id ? {
      ...a,
      status,
      scheduledAt: clocks?.scheduledAt === undefined ? a.scheduledAt : clocks.scheduledAt,
      actualOccurredAt: clocks?.actualOccurredAt === undefined ? a.actualOccurredAt : clocks.actualOccurredAt,
      completedAt: clocks?.completedAt === undefined ? a.completedAt : clocks.completedAt,
    } : a));
    router.refresh();
  }

  return (
    <div className="htc-tours-list" data-tours-list="">
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
      className="htc-tours-archived"
      count={appointments.length}
      hint="Archived tours stay in reporting and history. Restore one to return it to Upcoming, Past, or Cancelled. Archived is not the same as Cancelled."
    >
      <TourList appointments={appointments} venueTimezone={venueTimezone} archivedView />
    </LibraryArchivedSection>
  );
}
