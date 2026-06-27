"use client";

import * as React from "react";

import { Building2, Menu } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/providers/theme-toggle";
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

/**
 * Responsive workspace shell: a fixed left sidebar on desktop, a top navigation
 * bar, and a slide-out navigation sheet on mobile. Renders the active module
 * page as `children`.
 */
export function WorkspaceShell({
  email,
  venueName,
  venueLogo,
  children,
}: {
  email: string;
  venueName?: string;
  venueLogo?: string | null;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <div className="flex min-h-svh w-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Wordmark logoUrl={venueLogo} venueName={venueName} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
              className="w-72 bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetHeader className="h-16 justify-center border-b px-5 text-left">
                <SheetTitle>
                  <Wordmark logoUrl={venueLogo} venueName={venueName} />
                </SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto">
                <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <Wordmark showText={false} />
          </div>

          {venueName ? (
            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium text-heading">
                {venueName}
              </span>
            </div>
          ) : null}

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu email={email} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-muted/40">
          <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
