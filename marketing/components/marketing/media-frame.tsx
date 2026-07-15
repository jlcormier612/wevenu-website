import Image from "next/image";

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
  return (
    <figure className={cn("group overflow-hidden", className)}>
      <div
        className={cn(
          "relative overflow-hidden bg-[var(--taupe-light)]",
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
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
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
