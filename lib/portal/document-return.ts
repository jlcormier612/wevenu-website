import type { PortalSection } from "@/lib/portal/types";

/** Document email links. These must not fall back to the planning workspace home. */
export const DOCUMENT_PORTAL_SECTIONS = ["inventory", "choices", "event-order"] as const;

export type DocumentPortalSection = (typeof DOCUMENT_PORTAL_SECTIONS)[number];

export function isDocumentPortalSection(
  section: PortalSection | undefined,
): section is DocumentPortalSection {
  return section === "inventory" || section === "choices" || section === "event-order";
}

/** Where the legal welcome gate returns so the document view is not discarded. */
export function documentPortalReturnPath(token: string, section: PortalSection | undefined): string {
  if (section === "inventory") return `/p/${token}?view=inventory#inventory`;
  if (section === "choices") return `/p/${token}?view=choices#choices`;
  if (section === "event-order") return `/p/${token}?view=event-order#event-order`;
  return `/p/${token}`;
}
