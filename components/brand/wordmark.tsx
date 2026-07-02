import { cn } from "@/lib/utils";

const PLATFORM_LOGO = "/brand/wevenu-logo-final.png";

/**
 * Renders the Wevenu platform logo everywhere platform branding appears.
 * Always uses the final logo PNG — sidebar, mobile top bar, auth pages, setup shell.
 * Pass logoUrl only when displaying a venue's own uploaded logo instead.
 */
export function Wordmark({
  className,
  showText = true,
  logoUrl,
  venueName,
}: {
  className?: string;
  showText?: boolean;
  logoUrl?: string | null;
  venueName?: string;
}) {
  const src = logoUrl ?? PLATFORM_LOGO;
  const alt = logoUrl ? (venueName ?? "Venue") : "Wevenu";
  const sizeClass = showText
    ? "h-12 w-auto"
    : "h-8 w-auto";

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={logoUrl ? `${sizeClass} max-w-[200px] rounded-md object-contain` : sizeClass}
      />
    </span>
  );
}
