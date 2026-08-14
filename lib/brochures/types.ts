/**
 * Brochures — Work Package D7B. A reusable, brandable overview of the
 * venue to share with prospects. Content is mostly live-reused from
 * authoritative venue data (Packages, FAQs, venue story/branding) — only
 * genuinely brochure-specific editorial text lives on this type itself.
 */

export type Brochure = {
  id: string;
  venueId: string;
  name: string;
  isArchived: boolean;
  welcomeText: string | null;   // null = fall back to venue.story
  includePackages: boolean;
  includeFaqs: boolean;
  closingText: string | null;
  shareToken: string;
  /** Hello to Cheers starter key when provisioned from a protected master. */
  sourceMasterKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrochureActivity = {
  id: string;
  brochureId: string;
  venueId: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

export type BrochureWithActivity = Brochure & { activities: BrochureActivity[] };

export type BrochureInput = {
  name: string;
  welcomeText: string;
  includePackages: boolean;
  includeFaqs: boolean;
  closingText: string;
};

export type BrochureErrors = Record<string, string>;

export type BrochureActionResult =
  | { ok: true }
  | { ok: false; message?: string; errors?: BrochureErrors };

export type CreateBrochureResult =
  | { ok: true; brochureId: string }
  | { ok: false; message?: string; errors?: BrochureErrors };

/** Everything needed to render a Brochure — either the venue's own authenticated view or the public token-resolved view. Packages/FAQs are resolved live, never stored on the Brochure row. */
export type BrochureRenderData = {
  brochure: {
    id: string;
    name: string;
    welcomeText: string | null;
    includePackages: boolean;
    includeFaqs: boolean;
    closingText: string | null;
  };
  venue: {
    id: string;
    name: string;
    businessName: string | null;
    logoUrl: string | null;
    story: string | null;
    heroImageUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    email: string | null;
    phone: string | null;
    website: string | null;
  };
  packages: { name: string; description: string | null; basePrice: number | null; category: string | null }[];
  faqs: { question: string; answer: string }[];
};
