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
import { VendorNotificationBell } from "@/components/vendor-app/vendor-notification-bell";
import type { VendorRole } from "@/lib/vendors/types";

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
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
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
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card">
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
          <aside className="relative w-72 h-full flex flex-col bg-card border-r border-border">
            <button
              type="button"
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
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
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card lg:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-6 w-6 rounded-md object-cover shrink-0" />
          ) : null}
          <span className="font-semibold text-sm text-foreground truncate">{businessName}</span>
          <div className="ml-auto">
            <VendorNotificationBell />
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
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
      <div className="px-5 pt-6 pb-4 border-b border-border">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hello to Cheers</p>
          <div className="hidden lg:block">
            <VendorNotificationBell />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover border border-border shrink-0" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border border-border shrink-0">
              {businessName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground leading-tight truncate">{businessName}</p>
            {category && (
              <p className="text-xs text-muted-foreground mt-0.5 capitalize truncate">{category.replace(/_/g, " ")}</p>
            )}
          </div>
        </div>
      </div>

      {/* Event workspace nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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

      <div className="mt-auto border-t border-border px-3 py-3">
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
