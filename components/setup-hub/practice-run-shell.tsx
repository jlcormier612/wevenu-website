import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  PRACTICE_NAV_HINT,
  PRACTICE_REASSURANCE,
  PRACTICE_WORKSPACE_SUPPORT,
  type PracticePerspective,
  type PracticeRun,
} from "@/lib/practice-run/types";

export function PracticeRunShell({
  run,
  venueName,
  perspective = "venue",
  children,
}: {
  run: PracticeRun;
  venueName: string;
  perspective?: PracticePerspective;
  children?: React.ReactNode;
}) {
  const venueHref = `/setup-hub/practice-run?run=${encodeURIComponent(run.id)}`;
  const clientHref = `/practice-run/${encodeURIComponent(run.id)}/client`;

  return (
    <div className="htc-hospitality-page" data-testid="practice-run-shell">
      <div className="mx-auto max-w-[960px] space-y-6 px-1 sm:px-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/setup-hub"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-heading"
            data-testid="practice-run-back-setup"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Return to setup
          </Link>
          <Badge variant="muted" data-testid="practice-run-indicator">
            Practice Run
          </Badge>
        </div>

        <header className="htc-surface-guidance space-y-3 px-5 py-5 sm:px-6">
          <p
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            data-testid="practice-run-venue-name"
          >
            {venueName}
          </p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h1
                className="font-heading text-3xl font-medium tracking-tight text-heading"
                data-testid="practice-run-celebration-name"
              >
                {run.celebrationName}
              </h1>
              <p
                className="max-w-2xl text-sm leading-relaxed text-muted-foreground"
                data-testid="practice-run-support-copy"
              >
                {PRACTICE_WORKSPACE_SUPPORT}
              </p>
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {PRACTICE_REASSURANCE}
              </p>
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {PRACTICE_NAV_HINT}
              </p>
            </div>
            <div
              className="inline-flex rounded-full border border-border bg-card p-1"
              data-testid="practice-run-perspective-switcher"
              role="group"
              aria-label="Practice perspective"
            >
              <Link
                href={venueHref}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  perspective === "venue"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-heading"
                }`}
                data-testid="practice-perspective-venue"
                aria-current={perspective === "venue" ? "page" : undefined}
              >
                Venue
              </Link>
              <Link
                href={clientHref}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  perspective === "client"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-heading"
                }`}
                data-testid="practice-perspective-client"
                aria-current={perspective === "client" ? "page" : undefined}
              >
                Client
              </Link>
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
