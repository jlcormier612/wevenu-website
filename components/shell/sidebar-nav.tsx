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
  NAV_ATTENTION_REFRESH_EVENT,
  navAttentionHref,
  navBadgeAriaLabel,
  UNSEEN_LEADS_ATTENTION_HREF,
  type NavAttentionCounts,
} from "@/lib/navigation/attention";
import { filterNavSectionsForRole } from "@/lib/navigation/financial-nav";
import { cn } from "@/lib/utils";

function applyAttentionPayload(d: Partial<NavAttentionCounts>): NavAttentionCounts {
  return {
    leads: Number(d.leads) || 0,
    tours: Number(d.tours) || 0,
    inbox: Number(d.inbox) || 0,
    tasks: Number(d.tasks) || 0,
    payments: Number(d.payments) || 0,
    contracts: Number(d.contracts) || 0,
  };
}

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
    let cancelled = false;
    function loadAttention() {
      fetch("/api/navigation/attention")
        .then((r) => r.json())
        .then((d: Partial<NavAttentionCounts>) => {
          if (!cancelled) setCounts(applyAttentionPayload(d));
        })
        .catch(() => {});
    }
    loadAttention();
    window.addEventListener(NAV_ATTENTION_REFRESH_EVENT, loadAttention);
    return () => {
      cancelled = true;
      window.removeEventListener(NAV_ATTENTION_REFRESH_EVENT, loadAttention);
    };
  }, [pathname]);

  const sections = filterNavSectionsForRole(NAV_SECTIONS, staffRole);

  return (
    <nav className="flex flex-col gap-6 px-3 py-5" aria-label="Primary">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-1">
          <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-[0.2em] text-sidebar-foreground/80">
            {section.label}
          </p>
          {section.items.map((item) => {
            // Templates sits at /library, which prefixes every other Library
            // destination including /library/documents — a plain prefix match
            // would light both Library items at once. Templates still owns its
            // own sub-pages (/library/contracts, /library/offerings, …); it just
            // hands /library/documents to Documents.
            const itemPath = item.href.split("?")[0];
            const isActive = item.id === "templates"
              ? pathname === itemPath ||
                (pathname.startsWith(`${itemPath}/`) && !pathname.startsWith("/library/documents"))
              : pathname === itemPath || pathname.startsWith(`${itemPath}/`);
            const Icon = item.icon;
            const badgeCount = badgeCountForNavItem(item.id, counts);
            const badgeLabel = formatAttentionBadge(badgeCount);
            const href = navAttentionHref(item.id, item.href, badgeCount);

            return (
              <div
                key={item.id}
                className={cn(
                  "group/nav flex items-center gap-3 rounded-sm px-3 py-2.5 text-base tracking-wide transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-within:outline-none focus-within:ring-2 focus-within:ring-sidebar-ring",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground",
                )}
              >
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none"
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
                </Link>
                {badgeLabel && item.id === "leads" ? (
                  <Link
                    href={UNSEEN_LEADS_ATTENTION_HREF}
                    onClick={onNavigate}
                    className={NAV_ATTENTION_BADGE_CLASS}
                    title={navBadgeAriaLabel(item.id, badgeLabel)}
                    aria-label={navBadgeAriaLabel(item.id, badgeLabel)}
                  >
                    {badgeLabel}
                  </Link>
                ) : badgeLabel ? (
                  <span
                    className={NAV_ATTENTION_BADGE_CLASS}
                    title={navBadgeAriaLabel(item.id, badgeLabel)}
                    aria-label={navBadgeAriaLabel(item.id, badgeLabel)}
                  >
                    {badgeLabel}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
