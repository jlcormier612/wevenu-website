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
  // Contact & location (Sprint 91)
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  stateRegion: string | null;
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
  cancellationReason: string | null;
  createdAt: string;
};

export type BookingResult = {
  ok: boolean;
  error?: string;
  leadId?: string;
  relationshipId?: string | null;
  appointmentId?: string;
  scheduledAt?: string;
  venueName?: string;
  venueEmail?: string | null;
  venueId?: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  duration?: number;
};

// Coordinator Tour Scheduling — the Lead already exists, so there's no
// contact form; the RPC resolves everything from the Lead and returns the
// same shape a booking result needs to send a confirmation.
export type CoordinatorTourResult =
  | {
      ok: true;
      appointmentId: string;
      leadId: string;
      relationshipId: string | null;
      scheduledAt: string;
      venueName: string;
      venueId: string;
      duration: number;
      contactName: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      oldScheduledAt?: string; // present on reschedule
    }
  | { ok: false; error: string };

export type SimpleTourResult = { ok: true } | { ok: false; error: string };
