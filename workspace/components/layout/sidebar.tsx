"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/lib/nav";
import { NAV_PERMISSION } from "@/lib/program4/permissions";
import type { Permission } from "@/lib/program4/types";
import { cn } from "@/lib/utils";
import { HTC_LOGO_PUBLIC_PATH } from "@shared/brand/logo";

type SidebarProps = {
  unreadCount: number;
  openSupportCount?: number;
  /** Deep-link when badge is shown (single open → relationship; else CS triage list). */
  openSupportHref?: string;
  /** Open actionable Partner Support Inbox items (vendor/client Get Help / Bug). */
  openPartnerSupportCount?: number;
  permissions: Permission[];
  homeHref: string;
};

export function Sidebar({
  unreadCount,
  openSupportCount = 0,
  openSupportHref = "/customer-success?stage=needs_support&view=list",
  openPartnerSupportCount = 0,
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
    <aside className="flex h-full w-[var(--sidebar-width)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="px-4 pt-6 pb-4 md:px-5 md:pt-7 md:pb-5">
        <Link href={homeHref} className="block" aria-label="Hello to Cheers Relationship Workspace">
          <Image
            src={HTC_LOGO_PUBLIC_PATH}
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
          const showCsSupportBadge =
            item.href === "/customer-success" && openSupportCount > 0;
          const showPartnerSupportBadge =
            item.href === "/support" && openPartnerSupportCount > 0;
          const badgeCount = showCsSupportBadge
            ? openSupportCount
            : showPartnerSupportBadge
              ? openPartnerSupportCount
              : 0;
          return (
            <Link
              key={item.href}
              href={showCsSupportBadge ? openSupportHref : item.href}
              className={cn(
                "flex items-center justify-between gap-2 rounded-[8px] px-3 py-2.5 text-sm tracking-wide transition-colors",
                active
                  ? "ws-nav-active"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <span>{item.label}</span>
              {badgeCount > 0 ? (
                <span
                  className={cn(
                    "shrink-0 rounded-sm px-1.5 py-0.5 text-[0.65rem] font-medium tabular-nums",
                    active
                      ? "bg-sidebar-primary/15 text-sidebar-primary"
                      : "bg-[color-mix(in_srgb,var(--htc-dusty)_28%,transparent)] text-[var(--htc-dusty)]",
                  )}
                  title={
                    showPartnerSupportBadge
                      ? `${badgeCount} open partner support item${badgeCount === 1 ? "" : "s"}`
                      : `${badgeCount} open support item${badgeCount === 1 ? "" : "s"}`
                  }
                >
                  {badgeCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4 md:px-6 md:py-5">
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
      </div>
    </aside>
  );
}
