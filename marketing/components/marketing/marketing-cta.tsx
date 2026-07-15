import Link from "next/link";

import { cn } from "@/lib/utils";
import { PRIMARY_CTA } from "@/lib/marketing/nav";

type MarketingCtaProps = {
  href?: string;
  label?: string;
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
        "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm tracking-wide transition-opacity duration-300",
        variant === "primary" &&
          "bg-[var(--heritage-sage)] text-[var(--true-white)] hover:opacity-90",
        variant === "secondary" &&
          "border border-[var(--heritage-sage)]/35 bg-transparent text-[var(--forest-sage)] hover:bg-[var(--linen)]",
        variant === "ghost" &&
          "text-[var(--forest-sage)] underline-offset-4 hover:underline",
        className,
      )}
    >
      {label}
    </Link>
  );
}
