export type WebsiteTheme =
  | "classic"    // Wildflower — botanical, timeless, sage
  | "modern"     // Midnight — sleek, editorial, dark
  | "garden"     // Garden Party — fresh, airy, verdant
  | "minimal"    // Linen — pure, refined, white
  | "romance"    // Rosé — romantic, blush, candlelit
  | "coastal"    // Coastal — relaxed, navy, breezy
  | "champagne"  // Champagne — golden, celebratory, warm
  | "velvet"     // Velvet — dramatic, burgundy, luxurious
  | "estate"     // European Estate — formal grounds, stone and ivy
  | "rustic"     // Rustic — weathered wood, wildflowers
  | "industrial"; // Industrial — exposed brick, black steel

export type FontPairing =
  | "classic_serif"   // Playfair Display + Lato
  | "modern_sans"     // DM Sans (clean, contemporary)
  | "romantic"        // Cormorant Garamond (italic serifs)
  | "editorial"       // DM Serif Display + DM Sans
  | "luxury"          // EB Garamond
  | "minimal"         // Inter
  | "calligraphy"     // Great Vibes + Lato
  | "elegant"         // Cormorant italic
  | "playful"         // Fraunces + Karla
  | "indie_flower"    // Indie Flower + Nunito
  | "shadows_into_light"; // Shadows Into Light + Source Sans 3

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
    /** Optional, couple-supplied — never inferred from gallery/hero/venue imagery. */
    imageUrl?: string;
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
  // Hosted Experience RC1, Part 2 — the six semantic roles are required,
  // not optional: every color_stories row is authored data now, never
  // derived at render time (see deriveSixRoles in curated-color-stories.ts).
  tokens: {
    bg: string; accent: string; heroGradient: string; dark: boolean;
    colorPrimary: string; colorSecondary: string; colorAccent: string;
    colorNeutral: string; colorBackground: string; colorText: string;
    [k: string]: unknown;
  };
};

export type CatalogTypographyStyle = {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
  tokens: { headingFont: string; bodyFont: string; headingItalic: boolean; fontUrl: string | null; sampleLabel: string };
};

// The layout/composition vocabulary a Collection controls (Part 1) — kept
// deliberately separate from color/typography/photo tokens above, which are
// each their own independent dimension now (Part 6/7).
export type CollectionLayoutConfig = {
  heroType?: "full-bleed" | "invitation" | "inset";
  heroAlign?: "center" | "left" | "offset";
  heroMinHeight?: string;
  /** Bounds hero box width:height (e.g. Coastal `2 / 1`, Midnight cinematic). */
  heroAspectCap?: string;
  heroMaxHeight?: string;
  /**
   * Parameterized inset/framed/matted hero (shared primitive). Estate and
   * Rustic use different recipes of the same `heroType: "inset"` path —
   * never Collection-named forks.
   */
  heroInsetPadding?: string;
  heroInsetRadius?: string;
  heroInsetBorderWidth?: string;
  heroInsetOffsetX?: string;
  heroInsetOffsetY?: string;
  headerStyle?: "romantic" | "formal" | "editorial" | "minimal" | "coastal";
  storyStyle?: "quote" | "prose" | "editorial" | "minimal";
  divider?: "botanical" | "rule" | "dots" | "ornament" | "none" | "deco";
  cardRadius?: string;
  buttonRadius?: string;
  galleryLayout?: "grid" | "masonry" | "film-strip";
  rsvpPlacement?: "inline" | "banner";
  animationStyle?: "none" | "fade" | "rise";
  scrollBehavior?: "normal" | "snap";
  sectionSpacing?: "compact" | "cozy" | "spacious";
  // Wedding Website Visual Expression Pass (2026-08-03) — the composition
  // recipe. `sectionComposition` selects which shared primitive family
  // (components/wedding-website/composition-primitives.tsx) a section is
  // built from; the rest parametrize that primitive so Collections sharing
  // a family still render recognizably differently. See docs/wedding-
  // website-visual-expression-completion-report.md for the full per-
  // Collection table.
  sectionComposition?: "editorial" | "flowing" | "framed" | "quiet";
  contentWidth?: "narrow" | "standard" | "wide";
  itemAlign?: "center" | "left" | "alternating";
  alternate?: "none" | "background" | "position";
  featuredItem?: "none" | "first";
  sectionFrame?: "none" | "rule-top" | "rule-both" | "card";
  sectionBand?: "none" | "alternate" | "tinted";
  itemSeparator?: "divider" | "rule" | "gap" | "index";
  density?: "compact" | "cozy" | "spacious" | "airy";
  asymmetry?: "none" | "subtle" | "editorial";
  edgeTreatment?: "contained" | "wide" | "full-bleed" | "alternating";
  /** Wedding Party portrait crop shape only — never read by Photo Style. */
  portraitShape?: "circle" | "square";
  // Coastal Premium Art-Direction Proof Pass (2026-08-03) — per-section
  // whole-page canvas/scale choreography. Closed vocabulary at the leaf;
  // a Collection assigns each section a canvas moment and a visual weight
  // so the page reads as a composed rhythm rather than one flat color
  // repeated behind every section. Optional and additive — a Collection
  // without sectionRoles falls back to the pre-existing flat treatment.
  sectionRoles?: Partial<Record<WebsiteSection | "hero", SectionRole>>;
  [k: string]: unknown;
};

/** `paper` = independent light editorial chamber (STOP-1) — does not inherit dark Color Story fills. */
export type CanvasRole = "light" | "soft" | "strong" | "photographic" | "neutral" | "paper";
export type SectionScale = "feature" | "standard" | "interlude";
// Coastal Art-Direction Pass 2 (2026-08-03) — page-level composition
// primitives (Step 13). `treatment` selects which shared editorial
// primitive a section is built from, independent of `canvas`/`scale`.
// `pairWith` names the one other section key this section may compose
// into a single shared passage with — only when BOTH sides name each
// other AND they are currently adjacent in the couple's own section
// order. Reordered apart, or with one side hidden/empty, each renders
// solo via its normal treatment — this must never assume fixed indexes.
export type SectionTreatment =
  | "editorial-opening" | "split-feature" | "image-led-feature" | "compact-interlude"
  | "timeline" | "paired-passage" | "gallery-spread" | "strong-closing";
export type SectionRole = { canvas: CanvasRole; scale: SectionScale; treatment?: SectionTreatment; pairWith?: string };

export type CatalogCollection = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isPremium: boolean;
  sortOrder: number;
  swatchAccent: string | null;
  layoutConfig: CollectionLayoutConfig;
  colorStories: CatalogColorStory[];
};

// Photo Style — the 4th independent dimension (Part 4). How uploaded
// images are presented; independent from Collection, Color Story, and
// Typography.
export type CatalogPhotoStyle = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sortOrder: number;
  tokens: {
    photoFilter: string;
    photoRadius: string;
    frameStyle: "none" | "border" | "polaroid";
    // Dormant (2026-08-03) — no photo-caption content field exists yet
    // (WebsiteContent.gallery.photos is plain string[]), so this is
    // resolved and carried through the theme but never rendered. Kept,
    // not removed, pending a future dedicated caption capability.
    captionStyle: "none" | "minimal" | "handwritten";
    imageScale: "normal" | "large";
    // Wedding Website Visual Expression Pass (2026-08-03) — how the
    // Photo Gallery's photographs are arranged/treated, independent of
    // the Collection's own section-shell composition. `arrangement`
    // "collage"/"scrapbook"/"sparse"/"gallery-wall" replace the per-image
    // grid/masonry/film-strip loop for that gallery instance; "uniform" decorates it.
    arrangement?: "uniform" | "collage" | "scrapbook" | "sparse" | "gallery-wall";
    scalePattern?: "uniform" | "alternating" | "hero-emphasis";
    rotation?: "none" | "subtle" | "scattered";
    shadow?: "none" | "soft" | "lifted";
    spacing?: "tight" | "normal" | "generous";
    [k: string]: unknown;
  };
};

export type HostedExperienceCatalog = {
  collections: CatalogCollection[];
  typographyStyles: CatalogTypographyStyle[];
  photoStyles: CatalogPhotoStyle[];
};

// Hosted Experience Platform Phase 3 — publishing is a commitment, not a
// save. status replaces the old two-state is_published boolean (kept,
// still correct, now derived from status).
export type ExperienceStatus = "draft" | "preview" | "published" | "archived";

// Coastal Premium Art-Direction Proof Pass (2026-08-03) — the venue's own
// PLACE, distinct from WebsiteSuggestions.venue (onboarding-only, address/
// website fields). Reads venues.name/hero_image_url/story directly, the
// same authoritative columns the couple portal's get_portal_context already
// exposes — no duplicate image storage, one photo, not a gallery.
export type WebsiteVenue = {
  name: string | null;
  heroImageUrl: string | null;
  story: string | null;
} | null;

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
  // Photo Style — Part 4's independent 4th dimension.
  photoStyleId?: string | null;
  // Custom Color Story (Part 2) — reuses the venue brand color-picker
  // pattern: direct hex values, not a locked preset. Any of these set
  // overrides the chosen Color Story's own tokens for that color role.
  colorPrimary?: string | null;
  colorSecondary?: string | null;
  colorAccent?: string | null;
  colorNeutral?: string | null;
  colorBackground?: string | null;
  colorText?: string | null;
  sectionOrder?: string[] | null;
  sectionsEnabled?: WebsiteSection[];
  scheduleSync?: boolean;
  content?: WebsiteContent;
  sections?: ExperienceSection[];
  venue?: WebsiteVenue;
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
    eventEndDate?: string | null;
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
  travel?: {
    hotels?: Array<{ name: string; url?: string; code?: string; notes?: string }>;
    transportation?: { notes?: string } | null;
  } | null;
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
  // Resolved tokens for all four independent dimensions — already joined
  // server-side by get_wedding_website, re-read live on every request (never
  // frozen into the published snapshot itself, matching "reference, not
  // copy" for every other catalog lookup this platform already does).
  layoutConfig?: CollectionLayoutConfig;
  colorTokens?: CatalogColorStory["tokens"] | null;
  typographyTokens?: CatalogTypographyStyle["tokens"] | null;
  photoStyleTokens?: CatalogPhotoStyle["tokens"] | null;
  colorPrimary?: string | null;
  colorSecondary?: string | null;
  colorAccent?: string | null;
  colorNeutral?: string | null;
  colorBackground?: string | null;
  colorText?: string | null;
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
    eventEndDate?: string | null;
    eventType: string | null;
  } | null;
  venue?: WebsiteVenue;
  rsvpStats?: {
    total: number;
    attending: number;
    pending: number;
  };
};
