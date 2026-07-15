/**
 * Canonical connected-booking journey — Product list + journey pages.
 * Homepage chapter anchors use the same ids.
 */

export const PRODUCT_JOURNEY = [
  {
    id: "inquiry",
    title: "Inquiry",
    emotion: "A first hello that feels personal.",
    body: "Every conversation begins a relationship. Whether it arrives from your website, email, phone call, or referral, Wevenu keeps everything together from the very first moment.",
  },
  {
    id: "tour",
    title: "Tour",
    emotion: "Time on property, remembered beautifully.",
    body: "Every visit becomes part of the same living booking. Notes, impressions, preferences, questions, and follow-ups stay connected from the moment your guests arrive.",
  },
  {
    id: "proposal",
    title: "Proposal",
    emotion: "A beautiful yes begins with a beautiful proposal.",
    body: "Your venue has already told its story. Wevenu simply helps you present it clearly—with packages, pricing, imagery, and details that feel personal instead of transactional.",
  },
  {
    id: "contract-inventory",
    title: "Booking Confirmed",
    emotion: "Every promise becomes something your team can deliver.",
    body: "Contracts, packages, and inventory stay connected from the moment a booking is confirmed. Nothing needs to be entered twice, and nothing gets forgotten between sales and operations.",
  },
  {
    id: "invoice-payment",
    title: "Payments",
    emotion: "Money stays connected to the celebration.",
    body: "Deposits, payment schedules, invoices, and balances all stay connected to the same booking—so everyone always knows where things stand without chasing spreadsheets or email threads.",
  },
  {
    id: "planning",
    title: "Planning",
    emotion: "Everyone planning together—not everyone planning separately.",
    body: "Couples, venues, and your team all contribute to the same planning experience—so every update, decision, and detail stays connected from the first conversation to event day.",
  },
  {
    id: "vendors",
    title: "Vendors",
    emotion: "Every partner, perfectly informed.",
    body: "Florists, photographers, caterers, DJs, planners, and every trusted partner stay connected to the same celebration—without another chain of forwarded emails.",
  },
  {
    id: "timeline",
    title: "Timeline",
    emotion: "The celebration is ready before the day begins.",
    body: "Every conversation, planning decision, vendor update, and schedule change naturally becomes part of the event timeline—so everyone arrives knowing exactly what's happening.",
  },
  {
    id: "floor-seating",
    title: "Floor Plans",
    emotion: "Every space prepared with confidence.",
    body: "Floor plans, seating layouts, inventory, and guest counts stay connected to the same booking—so the room you're preparing is always the room you're expecting.",
  },
  {
    id: "client-portal-website",
    title: "Client Experience",
    emotion: "Your hospitality doesn't stop after the tour.",
    body: "Every booking includes a beautiful planning experience that reflects your venue—bringing together details, planning, communication, and next steps in one calm place your couples will actually enjoy using.",
  },
  {
    id: "guest-portal",
    title: "Guest Portal",
    emotion: "Every guest arrives a little more prepared.",
    body: "Guests receive a beautifully organized event experience with everything they need—from invitations and RSVPs to directions, accommodations, schedules, and helpful updates—all in one welcoming place.",
  },
  {
    id: "celebration",
    title: "Celebration",
    emotion: "The celebration ends. The relationship doesn't.",
    body: "Photos, memories, reviews, referrals, and every detail of the event become part of a complete story—preserved long after the last guest goes home.",
  },
] as const;

export type ProductJourneyId = (typeof PRODUCT_JOURNEY)[number]["id"];

/** Old product journey slugs → current ids */
export const JOURNEY_LEGACY_REDIRECTS: Record<string, ProductJourneyId> = {
  contract: "contract-inventory",
  payment: "invoice-payment",
  website: "client-portal-website",
  portal: "guest-portal",
  "floor-plan": "floor-seating",
  "wedding-day": "timeline",
};
