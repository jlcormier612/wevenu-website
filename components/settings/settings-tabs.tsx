"use client";

/**
 * Settings sub-navigation across the six category pages — same pattern as
 * components/reporting/report-tabs.tsx. No search-param preservation
 * needed here (unlike Reporting's date-range), so this is the simpler
 * sibling, not a divergent one-off.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/business", label: "Business & Brand" },
  { href: "/settings/leads", label: "Leads & Booking" },
  { href: "/settings/availability", label: "Availability & Capacity" },
  { href: "/settings/communications", label: "Communications & Automation" },
  { href: "/settings/integrations", label: "Financials & Integrations" },
  { href: "/settings/team", label: "Team & Data" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-border overflow-x-auto">
      {TABS.map((tab) => {
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
