"use client";

/**
 * Luv Experience Completion — celebration presentation layer.
 *
 * Contract: brief confetti + warm toast (~2s), no modal, no reward screen.
 * Visual burst uses the shared canonical center triple-burst
 * (`fireCelebrationConfetti`) — the approved “real celebration moment”
 * (portal task celebration, Aug 2026), not the original top-of-page trickle.
 *
 * Call sites must only invoke this when the server returned `celebrated: true`
 * from the one-time `luv_celebrations` insert.
 */
import { toast } from "sonner";

import { fireCelebrationConfetti } from "@/lib/celebration/confetti-burst";

export function celebrateLuv(message: string) {
  if (typeof document === "undefined") return;

  toast.success(message, { icon: "🎉", duration: 2200 });
  fireCelebrationConfetti();
}
