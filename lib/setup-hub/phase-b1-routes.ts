export const PHASE_B1_M02_ROUTES = {
  overview: "/setup-hub/make-htc-yours",
  bookingProcess: "/setup-hub/make-htc-yours/booking-process",
  eventExperiences: "/setup-hub/make-htc-yours/event-experiences",
  communications: "/setup-hub/make-htc-yours/communications",
  operationalResources: "/setup-hub/make-htc-yours/operational-resources",
  venueBrand: "/settings/business?from=setup-hub",
  venueDetails: "/settings/business?from=setup-hub#venue-details",
  lookAndFeel: "/settings/business?from=setup-hub#look-and-feel",
} as const;

export const PHASE_B1_RETURN_QUERY = "from=setup-hub";

export const SETUP_HUB_SECTIONS = [
  "booking-process",
  "event-experiences",
  "communications",
  "operational-resources",
] as const;

export type SetupHubSection = (typeof SETUP_HUB_SECTIONS)[number];

export const SETUP_HUB_SECTION_RETURN: Record<SetupHubSection, { href: string; label: string }> = {
  "booking-process": {
    href: PHASE_B1_M02_ROUTES.bookingProcess,
    label: "Back to Your booking process",
  },
  "event-experiences": {
    href: PHASE_B1_M02_ROUTES.eventExperiences,
    label: "Back to Your event experiences",
  },
  communications: {
    href: PHASE_B1_M02_ROUTES.communications,
    label: "Back to Your communications",
  },
  "operational-resources": {
    href: PHASE_B1_M02_ROUTES.operationalResources,
    label: "Back to Your operational resources",
  },
};

export function isSetupHubSection(value: string | null | undefined): value is SetupHubSection {
  return Boolean(value && (SETUP_HUB_SECTIONS as readonly string[]).includes(value));
}

export function isSafeSetupHubReturnPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/setup-hub/make-htc-yours")) return false;
  if (path.includes("://") || path.includes("//") || path.includes("\\")) return false;
  return true;
}

export function withSetupHubReturn(
  href: string,
  section?: SetupHubSection,
  options?: { returnPath?: string; returnLabel?: string },
): string {
  const url = new URL(href, "https://htc.invalid");
  url.searchParams.set("from", "setup-hub");
  if (section) url.searchParams.set("setupSection", section);
  if (options?.returnPath && isSafeSetupHubReturnPath(options.returnPath)) {
    url.searchParams.set("setupReturn", options.returnPath);
  }
  if (options?.returnLabel) url.searchParams.set("setupReturnLabel", options.returnLabel);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function experiencePreparePath(eventType: string): string {
  return `${PHASE_B1_M02_ROUTES.eventExperiences}/${encodeURIComponent(eventType)}`;
}

export function experiencePrepareHref(eventType: string): string {
  return experiencePreparePath(eventType);
}

export function experiencePrepareReturn(eventType: string, heading: string): {
  returnPath: string;
  returnLabel: string;
} {
  return {
    returnPath: experiencePreparePath(eventType),
    returnLabel: `Back to ${heading}`,
  };
}

export function isSetupHubReturn(from: string | string[] | undefined | null): boolean {
  const value = Array.isArray(from) ? from[0] : from;
  return value === "setup-hub";
}

export function setupProfileReviewHref(
  profileId: string,
  options?: { returnPath?: string; returnLabel?: string },
): string {
  return withSetupHubReturn(
    `/settings/leads/setup-profiles?profileId=${encodeURIComponent(profileId)}`,
    "event-experiences",
    options,
  );
}

export function setupProfileCreateHref(
  eventType: string,
  options?: { returnPath?: string; returnLabel?: string },
): string {
  return withSetupHubReturn(
    `/settings/leads/setup-profiles?create=1&eventType=${encodeURIComponent(eventType)}`,
    "event-experiences",
    options,
  );
}
