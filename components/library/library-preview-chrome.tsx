import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared full-page Library Preview chrome (Questionnaire is the reference).
 * Content inside uses its natural readable width — this only standardizes the shell.
 *
 * Escape paths are destination-named (collection label), not browser-history "Back".
 */
export function LibraryPreviewChrome({
  caption,
  editHref,
  libraryHref,
  libraryLabel,
  contentMaxWidthClassName = "max-w-xl",
  actions,
  children,
  className,
}: {
  /** Honest caption — do not claim client visibility when clients never see this asset. */
  caption: string;
  editHref?: string;
  libraryHref: string;
  /** Collection name shown on the primary escape control, e.g. "Event Order Templates". */
  libraryLabel: string;
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
        <Button
          size="sm"
          variant="ghost"
          className="-ml-2 text-muted-foreground"
          render={<Link href={libraryHref} />}
        >
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {libraryLabel}
        </Button>
        <div className="flex flex-wrap gap-2">
          {actions}
          {editHref ? (
            <Button size="sm" variant="outline" render={<Link href={editHref} />}>
              Back to edit
            </Button>
          ) : null}
        </div>
      </div>
      <p
        className={cn(
          "mx-auto px-4 text-sm text-muted-foreground",
          contentMaxWidthClassName,
        )}
      >
        {caption}
      </p>
      <div className={cn("mx-auto px-4", contentMaxWidthClassName)}>{children}</div>
    </div>
  );
}
