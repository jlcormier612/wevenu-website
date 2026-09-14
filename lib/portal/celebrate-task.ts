"use client";

/**
 * Couple-portal task-complete celebration — venue tasks, vendor-shared
 * tasks, and any other portal "I finished this" checkbox that should feel
 * like a real moment (without a modal or reward screen).
 *
 * Uses the same canonical burst as lifecycle milestones (`celebrateLuv`).
 * Kept as a separate entry point so call sites stay explicit about
 * task-complete vs verified Luv domain celebrations.
 */
import { toast } from "sonner";

import { fireCelebrationConfetti } from "@/lib/celebration/confetti-burst";

/**
 * Fire a clear, fun confetti moment after a couple successfully completes
 * a portal task. Call only on successful complete — never on un-complete.
 */
export function celebrateTaskComplete(message?: string) {
  if (typeof document === "undefined") return;

  toast.success(message ?? "Nice work — one less thing to worry about!", {
    icon: "🎉",
    duration: 2400,
  });
  fireCelebrationConfetti();
}
