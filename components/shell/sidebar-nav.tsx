"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_SECTIONS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Vertical navigation used by both the desktop sidebar and the mobile sheet.
 * Highlights the active route based on the current pathname.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6 px-3 py-5" aria-label="Primary">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            {section.label}
          </p>
          {section.items.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group/nav flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/50 group-hover/nav:text-sidebar-accent-foreground",
                  )}
                />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
