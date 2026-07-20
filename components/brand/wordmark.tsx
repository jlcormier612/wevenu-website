import { cn } from "@/lib/utils";

const PLATFORM_LOGO_LIGHT = "/brand/hello-to-cheers-logo-primary-transparent.png";
const PLATFORM_LOGO_DARK = "/brand/hello-to-cheers-logo-primary-transparent.png";

/**
 * Renders the Hello to Cheers platform logo everywhere platform branding appears.
 * Pass logoUrl only when displaying a venue's own uploaded logo instead.
 * Pass forceLight on a page whose surface is a fixed light background
 * regardless of the app's dark-mode setting (e.g. login) — otherwise the
 * `dark:` variant follows the html-level theme class even when the page
 * around it isn't actually dark, and the dark-mode (light/white) logo
 * disappears against a light background.
 */
export function Wordmark({
  className,
  showText = true,
  logoUrl,
  venueName,
  forceLight = false,
  sizeClassName,
}: {
  className?: string;
  showText?: boolean;
  logoUrl?: string | null;
  venueName?: string;
  forceLight?: boolean;
  /** Overrides the default height class — for callers that need a non-standard size (e.g. the main app header, sized 20% up from the default). */
  sizeClassName?: string;
}) {
  const alt = logoUrl ? (venueName ?? "Venue") : "Hello to Cheers";
  const sizeClass = sizeClassName ?? (showText ? "h-11 w-auto" : "h-8 w-auto");

  if (logoUrl) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={alt} className={`${sizeClass} max-w-[200px] rounded-md object-contain`} />
      </span>
    );
  }

  if (forceLight) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PLATFORM_LOGO_LIGHT} alt={alt} className={sizeClass} />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      {/* Light mode logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PLATFORM_LOGO_LIGHT} alt={alt} className={`${sizeClass} block dark:hidden`} />
      {/* Dark mode logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={PLATFORM_LOGO_DARK} alt={alt} className={`${sizeClass} hidden dark:block`} />
    </span>
  );
}
