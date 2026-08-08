"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/lib/nav";
import { NAV_PERMISSION } from "@/lib/program4/permissions";
import type { Permission } from "@/lib/program4/types";
import { cn } from "@/lib/utils";

type SidebarProps = {
  unreadCount: number;
  openSupportCount?: number;
  /** Deep-link when badge is shown (single open → relationship; else CS triage list). */
  openSupportHref?: string;
  permissions: Permission[];
  homeHref: string;
};

export function Sidebar({
  unreadCount,
  openSupportCount = 0,
  openSupportHref = "/customer-success?stage=needs_support&view=list",
  permissions,
  homeHref,
}: SidebarProps) {
  const pathname = usePathname();
  const allowed = new Set(permissions);

  const items = NAV_ITEMS.filter((item) => {
    const required = NAV_PERMISSION[item.href];
    if (!required) return true;
    return allowed.has(required);
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[var(--sidebar-width)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-5 pt-7 pb-5">
        <Link href={homeHref} className="block" aria-label="Hello to Cheers Relationship Workspace">
          <Image
            src="/brand/hello-to-cheers-logo-primary-transparent.png"
            alt="Hello to Cheers"
            width={755}
            height={274}
            className="h-auto w-full max-w-[11.5rem]"
            priority
          />
          <p className="ws-eyebrow mt-3">Relationship Workspace</p>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const showSupportBadge =
            item.href === "/customer-success" && openSupportCount > 0;
          return (
            <Link
              key={item.href}
              href={showSupportBadge ? openSupportHref : item.href}
              className={cn(
                "flex items-center justify-between gap-2 rounded-sm px-3 py-2.5 text-[0.95rem] tracking-wide transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <span>{item.label}</span>
              {showSupportBadge ? (
                <span
                  className={cn(
                    "shrink-0 rounded-sm px-1.5 py-0.5 text-[0.65rem] font-medium tabular-nums",
                    active
                      ? "bg-sidebar-primary/15 text-sidebar-primary"
                      : "bg-[color-mix(in_srgb,var(--dusty-rose)_28%,transparent)] text-[var(--dusty-rose)]",
                  )}
                  title={`${openSupportCount} open support`}
                >
                  {openSupportCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-6 py-5">
        <p className="text-sm text-sidebar-foreground/70">
          {unreadCount > 0 ? (
            <>
              <span className="font-medium text-sidebar-foreground">{unreadCount}</span>{" "}
              unread notifications
            </>
          ) : (
            "All caught up"
          )}
        </p>
        <Link
          href="/login"
          className="mt-2 inline-block text-sm text-sidebar-primary underline-offset-4 hover:underline"
        >
          Sign out (stub)
        </Link>
      </div>
    </aside>
  );
}
