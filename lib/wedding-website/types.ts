export type WebsiteTheme = "classic" | "modern" | "garden" | "minimal";

export type WebsiteSection = "home" | "event" | "schedule" | "travel" | "registry" | "faq" | "rsvp";

export type WebsiteContent = {
  home?: {
    title?: string;
    subtitle?: string;
    welcomeMessage?: string;
    coverImageUrl?: string;
  };
  event?: {
    ceremony?: { time?: string; location?: string; address?: string };
    reception?: { time?: string; location?: string; address?: string };
  };
  schedule?: Array<{ time: string; title: string; description?: string }>;
  travel?: {
    message?: string;
    hotels?: Array<{ name: string; url?: string; code?: string; notes?: string }>;
    transportation?: { notes?: string };
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
  accentColor?: string;
  sectionsEnabled?: WebsiteSection[];
  content?: WebsiteContent;
};

export type PublicWebsite = {
  error?: string;
  requires_password?: boolean;
  siteId?: string;
  slug?: string;
  theme?: WebsiteTheme;
  accentColor?: string;
  sectionsEnabled?: string[];
  content?: WebsiteContent;
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
