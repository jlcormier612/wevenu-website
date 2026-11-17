import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PRACTICE_REASSURANCE, type PracticeRun } from "@/lib/practice-run/types";

/** Compact Practice Run chrome above the real client portal. */
export function PracticeClientFrame({
  run,
  venueName,
  children,
}: {
  run: PracticeRun;
  venueName: string;
  children: React.ReactNode;
}) {
  const venueHref = `/setup-hub/practice-run?run=${encodeURIComponent(run.id)}`;
  const clientHref = `/practice-run/${encodeURIComponent(run.id)}/client`;

  return (
    <div className="flex h-svh flex-col overflow-hidden" data-testid="practice-client-frame">
      <div className="z-30 shrink-0 border-b border-border bg-card/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="muted" data-testid="practice-run-indicator">
              Practice Run
            </Badge>
            <p className="truncate text-sm font-medium text-heading">{run.celebrationName}</p>
            <p className="hidden text-xs text-muted-foreground sm:inline">{venueName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-full border border-border bg-background p-0.5"
              data-testid="practice-run-perspective-switcher"
              role="group"
              aria-label="Practice perspective"
            >
              <Link
                href={venueHref}
                className="rounded-full px-3 py-1 text-sm text-muted-foreground hover:text-heading"
                data-testid="practice-perspective-venue"
              >
                Venue
              </Link>
              <Link
                href={clientHref}
                className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
                data-testid="practice-perspective-client"
                aria-current="page"
              >
                Client
              </Link>
            </div>
            <Link
              href={venueHref}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              data-testid="practice-back-to-practice-run"
            >
              Back to Practice Run
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-1 max-w-5xl text-[11px] leading-snug text-muted-foreground">
          {PRACTICE_REASSURANCE}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
