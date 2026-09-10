"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Building2, Menu, Search } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { FeedbackSheet } from "@/components/feedback/feedback-sheet";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import { CommandPalette } from "@/components/shell/command-palette";
import { NotificationBell } from "@/components/shell/notification-bell";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Responsive workspace shell: a fixed left sidebar on desktop, a top navigation
 * bar, and a slide-out navigation sheet on mobile. Renders the active module
 * page as `children`.
 *
 * The shell is `fixed inset-0` so it always covers the browser viewport. That
 * prevents the short-shell failure mode where `h-svh` alone still left a cream
 * band of document background below the app.
 *
 * `main` is the module scroll surface for every route: the sidebar and global
 * header stay put while page content scrolls inside it. Inbox only differs in
 * content width (`max-w-[90rem]`), not in scroll model — its conversation
 * column must be free to grow past the viewport and keep scrolling.
 */
export function WorkspaceShell({
  email,
  venueName,
  venueLogo,
  staffRole = null,
  children,
}: {
  email: string;
  venueName?: string;
  venueLogo?: string | null;
  staffRole?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isInboxWorkspace = pathname === "/messaging";
  const [mobileNavOpen, setMobileNavOpen]   = React.useState(false);
  const [searchOpen,    setSearchOpen]      = React.useState(false);

  return (
    <div className="htc-staff fixed inset-0 flex min-h-0 w-full overflow-hidden bg-background font-sans text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-[15.5rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-20 items-center border-b border-sidebar-border px-5">
          <Wordmark sizeClassName="h-[66.8px] w-auto" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav staffRole={staffRole} />
        </div>
        <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
          <FeedbackSheet surface="venue" />
        </div>
      </aside>

      {/* Main column — min-h-0 so flex-1 children can shrink/fill under h-svh */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/40 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* Mobile nav trigger */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                />
              }
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[15.5rem] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetHeader className="h-20 justify-center border-b border-sidebar-border px-5 text-left">
                <SheetTitle>
                  <Wordmark sizeClassName="h-[66.8px] w-auto" />
                </SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto">
                <SidebarNav staffRole={staffRole} onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <Wordmark showText={false} sizeClassName="h-[48.6px] w-auto" />
          </div>

          {/* Venue branding — logo when uploaded, name + icon otherwise */}
          {(venueLogo || venueName) && (
            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              {venueLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={venueLogo}
                  alt={venueName ?? "Venue"}
                  className="h-12 w-auto max-w-[200px] rounded-md object-contain"
                />
              ) : (
                <>
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium text-heading">{venueName}</span>
                </>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            {/* Search button — also openable with ⌘K */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex h-9 items-center gap-2 rounded-sm border border-border/60 bg-muted/40 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Search"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search</span>
              <kbd className="ml-1 hidden md:inline-flex h-4 select-none items-center rounded-sm border bg-background px-1 text-[10px] font-medium">
                ⌘K
              </kbd>
            </button>
            {/* Mobile search icon */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Search"
            >
              <Search className="h-[1.1rem] w-[1.1rem]" />
            </button>
            <NotificationBell />
            <ThemeToggle />
            <UserMenu email={email} />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto bg-background">
          <div
            className={cn(
              "mx-auto w-full",
              isInboxWorkspace
                ? "max-w-[90rem] px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-4"
                : "max-w-6xl p-4 sm:p-6 lg:p-10",
            )}
          >
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
