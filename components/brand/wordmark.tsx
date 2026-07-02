import { cn } from "@/lib/utils";

const PLATFORM_LOGO_LIGHT = "/brand/wevenu-logo-transparent.png";
const PLATFORM_LOGO_DARK  = "/brand/wevenu-logo-white.svg";

/**
 * Renders the Wevenu platform logo everywhere platform branding appears.
 * Swaps to the white SVG version in dark mode automatically.
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
  const alt = logoUrl ? (venueName ?? "Venue") : "Wevenu";
  const sizeClass = showText ? "h-14 w-auto" : "h-10 w-auto";

  if (logoUrl) {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={alt} className={`${sizeClass} max-w-[200px] rounded-md object-contain`} />
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
