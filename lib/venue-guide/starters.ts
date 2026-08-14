/**
 * Hello to Cheers — Starter Venue Guide FAQs (FAQ-01 … FAQ-12).
 *
 * Protected masters — code fixtures, never editable DB rows.
 * Venue copies live in venue_operational_info.faqs (jsonb) with
 * source_master_key + published:false until the venue publishes.
 *
 * CONTENT IS PRODUCT-APPROVED. Do not rewrite.
 */

export type FaqStarterMasterKey =
  | "FAQ-01"
  | "FAQ-02"
  | "FAQ-03"
  | "FAQ-04"
  | "FAQ-05"
  | "FAQ-06"
  | "FAQ-07"
  | "FAQ-08"
  | "FAQ-09"
  | "FAQ-10"
  | "FAQ-11"
  | "FAQ-12";

export type FaqStarterMaster = {
  key: FaqStarterMasterKey;
  sortOrder: number;
  question: string;
  answer: string;
};

/**
 * Exact approved Hello to Cheers starter FAQ copy (FAQ-01…12), in order.
 * Explanatory Venue Guide content only — not packages, guest count, payments,
 * vendors, floor plans, or dates as operational source of truth.
 */
export const FAQ_STARTER_MASTERS: readonly FaqStarterMaster[] = [
  {
    key: "FAQ-01",
    sortOrder: 0,
    question: "What is included with our venue rental?",
    answer:
      "Your venue rental includes the spaces, furnishings, and services listed in your selected package. Review your package details for everything included with your event, and ask our team if you're unsure whether something is included.",
  },
  {
    key: "FAQ-02",
    sortOrder: 1,
    question: "Can we tour the venue before booking?",
    answer:
      "Absolutely! We recommend touring the venue so you can see the spaces, ask questions, and get a feel for how your celebration could come together. Contact our team to schedule a tour.",
  },
  {
    key: "FAQ-03",
    sortOrder: 2,
    question: "How far in advance should we book our wedding?",
    answer:
      "Popular wedding dates can book well in advance, especially during peak wedding seasons. If you have a specific date in mind, we recommend reaching out as early as possible. Our team can let you know which dates are currently available.",
  },
  {
    key: "FAQ-04",
    sortOrder: 3,
    question: "Can we have both our ceremony and reception at the venue?",
    answer:
      "Many couples choose to host both their ceremony and reception with us. Depending on your venue and package, different spaces or layouts may be available for each part of the celebration. Ask our team about the options for your event.",
  },
  {
    key: "FAQ-05",
    sortOrder: 4,
    question: "What happens if we want to change our guest count?",
    answer:
      "We understand that guest counts can change as your plans come together. Your final guest count helps us prepare your event, seating, and other details. Let us know when your guest list changes so we can confirm any updates that may affect your event.",
  },
  {
    key: "FAQ-06",
    sortOrder: 5,
    question: "Can we choose our own vendors?",
    answer:
      "Vendor policies vary by venue and by service. Some venues offer a preferred vendor list, while others allow couples to bring in their own vendors. We'll let you know which options apply to your event and package.",
  },
  {
    key: "FAQ-07",
    sortOrder: 6,
    question: "When should we finalize our event details?",
    answer:
      "We'll work with you throughout the planning process to gather the details we need for your celebration. As your event approaches, we'll confirm important information such as guest count, layout, timeline, vendors, and other event-day details.",
  },
  {
    key: "FAQ-08",
    sortOrder: 7,
    question: "Can we customize the layout for our event?",
    answer:
      "Absolutely. Your floor plan can be customized to fit the way you'd like your celebration to flow. Depending on your venue's layout and the options available, you can work with our team to arrange seating and other event details.",
  },
  {
    key: "FAQ-09",
    sortOrder: 8,
    question: "When will we receive our final event details?",
    answer:
      "We'll gather your final event information as your celebration approaches and confirm the details with you before the big day. Your event team will let you know when it's time to review and finalize your plans.",
  },
  {
    key: "FAQ-10",
    sortOrder: 9,
    question: "What time can we arrive to set up?",
    answer:
      "Your available setup and access times depend on your event, package, and venue schedule. We'll confirm your access window with you as part of the event planning process.",
  },
  {
    key: "FAQ-11",
    sortOrder: 10,
    question: "What should we bring with us on the wedding day?",
    answer:
      "This depends on your package and the plans you've made for your event. Your team will help you understand what the venue provides and what you'll need to bring, including any personal décor, specialty items, or other details you've chosen for your celebration.",
  },
  {
    key: "FAQ-12",
    sortOrder: 11,
    question: "What happens after our wedding?",
    answer:
      "Once your celebration is over, we'll help wrap up any remaining venue details and make sure you know about anything that still needs your attention. We'd also love to hear about your experience and see your favorite memories from the day.",
  },
] as const;

export function getFaqStarterMaster(key: string): FaqStarterMaster | undefined {
  return FAQ_STARTER_MASTERS.find((m) => m.key === key);
}

/**
 * Pure skip rules used by provision (unit-tested). Never overwrite an existing
 * key or same-question customized FAQ for the venue.
 */
export function shouldSkipFaqStarterProvision(opts: {
  masterKey: string;
  masterQuestion: string;
  existingByKey: Set<string>;
  existingQuestions: Set<string>;
}): "skip_key" | "skip_question" | "create" {
  if (opts.existingByKey.has(opts.masterKey)) return "skip_key";
  if (opts.existingQuestions.has(opts.masterQuestion)) return "skip_question";
  return "create";
}

/** Starters default unpublished so public/brochure/portal surfaces stay safelisted. */
export function faqEntryFromMaster(master: FaqStarterMaster): {
  question: string;
  answer: string;
  source_master_key: FaqStarterMasterKey;
  published: false;
  audience: "both";
} {
  return {
    question: master.question,
    answer: master.answer,
    source_master_key: master.key,
    published: false,
    audience: "both",
  };
}
