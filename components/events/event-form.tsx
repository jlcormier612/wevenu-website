"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createEventAction } from "@/app/(app)/events/actions";
import { applyPlaybookAction } from "@/app/(app)/playbooks/actions";
import { PlaybookApplyPreviewSheet } from "@/components/playbooks/playbook-apply-preview-sheet";
import { applyPreviewKindCopy } from "@/lib/playbooks/apply-preview";
import { PLAYBOOK_KINDS } from "@/lib/playbooks/constants";
import type { PlaybookKind, PlaybookTemplateWithStats } from "@/lib/playbooks/types";
import { ConflictWarning } from "@/components/availability/conflict-warning";
import { Field } from "@/components/setup/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { eventInputFromVenueEvent } from "@/lib/events/constants";
import type { EventErrors, EventInput, VenueEvent } from "@/lib/events/types";
import { EVENT_TYPES } from "@/lib/leads/constants";
import type { VenueSpace } from "@/lib/availability/types";

export function EventFormFields({
  input, errors, set, onSubmit, pending, submitLabel = "Create event",
  spaces = [], existingEventId,
}: {
  input: EventInput;
  errors: EventErrors;
  set: <K extends keyof EventInput>(key: K, v: EventInput[K]) => void;
  onSubmit: () => void;
  pending: boolean;
  submitLabel?: string;
  spaces?: VenueSpace[];
  existingEventId?: string; // exclude self when editing
}) {
  const router = useRouter();
  const [dateBlocked, setDateBlocked] = React.useState(false);
  return (
    <div className="space-y-6">
      <Field label="Event name" htmlFor="en" required error={errors.name}>
        <Input id="en" value={input.name} onChange={(e) => set("name", e.target.value)} placeholder="Emily & James Carter — Wedding" aria-invalid={errors.name ? true : undefined} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event type" htmlFor="et">
          <Select value={input.eventType} onValueChange={(v) => set("eventType", v)} items={EVENT_TYPES}>
            <SelectTrigger id="et"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{EVENT_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Start date" htmlFor="ed" required error={errors.eventDate}>
          <Input id="ed" type="date" value={input.eventDate} onChange={(e) => set("eventDate", e.target.value)} aria-invalid={errors.eventDate ? true : undefined} />
        </Field>
      </div>

      <Field
        label="End date"
        htmlFor="eed"
        error={errors.eventEndDate}
        hint="Optional — leave blank for a single-day event."
      >
        <Input
          id="eed"
          type="date"
          value={input.eventEndDate}
          min={input.eventDate || undefined}
          onChange={(e) => set("eventEndDate", e.target.value)}
          aria-invalid={errors.eventEndDate ? true : undefined}
        />
      </Field>

      {/* Space assignment + availability check */}
      {spaces.length > 0 && (
        <Field label="Event space" htmlFor="sp" hint="Optional — assign this event to a specific space.">
          <Select
            value={input.spaceId}
            onValueChange={(v) => set("spaceId", v)}
            items={[
              { value: "", label: "No specific space" },
              ...spaces.filter((s) => s.isActive).map((s) => ({
                value: s.id,
                label: `${s.name}${s.capacity != null ? ` — ${s.capacity.toLocaleString()} guests` : ""}`,
              })),
            ]}
          >
            <SelectTrigger id="sp"><SelectValue placeholder="No specific space" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">No specific space</SelectItem>
              {spaces.filter((s) => s.isActive).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.capacity != null ? ` — ${s.capacity.toLocaleString()} guests` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {/* Availability conflict advisory — hard block disables save */}
      {input.eventDate && (
        <ConflictWarning
          date={input.eventDate}
          spaceId={input.spaceId || undefined}
          type="event"
          excludeId={existingEventId}
          onStatusChange={setDateBlocked}
        />
      )}

      <Separator />
      <p className="text-sm font-medium text-heading">Day-of schedule</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start time" htmlFor="st">
          <Input id="st" type="time" value={input.startTime} onChange={(e) => set("startTime", e.target.value)} />
        </Field>
        <Field label="End time" htmlFor="et2" error={errors.endTime}>
          <Input id="et2" type="time" value={input.endTime} onChange={(e) => set("endTime", e.target.value)} />
        </Field>
        <Field label="Setup begins" htmlFor="su">
          <Input id="su" type="time" value={input.setupTime} onChange={(e) => set("setupTime", e.target.value)} />
        </Field>
        <Field label="Teardown ends" htmlFor="td">
          <Input id="td" type="time" value={input.teardownTime} onChange={(e) => set("teardownTime", e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guest count" htmlFor="gc" error={errors.guestCount}>
          <Input id="gc" type="number" value={input.guestCount} onChange={(e) => set("guestCount", e.target.value)} placeholder="150" />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={onSubmit} disabled={pending || dateBlocked}
          title={dateBlocked ? "Remove the calendar block before saving." : undefined}>
          {pending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Saving…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}

export function EventForm({
  initial, spaces = [], playbookTemplates = [],
}: {
  initial: EventInput;
  spaces?: VenueSpace[];
  playbookTemplates?: PlaybookTemplateWithStats[];
}) {
  const router = useRouter();
  const [input, setInput] = React.useState<EventInput>(initial);
  const [errors, setErrors] = React.useState<EventErrors>({});
  const [pending, startTransition] = React.useTransition();
  // Client Planning and Venue Planning are independent selections — a venue
  // may apply one, both, or neither at creation time (Product Decisions,
  // 2026-07-08). Each starts unselected; there's no meaningful "default"
  // playbook to preselect when multiple exist per kind.
  const [selected, setSelected] = React.useState<Record<PlaybookKind, string>>({ client: "", venue: "" });
  const [previewKind, setPreviewKind] = React.useState<PlaybookKind | null>(null);

  const set = <K extends keyof EventInput>(key: K, v: EventInput[K]) => {
    setInput((p) => ({ ...p, [key]: v }));
    setErrors((p) => { const n = { ...p }; delete n[key]; return n; });
  };

  function handleSubmit() {
    startTransition(async () => {
      const result = await createEventAction(input);
      if (!result.ok) {
        if (result.errors) setErrors(result.errors);
        toast.error(result.message ?? "Please fix the highlighted fields.");
        return;
      }
      const toApply = PLAYBOOK_KINDS.map((k) => selected[k.value]).filter(Boolean);
      if (toApply.length > 0 && input.eventDate) {
        let allApplied = true;
        for (const templateId of toApply) {
          const applyResult = await applyPlaybookAction(result.eventId, templateId, input.eventDate);
          if (!applyResult.ok) allApplied = false;
        }
        if (allApplied) toast.success("Event created and checklists applied — tasks and reminders are ready.");
        else {
          toast.success("Event created.");
          toast.error("A checklist could not be applied. You can apply it from the event's Planning tab.");
        }
      } else {
        toast.success("Event created.");
      }
      router.push(`/events/${result.eventId}`);
    });
  }

  const templatesByKind = (kind: PlaybookKind) => playbookTemplates.filter((t) => t.kind === kind);
  const previewTemplateId = previewKind ? selected[previewKind] : "";

  return (
    <div className="space-y-6">
      <EventFormFields input={input} errors={errors} set={set} onSubmit={handleSubmit} pending={pending} spaces={spaces} />
      {playbookTemplates.length > 0 && (
        <div className="rounded-sm border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium text-heading">Starting checklists (optional)</p>
          <p className="text-xs text-muted-foreground -mt-2">
            Preview what&apos;s included before you create the event. Applying creates this event&apos;s own copy — later Library edits won&apos;t change it.
          </p>
          {PLAYBOOK_KINDS.map((k) => {
            const options = templatesByKind(k.value);
            if (options.length === 0) return null;
            const kindCopy = applyPreviewKindCopy(k.value);
            return (
              <div key={k.value} className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-heading">{k.emoji} {kindCopy.label}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{kindCopy.explanation}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Select
                      value={selected[k.value]}
                      onValueChange={(v) => setSelected((p) => ({ ...p, [k.value]: v }))}
                      items={[{ value: "", label: `None — skip for now` }, ...options.map((t) => ({ value: t.id, label: t.name }))]}
                    >
                      <SelectTrigger className="h-8 w-44 text-sm">
                        <SelectValue placeholder={`Select…`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None — skip for now</SelectItem>
                        {options.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} <span className="text-muted-foreground">— {t.taskCount} tasks</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={!selected[k.value]}
                      onClick={() => setPreviewKind(k.value)}
                    >
                      Preview
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {previewKind && previewTemplateId ? (
            <PlaybookApplyPreviewSheet
              open
              onOpenChange={(v) => { if (!v) setPreviewKind(null); }}
              templateId={previewTemplateId}
              kind={previewKind}
              canApply={false}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
