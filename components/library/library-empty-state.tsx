import { cn } from "@/lib/utils";

/**
 * Shared empty-state shell for Library list pages.
 */
export function LibraryEmptyState({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-card/40 px-4 py-16 text-center",
        className,
      )}
    >
      <p className="font-heading text-lg font-medium text-heading">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {actions ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
