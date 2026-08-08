"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

/**
 * Link that marks a CRM notification read on click, then navigates.
 * Mark-read is best-effort — navigation always proceeds.
 */
export function NotificationNavLink({
  notificationId,
  href,
  className,
  children,
}: {
  notificationId: string;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function markRead() {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notificationId] }),
      });
    } catch {
      /* ignore — still navigate */
    }
  }

  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        void markRead().then(() => {
          startTransition(() => router.refresh());
        });
      }}
    >
      {children}
    </Link>
  );
}
