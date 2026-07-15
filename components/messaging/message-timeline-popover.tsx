"use client";

/**
 * Message Timeline — Communication Trust Experience, final piece.
 *
 * Click a message's status badge to see exactly what happened to it and
 * when: Created → Sent → Delivered → Opened → Clicked → Replied (or
 * Couldn't deliver), each with its own real timestamp. Wraps
 * MessageStatusBadge rather than replacing it — same trigger a coordinator
 * already looks at, now also clickable.
 */
import * as React from "react";
import { Loader2 } from "lucide-react";

import { getMessageTimelineAction } from "@/app/(app)/messaging/actions";
import { MessageStatusBadge } from "@/components/messaging/message-status-badge";
import type { TimelineStep } from "@/lib/communication/timeline";

function formatStep(step: TimelineStep, previousDateLabel: string | null): { dateLabel: string | null; time: string } {
  const d = new Date(step.occurredAt);
  const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  // Same pattern as the worked example: the date only appears when it's
  // the first step or differs from the step before it — same-day entries
  // show just the time.
  return { dateLabel: dateLabel !== previousDateLabel ? dateLabel : null, time };
}

export function MessageTimelinePopover({
  messageId, source, status, failureReason, isOutbound,
}: {
  messageId: string;
  source: "legacy" | "conversation";
  status: string | null | undefined;
  failureReason?: string | null;
  isOutbound: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [steps, setSteps] = React.useState<TimelineStep[] | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && steps === null) {
      setLoading(true);
      setSteps(await getMessageTimelineAction(messageId, source));
      setLoading(false);
    }
  }

  if (!isOutbound || !status) return null;

  return (
    <span ref={containerRef} className="relative inline-block">
      <button type="button" onClick={() => void toggle()} className="cursor-pointer">
        <MessageStatusBadge status={status} failureReason={failureReason} isOutbound={isOutbound} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-xl border border-border bg-popover p-3 text-left shadow-lg">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Message Timeline</p>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!loading && steps && steps.length === 0 && (
            <p className="text-xs text-muted-foreground">No timeline yet.</p>
          )}
          {!loading && steps && steps.length > 0 && (
            <ol className="space-y-0">
              {steps.map((step, i) => {
                const prev = i > 0 ? new Date(steps[i - 1].occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
                const { dateLabel, time } = formatStep(step, prev);
                return (
                  <li key={step.key}>
                    {i > 0 && <div className="ml-[5px] h-3 w-px bg-border" aria-hidden />}
                    <div className="flex items-start gap-2">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <div>
                        <p className="text-[11px] text-muted-foreground">{dateLabel ? `${dateLabel} ${time}` : time}</p>
                        <p className="text-xs font-medium text-heading">{step.label}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </span>
  );
}
