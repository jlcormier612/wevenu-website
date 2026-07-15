import type { ProductJourneyId } from "@/lib/marketing/journey";
import { FILM } from "@/lib/marketing/film";

/** Hero / lifestyle still for each Product journey chapter */
export const JOURNEY_CHAPTER_FILM: Record<
  ProductJourneyId,
  { src: string; alt: string }
> = {
  inquiry: {
    src: FILM.inquiryWelcome,
    alt: "A warm first hello on property — the beginning of a relationship",
  },
  tour: {
    src: FILM.tourGrounds,
    alt: "Walking the venue grounds — time on property, remembered",
  },
  proposal: {
    src: FILM.proposalReview,
    alt: "Reviewing a personal proposal together — confidence and continuity",
  },
  "contract-inventory": {
    src: FILM.bookingPrep,
    alt: "Quiet preparation after a booking is confirmed",
  },
  "invoice-payment": {
    src: FILM.paymentsConsult,
    alt: "A calm financial conversation connected to the celebration",
  },
  planning: {
    src: FILM.planningCraft,
    alt: "Planning together with care — not separately in spreadsheets",
  },
  vendors: {
    src: FILM.vendorsFlorist,
    alt: "A trusted partner preparing for the celebration",
  },
  timeline: {
    src: FILM.timelineMorning,
    alt: "The day prepared calmly before guests arrive",
  },
  "floor-seating": {
    src: FILM.floorReady,
    alt: "A room prepared with confidence — every placement intentional",
  },
  "client-portal-website": {
    src: FILM.clientHome,
    alt: "Hospitality that continues between conversations",
  },
  "guest-portal": {
    src: FILM.guestArrive,
    alt: "Outdoor seating quietly prepared — guests arrive informed and ready to celebrate",
  },
  celebration: {
    src: FILM.celebrationJoy,
    alt: "Joy on the day — the relationship continues afterward",
  },
};
