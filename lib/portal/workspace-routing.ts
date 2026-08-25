/**
 * Couple portal workspace deep-links — section + optional within-section focus.
 *
 * Extends the existing `#section` hash (portal-shell) with `#section/focus`
 * so CTAs can land on the exact domain action control. Focus is presentation
 * only: scrolling / highlighting never completes a task.
 *
 * Routing keys are structured (kind / autoCompleteTrigger / explicit focus),
 * never task titles.
 */

import type { PortalSection } from "@/lib/portal/types";
import type { UnifiedTaskTargetSection } from "@/lib/portal/unified-tasks";

/** Within-section action anchors — subset used by domain-verifiable tasks. */
export type PortalWorkspaceFocus =
  | "finalize"
  | "pick"
  | "submit"
  | "sign"
  | "form"
  | "upload"
  | "share";

const FOCUS_VALUES = new Set<PortalWorkspaceFocus>([
  "finalize",
  "pick",
  "submit",
  "sign",
  "form",
  "upload",
  "share",
]);

const PORTAL_SECTIONS = new Set<string>([
  "overview",
  "guests",
  "todos",
  "budget",
  "seating",
  "people",
  "website",
  "story",
  "journey",
  "tasks",
  "timeline",
  "vendors",
  "payments",
  "documents",
  "messages",
  "ask",
  "guide",
  "account",
  "requests",
  "questionnaire",
  "inventory",
  "floor_plans",
  "event-order",
]);

export function isPortalWorkspaceFocus(value: string | null | undefined): value is PortalWorkspaceFocus {
  return Boolean(value && FOCUS_VALUES.has(value as PortalWorkspaceFocus));
}

export function isPortalSection(value: string | null | undefined): value is PortalSection {
  return Boolean(value && PORTAL_SECTIONS.has(value));
}

/** Stable DOM id for scroll / highlight — section-scoped so `submit` is unambiguous. */
export function portalFocusElementId(
  section: PortalSection | UnifiedTaskTargetSection,
  focus: PortalWorkspaceFocus,
): string {
  return `portal-focus-${section}-${focus}`;
}

export function formatPortalHash(
  section: PortalSection | UnifiedTaskTargetSection,
  focus?: PortalWorkspaceFocus | null,
): string {
  return focus ? `${section}/${focus}` : section;
}

export function parsePortalHash(raw: string): {
  section: PortalSection | null;
  focus: PortalWorkspaceFocus | null;
} {
  const h = raw.replace(/^#/, "").trim();
  if (!h) return { section: null, focus: null };
  const [sectionPart, focusPart] = h.split("/");
  const section = isPortalSection(sectionPart) ? sectionPart : null;
  const focus = isPortalWorkspaceFocus(focusPart) ? focusPart : null;
  return { section, focus };
}

/**
 * Scroll to a focus anchor once it exists in the DOM.
 * Retries briefly — sections / cards often mount after async fetch.
 * Never mutates task completion state.
 */
export function scrollToPortalFocus(elementId: string, attempt = 0): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(elementId);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.setAttribute("data-portal-focused", "true");
    window.setTimeout(() => {
      el.removeAttribute("data-portal-focused");
    }, 2400);
    return;
  }
  if (attempt < 24) {
    window.setTimeout(() => scrollToPortalFocus(elementId, attempt + 1), 50);
  }
}
