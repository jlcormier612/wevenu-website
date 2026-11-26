"use client";

/**
 * Settings sub-navigation across category pages.
 * Referral tab is gated by the server-provided showReferrals flag.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const BASE_TABS = [
  { href: "/settings/business", label: "Business & Brand" },
  { href: "/settings/leads", label: "Leads & Booking" },
  { href: "/settings/availability", label: "Availability & Capacity" },
  { href: "/settings/communications", label: "Communications & Automation" },
  { href: "/settings/integrations", label: "Financials & Integrations" },
  { href: "/settings/billing", label: "Subscription & Billing" },
  { href: "/settings/team", label: "Team & Data" },
] as const;

const REFERRAL_TAB = {
  href: "/settings/referrals",
  label: "Refer a Venue",
} as const;

export function SettingsTabsClient({
  showReferrals = false,
}: {
  showReferrals?: boolean;
}) {
  const pathname = usePathname();
  const tabs = showReferrals
    ? [
        ...BASE_TABS.slice(0, 6),
        REFERRAL_TAB,
        ...BASE_TABS.slice(6),
      ]
    : [...BASE_TABS];

  return (
    <nav className="flex items-center gap-1 border-b border-border overflow-x-auto">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              active ? "border-primary text-heading" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
