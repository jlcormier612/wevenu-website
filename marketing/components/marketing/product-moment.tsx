import Image from "next/image";

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
  src = "/marketing/product-dashboard.png",
  className,
  tone = "light",
}: ProductMomentProps) {
  return (
    <figure
      className={cn(
        "overflow-hidden border",
        tone === "light"
          ? "border-[var(--taupe-medium)] bg-[var(--true-white)]"
          : "border-white/15 bg-black/20",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full">
        <Image src={src} alt={label} fill className="object-cover object-top" sizes="(max-width:768px) 100vw, 720px" />
      </div>
      <figcaption
        className={cn(
          "px-4 py-3 text-xs tracking-[0.16em] uppercase",
          tone === "light" ? "text-[var(--forest-sage)]/55" : "text-white/55",
        )}
      >
        {label}
      </figcaption>
    </figure>
  );
}
