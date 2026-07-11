"use client";

/** Timeline item Links — raw URL + optional label, one row per link. */

import * as React from "react";

import { Link2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { addEntryLinkAction, removeEntryLinkAction } from "@/app/(app)/events/[id]/timeline-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TimelineEntryLink } from "@/lib/timeline/types";

export function TimelineLinksField({
  eventId, timelineEntryId, links, onChanged,
}: {
  eventId: string;
  timelineEntryId: string;
  links: TimelineEntryLink[];
  onChanged: (links: TimelineEntryLink[]) => void;
}) {
  const [addingLink, setAddingLink] = React.useState(false);
  const [linkLabel, setLinkLabel] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  async function handleAddLink() {
    if (!linkUrl.trim()) return;
    setSaving(true);
    const result = await addEntryLinkAction(timelineEntryId, eventId, linkUrl.trim(), linkLabel.trim() || null, links.length);
    setSaving(false);
    if (result.ok) { toast.success("Link added."); setLinkLabel(""); setLinkUrl(""); setAddingLink(false); onChanged([...links, result.link]); }
    else toast.error(result.message ?? "Could not add link.");
  }

  async function handleRemove(linkId: string) {
    setRemovingId(linkId);
    const result = await removeEntryLinkAction(linkId, eventId);
    setRemovingId(null);
    if (result.ok) onChanged(links.filter((l) => l.id !== linkId));
    else toast.error("Could not remove link.");
  }

  return (
    <div className="space-y-2">
      {links.map((l) => (
        <div key={l.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-xs text-primary hover:underline">
            {l.label || l.url}
          </a>
          <button type="button" onClick={() => handleRemove(l.id)} disabled={removingId === l.id} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive">
            {removingId === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          </button>
        </div>
      ))}

      {addingLink ? (
        <div className="grid grid-cols-2 gap-1.5">
          <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label (optional)" className="h-7 text-xs" />
          <div className="flex gap-1.5">
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="h-7 text-xs" />
            <Button type="button" size="sm" className="h-7 px-2 text-xs shrink-0" disabled={!linkUrl.trim() || saving} onClick={handleAddLink}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setAddingLink(true)}>
          <Link2 className="mr-1 h-3 w-3" /> Add a link
        </Button>
      )}
    </div>
  );
}
