"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import type { VendorNotification } from "@/lib/vendor-notifications/types";

const CTA: Record<string, string> = {
  new_message: "Open message",
  new_task: "View task",
  document_shared: "View document",
  assigned_to_event: "Open event",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Vendor notification center — history feed with mark-one / mark-all read.
 * Lives in VendorAppShell (sidebar + mobile header), matching venue NotificationBell.
 */
export function VendorNotificationBell() {
  const [notifications, setNotifications] = React.useState<VendorNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const panelRef = React.useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/vendor/notifications");
      if (!res.ok) return;
      const data = await res.json() as {
        notifications?: VendorNotification[];
        unreadCount?: number;
      };
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // never crash the shell over a failed fetch
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, []);

  // Deep-link from Luv briefing rollups: /vendor/...?notifications=1
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("notifications") !== "1") return;
    setOpen(true);
    params.delete("notifications");
    const qs = params.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", next);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  async function markAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
    setUnreadCount(0);
    await fetch("/api/vendor/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });
  }

  async function markOneRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await fetch("/api/vendor/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
  }

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={hasUnread ? `${unreadCount} unread notifications` : "Notifications"}
      >
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          style={{ maxHeight: "min(480px, calc(100svh - 88px))" }}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              {hasUnread && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>
            {hasUnread && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <p className="text-sm font-medium text-foreground mb-0.5">You&apos;re all caught up</p>
                <p className="text-xs text-muted-foreground">
                  Messages, tasks, documents, and new event assignments show up here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {notifications.map((n) => {
                  const isUnread = !n.readAt;
                  const cta = CTA[n.type] ?? "View";

                  const item = (
                    <div
                      className={`flex gap-2.5 px-3 py-3 transition-colors hover:bg-muted/50 cursor-pointer ${
                        isUnread ? "bg-primary/[0.04]" : ""
                      }`}
                      onClick={() => {
                        if (isUnread) void markOneRead(n.id);
                        setOpen(false);
                      }}
                    >
                      <span className="mt-0.5 shrink-0 text-base leading-none">
                        {n.emoji ?? "🔔"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm leading-snug ${
                              isUnread
                                ? "font-semibold text-foreground"
                                : "font-medium text-foreground/80"
                            }`}
                          >
                            {n.title}
                          </p>
                          {isUnread && (
                            <span
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                        {n.link && (
                          <p className="mt-1 text-[10px] font-semibold text-primary">
                            {cta} →
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-muted-foreground/70">
                          {relativeTime(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );

                  return n.link ? (
                    <Link key={n.id} href={n.link} className="block">
                      {item}
                    </Link>
                  ) : (
                    <div key={n.id}>{item}</div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
