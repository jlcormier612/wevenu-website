"use client";

/**
 * Work Package R1 — shallow, five-item Reporting navigation (brief §4/§61):
 * Overview / Sales / Bookings / Revenue / Events. Preserves the current
 * date-range search params on every tab link so switching reports never
 * resets "This Quarter" back to the default.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/reporting", label: "Overview" },
  { href: "/reporting/sales", label: "Sales" },
  { href: "/reporting/bookings", label: "Bookings" },
  { href: "/reporting/revenue", label: "Revenue" },
  { href: "/reporting/events", label: "Events" },
] as const;

export function ReportTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  return (
    <nav className="flex items-center gap-1 border-b border-border overflow-x-auto">
      {TABS.map((tab) => {
        const active = tab.href === "/reporting" ? pathname === "/reporting" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={qs ? `${tab.href}?${qs}` : tab.href}
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
