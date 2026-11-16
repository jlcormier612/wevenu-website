import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function MilestoneDetailShell({
  number,
  title,
  intro,
  statusLabel,
  backHref = "/setup-hub",
  backLabel = "Back to your setup",
  children,
}: {
  number: string;
  title: string;
  intro: string;
  statusLabel?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[960px] space-y-6" data-testid={`phase-a-detail-${number}`}>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-heading"
        data-testid="phase-a-back-to-setup"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            MILESTONE {number}
          </p>
          {statusLabel ? <Badge variant="muted">{statusLabel}</Badge> : null}
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-heading">{title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {intro}
        </p>
      </header>

      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function MilestoneGuidancePanel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="rounded-xl border border-border bg-muted/25 px-4 py-3 sm:px-5" role="note">
      {title ? <p className="text-sm font-semibold text-heading">{title}</p> : null}
      <div
        className={`text-sm leading-relaxed text-muted-foreground ${title ? "mt-1" : ""}`}
      >
        {children}
      </div>
    </aside>
  );
}

export function MilestoneStepCard({
  title,
  description,
  action,
  statusLabel,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  statusLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-heading">{title}</h2>
            {statusLabel ? <Badge variant="muted">{statusLabel}</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
