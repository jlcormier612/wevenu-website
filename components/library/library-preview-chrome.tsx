import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared full-page Library Preview chrome (Questionnaire is the reference).
 * Content inside uses its natural readable width — this only standardizes the shell.
 */
export function LibraryPreviewChrome({
  caption,
  editHref,
  libraryHref,
  libraryLabel = "Library",
  contentMaxWidthClassName = "max-w-xl",
  actions,
  children,
  className,
}: {
  /** Honest caption — do not claim client visibility when clients never see this asset. */
  caption: string;
  editHref?: string;
  libraryHref: string;
  libraryLabel?: string;
  contentMaxWidthClassName?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-[70vh] space-y-4 pb-10", className)}>
      <div
        className={cn(
          "mx-auto flex flex-wrap items-center justify-between gap-2 px-4 pt-4",
          contentMaxWidthClassName,
        )}
      >
        <p className="text-sm text-muted-foreground">{caption}</p>
        <div className="flex flex-wrap gap-2">
          {actions}
          {editHref ? (
            <Button size="sm" variant="outline" render={<Link href={editHref} />}>
              Back to edit
            </Button>
          ) : null}
          <Button size="sm" variant="outline" render={<Link href={libraryHref} />}>
            {libraryLabel}
          </Button>
        </div>
      </div>
      <div className={cn("mx-auto px-4", contentMaxWidthClassName)}>{children}</div>
    </div>
  );
}
