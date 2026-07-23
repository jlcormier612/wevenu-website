import Image from "next/image";

import { EDITORIAL_FRAME, EDITORIAL_IMAGE_UI } from "@/lib/marketing/rhythm";
import { cn } from "@/lib/utils";

type ProductMomentProps = {
  label: string;
  src?: string;
  className?: string;
  tone?: "light" | "dark";
};

/**
 * Real screenshot when available; otherwise an honest labeled frame
 * so the journey composition stays intact while assets are captured.
 */
export function ProductMoment({
  label,
  src = "/marketing/homepage-dashboard-overview.png",
  className,
  tone = "light",
}: ProductMomentProps) {
  return (
    <figure
      className={cn(
        EDITORIAL_FRAME,
        tone === "light" ? "bg-[var(--true-white)]" : "bg-black/20",
        tone === "dark" && "border-white/15",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full">
        <Image
          src={src}
          alt={label}
          fill
          className={EDITORIAL_IMAGE_UI}
          sizes="(max-width:768px) 100vw, 720px"
        />
      </div>
      <figcaption
        className={cn(
          "px-4 py-3 text-xs tracking-[0.22em] uppercase",
          tone === "light" ? "text-[var(--forest-sage)]/55" : "text-white/55",
        )}
      >
        {label}
      </figcaption>
    </figure>
  );
}
