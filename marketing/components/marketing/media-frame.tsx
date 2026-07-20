import Image from "next/image";

import { EDITORIAL_FRAME, EDITORIAL_IMAGE, EDITORIAL_IMAGE_UI } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type MediaFrameProps = {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
  priority?: boolean;
  aspect?: "photo" | "product" | "wide";
};

export function MediaFrame({
  src,
  alt,
  caption,
  className,
  priority,
  aspect = "photo",
}: MediaFrameProps) {
  const isProduct = aspect === "product";

  return (
    <figure className={cn(className)}>
      <div
        className={cn(
          "relative",
          EDITORIAL_FRAME,
          aspect === "photo" && "aspect-[4/5] md:aspect-[5/6]",
          aspect === "product" && "aspect-[16/10]",
          aspect === "wide" && "aspect-[21/9] md:aspect-[2.4/1]",
        )}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className={isProduct ? EDITORIAL_IMAGE_UI : EDITORIAL_IMAGE}
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
      {caption ? (
        <figcaption className="mt-3 text-sm text-[var(--forest-sage)]/60">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
