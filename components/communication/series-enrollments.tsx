"use client";

import * as React from "react";

import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { cancelEnrollmentAction, enrollRelationshipAction, searchRelationshipsAction } from "@/app/(app)/communication/series/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SequenceEnrollment } from "@/lib/message-sequences/types";

const STATUS_LABEL: Record<SequenceEnrollment["status"], string> = {
  active: "Active", completed: "Completed", exited_reply: "Stopped — replied",
  exited_booking: "Stopped — booked", cancelled: "Cancelled",
};

export function SeriesEnrollments({ sequenceId, enrollments }: { sequenceId: string; enrollments: SequenceEnrollment[] }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<{ id: string; displayName: string }[]>([]);
  const [searching, startSearch] = React.useTransition();
  const [enrolling, startEnroll] = React.useTransition();
  const [cancelling, startCancel] = React.useTransition();

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
    startCancel(async () => {
      const result = await cancelEnrollmentAction(sequenceId, enrollmentId);
      if (!result.ok) toast.error(result.message ?? "Could not cancel.");
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
          {enrollments.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-heading">{e.relationshipName}</span>
                <Badge variant={e.status === "active" ? "default" : "muted"} className="text-[10px]">{STATUS_LABEL[e.status]}</Badge>
              </div>
              {e.status === "active" && (
                <Button type="button" size="icon-xs" variant="ghost" disabled={cancelling} onClick={() => handleCancel(e.id)}
                  className="text-muted-foreground hover:text-destructive">
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
