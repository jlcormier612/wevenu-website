import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Placeholder brand wordmark.
 *
 * The official Wevenu logo, typography and brand colors will arrive with the
 * Brand Book. Until then this is an intentionally neutral placeholder so layout
 * and spacing can be finalized without inventing brand identity.
 */
export function Wordmark({
  className,
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2 font-heading", className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Building2 className="h-5 w-5" />
      </span>
      {showText ? (
        <span className="text-lg font-semibold tracking-tight">Wevenu</span>
      ) : null}
    </span>
  );
}
