import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PRACTICE_REASSURANCE, type PracticeRun } from "@/lib/practice-run/types";

export function PracticeContextBanner({ run }: { run: PracticeRun }) {
  return (
    <div
      className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid="practice-context-banner"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted" data-testid="practice-context-badge">
            Practice Run
          </Badge>
          <p className="text-sm font-medium text-heading">{run.celebrationName}</p>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{PRACTICE_REASSURANCE}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        render={
          <Link
            href={`/setup-hub/practice-run?run=${encodeURIComponent(run.id)}`}
            data-testid="practice-back-to-practice-run"
          />
        }
      >
        Back to Practice Run
      </Button>
    </div>
  );
}
