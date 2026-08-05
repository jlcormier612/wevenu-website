import Link from "next/link";

import { logoutAction } from "@/app/(app)/team/auth-actions";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import type { TeamMemberProfile } from "@/lib/program4/types";
import { ROLE_LABELS } from "@/lib/program4/labels";
import { getNotifications } from "@/lib/data/store";
import { formatRelativeDay } from "@/lib/utils";

export function TopBar({
  actor,
  sessionUser,
}: {
  actor: TeamMemberProfile;
  /** Real signed-in user (before impersonation). */
  sessionUser: TeamMemberProfile;
}) {
  const unread = getNotifications({ unreadOnly: true }).slice(0, 3);

  return (
    <header className="sticky top-0 z-20 border-b border-border/40 bg-background/92 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-8 py-4">
        <p className="hidden text-sm text-muted-foreground md:block">
          One relationship. One timeline. One source of truth.
        </p>
        <div className="flex flex-1 items-center justify-end gap-4">
          <div className="hidden text-right lg:block">
            {unread.length === 0 ? (
              <p className="text-sm text-muted-foreground">No new alerts</p>
            ) : (
              <ul className="space-y-0.5">
                {unread.map((n) => (
                  <li key={n.id} className="text-sm">
                    <Link
                      href={`/relationships/${n.relationshipId}`}
                      className="text-foreground hover:text-primary"
                    >
                      {n.title}
                      <span className="ml-2 text-muted-foreground">
                        {formatRelativeDay(n.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--soft-sage)]/50 text-xs font-medium text-[var(--forest-sage)]"
              title={`${actor.name} · ${ROLE_LABELS[actor.role]}`}
            >
              {actor.initials}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium text-foreground">
                {actor.name}
              </p>
              <p className="truncate text-xs ws-muted">
                {ROLE_LABELS[actor.role]}
                {sessionUser.id !== actor.id ? " · impersonating" : null}
              </p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-xs text-primary underline-offset-4 hover:underline"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
