"use client";

import * as React from "react";

import { Loader2, Pause, Play, Search, X } from "lucide-react";
import { toast } from "sonner";

import {
  cancelEnrollmentAction,
  enrollRelationshipAction,
  pauseEnrollmentAction,
  resumeEnrollmentAction,
  searchRelationshipsAction,
} from "@/app/(app)/communication/series/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SequenceEnrollment } from "@/lib/message-sequences/types";

export const ENROLLMENT_STATUS_LABEL: Record<SequenceEnrollment["status"], string> = {
  active: "Active",
  completed: "Completed",
  exited_reply: "Stopped — replied",
  exited_booking: "Stopped — booked",
  exited_lost: "Stopped — lost",
  exited_cancelled: "Stopped — cancelled",
  cancelled: "Cancelled",
};

function formatNextSend(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function progressLine(e: SequenceEnrollment): string | null {
  if (e.status !== "active") return null;
  const total = e.stepsTotal ?? 0;
  if (total === 0) return null;
  const sent = e.stepsSent ?? 0;
  const stepNum = Math.min(sent + 1, total);
  const next = e.nextScheduledFor
    ? ` · Next ${formatNextSend(e.nextScheduledFor)}`
    : sent >= total
      ? ""
      : "";
  return `Step ${stepNum} of ${total}${next}`;
}

function statusLabel(e: SequenceEnrollment): string {
  if (e.status === "active" && e.pausedAt) return "Paused";
  return ENROLLMENT_STATUS_LABEL[e.status];
}

export function SeriesEnrollments({ sequenceId, enrollments }: { sequenceId: string; enrollments: SequenceEnrollment[] }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<{ id: string; displayName: string }[]>([]);
  const [searching, startSearch] = React.useTransition();
  const [enrolling, startEnroll] = React.useTransition();
  const [rowPending, startRow] = React.useTransition();

  function handleSearch() {
    if (!query.trim()) return;
    startSearch(async () => {
      setResults(await searchRelationshipsAction(query));
    });
  }

  function handleEnroll(relationshipId: string) {
    startEnroll(async () => {
      const result = await enrollRelationshipAction(sequenceId, relationshipId);
      if (result.ok) {
        toast.success("Enrolled.");
        setResults((r) => r.filter((x) => x.id !== relationshipId));
      } else {
        toast.error(result.message ?? "Could not enroll.");
      }
    });
  }

  function handleCancel(enrollmentId: string) {
    startRow(async () => {
      const result = await cancelEnrollmentAction(sequenceId, enrollmentId);
      if (!result.ok) toast.error(result.message ?? "Could not cancel.");
    });
  }

  function handlePause(enrollmentId: string) {
    startRow(async () => {
      const result = await pauseEnrollmentAction(sequenceId, enrollmentId);
      if (result.ok) toast.success("Paused.");
      else toast.error(result.message ?? "Could not pause.");
    });
  }

  function handleResume(enrollmentId: string) {
    startRow(async () => {
      const result = await resumeEnrollmentAction(sequenceId, enrollmentId);
      if (result.ok) toast.success("Resumed.");
      else toast.error(result.message ?? "Could not resume.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
          placeholder="Search leads and clients by name…"
          className="h-9 text-sm"
        />
        <Button type="button" size="sm" variant="outline" onClick={handleSearch} disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-border p-2">
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
              <span>{r.displayName}</span>
              <Button type="button" size="xs" variant="outline" disabled={enrolling} onClick={() => handleEnroll(r.id)}>Enroll</Button>
            </div>
          ))}
        </div>
      )}

      {enrollments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one is enrolled in this automation yet.</p>
      ) : (
        <div className="space-y-1.5">
          {enrollments.map((e) => {
            const progress = progressLine(e);
            const isPaused = e.status === "active" && !!e.pausedAt;
            return (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-heading">{e.relationshipName}</span>
                    <Badge variant={e.status === "active" && !isPaused ? "default" : "muted"} className="text-[10px]">
                      {statusLabel(e)}
                    </Badge>
                  </div>
                  {progress && (
                    <p className="text-xs text-muted-foreground">{progress}</p>
                  )}
                </div>
                {e.status === "active" && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    {isPaused ? (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        disabled={rowPending}
                        onClick={() => handleResume(e.id)}
                        className="text-muted-foreground"
                        aria-label="Resume for this person"
                        title="Resume"
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        disabled={rowPending}
                        onClick={() => handlePause(e.id)}
                        className="text-muted-foreground"
                        aria-label="Pause for this person"
                        title="Pause"
                      >
                        <Pause className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      disabled={rowPending}
                      onClick={() => handleCancel(e.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Stop"
                      title="Stop"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
