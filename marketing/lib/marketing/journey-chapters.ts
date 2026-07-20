import type { ProductJourneyId } from "@/lib/marketing/journey";
import { FILM } from "@/lib/marketing/film";

/** Lifestyle still for each Product journey chapter (paired with UX mock). */
export const JOURNEY_CHAPTER_FILM: Record<
  ProductJourneyId,
  { src: string; alt: string }
> = {
  inquiry: {
    src: FILM.inquiryWelcome,
    alt: "Let's start something beautiful — the first hello that begins a relationship",
  },
  tour: {
    src: FILM.tourGrounds,
    alt: "Open doors onto a sunlit courtyard — time on property, remembered",
  },
  proposal: {
    src: FILM.proposalReview,
    alt: "A Willow & Hearth proposal booklet for Elena & James — personal, clear, beautiful",
  },
  "contract-inventory": {
    src: FILM.bookingPrep,
    alt: "Booking — thank you, we're honored to be part of your celebration",
  },
  "invoice-payment": {
    src: FILM.paymentsConsult,
    alt: "Payment overview for Elena & James — deposits, schedules, and balances kept clear",
  },
  planning: {
    src: FILM.planningPrep,
    alt: "Hands writing a wedding plan with sage swatches and florals — collaboration as hospitality",
  },
  vendors: {
    src: FILM.vendorsFlorist,
    alt: "Vendor plan for Elena & James — partners confirmed, roles clear, everyone connected",
  },
  timeline: {
    src: FILM.timelineMorning,
    alt: "Event timeline for Elena & James — every moment, perfectly planned",
  },
  "floor-seating": {
    src: FILM.floorReady,
    alt: "Floor plan for Elena & James — every table, seat, and space prepared with confidence",
  },
  "client-portal-website": {
    src: FILM.clientHome,
    alt: "Guests celebrating together at a warm evening table — hospitality that continues",
  },
  "guest-portal": {
    src: FILM.guestArrive,
    alt: "Guest portal welcome on a phone — every guest arrives a little more prepared",
  },
  celebration: {
    src: FILM.celebrationJoy,
    alt: "Guests dancing under warm lights — the celebration ends, the relationship doesn't",
  },
};
