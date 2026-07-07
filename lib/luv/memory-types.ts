export type MemoryCategory = "milestone" | "business_pattern" | "seasonal" | "preference";

export type RawMemoryRow = {
  category: MemoryCategory;
  key: string;
  value: Record<string, unknown>;
  computed_at: string;
};

export type MonthlyAverage = { month: number; avg: number };

export type VenueMemories = {
  totalBookings:          number | null;
  firstBookingDate:       string | null;
  avgLeadToBookingDays:   number | null;
  busiestEventMonth:      { month: number; count: number } | null;
  monthlyInquiryAverages: MonthlyAverage[];
};
