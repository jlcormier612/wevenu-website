import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { FeedbackSheet } from "@/components/feedback/feedback-sheet";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { WorkspaceShellHeader } from "@/components/shell/workspace-shell-header";
import { cn } from "@/lib/utils";

/**
 * Responsive workspace shell: a fixed left sidebar on desktop, a top navigation
 * bar, and a slide-out navigation sheet on mobile. Renders the active module
 * page as `children`.
 *
 * This file is a Server Component. The App Router page slot (`children`) must
 * stay here — not inside a Client Component. Wrapping the slot in a client
 * shell plus `app/(app)/loading.tsx` left Lead HTML in a hidden `#S:0` node
 * (`<!--$~-->` / React `$RC` queue) so the skeleton stayed `aria-busy` and
 * the tree never hydrated.
 *
 * The shell is `fixed inset-0` so it always covers the browser viewport. That
 * prevents the short-shell failure mode where `h-svh` alone still left a cream
 * band of document background below the app.
 *
 * `main` is the module scroll surface for every route: the sidebar and global
 * header stay put while page content scrolls inside it. Inbox only differs in
 * content width (`max-w-[90rem]`) plus `min-w-0` / `overflow-x-clip` so a
 * long thread can grow the document vertically without sliding the workspace
 * horizontally (`overflow-y-auto` would otherwise compute overflow-x to auto).
 */
export function WorkspaceShell({
  email,
  venueName,
  venueLogo,
  staffRole = null,
  pathname,
  children,
}: {
  email: string;
  venueName?: string;
  venueLogo?: string | null;
  staffRole?: string | null;
  pathname: string;
  children: ReactNode;
}) {
  const isInboxWorkspace = pathname === "/messaging";

  return (
    <div className="htc-staff fixed inset-0 flex min-h-0 w-full overflow-hidden bg-background font-sans text-foreground">
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <WorkspaceShellHeader
          email={email}
          venueName={venueName}
          venueLogo={venueLogo}
          staffRole={staffRole}
        />

        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto bg-background",
            isInboxWorkspace && "overflow-x-clip",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full min-w-0",
              isInboxWorkspace
                ? "max-w-[90rem] px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-4"
                : "max-w-6xl p-4 sm:p-6 lg:p-10",
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
