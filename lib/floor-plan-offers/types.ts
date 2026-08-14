/**
 * Event Floor Plan Offers — Phase 2 types.
 * Offers point at venue-owned templates only.
 */

export type EventFloorPlanOffer = {
  id: string;
  venueId: string;
  eventId: string;
  floorPlanTemplateId: string;
  sortOrder: number;
  isOffered: boolean;
  coupleLabel: string | null;
  coupleBlurb: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventFloorPlanOfferWithTemplate = EventFloorPlanOffer & {
  templateName: string;
  templateArchived: boolean;
  templateSpaceId: string | null;
  objectCount: number;
};

export type UpsertEventFloorPlanOfferInput = {
  templateId: string;
  sortOrder?: number;
  isOffered?: boolean;
  coupleLabel?: string | null;
  coupleBlurb?: string | null;
};
