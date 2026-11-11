/**
 * Same-record Luv draft CTAs must not use a soft Link to ?luv=… — App Router
 * soft-nav on the open lead often does not open the drafting workflow.
 */
import type { LuvObservation } from "@/lib/luv/types";

export function isSameRecordDraftRecommendation(
  obs: Pick<LuvObservation, "recommendation" | "link">,
  currentPath: string | null | undefined,
): boolean {
  if (!currentPath?.trim()) return false;
  const rec = obs.recommendation;
  if (!rec || rec.type !== "draft") return false;
  const href = rec.link || obs.link;
  if (!href) return false;
  const dest = href.split(/[?#]/)[0];
  const here = currentPath.split(/[?#]/)[0];
  if (dest !== here) return false;
  return /[?&]luv=/.test(href) || /follow_up/i.test(rec.label);
}
