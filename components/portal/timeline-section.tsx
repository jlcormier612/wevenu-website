"use client";

/**
 * Client Timeline — the couple's own always-live view (docs/client-
 * workspace-product-architecture.md §12, refined 2026-07-17): the venue's
 * live structural framework, read-only here, plus the couple's own
 * private draft, fully editable (including delete and Visibility) until
 * they explicitly Submit. Submitting creates an immutable snapshot for
 * the venue and does not freeze this workspace — the couple keeps
 * planning; a later Submit creates a new snapshot.
 */

import * as React from "react";

import { Check, CheckCircle2, Circle, Clock, FileText, Link2, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatTime, formatTimelineDayHeader, isMultiDayEvent, maxDayOffset, timelineDayOptions, compareTimelineEntries } from "@/lib/timeline/constants";
import { TIMELINE_AUDIENCES, type TimelineAudience } from "@/lib/timeline/types";
import type { PortalTimeline, PortalTimelineEntry, PortalTimelineSection } from "@/lib/portal/types";
import { celebrateLuv } from "@/lib/luv/celebrate";
import { coupleCelebrationMessage } from "@/lib/luv/celebrations";

function formatEntryTimeRange(entryTime: string | null, endTime: string | null): string {
  if (!entryTime && !endTime) return "";
  if (entryTime && endTime) return `${formatTime(entryTime)} – ${formatTime(endTime)}`;
  return formatTime(entryTime ?? endTime);
}

function DaySelect({
  value, onChange, eventDate, eventEndDate,
}: {
  value: number;
  onChange: (v: number) => void;
  eventDate: string;
  eventEndDate?: string | null;
}) {
  const options = timelineDayOptions(eventDate, eventEndDate);
  if (options.length <= 1) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
      aria-label="Day"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function VisibilityPicker({
  entryId, token, audiences, onChanged,
}: { entryId: string; token: string; audiences: string[]; onChanged: (audiences: string[]) => void }) {
  const [saving, setSaving] = React.useState(false);

  async function toggle(value: TimelineAudience) {
    const next = audiences.includes(value) ? audiences.filter((a) => a !== value) : [...audiences, value];
    setSaving(true);
    const res = await fetch("/api/portal/timeline/visibility", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, entryId, audiences: next }),
    });
    const data = await res.json() as { ok: boolean };
    setSaving(false);
    if (data.ok) onChanged(next);
    else toast.error("Couldn't update who sees this item.");
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      <span className="text-[10px] text-muted-foreground">Also share with:</span>
      {TIMELINE_AUDIENCES.map((a) => (
        <button
          key={a.value}
          type="button"
          disabled={saving}
          onClick={() => toggle(a.value)}
          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-60 ${
            audiences.includes(a.value) ? "text-white border-transparent" : "border-border text-muted-foreground hover:border-ring"
          }`}
          style={audiences.includes(a.value) ? { background: a.color } : {}}
        >
          {a.emoji} {a.label}
        </button>
      ))}
    </div>
  );
}

function EntryEditForm({
  entry, eventDate, eventEndDate, onSave, onCancel, pending,
}: {
  entry: PortalTimelineEntry;
  eventDate?: string | null;
  eventEndDate?: string | null;
  onSave: (title: string, description: string, entryTime: string, endTime: string, dayOffset: number) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [title, setTitle] = React.useState(entry.title);
  const [description, setDescription] = React.useState(entry.description ?? "");
  const [entryTime, setEntryTime] = React.useState(entry.entryTime ?? "");
  const [endTime, setEndTime] = React.useState(entry.endTime ?? "");
  const [dayOffset, setDayOffset] = React.useState(entry.dayOffset ?? 0);

  return (
    <div className="space-y-2.5 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-8 text-sm" autoFocus />
        {eventDate && (
          <DaySelect value={dayOffset} onChange={setDayOffset} eventDate={eventDate} eventEndDate={eventEndDate} />
        )}
        <Input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className="h-8 w-28 text-sm" aria-label="Start time" />
        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-8 w-28 text-sm" aria-label="End time" />
      </div>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details (optional)" rows={2} className="text-sm" />
      <div className="flex items-center justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending} className="h-7 px-2 text-xs">
          <X className="mr-1 h-3 w-3" /> Cancel
        </Button>
        <Button type="button" size="sm" disabled={!title.trim() || pending} onClick={() => onSave(title, description, entryTime, endTime, dayOffset)} className="h-7 px-2 text-xs">
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="mr-1 h-3 w-3" />Save</>}
        </Button>
      </div>
    </div>
  );
}

function EntryRow({
  entry, token, eventDate, eventEndDate, onUpdated, onDeleted, onVisibilityChanged,
}: {
  entry: PortalTimelineEntry; token: string;
  eventDate?: string | null;
  eventEndDate?: string | null;
  onUpdated: (entry: PortalTimelineEntry) => void;
  onDeleted: (id: string) => void;
  onVisibilityChanged: (id: string, audiences: string[]) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleSave(title: string, description: string, entryTime: string, endTime: string, dayOffset: number) {
    setSaving(true);
    const res = await fetch("/api/portal/timeline", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, entryId: entry.id, title, description, entryTime, endTime, dayOffset }),
    });
    const data = await res.json() as { ok: boolean };
    setSaving(false);
    if (data.ok) {
      onUpdated({
        ...entry,
        title,
        description: description || null,
        entryTime: entryTime || null,
        endTime: endTime || null,
        dayOffset,
      });
      setEditing(false);
    } else {
      toast.error("Could not save your changes.");
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove "${entry.title}" from your timeline?`)) return;
    setDeleting(true);
    const res = await fetch("/api/portal/timeline/delete", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, entryId: entry.id }),
    });
    const data = await res.json() as { ok: boolean };
    setDeleting(false);
    if (data.ok) onDeleted(entry.id);
    else toast.error("Could not remove this item.");
  }

  if (editing) {
    return (
      <EntryEditForm
        entry={entry}
        eventDate={eventDate}
        eventEndDate={eventEndDate}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
        pending={saving}
      />
    );
  }

  const isOwnItem = entry.owner === "client";

  return (
    <div className="w-full rounded-xl border border-border/60 bg-card px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {entry.entryTime || entry.endTime ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-heading">
                <Clock className="h-3 w-3" /> {formatEntryTimeRange(entry.entryTime, entry.endTime)}
              </span>
            ) : (
              <span className="text-[10px] italic text-muted-foreground">No time set</span>
            )}
            {!isOwnItem && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                🔒 From your venue
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-medium text-foreground">{entry.title}</p>
          {entry.description && <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{entry.description}</p>}

          {entry.links.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {entry.links.map((l) => (
                <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Link2 className="h-3 w-3 shrink-0" /> {l.label || l.url}
                </a>
              ))}
            </div>
          )}

          {entry.attachments.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {entry.attachments.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <FileText className="h-3 w-3 shrink-0" /> {a.name}
                </a>
              ))}
            </div>
          )}

          {/* Visibility follows Ownership — only the couple's own items
              show a picker here; the venue's own items are managed by
              the venue. */}
          {entry.canManageVisibility && (
            <VisibilityPicker entryId={entry.id} token={token} audiences={entry.audiences} onChanged={(a) => onVisibilityChanged(entry.id, a)} />
          )}
        </div>

        {entry.canEdit && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={handleDelete} disabled={deleting} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-60" aria-label="Delete">
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddItemAction({
  token, sectionId, defaultDayOffset = 0, eventDate, eventEndDate, onAdded,
}: {
  token: string; sectionId: string; defaultDayOffset?: number;
  eventDate?: string | null; eventEndDate?: string | null;
  onAdded: (entry: PortalTimelineEntry) => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [entryTime, setEntryTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [dayOffset, setDayOffset] = React.useState(defaultDayOffset);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/portal/timeline/add", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, sectionId, title, description, entryTime, endTime, dayOffset }),
    });
    const data = await res.json() as { ok: boolean; entry?: PortalTimelineEntry };
    setSaving(false);
    if (data.ok && data.entry) {
      onAdded(data.entry);
      setTitle(""); setDescription(""); setEntryTime(""); setEndTime(""); setDayOffset(defaultDayOffset); setAdding(false);
    } else {
      toast.error("Could not add this item.");
    }
  }

  if (!adding) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} className="h-7 px-2 text-xs">
        <Plus className="mr-1 h-3 w-3" /> Add Timeline Item
      </Button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-8 text-sm" autoFocus />
        {eventDate && (
          <DaySelect value={dayOffset} onChange={setDayOffset} eventDate={eventDate} eventEndDate={eventEndDate} />
        )}
        <Input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className="h-8 w-28 text-sm" aria-label="Start time" />
        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-8 w-28 text-sm" aria-label="End time" />
      </div>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details (optional)" rows={2} className="text-sm" />
      <div className="flex items-center justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={saving} className="h-7 px-2 text-xs">
          <X className="mr-1 h-3 w-3" /> Cancel
        </Button>
        <Button type="button" size="sm" disabled={!title.trim() || saving} onClick={handleSave} className="h-7 px-2 text-xs">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="mr-1 h-3 w-3" />Add</>}
        </Button>
      </div>
    </div>
  );
}

function formatSubmittedAt(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function TimelineStatus({
  token, clientId, lastSubmittedAt, hasUnpublishedChanges, onSubmitted,
}: { token: string; clientId: string; lastSubmittedAt: string | null; hasUnpublishedChanges: boolean; onSubmitted: () => void }) {
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const res = await fetch("/api/portal/timeline/submit", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, clientId }),
    });
    const data = await res.json() as { ok: boolean; celebrated?: boolean };
    setSubmitting(false);
    if (data.ok) {
      if (data.celebrated) {
        celebrateLuv(coupleCelebrationMessage("timeline_submitted"));
      } else {
        toast.success("Your timeline is submitted — your venue can see it now.");
      }
      onSubmitted();
    } else {
      toast.error("Couldn't submit your timeline. Please try again.");
    }
  }

  return (
    <div className="w-full rounded-xl border border-border/60 bg-card px-3 py-3 space-y-2">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Timeline Status</p>

      {lastSubmittedAt ? (
        <div className="flex items-center gap-1.5 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-[var(--venue-primary)]" /> Submitted to venue
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Circle className="h-4 w-4" /> Not yet submitted
        </div>
      )}

      {lastSubmittedAt && (() => {
        const { date, time } = formatSubmittedAt(lastSubmittedAt);
        return (
          <p className="text-xs text-muted-foreground">
            Last submitted<br />{date}<br />{time}
          </p>
        );
      })()}

      {hasUnpublishedChanges && (
        <p className="text-xs font-medium text-[#8A5A5E]">You have unpublished changes.</p>
      )}

      {(hasUnpublishedChanges || !lastSubmittedAt) && (
        <Button type="button" size="sm" disabled={submitting} onClick={handleSubmit} className="mt-1">
          {submitting ? "Submitting…" : lastSubmittedAt ? "Submit Updated Timeline" : "Submit Timeline to Venue"}
        </Button>
      )}
    </div>
  );
}

export function TimelineSection({
  token, clientId, initialSections, initialEntries, initialLastSubmittedAt = null, initialHasUnpublishedChanges = false,
  eventDate = null, eventEndDate = null,
}: {
  token: string; clientId: string;
  initialSections: PortalTimelineSection[]; initialEntries: PortalTimelineEntry[];
  initialLastSubmittedAt?: string | null; initialHasUnpublishedChanges?: boolean;
  eventDate?: string | null;
  eventEndDate?: string | null;
}) {
  const [entries, setEntries] = React.useState(
    initialEntries.map((e) => ({
      ...e,
      dayOffset: Number(e.dayOffset ?? 0) || 0,
      endTime: e.endTime ? String(e.endTime).slice(0, 5) : null,
    })),
  );
  const [lastSubmittedAt, setLastSubmittedAt] = React.useState(initialLastSubmittedAt);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = React.useState(initialHasUnpublishedChanges);

  const multiDay = isMultiDayEvent(eventDate, eventEndDate);
  const dayOffsets = React.useMemo(() => {
    if (!multiDay) return [null] as (number | null)[];
    const max = maxDayOffset(eventDate, eventEndDate);
    return Array.from({ length: max + 1 }, (_, i) => i);
  }, [multiDay, eventDate, eventEndDate]);

  const refresh = React.useCallback(() => {
    fetch(`/api/portal/timeline?token=${token}`)
      .then((r) => r.json())
      .then((d: PortalTimeline) => {
        setEntries((d.entries ?? []).map((e) => ({
          ...e,
          dayOffset: Number(e.dayOffset ?? 0) || 0,
          endTime: e.endTime ? String(e.endTime).slice(0, 5) : null,
        })));
        setLastSubmittedAt(d.lastSubmittedAt ?? null);
        setHasUnpublishedChanges(d.hasUnpublishedChanges ?? false);
      })
      .catch(() => {});
  }, [token]);

  function handleUpdated(updated: PortalTimelineEntry) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? {
      ...updated,
      dayOffset: Number(updated.dayOffset ?? 0) || 0,
      endTime: updated.endTime ? String(updated.endTime).slice(0, 5) : null,
    } : e)));
    setHasUnpublishedChanges(true);
  }

  function handleAdded(entry: PortalTimelineEntry) {
    setEntries((prev) => [...prev, {
      ...entry,
      dayOffset: Number(entry.dayOffset ?? 0) || 0,
      endTime: entry.endTime ? String(entry.endTime).slice(0, 5) : null,
    }]);
    setHasUnpublishedChanges(true);
  }

  function handleDeleted(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setHasUnpublishedChanges(true);
  }

  function handleVisibilityChanged(id: string, audiences: string[]) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, audiences } : e)));
  }

  /** Whole-day chronological list — never section-first (that put 8pm client items above 6pm venue items). */
  function entriesForDay(day: number | null) {
    return entries
      .filter((e) => day == null || Number(e.dayOffset ?? 0) === day)
      .slice()
      .sort(compareTimelineEntries);
  }

  if (entries.length === 0 && initialSections.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center px-6 space-y-2">
        <p className="text-2xl">🕒</p>
        <p className="text-sm font-medium text-heading">No timeline shared yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">Your venue will share the Timeline here as it comes together.</p>
      </div>
    );
  }

  function renderDay(day: number | null) {
    const list = entriesForDay(day);
    const addTargetSectionId = initialSections.find((s) => s.clientCanAdd)?.id ?? null;
    const sectionNameById = new Map(initialSections.map((s) => [s.id, s.name]));

    return (
      <>
        {list.length > 0 && (
          <div className="space-y-2">
            {list.map((entry, index) => {
              const sectionName = entry.sectionId ? sectionNameById.get(entry.sectionId) ?? null : null;
              const prev = index > 0 ? list[index - 1] : null;
              const prevSectionName = prev?.sectionId ? sectionNameById.get(prev.sectionId) ?? null : null;
              const showSectionLabel = !!sectionName && sectionName !== prevSectionName;
              return (
                <div key={entry.id} className="space-y-1">
                  {showSectionLabel && (
                    <p className="pt-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground px-0.5">
                      {sectionName}
                    </p>
                  )}
                  <EntryRow
                    entry={entry}
                    token={token}
                    eventDate={eventDate}
                    eventEndDate={eventEndDate}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                    onVisibilityChanged={handleVisibilityChanged}
                  />
                </div>
              );
            })}
          </div>
        )}

        {addTargetSectionId && (
          <AddItemAction
            token={token}
            sectionId={addTargetSectionId}
            defaultDayOffset={day ?? 0}
            eventDate={eventDate}
            eventEndDate={eventEndDate}
            onAdded={handleAdded}
          />
        )}
      </>
    );
  }

  return (
    <div className="w-full space-y-5">
      <TimelineStatus
        token={token} clientId={clientId}
        lastSubmittedAt={lastSubmittedAt} hasUnpublishedChanges={hasUnpublishedChanges}
        onSubmitted={refresh}
      />

      {dayOffsets.map((day) => {
        if (!multiDay || day == null || !eventDate) {
          return <React.Fragment key="single">{renderDay(null)}</React.Fragment>;
        }
        return (
          <div key={day} className="space-y-4">
            <h3 className="font-heading text-sm font-semibold text-heading border-b border-border pb-2">
              {formatTimelineDayHeader(eventDate, day)}
            </h3>
            <div className="space-y-5">{renderDay(day)}</div>
          </div>
        );
      })}
    </div>
  );
}
