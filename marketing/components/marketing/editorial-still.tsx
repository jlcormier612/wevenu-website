import Image from "next/image";

import {
  EDITORIAL_BLEED,
  EDITORIAL_FRAME,
  EDITORIAL_IMAGE,
  EDITORIAL_SPACE_Y,
} from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type EditorialStillProps = {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  /** Aspect / width utilities — layout only */
  className?: string;
  /** Add consistent vertical margin around the still */
  spaced?: boolean;
  /** Edge-to-edge band — no radius/shadow */
  bleed?: boolean;
};

/**
 * Formal editorial photography frame.
 * Same crop, radius, and shadow treatment sitewide.
 */
export function EditorialStill({
  src,
  alt,
  sizes = "100vw",
  priority = false,
  className,
  spaced = false,
  bleed = false,
}: EditorialStillProps) {
  return (
    <div
      className={cn(
        "relative w-full",
        bleed ? EDITORIAL_BLEED : EDITORIAL_FRAME,
        spaced && EDITORIAL_SPACE_Y,
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        className={EDITORIAL_IMAGE}
        sizes={sizes}
      />
    </div>
  );
}
