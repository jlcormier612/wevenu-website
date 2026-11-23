"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

/**
 * Link that dismisses a CRM alert for the acting member on click, then navigates.
 * Dismissal is best-effort — navigation always proceeds.
 */
export function NotificationNavLink({
  notificationId,
  href,
  className,
  children,
  onNavigate,
}: {
  notificationId: string;
  href: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function dismissForActor() {
    try {
      await fetch("/api/notifications/dismiss", {
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
        onNavigate?.();
        void dismissForActor().then(() => {
          startTransition(() => router.refresh());
        });
      }}
    >
      {children}
    </Link>
  );
}
