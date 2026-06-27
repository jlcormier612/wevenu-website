/**
 * Calendar domain types (Sprint 17 — Unified Calendar).
 * No new DB tables — aggregates data from existing tables.
 */

export type CalendarItemType =
  | "event"          // booked event (events table)
  | "tour"           // venue tour (leads.tour_date)
  | "follow_up"      // lead follow-up (leads.follow_up_date)
  | "payment_due"    // payment line item (payment_line_items.due_date)
  | "key_date"       // client milestone (client_key_dates.date)
  | "date_hold"      // soft reservation (date_holds table)
  | "calendar_block"; // administrative closure (calendar_blocks table)

export type CalendarItem = {
  id: string;
  type: CalendarItemType;
  date: string;        // ISO "YYYY-MM-DD"
  title: string;
  subtitle: string | null;
  time: string | null; // "HH:MM" if known
  link: string;        // route to navigate to on click
};

export type CalendarData = {
  year: number;
  month: number; // 1-12
  items: CalendarItem[];
};
