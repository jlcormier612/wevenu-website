"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, CalendarDays, CheckSquare, FileText, Heart,
  Inbox, LayoutDashboard, Menu, MessageSquare, Package,
  User, X,
} from "lucide-react";

import type { VendorRole } from "@/lib/vendors/types";

const DAILY_NAV = [
  { href: "/vendor/dashboard",   label: "Home",      icon: LayoutDashboard },
  { href: "/vendor/inquiries",   label: "Inquiries", icon: Inbox,          badge: "inquiry" as const },
  { href: "/vendor/events",      label: "Events",    icon: CalendarDays    },
  { href: "/vendor/messages",    label: "Messages",  icon: MessageSquare   },
  { href: "/vendor/tasks",       label: "Tasks",     icon: CheckSquare,    badge: "task" as const },
  { href: "/vendor/documents",   label: "Documents", icon: FileText        },
];

const BUSINESS_NAV = [
  { href: "/vendor/packages",     label: "Packages",    icon: Package    },
  { href: "/vendor/availability", label: "Availability", icon: CalendarDays },
  { href: "/vendor/venues",       label: "Venues",      icon: Building2  },
  { href: "/vendor/profile",      label: "Profile",     icon: User       },
];

type BadgeKey = "inquiry" | "task";

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
  role,
  newInquiryCount,
  pendingTaskCount,
  children,
}: {
  businessName:     string;
  category:         string | null;
  role:             VendorRole;
  newInquiryCount?: number;
  pendingTaskCount?: number;
  children:         React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const badges: Record<BadgeKey, number | undefined> = {
    inquiry: newInquiryCount,
    task:    pendingTaskCount,
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <SidebarContent businessName={businessName} category={category} badges={badges} />
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
            <SidebarContent businessName={businessName} category={category} badges={badges} />
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
          <span className="font-semibold text-sm text-foreground truncate">{businessName}</span>
          <span className="ml-auto text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Wevenu
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
  badges,
}: {
  businessName: string;
  category:     string | null;
  badges:       Record<BadgeKey, number | undefined>;
}) {
  return (
    <>
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Wevenu</p>
        <p className="font-semibold text-sm text-foreground leading-tight">{businessName}</p>
        {category && (
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{category.replace(/_/g, " ")}</p>
        )}
      </div>

      {/* Daily work nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Daily Work</p>
        {DAILY_NAV.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            badgeCount={item.badge ? badges[item.badge] : undefined}
          />
        ))}

        <p className="px-3 pt-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Business</p>
        {BUSINESS_NAV.map((item) => (
          <NavItem key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}
      </nav>

      {/* Luv button */}
      <div className="px-3 pb-4 border-t border-border pt-3">
        <Link
          href="/vendor/luv"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/20 transition-colors"
        >
          <Heart className="h-4 w-4 shrink-0 fill-pink-400 text-pink-400" />
          Luv
        </Link>
      </div>
    </>
  );
}
