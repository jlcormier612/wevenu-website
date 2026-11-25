import {
  STATIC_PHOTO_ASSETS,
  type StaticPhotoId,
} from "@/lib/marketing/static-photo-assets.generated";
import { cn } from "@/lib/utils";

type StaticPhotoProps = {
  id: StaticPhotoId;
  alt: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
};

/**
 * Serves build-time WebP derivatives directly (no /_next/image).
 * Falls back to the approved original for non-WebP clients.
 */
export function StaticPhoto({
  id,
  alt,
  sizes,
  className,
  imgClassName,
  priority = false,
  fill = false,
  width,
  height,
}: StaticPhotoProps) {
  const asset = STATIC_PHOTO_ASSETS[id];
  const w = width ?? asset.width;
  const h = height ?? asset.height;
  const srcSet = Object.entries(asset.variants)
    .map(([bw, url]) => `${url} ${bw}w`)
    .join(", ");
  const widths = Object.keys(asset.variants)
    .map(Number)
    .sort((a, b) => a - b);
  const preferred =
    widths.find((x) => x >= 1280) ?? widths[widths.length - 1] ?? null;
  const fallback =
    (preferred != null && asset.variants[String(preferred)]) || asset.source;

  return (
    <picture
      className={cn(fill && "absolute inset-0 block h-full w-full", className)}
    >
      <source type="image/webp" srcSet={srcSet} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element -- static public assets; optimizer bypassed by design */}
      <img
        src={fallback}
        alt={alt}
        width={fill ? undefined : w}
        height={fill ? undefined : h}
        sizes={sizes}
        decoding={priority ? "sync" : "async"}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className={cn(fill && "h-full w-full object-cover", imgClassName)}
      />
    </picture>
  );
}
