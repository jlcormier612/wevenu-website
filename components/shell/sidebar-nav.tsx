"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_SECTIONS } from "@/lib/navigation";
import {
  badgeCountForNavItem,
  emptyNavAttentionCounts,
  formatAttentionBadge,
  NAV_ATTENTION_BADGE_CLASS,
  type NavAttentionCounts,
} from "@/lib/navigation/attention";
import { filterNavSectionsForRole } from "@/lib/navigation/financial-nav";
import { cn } from "@/lib/utils";

export function SidebarNav({
  onNavigate,
  staffRole = null,
}: {
  onNavigate?: () => void;
  staffRole?: string | null;
}) {
  const pathname = usePathname();
  const [counts, setCounts] = React.useState<NavAttentionCounts>(emptyNavAttentionCounts);

  React.useEffect(() => {
    fetch("/api/navigation/attention")
      .then((r) => r.json())
      .then((d: Partial<NavAttentionCounts>) => {
        setCounts({
          leads: Number(d.leads) || 0,
          tours: Number(d.tours) || 0,
          inbox: Number(d.inbox) || 0,
          tasks: Number(d.tasks) || 0,
          payments: Number(d.payments) || 0,
        });
      })
      .catch(() => {});
  }, [pathname]);

  const sections = filterNavSectionsForRole(NAV_SECTIONS, staffRole);

  return (
    <nav className="flex flex-col gap-6 px-3 py-5" aria-label="Primary">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-[0.2em] text-sidebar-foreground/60">
            {section.label}
          </p>
          {section.items.map((item) => {
            // Templates sits at /library, which prefixes every other Library
            // destination including /library/documents — a plain prefix match
            // would light both Library items at once. Templates still owns its
            // own sub-pages (/library/contracts, /library/offerings, …); it just
            // hands /library/documents to Documents.
            const isActive = item.id === "templates"
              ? pathname === item.href ||
                (pathname.startsWith(`${item.href}/`) && !pathname.startsWith("/library/documents"))
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const badgeLabel = formatAttentionBadge(badgeCountForNavItem(item.id, counts));

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group/nav flex items-center gap-3 rounded-sm px-3 py-2.5 text-base tracking-wide transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/70 group-hover/nav:text-sidebar-accent-foreground",
                  )}
                />
                <span className="flex-1 truncate">{item.title}</span>
                {badgeLabel && (
                  <span className={NAV_ATTENTION_BADGE_CLASS} aria-label={`${badgeLabel} need attention`}>
                    {badgeLabel}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
