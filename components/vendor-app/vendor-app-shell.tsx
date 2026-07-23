"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, CheckSquare, Clock, FileText,
  Handshake, LayoutDashboard, Menu, MessageSquare,
  User, X,
} from "lucide-react";

import type { VendorRole } from "@/lib/vendors/types";

// Program 4, Initiative C, Phase 9 (2026-07-23): "The Vendor Workspace is
// not a CRM. It exists to strengthen the Vendor's relationship with
// participating Venues." Nav order is the directive's own list verbatim.
// Venue Information (formerly top-level, /vendor/handbook) drops out of
// primary nav — Phase 11 places it inside each Event's own workspace
// instead, alongside that event's Timeline/Tasks/Messages/Documents,
// rather than as a standalone, venue-agnostic destination. Venue
// Partnerships (/vendor/partnerships) takes its slot: the vendor's list of
// every venue relationship, with the venue-specific promotion editor
// (Phase 10/16). Inquiries (lead pipeline), Venues (old cross-venue
// browser, now redirects to Partnerships), and Luv/health-score business
// coaching remain dropped per the Program 4 Initiative B Phase 1 audit.
const NAV = [
  { href: "/vendor/dashboard",    label: "Home",               icon: LayoutDashboard },
  { href: "/vendor/partnerships", label: "Venue Partnerships", icon: Handshake       },
  { href: "/vendor/messages",     label: "Messages",           icon: MessageSquare,  badge: "message" as const },
  { href: "/vendor/events",       label: "Events",             icon: CalendarDays    },
  { href: "/vendor/tasks",        label: "Tasks",              icon: CheckSquare,    badge: "task" as const },
  { href: "/vendor/timeline",     label: "Timeline",           icon: Clock           },
  { href: "/vendor/documents",    label: "Documents",          icon: FileText        },
  { href: "/vendor/profile",      label: "Profile",            icon: User            },
];

type BadgeKey = "task" | "message";

function NavItem({
  href, label, icon: Icon, badgeCount,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  badgeCount?: number;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/vendor/dashboard" && pathname.startsWith(href));
  return (
    <Link
      href={href}
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
  children,
}: {
  businessName:     string;
  category:         string | null;
  logoUrl?:         string | null;
  role:             VendorRole;
  pendingTaskCount?: number;
  unreadMessageCount?: number;
  children:         React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const badges: Record<BadgeKey, number | undefined> = {
    task:    pendingTaskCount,
    message: unreadMessageCount,
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <SidebarContent businessName={businessName} category={category} logoUrl={logoUrl} badges={badges} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 h-full flex flex-col bg-card border-r border-border">
            <button
              type="button"
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent businessName={businessName} category={category} logoUrl={logoUrl} badges={badges} />
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
          <span className="ml-auto text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Hello to Cheers
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
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
}: {
  businessName: string;
  category:     string | null;
  logoUrl?:     string | null;
  badges:       Record<BadgeKey, number | undefined>;
}) {
  return (
    <>
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Hello to Cheers</p>
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
          />
        ))}
      </nav>
    </>
  );
}
