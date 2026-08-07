"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, CheckSquare, Clock, FileText, Heart,
  LayoutDashboard, LogOut, Menu, MessageSquare,
  User, X,
} from "lucide-react";

import { signOut } from "@/app/auth/actions";
import { FeedbackSheet } from "@/components/feedback/feedback-sheet";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import { VendorNotificationBell } from "@/components/vendor-app/vendor-notification-bell";
import type { VendorRole } from "@/lib/vendors/types";
import { cn } from "@/lib/utils";

// Luv sits in nav (reachable surface) the way venue puts her on Today —
// same job (attention + next actions), vendor-scoped. Health/CRM coaching
// stay out of primary nav.
const NAV = [
  { href: "/vendor/dashboard", label: "Home",         icon: LayoutDashboard },
  { href: "/vendor/luv",       label: "Luv",           icon: Heart,          badge: "luv" as const },
  { href: "/vendor/events",    label: "Events",        icon: CalendarDays    },
  { href: "/vendor/timeline",  label: "Run of show",   icon: Clock           },
  { href: "/vendor/tasks",     label: "Tasks",         icon: CheckSquare,    badge: "task" as const },
  { href: "/vendor/documents", label: "Documents",     icon: FileText        },
  { href: "/vendor/messages",  label: "Messages",      icon: MessageSquare,  badge: "message" as const },
  { href: "/vendor/profile",   label: "Profile",       icon: User            },
];

type BadgeKey = "task" | "message" | "luv";

function NavItem({
  href, label, icon: Icon, badgeCount, onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  badgeCount?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/vendor/dashboard" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav flex items-center gap-3 rounded-sm px-3 py-2.5 text-[0.95rem] tracking-wide transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active
            ? "text-sidebar-primary"
            : "text-sidebar-foreground/70 group-hover/nav:text-sidebar-accent-foreground",
        )}
      />
      <span className="flex-1">{label}</span>
      {badgeCount != null && badgeCount > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
          {badgeCount}
        </span>
      )}
    </Link>
  );
}

export function VendorAppShell({
  businessName,
  category,
  logoUrl,
  role,
  pendingTaskCount,
  unreadMessageCount,
  luvAttentionCount,
  children,
}: {
  businessName:     string;
  category:         string | null;
  logoUrl?:         string | null;
  role:             VendorRole;
  pendingTaskCount?: number;
  unreadMessageCount?: number;
  /** Count for Luv nav badge — needsAttentionNow from shared briefing. */
  luvAttentionCount?: number;
  children:         React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const badges: Record<BadgeKey, number | undefined> = {
    task:    pendingTaskCount,
    message: unreadMessageCount,
    luv:     luvAttentionCount,
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="htc-staff flex h-svh w-full overflow-hidden bg-background font-sans text-foreground">
      {/* Desktop sidebar — same sidebar tokens as WorkspaceShell */}
      <aside className="hidden w-[15.5rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarContent
          businessName={businessName}
          category={category}
          logoUrl={logoUrl}
          badges={badges}
        />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile} />
          <aside className="relative flex h-full w-[15.5rem] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <button
              type="button"
              className="absolute right-4 top-4 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={closeMobile}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              businessName={businessName}
              category={category}
              logoUrl={logoUrl}
              badges={badges}
              onNavigate={closeMobile}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar — page chrome tokens (like venue header), not sidebar */}
        <header className="flex items-center gap-3 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-6 w-6 shrink-0 rounded-sm object-cover" />
          ) : null}
          <span className="truncate text-sm font-semibold text-foreground">{businessName}</span>
          <div className="ml-auto flex items-center gap-1">
            <VendorNotificationBell />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  businessName,
  category,
  logoUrl,
  badges,
  onNavigate,
}: {
  businessName: string;
  category:     string | null;
  logoUrl?:     string | null;
  badges:       Record<BadgeKey, number | undefined>;
  onNavigate?:  () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="border-b px-5 pb-4 pt-6">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/60">
            Hello to Cheers
          </p>
          <div className="hidden items-center gap-1 text-sidebar-foreground lg:flex">
            <VendorNotificationBell triggerClassName="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-sm border border-sidebar-border object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-sidebar-border bg-sidebar-accent text-xs font-bold text-sidebar-foreground/70">
              {businessName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">{businessName}</p>
            {category && (
              <p className="mt-0.5 truncate text-xs capitalize text-sidebar-foreground/60">
                {category.replace(/_/g, " ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Event workspace nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            badgeCount={item.badge ? badges[item.badge] : undefined}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-auto shrink-0 border-t border-sidebar-border px-3 py-3 space-y-0.5">
        <FeedbackSheet surface="vendor" />
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-[0.95rem] tracking-wide text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
