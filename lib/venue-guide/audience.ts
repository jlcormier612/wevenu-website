/**
 * Venue Guide audience visibility + optional dual copy.
 *
 * One guide, two asking audiences (clients | vendors). Section-level
 * visibility defaults preserve today's behavior: hotels / accommodations /
 * things-to-do are client-facing; operational sections default to both.
 */

export type GuideAudience = "clients" | "vendors" | "both";
export type AskingAudience = "clients" | "vendors";

export type GuideSectionKey =
  | "parking"
  | "accommodations"
  | "weather"
  | "policies"
  | "ceremony"
  | "things"
  | "faqs"
  | "contacts";

export const GUIDE_SECTION_KEYS: GuideSectionKey[] = [
  "parking",
  "accommodations",
  "weather",
  "policies",
  "ceremony",
  "things",
  "faqs",
  "contacts",
];

/** Dual-copy prose sections stored as section_overrides.<key>.vendors string. */
export type DualCopySectionKey = "parking" | "policies" | "ceremony" | "things";

export const DUAL_COPY_SECTION_KEYS: DualCopySectionKey[] = [
  "parking",
  "policies",
  "ceremony",
  "things",
];

/** Defaults match today's hardcoded vendor handbook subset. */
export const DEFAULT_SECTION_AUDIENCES: Record<GuideSectionKey, GuideAudience> = {
  parking: "both",
  accommodations: "clients",
  weather: "both",
  policies: "both",
  ceremony: "both",
  things: "clients",
  faqs: "both",
  contacts: "both",
};

export type VendorFaqEntry = {
  question: string;
  answer: string;
};

export type SectionOverrides = {
  parking?: { vendors?: string | null };
  policies?: { vendors?: string | null };
  ceremony?: { vendors?: string | null };
  things?: { vendors?: string | null };
  /** Separate vendor FAQ list when section audience is both. */
  faqs?: { vendors?: VendorFaqEntry[] };
};

export type GuideFaqEntry = {
  question: string;
  answer: string;
  /** Defaults to both when omitted. Legacy; dual lists preferred. */
  audience?: GuideAudience;
  /** Legacy dual-answer field; prefer section_overrides.faqs.vendors. */
  answer_for_vendors?: string | null;
};

const AUDIENCE_VALUES = new Set<GuideAudience>(["clients", "vendors", "both"]);

function asAudience(value: unknown): GuideAudience | null {
  return typeof value === "string" && AUDIENCE_VALUES.has(value as GuideAudience)
    ? (value as GuideAudience)
    : null;
}

function normalizeVendorFaqList(raw: unknown): VendorFaqEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items: VendorFaqEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const question = (entry as { question?: unknown }).question;
    const answer = (entry as { answer?: unknown }).answer;
    if (typeof question !== "string") continue;
    items.push({
      question,
      answer: typeof answer === "string" ? answer : "",
    });
  }
  return items;
}

/** Merge stored jsonb with defaults so missing keys keep current behavior. */
export function normalizeSectionAudiences(
  raw: unknown,
): Record<GuideSectionKey, GuideAudience> {
  const out = { ...DEFAULT_SECTION_AUDIENCES };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const obj = raw as Record<string, unknown>;
  for (const key of GUIDE_SECTION_KEYS) {
    const parsed = asAudience(obj[key]);
    if (parsed) out[key] = parsed;
  }
  return out;
}

export function normalizeSectionOverrides(raw: unknown): SectionOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: SectionOverrides = {};
  for (const key of DUAL_COPY_SECTION_KEYS) {
    const block = obj[key];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const vendors = (block as { vendors?: unknown }).vendors;
    if (typeof vendors === "string") {
      out[key] = { vendors };
    } else if (vendors === null) {
      out[key] = { vendors: null };
    }
  }
  const faqsBlock = obj.faqs;
  if (faqsBlock && typeof faqsBlock === "object" && !Array.isArray(faqsBlock)) {
    const vendors = normalizeVendorFaqList((faqsBlock as { vendors?: unknown }).vendors);
    if (vendors) out.faqs = { vendors };
  }
  return out;
}

export function isSectionVisible(
  section: GuideSectionKey,
  asking: AskingAudience,
  audiences?: Partial<Record<GuideSectionKey, GuideAudience>> | null,
): boolean {
  const visibility =
    audiences?.[section] ??
    DEFAULT_SECTION_AUDIENCES[section] ??
    "both";
  if (visibility === "both") return true;
  return visibility === asking;
}

/**
 * Resolve dual-copy fields. Clients always get main content.
 * Vendors get override when present (non-empty), otherwise main.
 */
export function resolveContent(
  section: DualCopySectionKey,
  asking: AskingAudience,
  main: string | null | undefined,
  overrides?: SectionOverrides | null,
): string | null {
  const mainText = typeof main === "string" ? main : null;
  if (asking === "clients") return mainText;

  const vendorOverride = overrides?.[section]?.vendors;
  if (typeof vendorOverride === "string" && vendorOverride.trim().length > 0) {
    return vendorOverride;
  }
  return mainText;
}

export function isFaqVisibleTo(
  faq: GuideFaqEntry,
  asking: AskingAudience,
): boolean {
  const visibility = asAudience(faq.audience) ?? "both";
  if (visibility === "both") return true;
  return visibility === asking;
}

export function resolveFaqAnswer(
  faq: GuideFaqEntry,
  asking: AskingAudience,
): string {
  if (asking === "vendors") {
    const override = faq.answer_for_vendors;
    if (typeof override === "string" && override.trim().length > 0) {
      return override;
    }
  }
  return faq.answer ?? "";
}

function hasVendorFaqList(overrides?: SectionOverrides | null): boolean {
  const list = overrides?.faqs?.vendors;
  return Array.isArray(list) && list.some((f) => f.question.trim().length > 0);
}

/**
 * Project FAQs for an audience.
 * Vendors: prefer section_overrides.faqs.vendors when present; else fall back
 * to the main list filtered by legacy per-item audience / answer_for_vendors.
 */
export function resolveFaqsForAudience(
  faqs: GuideFaqEntry[] | null | undefined,
  asking: AskingAudience,
  overrides?: SectionOverrides | null,
): { question: string; answer: string }[] {
  if (asking === "vendors" && hasVendorFaqList(overrides)) {
    return (overrides!.faqs!.vendors ?? [])
      .filter((f) => f && typeof f.question === "string")
      .map((f) => ({
        question: f.question,
        answer: typeof f.answer === "string" ? f.answer : "",
      }))
      .filter((f) => f.question.trim().length > 0);
  }

  if (!Array.isArray(faqs)) return [];
  return faqs
    .filter((f) => f && typeof f.question === "string" && isFaqVisibleTo(f, asking))
    .map((f) => ({
      question: f.question,
      answer: resolveFaqAnswer(f, asking),
    }))
    .filter((f) => f.question.trim().length > 0);
}

/** Raw guide payload (camelCase, as returned by RPCs / mapped rows). */
export type VenueGuideRaw = {
  parkingInfo?: string | null;
  transportation?: string | null;
  nearbyAccommodations?: string | null;
  hotelBlocks?: unknown[] | null;
  rainPlan?: string | null;
  policies?: string | null;
  ceremonyInstructions?: string | null;
  thingsToDo?: string | null;
  faqs?: GuideFaqEntry[] | null;
  importantContacts?: unknown[] | null;
  sectionAudiences?: unknown;
  sectionOverrides?: unknown;
};

/** Audience-projected guide — consumers never see the wrong side's copy. */
export type VenueGuideForAudience = {
  parkingInfo: string | null;
  transportation: string | null;
  nearbyAccommodations: string | null;
  hotelBlocks: unknown[];
  rainPlan: string | null;
  policies: string | null;
  ceremonyInstructions: string | null;
  thingsToDo: string | null;
  faqs: { question: string; answer: string }[];
  importantContacts: unknown[];
  /** True when vendor parking override is active (prefer load-in labels). */
  parkingUsesVendorOverride: boolean;
};

/**
 * Project a stored guide row for a asking audience: hide non-visible
 * sections and resolve dual-copy fields.
 */
export function projectGuideForAudience(
  raw: VenueGuideRaw | null | undefined,
  asking: AskingAudience,
): VenueGuideForAudience | null {
  if (!raw) return null;

  const audiences = normalizeSectionAudiences(raw.sectionAudiences);
  const overrides = normalizeSectionOverrides(raw.sectionOverrides);

  const show = (key: GuideSectionKey) => isSectionVisible(key, asking, audiences);

  const parkingMain = typeof raw.parkingInfo === "string" ? raw.parkingInfo : null;
  const parkingResolved = show("parking")
    ? resolveContent("parking", asking, parkingMain, overrides)
    : null;
  const parkingUsesVendorOverride =
    asking === "vendors" &&
    show("parking") &&
    typeof overrides.parking?.vendors === "string" &&
    overrides.parking.vendors.trim().length > 0;

  return {
    parkingInfo: parkingResolved,
    transportation: show("parking")
      ? (typeof raw.transportation === "string" ? raw.transportation : null)
      : null,
    nearbyAccommodations: show("accommodations")
      ? (typeof raw.nearbyAccommodations === "string" ? raw.nearbyAccommodations : null)
      : null,
    hotelBlocks: show("accommodations")
      ? (Array.isArray(raw.hotelBlocks) ? raw.hotelBlocks : [])
      : [],
    rainPlan: show("weather")
      ? (typeof raw.rainPlan === "string" ? raw.rainPlan : null)
      : null,
    policies: show("policies")
      ? resolveContent("policies", asking, raw.policies, overrides)
      : null,
    ceremonyInstructions: show("ceremony")
      ? resolveContent("ceremony", asking, raw.ceremonyInstructions, overrides)
      : null,
    thingsToDo: show("things")
      ? resolveContent("things", asking, raw.thingsToDo, overrides)
      : null,
    faqs: show("faqs")
      ? resolveFaqsForAudience(raw.faqs, asking, overrides)
      : [],
    importantContacts: show("contacts")
      ? (Array.isArray(raw.importantContacts) ? raw.importantContacts : [])
      : [],
    parkingUsesVendorOverride,
  };
}
