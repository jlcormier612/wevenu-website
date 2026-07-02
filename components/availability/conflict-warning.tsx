"use client";

import * as React from "react";
import { AlertTriangle, CalendarX, Ban } from "lucide-react";
import { checkAvailabilityAction } from "@/app/(app)/availability/actions";
import type { AvailabilityStatus, ConflictItem } from "@/lib/availability/types";

function ConflictRow({ conflict }: { conflict: ConflictItem }) {
  if (conflict.severity === "error") {
    return (
      <div className="flex items-start gap-2">
        <Ban className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive" />
        <p className="text-xs text-destructive">{conflict.message}</p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
      <p className="text-xs text-warning-foreground dark:text-warning">{conflict.message}</p>
    </div>
  );
}

export function ConflictWarning({
  date,
  spaceId,
  type,
  excludeId,
  onStatusChange,
}: {
  date: string;
  spaceId?: string;
  type: "event" | "tour";
  excludeId?: string;
  /** Called when availability resolves. `true` = hard block exists, save must be prevented. */
  onStatusChange?: (blocked: boolean) => void;
}) {
  const [status, setStatus] = React.useState<AvailabilityStatus | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!date) {
      setStatus(null);
      onStatusChange?.(false);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const result = await checkAvailabilityAction({ date, spaceId: spaceId || undefined, type, excludeId });
      setStatus(result);
      onStatusChange?.(result.conflicts.some(c => c.severity === "error"));
    }, 400);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [date, spaceId, type, excludeId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!status || status.conflicts.length === 0) return null;

  const hasError = status.conflicts.some(c => c.severity === "error");
  const errors   = status.conflicts.filter(c => c.severity === "error");
  const warnings = status.conflicts.filter(c => c.severity === "warning");

  return (
    <div className={[
      "rounded-lg border px-3 py-2.5 space-y-1.5",
      hasError ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/8",
    ].join(" ")}>
      <div className="flex items-center gap-1.5">
        <CalendarX className={["h-3.5 w-3.5", hasError ? "text-destructive" : "text-warning"].join(" ")} />
        <p className={[
          "text-xs font-semibold uppercase tracking-wide",
          hasError ? "text-destructive" : "text-warning-foreground dark:text-warning",
        ].join(" ")}>
          {hasError ? "Date unavailable" : "Availability notice"}
        </p>
      </div>
      <div className="space-y-1">
        {errors.map((c, i)   => <ConflictRow key={`e${i}`} conflict={c} />)}
        {warnings.map((c, i) => <ConflictRow key={`w${i}`} conflict={c} />)}
      </div>
      <p className={["text-xs", hasError ? "text-destructive/80" : "text-muted-foreground"].join(" ")}>
        {hasError
          ? "Remove this block from the Calendar before creating an event on this date."
          : "You can still proceed — this is advisory only."}
      </p>
    </div>
  );
}
