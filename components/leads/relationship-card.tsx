"use client";

import * as React from "react";

import { Calendar, Clock, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";

import { completeFollowUpAction, updateRelationshipAction } from "@/app/(app)/leads/[id]/actions";
import { ConflictWarning } from "@/components/availability/conflict-warning";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createInitialRelationshipInput,
  formatDate,
} from "@/lib/leads/constants";
import { occurrenceEnteredSeparately, TOUR_ACTUAL_REQUIRED_MESSAGE } from "@/lib/leads/relationship-tour";
import type { Lead, RelationshipInput } from "@/lib/leads/types";
import {
  INTERNAL_NOTES_PRIVACY_HINT,
  internalNotesLabel,
} from "@/lib/notes/internal-notes-copy";
import { FUTURE_ACTUAL_OCCURRENCE_MESSAGE, prefillActualFromScheduled } from "@/lib/tours/occurrence-clock";
import { formatVenueLocalClock, formatVenueLocalShortDate, utcToVenueLocalParts, venueLocalToUtcIso } from "@/lib/venue/timezone";

// Common next steps, covering the inquiry -> tour -> booked lifecycle. Not
// exhaustive on purpose — "Custom…" always drops back to free text, since
// every relationship eventually needs something this list didn't predict.
const NEXT_ACTION_PRESETS = [
  "Send pricing / info packet",
  "Schedule a tour",
  "Send tour confirmation",
  "Follow up after tour",
  "Send proposal / contract",
  "Follow up on contract",
  "Confirm event details",
] as const;
const CUSTOM_ACTION = "__custom__";

const TOUR_AS_SCHEDULED_HELP =
  "If the tour happened as scheduled, just mark it complete. Only enter an actual date or time if it was different.";

function differentTimeInitial(lead: Lead): boolean {
  return occurrenceEnteredSeparately({
    completed: Boolean(lead.tourCompleted),
    scheduledDate: lead.tourScheduledDate || lead.tourDate || "",
    scheduledTime: lead.tourScheduledTime || lead.tourTime || "",
    actualDate: lead.tourActualDate || "",
    actualTime: lead.tourActualTime || "",
  });
}

function DisplayRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-xs text-muted-foreground">{label}:&nbsp;</span>
        <span className="text-sm text-foreground">
          {value && value.trim() ? value : <span className="text-muted-foreground">—</span>}
        </span>
      </div>
    </div>
  );
}

function EditRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

type CompletionKind = "another_follow_up" | "other_next_action" | "no_further_follow_up";

export function RelationshipCard({
  lead,
  venueTimezone = null,
  tourActions = null,
  tourAppointments = null,
  hideManualTourSummary = false,
}: {
  lead: Lead;
  venueTimezone?: string | null;
  /** Schedule Tour and Copy scheduling link, beside the follow-up action. */
  tourActions?: React.ReactNode;
  /** Scheduled tours for this lead. Shown once, in this section. */
  tourAppointments?: React.ReactNode;
  hideManualTourSummary?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);
  const [completionKind, setCompletionKind] = React.useState<CompletionKind | null>(null);
  const [completeNextAction, setCompleteNextAction] = React.useState("");
  const [completeDate, setCompleteDate] = React.useState("");
  const [completeActionMode, setCompleteActionMode] = React.useState<"preset" | "custom">("preset");
  const [input, setInput] = React.useState<RelationshipInput>(() =>
    createInitialRelationshipInput(lead),
  );
  const [differentTime, setDifferentTime] = React.useState(() => differentTimeInitial(lead));
  const [pending, startTransition] = React.useTransition();
  // Capacity and calendar blocks stay visible, but they must not disable Save.
  // Follow-up fields share this button with the tour. The server writes the
  // follow-up first and returns a structured tour conflict without rolling it back.
  const [, setTourDateBlocked] = React.useState(false);
  const [tourConflictMessage, setTourConflictMessage] = React.useState<string | null>(null);
  const tourDateOnly = Boolean(input.tourDate.trim() && !input.tourTime.trim());
  const tourActualDateOnly = differentTime && Boolean(
    (input.tourActualDate.trim() && !input.tourActualTime.trim())
    || (!input.tourActualDate.trim() && input.tourActualTime.trim()),
  );
  const tourFormBlocked = input.tourCompleted ? tourActualDateOnly : tourDateOnly;
  const scheduledStillAhead = React.useMemo(() => {
    if (!input.tourDate || !input.tourTime) return false;
    const iso = venueLocalToUtcIso(input.tourDate, input.tourTime, venueTimezone);
    return prefillActualFromScheduled({
      scheduledAt: iso,
      timezone: venueTimezone,
      utcToParts: utcToVenueLocalParts,
    }).scheduledStillAhead;
  }, [input.tourDate, input.tourTime, venueTimezone]);
  const [nextActionMode, setNextActionMode] = React.useState<"preset" | "custom">(() =>
    (NEXT_ACTION_PRESETS as readonly string[]).includes(lead.nextActionText ?? "") || !lead.nextActionText
      ? "preset"
      : "custom",
  );

  // Track what changed relative to the saved lead values
  const prev = React.useRef(createInitialRelationshipInput(lead));

  function set<K extends keyof RelationshipInput>(key: K, value: RelationshipInput[K]) {
    setInput((p) => {
      const next = { ...p, [key]: value };
      if (key === "tourCompleted" && value === false) {
        next.tourActualDate = "";
        next.tourActualTime = "";
      }
      return next;
    });
    if (key === "tourCompleted" && value === true) {
      setTourDateBlocked(false);
      setTourConflictMessage(null);
    }
    if (key === "tourCompleted" && value === false) {
      setDifferentTime(false);
    }
  }

  function setHappenedAtDifferentTime(on: boolean) {
    setDifferentTime(on);
    if (!on) {
      setInput((p) => ({ ...p, tourActualDate: "", tourActualTime: "" }));
    }
  }

  function handleCancel() {
    setInput(createInitialRelationshipInput(lead));
    setDifferentTime(differentTimeInitial(lead));
    setEditing(false);
  }

  function resetCompletion() {
    setCompleting(false);
    setCompletionKind(null);
    setCompleteNextAction("");
    setCompleteDate("");
    setCompleteActionMode("preset");
  }

  function startCompletion() {
    setEditing(false);
    setCompleting(true);
    setCompletionKind(null);
    setCompleteNextAction("");
    setCompleteDate("");
    setCompleteActionMode("preset");
  }

  function submitCompletion(kind: CompletionKind, nextActionText?: string, followUpDate?: string) {
    startTransition(async () => {
      const result = await completeFollowUpAction(lead.id, {
        kind,
        nextActionText,
        followUpDate,
      });
      if (result.ok) {
        resetCompletion();
        toast.success("Follow-up completed.");
      } else {
        toast.error(result.message ?? "Could not complete follow-up.");
      }
    });
  }

  function handleCompleteSave() {
    if (!completionKind || completionKind === "no_further_follow_up") return;
    if (completionKind === "another_follow_up" && !completeDate.trim()) {
      toast.error("Enter the next follow-up date.");
      return;
    }
    if (!completeNextAction.trim()) {
      toast.error("Enter the next action.");
      return;
    }
    submitCompletion(completionKind, completeNextAction, completeDate);
  }

  function handleSave() {
    if (input.tourCompleted && differentTime) {
      if (!input.tourActualDate.trim() || !input.tourActualTime.trim()) {
        toast.error("Enter the date and time the tour actually occurred.");
        return;
      }
    } else if (input.tourCompleted) {
      if (!input.tourDate.trim() || !input.tourTime.trim()) {
        toast.error(TOUR_ACTUAL_REQUIRED_MESSAGE);
        return;
      }
      if (scheduledStillAhead) {
        toast.error(FUTURE_ACTUAL_OCCURRENCE_MESSAGE);
        return;
      }
    } else if (input.tourDate.trim() && !input.tourTime.trim()) {
      toast.error("A tour time is required to schedule a venue tour.");
      return;
    }
    const saved: RelationshipInput = {
      ...input,
      tourActualDate: input.tourCompleted && differentTime ? input.tourActualDate : "",
      tourActualTime: input.tourCompleted && differentTime ? input.tourActualTime : "",
    };
    startTransition(async () => {
      const hints = {
        tourScheduled: saved.tourDate !== prev.current.tourDate && !!saved.tourDate && !!saved.tourTime.trim() && !saved.tourCompleted,
        followUpSet: saved.followUpDate !== prev.current.followUpDate && !!saved.followUpDate,
        contactedSet: saved.lastContactedAt !== prev.current.lastContactedAt && !!saved.lastContactedAt,
      };
      const result = await updateRelationshipAction(lead.id, saved, hints);
      if (result.ok) {
        prev.current = { ...saved };
        setInput(saved);
        if (result.tourConflict) {
          setTourConflictMessage(result.tourConflict.message);
          toast.success("Follow-up details saved.");
          toast.error(result.tourConflict.message);
          // Keep editing open so the tour conflict stays visible inline.
          return;
        }
        setTourConflictMessage(null);
        setEditing(false);
        toast.success("Follow-up details saved.");
      } else {
        toast.error(result.message ?? "Could not save.");
      }
    });
  }

  const isEmpty =
    !lead.nextActionText &&
    !lead.followUpDate &&
    !lead.lastContactedAt &&
    !lead.tourDate;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Follow-up</CardTitle>
          {!editing && !completing ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {lead.followUpDate ? (
                <Button type="button" size="sm" className="h-8" onClick={startCompletion}>
                  Complete follow-up
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setEditing(true)}
              >
                {isEmpty ? "Add follow-up details" : "Edit"}
              </Button>
              {tourActions}
            </div>
          ) : completing ? (
            <Button type="button" variant="ghost" size="sm" onClick={resetCompletion} disabled={pending}>
              Cancel
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleCancel} disabled={pending}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={pending || tourFormBlocked} onClick={handleSave}>
                {pending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {completing ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-foreground">
                Follow up: {lead.nextActionText?.trim() ? lead.nextActionText : "—"}
              </p>
              <p className="text-sm text-foreground">
                Due: {formatDate(lead.followUpDate) || "—"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-heading">What&apos;s next?</p>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant={completionKind === "another_follow_up" ? "default" : "outline"}
                  size="sm"
                  disabled={pending}
                  onClick={() => setCompletionKind("another_follow_up")}
                >
                  Another follow-up
                </Button>
                <Button
                  type="button"
                  variant={completionKind === "other_next_action" ? "default" : "outline"}
                  size="sm"
                  disabled={pending}
                  onClick={() => setCompletionKind("other_next_action")}
                >
                  Other next action
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => submitCompletion("no_further_follow_up")}
                >
                  {pending && completionKind === null ? (
                    <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</>
                  ) : (
                    "No further follow-up"
                  )}
                </Button>
              </div>
            </div>
            {(completionKind === "another_follow_up" || completionKind === "other_next_action") && (
              <div className="space-y-3">
                <EditRow label="Next action">
                  {completeActionMode === "preset" ? (
                    <Select
                      value={completeNextAction || undefined}
                      onValueChange={(v) => {
                        if (v === CUSTOM_ACTION) {
                          setCompleteActionMode("custom");
                          setCompleteNextAction("");
                        } else {
                          setCompleteNextAction(v);
                        }
                      }}
                      items={[...NEXT_ACTION_PRESETS.map((p) => ({ value: p, label: p })), { value: CUSTOM_ACTION, label: "Custom…" }]}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose a next step…" /></SelectTrigger>
                      <SelectContent>
                        {NEXT_ACTION_PRESETS.map((preset) => (
                          <SelectItem key={preset} value={preset}>{preset}</SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_ACTION}>Custom…</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-1.5">
                      <Input
                        value={completeNextAction}
                        onChange={(e) => setCompleteNextAction(e.target.value)}
                        placeholder="What's the next step?"
                        autoFocus
                      />
                      <Button type="button" variant="ghost" size="sm"
                        onClick={() => { setCompleteActionMode("preset"); setCompleteNextAction(""); }}>
                        Use list
                      </Button>
                    </div>
                  )}
                </EditRow>
                <EditRow label={completionKind === "another_follow_up" ? "Follow-up date" : "Due date (optional)"}>
                  <Input
                    type="date"
                    value={completeDate}
                    onChange={(e) => setCompleteDate(e.target.value)}
                  />
                </EditRow>
                <Button type="button" size="sm" disabled={pending} onClick={handleCompleteSave}>
                  {pending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save"}
                </Button>
              </div>
            )}
          </div>
        ) : !editing ? (
          <div className="space-y-0.5">
            {lead.nextActionText ? (
              <DisplayRow
                icon={Clock}
                label="Next action"
                value={lead.nextActionText}
              />
            ) : null}
            <DisplayRow icon={Calendar} label="Follow-up" value={formatDate(lead.followUpDate)} />
            <DisplayRow icon={Phone} label="Last contacted" value={formatDate(lead.lastContactedAt)} />
            {hideManualTourSummary ? null : lead.tourCompleted && (lead.tourScheduledDate || lead.tourActualDate || lead.tourDate) ? (
              <>
                {lead.tourScheduledDate ? (
                  <DisplayRow
                    icon={Calendar}
                    label="Scheduled"
                    value={`${formatVenueLocalShortDate(lead.tourScheduledDate)}${lead.tourScheduledTime ? ` at ${formatVenueLocalClock(lead.tourScheduledTime)}` : ""}`}
                  />
                ) : null}
                <DisplayRow
                  icon={Calendar}
                  label="Actually occurred"
                  value={
                    lead.tourActualDate
                      ? `${formatVenueLocalShortDate(lead.tourActualDate)}${lead.tourActualTime ? ` at ${formatVenueLocalClock(lead.tourActualTime)}` : ""}`
                      : "Not recorded"
                  }
                />
                {lead.tourCompletedAt ? (
                  <DisplayRow
                    icon={Clock}
                    label="Marked completed"
                    value={(() => {
                      const when = new Date(lead.tourCompletedAt);
                      const zone = venueTimezone || undefined;
                      return when.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: zone,
                      });
                    })()}
                  />
                ) : null}
              </>
            ) : lead.tourDate ? (
              <DisplayRow
                icon={Calendar}
                label="Tour"
                value={`${formatVenueLocalShortDate(lead.tourDate)}${lead.tourTime ? ` at ${formatVenueLocalClock(lead.tourTime)}` : ""}`}
              />
            ) : null}
            {tourAppointments}
            {isEmpty && !tourAppointments && (
              <p className="py-1 text-sm text-muted-foreground">
                No follow-up details yet. Use Add follow-up details for next steps and dates, or Schedule Tour.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <EditRow label="Next action">
              {nextActionMode === "preset" ? (
                <Select
                  value={input.nextActionText || undefined}
                  onValueChange={(v) => {
                    if (v === CUSTOM_ACTION) {
                      setNextActionMode("custom");
                      set("nextActionText", "");
                    } else {
                      set("nextActionText", v);
                    }
                  }}
                  items={[...NEXT_ACTION_PRESETS.map((p) => ({ value: p, label: p })), { value: CUSTOM_ACTION, label: "Custom…" }]}
                >
                  <SelectTrigger><SelectValue placeholder="Choose a next step…" /></SelectTrigger>
                  <SelectContent>
                    {NEXT_ACTION_PRESETS.map((preset) => (
                      <SelectItem key={preset} value={preset}>{preset}</SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_ACTION}>Custom…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-1.5">
                  <Input
                    value={input.nextActionText}
                    onChange={(e) => set("nextActionText", e.target.value)}
                    placeholder="What's the next step?"
                    autoFocus
                  />
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => { setNextActionMode("preset"); set("nextActionText", ""); }}>
                    Use list
                  </Button>
                </div>
              )}
            </EditRow>

            <div className="grid gap-3 sm:grid-cols-2">
              <EditRow label="Follow-up date">
                <Input
                  type="date"
                  value={input.followUpDate}
                  onChange={(e) => set("followUpDate", e.target.value)}
                />
              </EditRow>
              <EditRow label="Last contacted">
                <Input
                  type="date"
                  value={input.lastContactedAt}
                  onChange={(e) => set("lastContactedAt", e.target.value)}
                />
              </EditRow>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Venue tour</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <EditRow label={input.tourCompleted && (lead.tourScheduledDate || input.tourDate) ? "Scheduled date" : "Tour date"}>
                  <Input
                    type="date"
                    value={input.tourDate}
                    onChange={(e) => set("tourDate", e.target.value)}
                    disabled={input.tourCompleted && Boolean(lead.tourScheduledDate || lead.tourDate)}
                  />
                </EditRow>
                <EditRow label={input.tourDate ? (input.tourCompleted ? "Scheduled time" : "Tour time *") : "Tour time"}>
                  <Input
                    type="time"
                    value={input.tourTime}
                    onChange={(e) => set("tourTime", e.target.value)}
                    disabled={input.tourCompleted && Boolean(lead.tourScheduledDate || lead.tourDate)}
                  />
                </EditRow>
              </div>
              {tourDateOnly && !input.tourCompleted ? (
                <p className="text-xs text-destructive">A tour time is required to schedule a venue tour. Clear the date to remove a scheduled tour.</p>
              ) : null}
              {tourConflictMessage ? (
                <p className="text-xs text-destructive" role="alert">{tourConflictMessage}</p>
              ) : null}
              {input.tourDate && input.tourTime && !input.tourCompleted && (
                <ConflictWarning date={input.tourDate} startTime={input.tourTime} type="tour" excludeId={lead.id} excludeLeadId={lead.id} onStatusChange={setTourDateBlocked} />
              )}
              <div className="flex items-center gap-2">
                <Switch
                  checked={input.tourCompleted}
                  onCheckedChange={(c) => set("tourCompleted", c)}
                />
                <Label>Tour completed</Label>
              </div>
              {input.tourCompleted ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">{TOUR_AS_SCHEDULED_HELP}</p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="tour-different-time"
                      checked={differentTime}
                      onCheckedChange={(v) => setHappenedAtDifferentTime(v === true)}
                    />
                    <Label htmlFor="tour-different-time">The tour happened at a different date or time</Label>
                  </div>
                  {differentTime ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <EditRow label="Actually occurred (date) *">
                        <Input
                          type="date"
                          value={input.tourActualDate}
                          onChange={(e) => set("tourActualDate", e.target.value)}
                        />
                      </EditRow>
                      <EditRow label="Actually occurred (time) *">
                        <Input
                          type="time"
                          value={input.tourActualTime}
                          onChange={(e) => set("tourActualTime", e.target.value)}
                        />
                      </EditRow>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <EditRow label={internalNotesLabel("tour")}>
                <p className="mb-1.5 text-[11px] text-muted-foreground">{INTERNAL_NOTES_PRIVACY_HINT}</p>
                <Textarea
                  value={input.tourNotes}
                  onChange={(e) => set("tourNotes", e.target.value)}
                  placeholder="Any notes from the tour…"
                  rows={2}
                />
              </EditRow>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
