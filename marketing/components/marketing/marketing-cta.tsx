import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { MORE_INFO_CTA, PRIMARY_CTA } from "@/lib/marketing/nav";
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

/** Contact / inquiry sibling used next to Schedule a Walkthrough CTAs. */
export function MoreInfoCta({
  variant = "secondary",
  className,
}: Pick<MarketingCtaProps, "variant" | "className">) {
  return (
    <MarketingCta
      href={MORE_INFO_CTA.href}
      label={MORE_INFO_CTA.label}
      variant={variant}
      className={className}
    />
  );
}

type WalkthroughCtasProps = {
  /** Extra ghost / tertiary actions after the walkthrough + more-info pair. */
  children?: ReactNode;
  className?: string;
  walkthroughLabel?: string;
  walkthroughVariant?: MarketingCtaProps["variant"];
  walkthroughClassName?: string;
  moreInfoVariant?: MarketingCtaProps["variant"];
  moreInfoClassName?: string;
};

/**
 * Primary walkthrough CTA + "Request more information" sibling.
 * Optional children hold lighter tertiary links (Back to Journey, etc.).
 */
export function WalkthroughCtas({
  children,
  className,
  walkthroughLabel,
  walkthroughVariant = "primary",
  walkthroughClassName,
  moreInfoVariant = "secondary",
  moreInfoClassName,
}: WalkthroughCtasProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      <MarketingCta
        label={walkthroughLabel}
        variant={walkthroughVariant}
        className={walkthroughClassName}
      />
      <MoreInfoCta variant={moreInfoVariant} className={moreInfoClassName} />
      {children}
    </div>
  );
}
