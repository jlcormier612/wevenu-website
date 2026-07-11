"use client";

/**
 * Client Timeline — the same Booking Timeline (timeline_entries), read
 * through get_portal_run_of_show's visibility filter (lib/portal/service.ts
 * resolvePortalTimeline). Not a second Timeline: read-only items display
 * as-is, and items marked editable by the coordinator edit the exact same
 * row via update_portal_timeline_entry. Sections are the same sections the
 * coordinator organized — no separate client-side grouping.
 */

import * as React from "react";

import { Check, Clock, FileText, Link2, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/lib/timeline/constants";
import type { PortalTimelineEntry, PortalTimelineSection } from "@/lib/portal/types";

const UNSECTIONED = "__unsectioned__";

function EntryEditForm({
  entry, onSave, onCancel, pending,
}: { entry: PortalTimelineEntry; onSave: (title: string, description: string, entryTime: string) => void; onCancel: () => void; pending: boolean }) {
  const [title, setTitle] = React.useState(entry.title);
  const [description, setDescription] = React.useState(entry.description ?? "");
  const [entryTime, setEntryTime] = React.useState(entry.entryTime ?? "");

  return (
    <div className="space-y-2.5 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-8 text-sm" autoFocus />
        <Input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className="h-8 w-28 text-sm" />
      </div>
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details (optional)" rows={2} className="text-sm" />
      <div className="flex items-center justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending} className="h-7 px-2 text-xs">
          <X className="mr-1 h-3 w-3" /> Cancel
        </Button>
        <Button type="button" size="sm" disabled={!title.trim() || pending} onClick={() => onSave(title, description, entryTime)} className="h-7 px-2 text-xs">
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="mr-1 h-3 w-3" />Save</>}
        </Button>
      </div>
    </div>
  );
}

function EntryRow({ entry, token, onUpdated }: { entry: PortalTimelineEntry; token: string; onUpdated: (entry: PortalTimelineEntry) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function handleSave(title: string, description: string, entryTime: string) {
    setSaving(true);
    const res = await fetch("/api/portal/timeline", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, entryId: entry.id, title, description, entryTime }),
    });
    const data = await res.json() as { ok: boolean };
    setSaving(false);
    if (data.ok) {
      onUpdated({ ...entry, title, description: description || null, entryTime: entryTime || null });
      setEditing(false);
    } else {
      toast.error("Could not save your changes.");
    }
  }

  if (editing) {
    return <EntryEditForm entry={entry} onSave={handleSave} onCancel={() => setEditing(false)} pending={saving} />;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {entry.entryTime ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-heading">
                <Clock className="h-3 w-3" /> {formatTime(entry.entryTime)}
              </span>
            ) : (
              <span className="text-[10px] italic text-muted-foreground">No time set</span>
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
        </div>

        {entry.canEdit && (
          <button type="button" onClick={() => setEditing(true)} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function AddItemAction({
  token, sectionId, onAdded,
}: { token: string; sectionId: string; onAdded: (entry: PortalTimelineEntry) => void }) {
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [entryTime, setEntryTime] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/portal/timeline/add", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, sectionId, title, description, entryTime }),
    });
    const data = await res.json() as { ok: boolean; entry?: PortalTimelineEntry };
    setSaving(false);
    if (data.ok && data.entry) {
      onAdded(data.entry);
      setTitle(""); setDescription(""); setEntryTime(""); setAdding(false);
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
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-8 text-sm" autoFocus />
        <Input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className="h-8 w-28 text-sm" />
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

export function TimelineSection({
  token, initialSections, initialEntries,
}: { token: string; initialSections: PortalTimelineSection[]; initialEntries: PortalTimelineEntry[] }) {
  const [entries, setEntries] = React.useState(initialEntries);

  function handleUpdated(updated: PortalTimelineEntry) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  function handleAdded(entry: PortalTimelineEntry) {
    setEntries((prev) => [...prev, entry]);
  }

  const groups = React.useMemo(() => {
    const map = new Map<string, PortalTimelineEntry[]>();
    initialSections.forEach((s) => map.set(s.id, []));
    map.set(UNSECTIONED, []);
    for (const e of entries) {
      const key = e.sectionId && map.has(e.sectionId) ? e.sectionId : UNSECTIONED;
      map.get(key)!.push(e);
    }
    for (const [, list] of map) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return map;
  }, [entries, initialSections]);

  if (entries.length === 0 && initialSections.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center px-6 space-y-2">
        <p className="text-2xl">🕒</p>
        <p className="text-sm font-medium text-heading">No timeline shared yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">Your venue will share the day-of schedule here as it comes together.</p>
      </div>
    );
  }

  const unsectioned = groups.get(UNSECTIONED) ?? [];

  return (
    <div className="space-y-5">
      {initialSections.map((section) => {
        const list = groups.get(section.id) ?? [];
        // A brand-new addable section can be legitimately empty until the
        // couple (or venue) adds its first item — only hide sections that
        // are both empty and not addable.
        if (list.length === 0 && !section.clientCanAdd) return null;
        return (
          <div key={section.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-sm font-semibold text-heading">{section.name}</h3>
              {list.length > 0 && <Badge variant="outline" className="text-[10px]">{list.length}</Badge>}
            </div>
            <div className="space-y-2">
              {list.map((entry) => <EntryRow key={entry.id} entry={entry} token={token} onUpdated={handleUpdated} />)}
              {list.length === 0 && <p className="text-xs text-muted-foreground italic">Nothing here yet.</p>}
            </div>
            {section.clientCanAdd && <AddItemAction token={token} sectionId={section.id} onAdded={handleAdded} />}
          </div>
        );
      })}

      {unsectioned.length > 0 && (
        <div className="space-y-2">
          {initialSections.length > 0 && <h3 className="font-heading text-sm font-semibold text-heading">Other</h3>}
          <div className="space-y-2">
            {unsectioned.map((entry) => <EntryRow key={entry.id} entry={entry} token={token} onUpdated={handleUpdated} />)}
          </div>
        </div>
      )}
    </div>
  );
}
