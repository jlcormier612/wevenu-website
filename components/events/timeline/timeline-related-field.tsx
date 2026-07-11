"use client";

/**
 * Timeline item "Related Items" — links to a Planning task, an assigned
 * vendor, the event's Floor Plan, its Conversation, or an Invoice (Timeline
 * Integration task). Planning is bidirectional by construction: attaching
 * here calls the same addEventTaskContextLink the Planning task's own
 * "Attach…" picker already uses, so it's the same row read from either
 * side, never a duplicate. The other four are one-directional pointers
 * (open the destination), matching what each requirement actually asked
 * for — none of Vendors/Floor Plans/Conversation/Invoices asked for a link
 * back to the Timeline item.
 */

import * as React from "react";

import Link from "next/link";
import { ClipboardList, CreditCard, LayoutTemplate, Loader2, MessageSquare, Truck, X } from "lucide-react";
import { toast } from "sonner";

import {
  addPlanningLinkAction, addRelatedLinkAction, removePlanningLinkAction, removeRelatedLinkAction,
} from "@/app/(app)/events/[id]/timeline-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EventTask } from "@/lib/playbooks/types";
import type { EventVendorAssignment } from "@/lib/vendors/types";
import type { Invoice } from "@/lib/invoices/types";
import type { FloorPlan } from "@/lib/floor-plans/types";
import type { TimelineRelatedLink, TimelineRelatedSourceType } from "@/lib/timeline/types";

const RELATED_ICONS: Record<TimelineRelatedSourceType, React.ComponentType<{ className?: string }>> = {
  planning_task: ClipboardList, vendor: Truck, floor_plan: LayoutTemplate, conversation: MessageSquare, invoice: CreditCard,
};

/** Same-page tab hashes the Booking Workspace already listens for. */
function relatedLinkHref(eventId: string, link: TimelineRelatedLink): string {
  const tabHash = link.sourceType === "planning_task" ? "playbook"
    : link.sourceType === "vendor" ? "vendors"
    : link.sourceType === "conversation" ? "messages"
    : link.sourceType === "floor_plan" ? "floorplan"
    : "invoice";
  return `/events/${eventId}#${tabHash}`;
}

function RelatedLinkRow({ eventId, link, onRemove, removing }: { eventId: string; link: TimelineRelatedLink; onRemove: () => void; removing: boolean }) {
  const Icon = RELATED_ICONS[link.sourceType];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <Link href={relatedLinkHref(eventId, link)} className="min-w-0 flex-1 truncate text-xs text-primary hover:underline">
        {link.label}{link.detail ? ` · ${link.detail}` : ""}
      </Link>
      <button type="button" onClick={onRemove} disabled={removing} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive">
        {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      </button>
    </div>
  );
}

export function TimelineRelatedField({
  eventId, timelineEntryId, relatedLinks, eventTasks, vendorAssignments, floorPlans, conversationId, invoices, onChanged,
}: {
  eventId: string;
  timelineEntryId: string;
  relatedLinks: TimelineRelatedLink[];
  eventTasks: EventTask[];
  vendorAssignments: EventVendorAssignment[];
  floorPlans: FloorPlan[];
  conversationId: string | null;
  invoices: Invoice[];
  onChanged: (links: TimelineRelatedLink[]) => void;
}) {
  const [value, setValue] = React.useState("");
  const [attaching, setAttaching] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const alreadyLinkedIds = new Set(relatedLinks.map((l) => l.sourceId));

  const options = [
    ...eventTasks.filter((t) => !alreadyLinkedIds.has(t.id)).map((t) => ({ value: `planning_task:${t.id}`, label: `📋 ${t.title}` })),
    ...vendorAssignments.filter((v) => !alreadyLinkedIds.has(v.id)).map((v) => ({ value: `vendor:${v.id}`, label: `🚚 ${v.vendorName}${v.vendorCategory ? ` (${v.vendorCategory})` : ""}` })),
    ...floorPlans.filter((p) => !alreadyLinkedIds.has(p.id)).map((p) => ({ value: `floor_plan:${p.id}`, label: `🗺️ ${p.name}` })),
    ...(conversationId && !alreadyLinkedIds.has(conversationId) ? [{ value: `conversation:${conversationId}`, label: "💬 Conversation" }] : []),
    ...invoices.filter((i) => !alreadyLinkedIds.has(i.id)).map((i) => ({ value: `invoice:${i.id}`, label: `💳 Invoice ${i.invoiceNumber}` })),
  ];

  async function handleAttach() {
    if (!value) return;
    const [sourceType, sourceId] = value.split(/:(.+)/) as [TimelineRelatedSourceType, string];
    setAttaching(true);
    if (sourceType === "planning_task") {
      const result = await addPlanningLinkAction(timelineEntryId, eventId, sourceId);
      setAttaching(false);
      if (result.ok) {
        const task = eventTasks.find((t) => t.id === sourceId);
        onChanged([...relatedLinks, { id: sourceId, timelineEntryId, sourceType, sourceId, label: task?.title ?? "Task", detail: null }]);
        setValue("");
      } else {
        toast.error(result.message ?? "Could not attach task.");
      }
    } else {
      const result = await addRelatedLinkAction(timelineEntryId, eventId, sourceType, sourceId);
      setAttaching(false);
      if (result.ok) { onChanged([...relatedLinks, result.link]); setValue(""); }
      else toast.error(result.message ?? "Could not attach.");
    }
  }

  async function handleRemove(link: TimelineRelatedLink) {
    setRemovingId(link.id);
    const result = link.sourceType === "planning_task"
      ? await removePlanningLinkAction(link.id, eventId)
      : await removeRelatedLinkAction(link.id, eventId);
    setRemovingId(null);
    if (result.ok) onChanged(relatedLinks.filter((l) => l.id !== link.id));
    else toast.error(result.message ?? "Could not remove.");
  }

  return (
    <div className="space-y-2">
      {relatedLinks.map((link) => (
        <RelatedLinkRow key={link.id} eventId={eventId} link={link} onRemove={() => handleRemove(link)} removing={removingId === link.id} />
      ))}

      {options.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Select value={value} onValueChange={setValue} items={options}>
            <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="Link to…" /></SelectTrigger>
            <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <button
            type="button" onClick={handleAttach} disabled={!value || attaching}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
          >
            {attaching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Attach"}
          </button>
        </div>
      )}
    </div>
  );
}
