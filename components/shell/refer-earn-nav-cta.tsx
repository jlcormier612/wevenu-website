import Link from "next/link";
import { Gift } from "lucide-react";

import { cn } from "@/lib/utils";

/** Persistent header CTA → existing Settings → Refer a Venue (`/settings/referrals`). */
export const REFER_EARN_NAV_HREF = "/settings/referrals";
export const REFER_EARN_NAV_LABEL = "Refer & Earn a Free Month";

/**
 * Warm dusty-rose pill for the venue top nav. Links only — does not change
 * referral eligibility, form, or fulfillment.
 */
export function ReferEarnNavCta({ className }: { className?: string }) {
  return (
    <Link
      href={REFER_EARN_NAV_HREF}
      data-testid="refer-earn-nav-cta"
      aria-label={REFER_EARN_NAV_LABEL}
      title={REFER_EARN_NAV_LABEL}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-medium tracking-tight transition-colors",
        "border-[color:color-mix(in_oklch,var(--htc-blush)_42%,var(--htc-border-warm))]",
        "bg-[var(--htc-soft-blush)] text-[color:color-mix(in_oklch,var(--htc-blush)_42%,#24332b)]",
        "hover:bg-[var(--htc-petal)] hover:text-[#24332b]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklch,var(--htc-blush)_55%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Gift className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="hidden max-w-[14rem] truncate sm:inline">{REFER_EARN_NAV_LABEL}</span>
    </Link>
  );
}
