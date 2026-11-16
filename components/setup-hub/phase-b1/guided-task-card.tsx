import { Badge } from "@/components/ui/badge";

export function GuidedTaskCard({
  step,
  title,
  description,
  statusLabel,
  statusTestId,
  action,
  note,
  children,
}: {
  step: string;
  title: string;
  description: string;
  statusLabel?: string;
  statusTestId?: string;
  action: React.ReactNode;
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-xs font-semibold text-muted-foreground"
          aria-hidden
        >
          {step}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <h2 className="font-heading text-lg font-medium text-heading">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
          {statusLabel ? (
            <Badge variant="muted" data-testid={statusTestId}>
              {statusLabel}
            </Badge>
          ) : null}
          <div>{action}</div>
          {children}
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
        </div>
      </div>
    </section>
  );
}

export function GuidedSectionComplete({
  heading,
  description,
  children,
}: {
  heading: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 pt-2">
      <h2 className="font-heading text-lg font-medium text-heading">{heading}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
