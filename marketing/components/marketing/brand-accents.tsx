import { cn } from "@/lib/utils";

/**
 * Brand value accents — Hospitality · Trust · Celebration
 *
 * Recurring visual cues, never decoration for its own sake.
 * Hospitality → Dusty Rose heart
 * Trust → sage fine rule
 * Celebration → gold whisper on imagery only
 */

type AccentProps = {
  className?: string;
};

/** Hospitality — Dusty Rose heart */
export function HospitalityHeart({
  className,
  size = 14,
}: AccentProps & { size?: 14 | 16 }) {
  return (
    <span
      className={cn("hospitality-heart inline-flex shrink-0", className)}
      aria-hidden
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M8 13.75S1.5 9.6 1.5 5.8C1.5 3.7 3.05 2.25 5 2.25c1.15 0 2.2.55 2.85 1.4C8.5 2.8 9.55 2.25 10.7 2.25c1.95 0 3.5 1.45 3.5 3.55 0 3.8-6.5 7.95-6.2 7.95Z" />
      </svg>
    </span>
  );
}

/** Trust — short sage fine rule */
export function TrustRule({ className }: AccentProps) {
  return <span className={cn("trust-rule", className)} aria-hidden />;
}

/**
 * Celebration — gold sparkle whisper for photography frames only.
 * Place inside a `relative` editorial frame / bleed; never as UI chrome.
 */
export function CelebrationWhisper({ className }: AccentProps) {
  return (
    <span className={cn("celebration-whisper", className)} aria-hidden>
      <svg
        width="11"
        height="11"
        viewBox="0 0 12 12"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M6 0.4 6.85 4.4 10.9 5.25 6.85 6.1 6 10.1 5.15 6.1 1.1 5.25 5.15 4.4Z" />
      </svg>
    </span>
  );
}
