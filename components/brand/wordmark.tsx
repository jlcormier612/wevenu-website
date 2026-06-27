import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Brand wordmark. Shows the venue's uploaded logo when available;
 * falls back to the default Building2 icon placeholder.
 * The official Wevenu logo will replace this when delivered by the founder.
 */
export function Wordmark({
  className,
  showText = true,
  logoUrl,
  venueName,
}: {
  className?: string;
  showText?: boolean;
  /** Venue logo URL — shown in place of the icon when set. */
  logoUrl?: string | null;
  /** Venue name — used as alt text when a logo image is displayed. */
  venueName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2 font-heading", className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={venueName ?? "Venue logo"}
          className="h-8 w-8 shrink-0 rounded-md object-contain bg-muted"
        />
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="h-5 w-5" />
        </span>
      )}
      {showText ? (
        <span className="text-lg font-semibold tracking-tight">Wevenu</span>
      ) : null}
    </span>
  );
}
