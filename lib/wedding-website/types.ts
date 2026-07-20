export type WebsiteTheme =
  | "classic"    // Wildflower — botanical, timeless, sage
  | "modern"     // Midnight — sleek, editorial, dark
  | "garden"     // Garden Party — fresh, airy, verdant
  | "minimal"    // Linen — pure, refined, white
  | "romance"    // Rosé — romantic, blush, candlelit
  | "coastal"    // Coastal — relaxed, navy, breezy
  | "champagne"  // Champagne — golden, celebratory, warm
  | "velvet";    // Velvet — dramatic, burgundy, luxurious

export type FontPairing =
  | "classic_serif"   // Playfair Display + Lato
  | "modern_sans"     // DM Sans (clean, contemporary)
  | "romantic"        // Cormorant Garamond (italic serifs)
  | "editorial";      // DM Serif Display + DM Sans

export type WebsiteSection =
  | "home"
  | "story"
  | "event"
  | "gallery"
  | "schedule"
  | "travel"
  | "dress_code"
  | "bridal_party"
  | "things_to_do"
  | "music"
  | "registry"
  | "faq"
  | "rsvp";

export type WebsiteContent = {
  home?: {
    title?: string;
    subtitle?: string;
    welcomeMessage?: string;
    coverImageUrl?: string;
  };
  story?: {
    title?: string;
    text?: string;
  };
  event?: {
    ceremony?: { time?: string; location?: string; address?: string };
    reception?: { time?: string; location?: string; address?: string };
  };
  gallery?: {
    title?: string;
    photos?: string[];
  };
  schedule?: Array<{ time: string; title: string; description?: string }>;
  travel?: {
    message?: string;
    hotels?: Array<{ name: string; url?: string; code?: string; notes?: string }>;
    transportation?: { notes?: string };
  };
  dress_code?: {
    formality?: "casual" | "smart_casual" | "cocktail" | "black_tie" | "custom";
    description?: string;
    colorNote?: string;
  };
  bridal_party?: {
    title?: string;
    members?: Array<{
      name: string;
      role: string;
      note?: string;
      photoUrl?: string;
    }>;
  };
  things_to_do?: {
    title?: string;
    intro?: string;
    items?: Array<{
      name: string;
      category: "restaurant" | "cafe" | "attraction" | "hotel" | "shopping" | "other";
      description?: string;
      address?: string;
      url?: string;
    }>;
  };
  music?: {
    title?: string;
    ceremony?: string;
    cocktail?: string;
    reception?: string;
    lastDance?: string;
    doNotPlay?: string;
  };
  registry?: Array<{ name: string; url: string; notes?: string }>;
  faq?: Array<{ question: string; answer: string }>;
};

// Hosted Experience Platform Phase 2 — a section as a first-class row
// (experience_sections), not just an implicit key inside `content`.
// See docs/hosted-experience-platform-architecture-spec.md §3.
export type SectionOwner = "live_synced" | "guided" | "couple_authored" | "venue_managed";
export type SectionSyncMode = "live" | "one_time_copy" | "manual";
export type SectionVisibility = "guest" | "password_required" | "hidden";

export type ExperienceSection = {
  key: string;
  title: string;
  visibility: SectionVisibility;
  owner: SectionOwner;
  syncMode: SectionSyncMode;
  dataSource?: string | null;
  lastSyncedAt?: string | null;
  displayRules?: Record<string, unknown>;
  animation?: string | null;
  sortOrder: number;
  content?: unknown;
};

// Hosted Experience Platform Phase 1 catalog — collections/color stories/
// typography styles, replacing the hardcoded THEMES/FONT_PAIRINGS arrays
// that used to live only in components/portal/website-editor.tsx.
export type CatalogColorStory = {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
  tokens: { bg: string; accent: string; heroGradient: string; dark: boolean; [k: string]: unknown };
};

export type CatalogTypographyStyle = {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
  tokens: { headingFont: string; bodyFont: string; headingItalic: boolean; fontUrl: string | null; sampleLabel: string };
};

export type CatalogCollection = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isPremium: boolean;
  sortOrder: number;
  swatchAccent: string | null;
  colorStories: CatalogColorStory[];
};

export type HostedExperienceCatalog = {
  collections: CatalogCollection[];
  typographyStyles: CatalogTypographyStyle[];
};

// Hosted Experience Platform Phase 3 — publishing is a commitment, not a
// save. status replaces the old two-state is_published boolean (kept,
// still correct, now derived from status).
export type ExperienceStatus = "draft" | "preview" | "published" | "archived";

export type CoupleWebsite = {
  exists: boolean;
  id?: string;
  slug?: string;
  status?: ExperienceStatus;
  isPublished?: boolean;
  hasPendingChanges?: boolean;
  previewToken?: string;
  hasPassword?: boolean;
  theme?: WebsiteTheme;
  themePalette?: string;
  accentColor?: string;
  fontPairing?: FontPairing;
  collectionId?: string | null;
  colorStoryId?: string | null;
  typographyStyleId?: string | null;
  sectionOrder?: string[] | null;
  sectionsEnabled?: WebsiteSection[];
  scheduleSync?: boolean;
  content?: WebsiteContent;
  sections?: ExperienceSection[];
};

// Suggestions returned by get_website_suggestions — data already on the
// platform that can pre-populate the website so it feels half-built on first open.
export type WebsiteSuggestions = {
  coupleNames?: string | null;
  hashtag?: string | null;
  story?: { text: string } | null;
  event?: {
    name: string;
    eventDate: string;
    eventType: string | null;
  } | null;
  venue?: {
    name: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    website?: string | null;
  } | null;
  engagementPhotos?: { url: string; id: string }[];
};

export type PublicWebsite = {
  error?: string;
  requires_password?: boolean;
  siteId?: string;
  slug?: string;
  status?: ExperienceStatus;
  isPreview?: boolean;
  theme?: WebsiteTheme;
  themePalette?: string;
  accentColor?: string;
  fontPairing?: FontPairing;
  sectionOrder?: string[] | null;
  sections?: ExperienceSection[];
  sectionsEnabled?: string[];
  content?: WebsiteContent;
  totalViews?: number;
  couple?: {
    firstName: string;
    lastName: string | null;
    partnerFirstName: string | null;
    partnerLastName: string | null;
  };
  event?: {
    id: string;
    name: string;
    eventDate: string;
    eventType: string | null;
  } | null;
  rsvpStats?: {
    total: number;
    attending: number;
    pending: number;
  };
};
