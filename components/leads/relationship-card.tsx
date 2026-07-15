"use client";

import * as React from "react";

import { Calendar, Clock, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";

import { updateRelationshipAction } from "@/app/(app)/leads/[id]/actions";
import { ConflictWarning } from "@/components/availability/conflict-warning";
import { Button } from "@/components/ui/button";
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
import type { Lead, RelationshipInput } from "@/lib/leads/types";

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

export function RelationshipCard({
  lead,
}: {
  lead: Lead;
}) {
  const [editing, setEditing] = React.useState(false);
  const [input, setInput] = React.useState<RelationshipInput>(() =>
    createInitialRelationshipInput(lead),
  );
  const [pending, startTransition] = React.useTransition();
  // Mirrors event-form.tsx's own dateBlocked wiring exactly — a hard
  // conflict (e.g. a calendar_blocked date) must disable Save here the same
  // way it already does for event creation, not just show an ignorable
  // advisory (Scheduling Release Readiness Phase 1).
  const [tourDateBlocked, setTourDateBlocked] = React.useState(false);
  const [nextActionMode, setNextActionMode] = React.useState<"preset" | "custom">(() =>
    (NEXT_ACTION_PRESETS as readonly string[]).includes(lead.nextActionText ?? "") || !lead.nextActionText
      ? "preset"
      : "custom",
  );

  // Track what changed relative to the saved lead values
  const prev = React.useRef(createInitialRelationshipInput(lead));

  function set<K extends keyof RelationshipInput>(key: K, value: RelationshipInput[K]) {
    setInput((p) => ({ ...p, [key]: value }));
  }

  function handleCancel() {
    setInput(createInitialRelationshipInput(lead));
    setEditing(false);
  }

  function handleSave() {
    startTransition(async () => {
      const hints = {
        tourScheduled: input.tourDate !== prev.current.tourDate && !!input.tourDate,
        followUpSet: input.followUpDate !== prev.current.followUpDate && !!input.followUpDate,
        contactedSet: input.lastContactedAt !== prev.current.lastContactedAt && !!input.lastContactedAt,
      };
      const result = await updateRelationshipAction(lead.id, input, hints);
      if (result.ok) {
        prev.current = { ...input };
        setEditing(false);
        toast.success("Relationship details saved.");
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Relationship</CardTitle>
          {!editing ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
            >
              {isEmpty ? "+ Add details" : "Edit"}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleCancel} disabled={pending}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={pending || tourDateBlocked} onClick={handleSave}>
                {pending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save"}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!editing ? (
          <div className="space-y-0.5">
            {lead.nextActionText ? (
              <DisplayRow
                icon={Clock}
                label="Next action"
                value={
                  lead.nextActionText +
                  (lead.nextActionDue ? ` — by ${formatDate(lead.nextActionDue)}` : "")
                }
              />
            ) : null}
            <DisplayRow icon={Calendar} label="Follow-up" value={formatDate(lead.followUpDate)} />
            <DisplayRow icon={Phone} label="Last contacted" value={formatDate(lead.lastContactedAt)} />
            <DisplayRow
              icon={Calendar}
              label="Tour"
              value={
                lead.tourDate
                  ? `${formatDate(lead.tourDate)}${lead.tourTime ? ` at ${lead.tourTime.slice(0, 5)}` : ""}${lead.tourCompleted ? " (completed)" : ""}`
                  : null
              }
            />
            {isEmpty && (
              <p className="py-1 text-sm text-muted-foreground">
                No relationship details yet. Click "Add details" to record next steps,
                follow-up dates, and tour scheduling.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
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
              <EditRow label="Due date">
                <Input
                  type="date"
                  value={input.nextActionDue}
                  onChange={(e) => set("nextActionDue", e.target.value)}
                />
              </EditRow>
            </div>

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
                <EditRow label="Tour date">
                  <Input
                    type="date"
                    value={input.tourDate}
                    onChange={(e) => set("tourDate", e.target.value)}
                  />
                </EditRow>
                <EditRow label="Tour time">
                  <Input
                    type="time"
                    value={input.tourTime}
                    onChange={(e) => set("tourTime", e.target.value)}
                  />
                </EditRow>
              </div>
              {input.tourDate && !input.tourCompleted && (
                <ConflictWarning date={input.tourDate} type="tour" excludeId={lead.id} onStatusChange={setTourDateBlocked} />
              )}
              <div className="flex items-center gap-2">
                <Switch
                  checked={input.tourCompleted}
                  onCheckedChange={(c) => set("tourCompleted", c)}
                />
                <Label>Tour completed</Label>
              </div>
              <EditRow label="Tour notes">
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
