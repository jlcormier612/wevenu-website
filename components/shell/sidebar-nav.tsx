"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_SECTIONS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname   = usePathname();
  const [unread, setUnread] = React.useState(0);

  // Fetch unread message count — runs once on mount, refreshes when path changes
  React.useEffect(() => {
    fetch("/api/messages/unread")
      .then(r => r.json())
      .then((d: { count?: number }) => setUnread(d.count ?? 0))
      .catch(() => {});
  }, [pathname]);

  const isAdmin  = process.env.NEXT_PUBLIC_WEVENU_ADMIN === "true";

  return (
    <nav className="flex flex-col gap-6 px-3 py-5" aria-label="Primary">
      {NAV_SECTIONS.filter(s => !s.adminOnly || isAdmin).map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/60">
            {section.label}
          </p>
          {section.items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon     = item.icon;
            const isMsg    = item.href === "/messaging";
            const badge    = isMsg && unread > 0 ? unread : 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group/nav flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
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
                {badge > 0 && (
                  <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {badge > 99 ? "99+" : badge}
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
