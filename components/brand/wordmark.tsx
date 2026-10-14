import { cn } from "@/lib/utils";
import { HTC_LOGO_PUBLIC_PATH } from "@/shared/brand/logo";

/**
 * Renders the Hello to Cheers platform logo everywhere platform branding appears.
 * Always uses the approved primary brand asset (olive/sage lettering + dusty-rose
 * accents). Do not swap to the lavender-gray on-dark raster — it washes out brand
 * color on the dark-mode sidebar (lightened taupe) and other themed surfaces.
 *
 * Pass logoUrl only when displaying a venue's own uploaded logo instead.
 * Pass forceLight / forceDark when a fixed-surface page must ignore the html
 * theme class for layout reasons; both still render the primary brand mark.
 */
export function Wordmark({
  className,
  showText = true,
  logoUrl,
  venueName,
  forceLight = false,
  forceDark = false,
  sizeClassName,
}: {
  className?: string;
  showText?: boolean;
  logoUrl?: string | null;
  venueName?: string;
  forceLight?: boolean;
  forceDark?: boolean;
  /** Overrides the default height class — for callers that need a non-standard size (e.g. the main app header, sized 20% up from the default). */
  sizeClassName?: string;
}) {
  const alt = logoUrl ? (venueName ?? "Venue") : "Hello to Cheers";
  const sizeClass = sizeClassName ?? (showText ? "h-11 w-auto" : "h-8 w-auto");
  // forceLight / forceDark remain accepted for call-site compatibility; the
  // primary asset is correct on both light and dark HTC surfaces.
  void forceLight;
  void forceDark;

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={HTC_LOGO_PUBLIC_PATH} alt={alt} className={sizeClass} />
    </span>
  );
}
