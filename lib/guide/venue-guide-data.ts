import {
  DEFAULT_SECTION_AUDIENCES,
  type DualCopySectionKey,
  type GuideAudience,
  type GuideFaqEntry,
  type GuideSectionKey,
  type SectionOverrides,
  type VendorFaqEntry,
} from "@/lib/venue-guide/audience";

export type FaqEntry = GuideFaqEntry;
export type HotelBlock = { name: string; url?: string; code?: string; notes?: string };
export type VenueContact = { name: string; role: string; phone?: string; email?: string };
export type {
  DualCopySectionKey,
  GuideAudience,
  GuideSectionKey,
  SectionOverrides,
  VendorFaqEntry,
};

export type VenueGuideData = {
  parkingInfo: string | null;
  transportation: string | null;
  nearbyAccommodations: string | null;
  hotelBlocks: HotelBlock[];
  rainPlan: string | null;
  policies: string | null;
  ceremonyInstructions: string | null;
  thingsToDo: string | null;
  faqs: FaqEntry[];
  importantContacts: VenueContact[];
  sectionAudiences: Record<GuideSectionKey, GuideAudience>;
  sectionOverrides: SectionOverrides;
};

export function emptyVenueGuideData(): VenueGuideData {
  return {
    parkingInfo: null,
    transportation: null,
    nearbyAccommodations: null,
    hotelBlocks: [],
    rainPlan: null,
    policies: null,
    ceremonyInstructions: null,
    thingsToDo: null,
    faqs: [],
    importantContacts: [],
    sectionAudiences: { ...DEFAULT_SECTION_AUDIENCES },
    sectionOverrides: {},
  };
}
