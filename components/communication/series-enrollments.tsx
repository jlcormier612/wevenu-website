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
import { LeadLifecycleConfirmDialog } from "@/components/leads/lifecycle-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SequenceEnrollment } from "@/lib/message-sequences/types";

export const ENROLLMENT_STATUS_LABEL: Record<SequenceEnrollment["status"], string> = {
  active: "Active",
  completed: "Finished",
  exited_reply: "Stopped — replied",
  exited_booking: "Stopped — booked",
  exited_lost: "Stopped — lost",
  exited_cancelled: "Stopped — cancelled",
  cancelled: "Stopped",
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
    : "";
  return `Message ${stepNum} of ${total}${next}`;
}

function statusLabel(e: SequenceEnrollment): string {
  if (e.status === "active" && e.pausedAt) return "Paused";
  return ENROLLMENT_STATUS_LABEL[e.status];
}

export function SeriesEnrollments({ sequenceId, enrollments }: { sequenceId: string; enrollments: SequenceEnrollment[] }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<{ id: string; displayName: string; otherActiveAutomations: string[] }[]>([]);
  const [searching, startSearch] = React.useTransition();
  const [enrolling, startEnroll] = React.useTransition();
  const [rowPending, startRow] = React.useTransition();
  const [stopTarget, setStopTarget] = React.useState<SequenceEnrollment | null>(null);
  const [stopping, setStopping] = React.useState(false);

  function handleSearch() {
    if (!query.trim()) return;
    startSearch(async () => {
      setResults(await searchRelationshipsAction(query, sequenceId));
    });
  }

  function handleEnroll(relationshipId: string) {
    startEnroll(async () => {
      const result = await enrollRelationshipAction(sequenceId, relationshipId);
      if (result.ok) {
        toast.success("Added to this automation.");
        setResults((r) => r.filter((x) => x.id !== relationshipId));
      } else {
        toast.error(result.message ?? "Could not add them.");
      }
    });
  }

  async function handleStopConfirmed() {
    if (!stopTarget) return;
    setStopping(true);
    const result = await cancelEnrollmentAction(sequenceId, stopTarget.id);
    setStopping(false);
    if (result.ok) {
      toast.success("Stopped for this person.");
      setStopTarget(null);
    } else {
      toast.error(result.message ?? "Could not stop.");
    }
  }

  function handlePause(enrollmentId: string) {
    startRow(async () => {
      const result = await pauseEnrollmentAction(sequenceId, enrollmentId);
      if (result.ok) toast.success("Paused for this person.");
      else toast.error(result.message ?? "Could not pause.");
    });
  }

  function handleResume(enrollmentId: string) {
    startRow(async () => {
      const result = await resumeEnrollmentAction(sequenceId, enrollmentId);
      if (result.ok) toast.success("Resumed for this person.");
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
            <div key={r.id} className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
              <div className="min-w-0 space-y-0.5">
                <span>{r.displayName}</span>
                {r.otherActiveAutomations.length > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Also in another active automation: {r.otherActiveAutomations.join(", ")}
                  </p>
                )}
              </div>
              <Button type="button" size="xs" variant="outline" disabled={enrolling} onClick={() => handleEnroll(r.id)}>
                Add
              </Button>
            </div>
          ))}
        </div>
      )}

      {enrollments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one is in this automation yet.</p>
      ) : (
        <div className="space-y-1.5">
          {enrollments.map((e) => {
            const progress = progressLine(e);
            const isPaused = e.status === "active" && !!e.pausedAt;
            const others = e.otherActiveAutomations ?? [];
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
                  {others.length > 0 && e.status === "active" && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Also in another active automation: {others.join(", ")}
                    </p>
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
                        title="Resume for this person"
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
                        title="Pause for this person only"
                      >
                        <Pause className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      disabled={rowPending}
                      onClick={() => setStopTarget(e)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Stop for this person"
                      title="Stop for this person"
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

      <LeadLifecycleConfirmDialog
        open={!!stopTarget}
        title={`Stop this automation for ${stopTarget?.relationshipName ?? "this person"}?`}
        description="They won’t receive any more messages from this automation. Their conversation and past messages stay as they are."
        confirmLabel="Stop Automation"
        confirming={stopping}
        onConfirm={() => { void handleStopConfirmed(); }}
        onCancel={() => { if (!stopping) setStopTarget(null); }}
      />
    </div>
  );
}
