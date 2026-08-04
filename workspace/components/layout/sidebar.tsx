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
  permissions: Permission[];
  homeHref: string;
};

export function Sidebar({
  unreadCount,
  openSupportCount = 0,
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
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[var(--sidebar-width)] flex-col border-r border-[color-mix(in_srgb,var(--taupe-medium)_45%,transparent)] bg-[var(--header-linen)]">
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
              href={
                showSupportBadge
                  ? "/customer-success?stage=needs_support"
                  : item.href
              }
              className={cn(
                "flex items-center justify-between gap-2 rounded-sm px-3 py-2.5 text-[0.95rem] tracking-wide",
                active
                  ? "bg-[var(--forest-sage)] text-[var(--true-white)]"
                  : "text-[var(--forest-sage)] hover:bg-[color-mix(in_srgb,var(--soft-sage)_35%,transparent)]",
              )}
            >
              <span>{item.label}</span>
              {showSupportBadge ? (
                <span
                  className={cn(
                    "shrink-0 rounded-sm px-1.5 py-0.5 text-[0.65rem] font-medium tabular-nums",
                    active
                      ? "bg-[var(--true-white)]/20 text-[var(--true-white)]"
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

      <div className="border-t border-[color-mix(in_srgb,var(--taupe-medium)_45%,transparent)] px-6 py-5">
        <p className="text-sm text-[color-mix(in_srgb,var(--forest-sage)_70%,transparent)]">
          {unreadCount > 0 ? (
            <>
              <span className="font-medium text-[var(--forest-sage)]">{unreadCount}</span>{" "}
              unread notifications
            </>
          ) : (
            "All caught up"
          )}
        </p>
        <Link
          href="/login"
          className="mt-2 inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
        >
          Sign out (stub)
        </Link>
      </div>
    </aside>
  );
}
