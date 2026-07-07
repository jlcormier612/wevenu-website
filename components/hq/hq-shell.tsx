import Link from "next/link";
import {
  Gauge,
  Headset,
  LineChart,
  MessageSquareHeart,
  Settings,
  Siren,
} from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";

type NavItem =
  | { section: string }
  | { href: string; label: string; icon: React.ComponentType<{ className?: string }>; soon?: boolean };

const NAV: NavItem[] = [
  { section: "Beta" },
  { href: "/admin", label: "Beta Command Center", icon: Gauge },
  { href: "/admin/feedback", label: "Feedback & Roadmap", icon: MessageSquareHeart },
  { section: "Coming soon" },
  { href: "/admin/support", label: "Support", icon: Headset, soon: true },
  { href: "/admin/analytics", label: "Analytics", icon: LineChart, soon: true },
  { href: "/admin/system-health", label: "System Health", icon: Siren, soon: true },
  { href: "/admin/settings", label: "Settings", icon: Settings, soon: true },
];

/**
 * Wevenu HQ's left nav. IA per docs/wevenu-hq-architecture.md §1 — reuses
 * QuickCloud's sectioned-nav shape, built on Wevenu's own sidebar tokens.
 * Beta Command Center is the default /admin route (not /admin/beta) — see
 * §6: beta health is the single most important thing happening in the
 * company for the next 6–12 months, so it's the home page, not a sub-page.
 */
export function HqShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Wordmark />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">HQ</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {NAV.map((item, i) =>
              "section" in item ? (
                <li key={i} className="mb-1 mt-4 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground first:mt-0">
                  {item.section}
                </li>
              ) : (
                <li key={item.href}>
                  {item.soon ? (
                    <span className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground/50">
                      <span className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">Soon</span>
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  )}
                </li>
              ),
            )}
          </ul>
        </nav>
        <div className="shrink-0 border-t px-4 py-3">
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Wevenu
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center border-b px-4 lg:hidden">
          <Wordmark />
          <span className="ml-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">HQ</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
