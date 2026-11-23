"use client";

import { logoutAction } from "@/app/(app)/team/auth-actions";
import { NotificationNavLink } from "@/components/notifications/notification-nav-link";
import {
  notificationDestinationLabel,
  notificationHref,
} from "@/lib/notifications/href";
import type { Notification } from "@/lib/types";
import type { TeamMemberProfile } from "@/lib/program4/types";
import { ROLE_LABELS } from "@/lib/program4/labels";
import { formatRelativeDay } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type TopBarNotification = Pick<
  Notification,
  "id" | "title" | "body" | "createdAt" | "relationshipId" | "type" | "meta"
> & {
  venueName?: string | null;
};

export function TopBar({
  actor,
  sessionUser,
  notifications = [],
}: {
  actor: TeamMemberProfile;
  /** Real signed-in user (before impersonation). */
  sessionUser: TeamMemberProfile;
  notifications?: TopBarNotification[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  const unreadCount = items.length;

  async function dismissIds(ids: string[]) {
    const idSet = new Set(ids);
    setItems((prev) => prev.filter((n) => !idSet.has(n.id)));
    try {
      await fetch("/api/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch {
      /* keep optimistic UI; refresh reconciles */
    }
    startTransition(() => router.refresh());
  }

  async function dismissOne(id: string) {
    await dismissIds([id]);
  }

  async function dismissAll() {
    const ids = items.map((n) => n.id);
    if (ids.length === 0) return;
    await dismissIds(ids);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--htc-border)] bg-[var(--htc-warm-white)]">
      <div className="mx-auto flex h-[60px] max-w-[1440px] items-center justify-end gap-3 px-4 md:h-16 md:gap-4 md:px-8">
        <div className="relative shrink-0">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-sm border border-[var(--htc-border)] bg-[var(--true-white)] px-2.5 py-1.5 text-sm text-foreground hover:border-[var(--htc-primary)]"
            aria-expanded={open}
            aria-haspopup="true"
            aria-label={
              unreadCount > 0
                ? `${unreadCount} notifications`
                : "Notifications"
            }
            onClick={() => setOpen((v) => !v)}
            data-testid="notifications-menu-button"
          >
            <span className="hidden sm:inline">Alerts</span>
            {unreadCount > 0 ? (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-sm bg-[var(--htc-primary)] px-1 text-[0.65rem] font-medium text-[var(--true-white)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : (
              <span className="text-xs ws-muted">0</span>
            )}
          </button>

          {open ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-20 cursor-default bg-transparent"
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
              />
              <div
                className="absolute right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] max-sm:fixed max-sm:inset-x-2 max-sm:top-[4.25rem] max-sm:w-auto rounded-sm border border-[var(--htc-border)] bg-[var(--true-white)] shadow-sm"
                style={{ maxHeight: "min(28rem, calc(100svh - 5.5rem))" }}
                data-testid="notifications-menu"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[var(--htc-border)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--htc-dusty)]">
                      Notifications
                    </p>
                    <p className="mt-0.5 text-xs ws-muted">
                      Awareness items only. Routine activity lives on Today and
                      each relationship timeline.
                    </p>
                  </div>
                  {unreadCount > 0 ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-[var(--htc-primary)] underline-offset-4 hover:underline"
                      onClick={() => void dismissAll()}
                      data-testid="notifications-dismiss-all"
                    >
                      Dismiss all
                    </button>
                  ) : null}
                </div>
                {unreadCount === 0 ? (
                  <p className="px-3 py-4 text-sm ws-muted">No new alerts</p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto overscroll-contain py-1">
                    {items.map((n) => {
                      const destination = notificationDestinationLabel(
                        n as Notification,
                        n.venueName,
                      );
                      return (
                        <li
                          key={n.id}
                          className="flex items-stretch gap-1 border-b border-[var(--htc-border)] last:border-0"
                        >
                          <NotificationNavLink
                            notificationId={n.id}
                            href={notificationHref(n as Notification)}
                            className="min-w-0 flex-1 px-3 py-2.5 hover:bg-[var(--htc-linen)]/60"
                            onNavigate={() => {
                              setOpen(false);
                              setItems((prev) =>
                                prev.filter((row) => row.id !== n.id),
                              );
                            }}
                          >
                            <p className="truncate text-sm font-medium text-foreground">
                              {n.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs ws-muted">
                              {destination}
                              <span className="mx-1">·</span>
                              {formatRelativeDay(n.createdAt)}
                            </p>
                          </NotificationNavLink>
                          <button
                            type="button"
                            className="shrink-0 px-2.5 text-xs ws-muted hover:bg-[var(--htc-linen)]/60 hover:text-foreground"
                            aria-label={`Dismiss ${n.title}`}
                            data-testid="notification-dismiss"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void dismissOne(n.id);
                            }}
                          >
                            Dismiss
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="border-t border-[var(--htc-border)] px-3 py-2">
                  <a
                    href="/today"
                    className="text-xs font-medium text-[var(--htc-primary)] underline-offset-4 hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    Open Today for full activity →
                  </a>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center gap-3">
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
    </header>
  );
}
