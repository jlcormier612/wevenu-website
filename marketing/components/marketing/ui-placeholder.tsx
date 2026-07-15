import { cn } from "@/lib/utils";

type UiPlaceholderProps = {
  moment: string;
  capture: string;
  className?: string;
  aspect?: "wide" | "tall" | "square" | "mobile";
};

/**
 * Honest frame for product screenshots Jen will provide from the live product.
 */
export function UiPlaceholder({
  moment,
  capture,
  className,
  aspect = "wide",
}: UiPlaceholderProps) {
  return (
    <figure
      className={cn(
        "flex h-full flex-col justify-between border border-[var(--taupe-medium)]/70 bg-[var(--true-white)]",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-1 flex-col items-start justify-end bg-[var(--linen)]/80 p-6 md:p-8",
          aspect === "wide" && "min-h-[220px] w-full md:min-h-[280px]",
          aspect === "tall" && "min-h-[320px] w-full md:min-h-[420px]",
          aspect === "square" && "aspect-square min-h-[240px]",
          aspect === "mobile" && "mx-auto aspect-[9/17] w-full max-w-[220px] min-h-[360px]",
        )}
      >
        <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--heritage-sage)]">
          Product proof · placeholder
        </p>
        <p className="mt-3 font-heading text-xl text-[var(--forest-sage)] md:text-2xl">
          {moment}
        </p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--forest-sage)]/60">
          {capture}
        </p>
      </div>
    </figure>
  );
}
