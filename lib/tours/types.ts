export type TourSlot = {
  start: string;     // ISO timestamp
  end: string;
  date: string;      // "YYYY-MM-DD"
  time: string;      // "10:00 AM"
};

export type TourVenueInfo = {
  name: string;
  headline: string;
  description: string | null;
  duration: number;  // minutes
};

export type TourSettings = {
  tourSchedulingEnabled: boolean;
  tourEmbedKey: string;
  tourDurationMinutes: number;
  tourMinNoticeHours: number;
  tourMaxAdvanceDays: number;
  tourBufferMinutes: number;
  tourPageHeadline: string | null;
  tourPageDescription: string | null;
};

export type TourOutcome = "interested" | "considering" | "not_a_fit" | "booked" | "unknown";

export type TourAppointment = {
  id: string;
  venueId: string;
  leadId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  eventType: string | null;
  eventDate: string | null;
  guestCount: number | null;
  notes: string | null;
  // Lifecycle fields (Sprint 47)
  assignedTo: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  followUpSentAt: string | null;
  outcome: TourOutcome | null;
  createdAt: string;
};

export type BookingResult = {
  ok: boolean;
  error?: string;
  leadId?: string;
  appointmentId?: string;
  scheduledAt?: string;
  venueName?: string;
  duration?: number;
};
