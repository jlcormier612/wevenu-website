import Link from "next/link";

import { cn } from "@/lib/utils";
import { PRIMARY_CTA } from "@/lib/marketing/nav";
import { HOVER_FILL, HOVER_GHOST, HOVER_OUTLINE } from "@/lib/marketing/rhythm";

type MarketingCtaProps = {
  href?: string;
  label?: string;
  /**
   * primary — one filled action per viewport (Schedule a Walkthrough)
   * secondary — quieter control (header, outline peers)
   * ghost — lightest paired action (Follow one booking, Explore…, Back to Journey)
   */
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
};

export function MarketingCta({
  href = PRIMARY_CTA.href,
  label = PRIMARY_CTA.label,
  variant = "primary",
  className,
}: MarketingCtaProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-full text-sm tracking-wide transition duration-200 ease-out",
        variant === "primary" &&
          `bg-[var(--heritage-sage)] px-6 py-3 text-[var(--true-white)] ${HOVER_FILL}`,
        variant === "secondary" &&
          `border border-[var(--heritage-sage)]/28 bg-transparent px-6 py-3 text-[var(--forest-sage)]/72 ${HOVER_OUTLINE}`,
        variant === "ghost" &&
          `px-1 py-3 text-[var(--forest-sage)]/55 ${HOVER_GHOST}`,
        className,
      )}
    >
      {label}
    </Link>
  );
}
