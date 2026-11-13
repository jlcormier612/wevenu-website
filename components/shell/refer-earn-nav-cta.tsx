import Link from "next/link";
import { Gift } from "lucide-react";

import { cn } from "@/lib/utils";

/** Persistent header CTA → existing Settings → Refer a Venue (`/settings/referrals`). */
export const REFER_EARN_NAV_HREF = "/settings/referrals";
export const REFER_EARN_NAV_LABEL = "Refer & Earn a Free Month";

/** Soft powder blue reference from the HTC palette (#A9C9DA). */
export const REFER_EARN_POWDER_BLUE = "#A9C9DA";

/**
 * Soft powder-blue invitation pill for the venue top nav. Links only — does not
 * change referral eligibility, form, or fulfillment.
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
        "border-[color:color-mix(in_oklch,#A9C9DA_55%,var(--htc-border-warm,#e6e3dc))]",
        "bg-[color:color-mix(in_oklch,#A9C9DA_22%,white)] text-[#24332b]",
        "hover:bg-[color:color-mix(in_oklch,#A9C9DA_34%,white)] hover:border-[color:color-mix(in_oklch,#A9C9DA_70%,var(--htc-border-warm,#e6e3dc))] hover:text-[#24332b]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklch,#A9C9DA_65%,var(--htc-calm-accent,#63819a))] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <Gift className="h-3.5 w-3.5 shrink-0 text-[#24332b]" aria-hidden />
      <span className="hidden max-w-[14rem] truncate sm:inline">{REFER_EARN_NAV_LABEL}</span>
    </Link>
  );
}
