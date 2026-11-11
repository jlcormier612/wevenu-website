"use client";

/**
 * Preparing Booking Workspace has no Conversation tab. Historical
 * message_received links still point at /clients/:id#messages — send those
 * to the Lead Conversation surface when a lead exists.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PreparingMessagesDeepLink({ leadId }: { leadId: string | null | undefined }) {
  const router = useRouter();

  useEffect(() => {
    if (!leadId) return;
    if (window.location.hash.replace(/^#/, "") !== "messages") return;
    router.replace(`/leads/${leadId}#messages`);
  }, [leadId, router]);

  return null;
}
