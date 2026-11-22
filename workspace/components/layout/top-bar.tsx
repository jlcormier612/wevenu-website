import { logoutAction } from "@/app/(app)/team/auth-actions";
import { NotificationNavLink } from "@/components/notifications/notification-nav-link";
import { ThemeToggle } from "@/components/providers/theme-toggle";
import { getNotifications, getRelationship } from "@/lib/data/store";
import {
  notificationDestinationLabel,
  notificationHref,
} from "@/lib/notifications/href";
import type { TeamMemberProfile } from "@/lib/program4/types";
import { ROLE_LABELS } from "@/lib/program4/labels";
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
    <header className="sticky top-0 z-20 border-b border-[var(--htc-border)] bg-[var(--htc-warm-white)]">
      <div className="mx-auto flex h-[60px] max-w-[1440px] items-center justify-end gap-4 px-4 md:h-16 md:gap-6 md:px-8">
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 md:gap-4">
          <div className="hidden min-w-0 text-right lg:block">
            {unread.length === 0 ? (
              <p className="text-sm text-muted-foreground">No new alerts</p>
            ) : (
              <ul className="space-y-0.5">
                {unread.map((n) => {
                  const rel = getRelationship(n.relationshipId);
                  return (
                    <li key={n.id} className="text-sm">
                      <NotificationNavLink
                        notificationId={n.id}
                        href={notificationHref(n)}
                        className="text-foreground hover:text-primary"
                      >
                        {n.title}
                        <span className="ml-2 text-muted-foreground">
                          {formatRelativeDay(n.createdAt)}
                        </span>
                        <span className="ml-2 text-xs text-[var(--htc-primary)]">
                          {notificationDestinationLabel(n, rel?.venue.name)}
                        </span>
                      </NotificationNavLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--htc-soft-sage)] text-xs font-medium text-[var(--htc-forest)]"
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
                className="text-sm text-[var(--htc-primary)] underline-offset-4 hover:underline"
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
