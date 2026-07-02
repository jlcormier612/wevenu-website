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

export type CoupleWebsite = {
  exists: boolean;
  id?: string;
  slug?: string;
  isPublished?: boolean;
  hasPassword?: boolean;
  theme?: WebsiteTheme;
  themePalette?: string;
  accentColor?: string;
  fontPairing?: FontPairing;
  sectionOrder?: string[] | null;
  sectionsEnabled?: WebsiteSection[];
  scheduleSync?: boolean;
  content?: WebsiteContent;
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
  theme?: WebsiteTheme;
  themePalette?: string;
  accentColor?: string;
  fontPairing?: FontPairing;
  sectionOrder?: string[] | null;
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
