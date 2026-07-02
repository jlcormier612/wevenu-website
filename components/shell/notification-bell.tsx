"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type VenueNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  emoji: string | null;
  eventId: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  notifications?: VenueNotification[];
  unreadCount?: number;
};

const NOTIFICATION_CTA: Record<string, string> = {
  new_lead:               "Review inquiry",
  rsvp_received:          "View guest list",
  task_completed_couple:  "Open playbook",
  task_completed_vendor:  "Open playbook",
  vendor_checked_in:      "Open day view",
  feedback_received:      "Review feedback",
  referral_received:      "View referral",
  message_received:       "Reply to message",
};

function getCta(type: string): string {
  return NOTIFICATION_CTA[type] ?? "View";
}

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

export function NotificationBell() {
  const [notifications, setNotifications] = React.useState<VenueNotification[]>([]);
  const [unreadCount, setUnreadCount]     = React.useState(0);
  const [open, setOpen]                   = React.useState(false);
  const [loading, setLoading]             = React.useState(true);
  const panelRef                          = React.useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res  = await fetch("/api/notifications");
      const data = await res.json() as NotificationsResponse;
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent — never crash the shell over a failed notification fetch
    } finally {
      setLoading(false);
    }
  }

  // Initial fetch + 60s poll
  React.useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, []);

  // Close on outside click
  React.useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });
    setNotifications(prev =>
      prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
    setUnreadCount(0);
  }

  async function markOneRead(id: string) {
    // Optimistic
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n),
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
  }

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen(s => !s)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={hasUnread ? `${unreadCount} unread notifications` : "Notifications"}
      >
        <Bell className="h-[1.1rem] w-[1.1rem]" />
        {hasUnread && (
          <span
            className="absolute right-1 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-[3px] text-[9px] font-bold leading-none text-white"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-[340px] overflow-hidden rounded-2xl border bg-background shadow-xl"
          style={{ maxHeight: "min(500px, calc(100svh - 88px))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-heading">Notifications</p>
              {hasUnread && (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  {unreadCount} new
                </span>
              )}
            </div>
            {hasUnread && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-2xl mb-2">🔔</p>
                <p className="text-sm font-medium text-heading mb-0.5">All caught up</p>
                <p className="text-xs text-muted-foreground">Notifications will appear here as activity happens.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {notifications.map(n => {
                  const isUnread = !n.readAt;

                  const itemContent = (
                    <div
                      className={`flex gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 cursor-pointer ${isUnread ? "bg-primary/[0.03]" : ""}`}
                      onClick={() => {
                        if (isUnread) void markOneRead(n.id);
                        setOpen(false);
                      }}
                    >
                      <span className="mt-0.5 shrink-0 text-lg leading-none">
                        {n.emoji ?? "🔔"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm leading-snug ${isUnread ? "font-semibold text-heading" : "font-medium text-foreground/80"}`}>
                            {n.title}
                          </p>
                          {isUnread && (
                            <span
                              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
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
                          <p className="mt-1.5 text-[10px] font-semibold" style={{ color: "#9B4F54" }}>
                            {getCta(n.type)} →
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
                      {itemContent}
                    </Link>
                  ) : (
                    <div key={n.id}>{itemContent}</div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && notifications.length > 0 && (
            <div className="border-t px-4 py-2">
              <p className="text-center text-[10px] text-muted-foreground">
                {notifications.length} most recent · older notifications expire after 30 days
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
