"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Bell, Trash2 } from "lucide-react";

import type { CoupleNotification } from "@/lib/couple-notifications/types";
import type { PortalSection } from "@/lib/portal/types";

const PANEL_WIDTH = 320;
const VIEWPORT_PAD = 8;

const ROSE = "#D8A7AA";
const ROSE_DEEP = "#C17F84";
const LINEN = "#F7F2EC";
const BORDER = "#E8DFD4";

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

function sectionFromLink(link: string | null): PortalSection | null {
  if (!link) return null;
  const hash = link.startsWith("#") ? link.slice(1) : link.replace(/^.*#/, "");
  const section = (hash.split("?")[0] || "").trim();
  if (!section) return null;
  return section as PortalSection;
}

/**
 * Couple portal notification bell — message-only shared household inbox.
 * Soft romantic styling (linen / dusty rose); Clear all + trash match vendor UX.
 */
export function CoupleNotificationBell({
  token,
  onNavigate,
}: {
  token: string;
  onNavigate: (section: PortalSection) => void;
}) {
  const [notifications, setNotifications] = React.useState<CoupleNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch(`/api/portal/notifications?token=${encodeURIComponent(token)}`);
      if (!res.ok) return;
      const data = await res.json() as {
        notifications?: CoupleNotification[];
        unreadCount?: number;
      };
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // never crash the portal shell over a failed fetch
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [token]);

  React.useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    function updatePosition() {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_PAD;
      let left = rect.right - PANEL_WIDTH;
      if (left < VIEWPORT_PAD) left = rect.left;
      left = Math.max(VIEWPORT_PAD, Math.min(left, maxLeft));
      const top = Math.min(
        rect.bottom + 8,
        Math.max(VIEWPORT_PAD, window.innerHeight - VIEWPORT_PAD - 120),
      );
      setCoords({ top, left });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  async function markAllRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    );
    setUnreadCount(0);
    await fetch("/api/portal/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ids: [] }),
    });
  }

  async function markOneRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await fetch("/api/portal/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ids: [id] }),
    });
  }

  async function clearAll() {
    setNotifications([]);
    setUnreadCount(0);
    await fetch("/api/portal/notifications/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ids: [] }),
    });
  }

  async function clearOne(id: string, wasUnread: boolean) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    await fetch("/api/portal/notifications/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ids: [id] }),
    });
  }

  function openNotification(n: CoupleNotification) {
    if (!n.readAt) void markOneRead(n.id);
    setOpen(false);
    const section = sectionFromLink(n.link) ?? "messages";
    onNavigate(section);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${section}`);
    }
  }

  const hasUnread = unreadCount > 0;
  const hasNotifications = notifications.length > 0;

  const panel =
    open && coords && mounted
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 w-[320px] overflow-hidden rounded-2xl border shadow-sm"
            style={{
              top: coords.top,
              left: coords.left,
              maxHeight: "min(480px, calc(100svh - 88px))",
              background: "#FFFCFA",
              borderColor: BORDER,
            }}
            role="dialog"
            aria-label="Notifications"
          >
            <div
              className="flex items-center justify-between px-3.5 py-3"
              style={{ borderBottom: `1px solid ${BORDER}`, background: LINEN }}
            >
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#3D3833]">Messages</p>
                {hasUnread && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: `${ROSE}33`, color: ROSE_DEEP }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasUnread && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="text-xs hover:underline"
                    style={{ color: ROSE_DEEP }}
                  >
                    Mark all read
                  </button>
                )}
                {hasNotifications && (
                  <button
                    type="button"
                    onClick={() => void clearAll()}
                    className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs text-[#8A837D] transition-colors hover:bg-white/70 hover:text-[#B45A5A]"
                    aria-label="Clear all notifications"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div
                    className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
                    style={{ borderColor: ROSE, borderTopColor: "transparent" }}
                  />
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="mb-0.5 text-sm font-medium text-[#3D3833]">You&apos;re all caught up</p>
                  <p className="text-xs text-[#8A837D]">
                    New messages from your venue and vendors will show up here.
                  </p>
                </div>
              ) : (
                <div style={{ borderColor: BORDER }}>
                  {notifications.map((n) => {
                    const isUnread = !n.readAt;
                    const cta = n.link?.includes("vendors") ? "Open vendor messages" : "Open messages";

                    return (
                      <div
                        key={n.id}
                        className="flex gap-2.5 px-3.5 py-3 transition-colors"
                        style={{
                          borderBottom: `1px solid ${BORDER}99`,
                          background: isUnread ? `${ROSE}14` : "transparent",
                          cursor: "pointer",
                        }}
                        onClick={() => openNotification(n)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isUnread ? `${ROSE}22` : `${LINEN}`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isUnread ? `${ROSE}14` : "transparent";
                        }}
                      >
                        <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden="true">
                          💬
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm leading-snug ${
                                isUnread ? "font-semibold text-[#3D3833]" : "font-medium text-[#3D3833]/90"
                              }`}
                            >
                              {n.title}
                            </p>
                            <div className="flex shrink-0 items-start gap-1">
                              {isUnread && (
                                <span
                                  className="mt-1.5 h-1.5 w-1.5 rounded-full"
                                  style={{ background: ROSE_DEEP }}
                                  aria-hidden="true"
                                />
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void clearOne(n.id, isUnread);
                                }}
                                className="rounded p-0.5 text-[#8A837D]/70 transition-colors hover:bg-white hover:text-[#B45A5A]"
                                aria-label="Clear notification"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          {n.body && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-[#8A837D]">
                              {n.body}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] font-semibold" style={{ color: ROSE_DEEP }}>
                            {cta} →
                          </p>
                          <p className="mt-1 text-[10px] text-[#8A837D]/80">
                            {relativeTime(n.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted/60"
        style={{ color: open ? ROSE_DEEP : "#6A6460" }}
        aria-label={hasUnread ? `${unreadCount} unread notifications` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
            style={{ background: ROSE_DEEP }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {panel}
    </div>
  );
}
