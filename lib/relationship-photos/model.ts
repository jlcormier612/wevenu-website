/**
 * Enduring relationship photos — venue photo vs client-shared photo.
 *
 * Source of truth lives on venue_customer_relationships. Display rules are
 * pure here so UI, services, and tests share one precedence model.
 */

export type VenueDisplaySource = "none" | "venue" | "client";

export type RelationshipPhotoState = {
  venuePhotoUrl: string | null;
  clientPhotoUrl: string | null;
  clientPhotoShared: boolean;
  venueDisplaySource: VenueDisplaySource;
};

export type VenueFacingPhotoState = {
  venuePhotoUrl: string | null;
  /** Null unless the couple has shared. */
  clientPhotoUrl: string | null;
  clientPhotoShared: boolean;
  venueDisplaySource: VenueDisplaySource;
  /** What the venue-side UI should render now. */
  displayedPhotoUrl: string | null;
  effectiveDisplaySource: VenueDisplaySource;
  /** Shared client photo exists but venue photo is still displayed. */
  clientPhotoAvailable: boolean;
};

export function normalizePhotoUrl(url: string | null | undefined): string | null {
  const trimmed = (url ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve what the venue-side record should show.
 * Does not mutate state — callers persist source changes separately.
 */
export function resolveVenueFacingPhoto(state: RelationshipPhotoState): VenueFacingPhotoState {
  const venuePhotoUrl = normalizePhotoUrl(state.venuePhotoUrl);
  const rawClientUrl = normalizePhotoUrl(state.clientPhotoUrl);
  const clientPhotoShared = Boolean(state.clientPhotoShared) && rawClientUrl != null;
  const clientPhotoUrl = clientPhotoShared ? rawClientUrl : null;
  const source = state.venueDisplaySource;

  let displayedPhotoUrl: string | null = null;
  let effectiveDisplaySource: VenueDisplaySource = "none";

  if (source === "client" && clientPhotoUrl) {
    displayedPhotoUrl = clientPhotoUrl;
    effectiveDisplaySource = "client";
  } else if (source === "client" && venuePhotoUrl) {
    // Sharing revoked or photo removed while source was client.
    displayedPhotoUrl = venuePhotoUrl;
    effectiveDisplaySource = "venue";
  } else if (source === "venue" && venuePhotoUrl) {
    displayedPhotoUrl = venuePhotoUrl;
    effectiveDisplaySource = "venue";
  } else if (source === "none" && venuePhotoUrl) {
    displayedPhotoUrl = venuePhotoUrl;
    effectiveDisplaySource = "venue";
  } else {
    displayedPhotoUrl = null;
    effectiveDisplaySource = "none";
  }

  return {
    venuePhotoUrl,
    clientPhotoUrl,
    clientPhotoShared,
    venueDisplaySource: source,
    displayedPhotoUrl,
    effectiveDisplaySource,
    clientPhotoAvailable: clientPhotoShared && effectiveDisplaySource !== "client",
  };
}

/** After venue uploads/replaces their photo. */
export function afterVenuePhotoUpload(state: RelationshipPhotoState, url: string): RelationshipPhotoState {
  return {
    ...state,
    venuePhotoUrl: normalizePhotoUrl(url),
    venueDisplaySource: "venue",
  };
}

/** After venue removes their photo — do not silently adopt the client photo. */
export function afterVenuePhotoRemove(state: RelationshipPhotoState): RelationshipPhotoState {
  return {
    ...state,
    venuePhotoUrl: null,
    venueDisplaySource: "none",
  };
}

/** Venue explicitly chooses the shared client photo. */
export function afterVenueChoosesClientPhoto(state: RelationshipPhotoState): RelationshipPhotoState | null {
  const clientUrl = normalizePhotoUrl(state.clientPhotoUrl);
  if (!state.clientPhotoShared || !clientUrl) return null;
  return {
    ...state,
    venueDisplaySource: "client",
  };
}

/** Venue switches back to their own photo. */
export function afterVenueChoosesVenuePhoto(state: RelationshipPhotoState): RelationshipPhotoState | null {
  if (!normalizePhotoUrl(state.venuePhotoUrl)) return null;
  return {
    ...state,
    venueDisplaySource: "venue",
  };
}

/**
 * Couple turns sharing on. Auto-display only when there is no venue photo.
 */
export function afterClientSharesPhoto(state: RelationshipPhotoState): RelationshipPhotoState {
  const clientUrl = normalizePhotoUrl(state.clientPhotoUrl);
  if (!clientUrl) {
    return { ...state, clientPhotoShared: false };
  }
  const venueUrl = normalizePhotoUrl(state.venuePhotoUrl);
  return {
    ...state,
    clientPhotoShared: true,
    venueDisplaySource: venueUrl ? state.venueDisplaySource : "client",
  };
}

/** Couple turns sharing off. */
export function afterClientRevokesShare(state: RelationshipPhotoState): RelationshipPhotoState {
  const venueUrl = normalizePhotoUrl(state.venuePhotoUrl);
  return {
    ...state,
    clientPhotoShared: false,
    venueDisplaySource:
      state.venueDisplaySource === "client"
        ? (venueUrl ? "venue" : "none")
        : state.venueDisplaySource,
  };
}

/** Couple uploads/replaces their photo. Sharing stays as-is unless cleared by remove. */
export function afterClientPhotoUpload(
  state: RelationshipPhotoState,
  url: string,
): RelationshipPhotoState {
  return {
    ...state,
    clientPhotoUrl: normalizePhotoUrl(url),
  };
}

/** Couple deletes their photo. */
export function afterClientPhotoRemove(state: RelationshipPhotoState): RelationshipPhotoState {
  const venueUrl = normalizePhotoUrl(state.venuePhotoUrl);
  return {
    ...state,
    clientPhotoUrl: null,
    clientPhotoShared: false,
    venueDisplaySource:
      state.venueDisplaySource === "client"
        ? (venueUrl ? "venue" : "none")
        : state.venueDisplaySource,
  };
}

/** Whether turning sharing ON should create a venue notification. */
export function shouldNotifyClientPhotoShared(
  previousShared: boolean,
  nextShared: boolean,
  clientPhotoUrl: string | null | undefined,
): boolean {
  return !previousShared && nextShared && normalizePhotoUrl(clientPhotoUrl) != null;
}
