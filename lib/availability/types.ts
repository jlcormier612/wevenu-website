/**
 * Availability & Inventory types (Sprint 20).
 */

export type VenueSpace = {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  capacity: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type VenueCapacityRules = {
  id: string;
  venueId: string;
  maxSimultaneousEvents: number;
  maxSimultaneousTours: number;
  minTurnaroundHours: number;
  createdAt: string;
  updatedAt: string;
};

export type HoldStatus = "active" | "converted" | "released" | "expired";

export type DateHold = {
  id: string;
  venueId: string;
  leadId: string | null;
  spaceId: string | null;
  title: string;
  holdDate: string;
  startTime: string | null;
  endTime: string | null;
  status: HoldStatus;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Embedded
  leadName: string | null;
  spaceName: string | null;
};

export type BlockReason =
  | "maintenance"
  | "private_event"
  | "holiday"
  | "staff_training"
  | "other";

export type CalendarBlock = {
  id: string;
  venueId: string;
  title: string;
  reason: BlockReason;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  createdAt: string;
};

// ---- Conflict detection types -----------------------------------------------

export type ConflictType =
  | "event_capacity_full"  // max simultaneous events reached
  | "tour_capacity_full"   // max simultaneous tours reached
  | "calendar_blocked"     // administrative block on this date
  | "space_booked"         // the specific space is already taken
  | "hold_exists";         // an active date hold exists

export type ConflictItem = {
  type: ConflictType;
  message: string;
  severity: "warning" | "error"; // warning = can override; error = hard block
};

export type AvailabilityStatus = {
  available: boolean;
  conflicts: ConflictItem[];
};

// ---- Input types ------------------------------------------------------------

export type SpaceInput = {
  name: string;
  description: string;
  capacity: string;
  isActive: boolean;
};

export type CapacityRulesInput = {
  maxSimultaneousEvents: number;
  maxSimultaneousTours: number;
  minTurnaroundHours: number;
};

export type DateHoldInput = {
  leadId: string;
  spaceId: string;
  title: string;
  holdDate: string;
  startTime: string;
  endTime: string;
  expiresAt: string;
  notes: string;
};

export type CalendarBlockInput = {
  title: string;
  reason: BlockReason;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  startTime: string;
  endTime: string;
  notes: string;
};

export type AvailabilityActionResult =
  | { ok: true }
  | { ok: false; message?: string };

export type CreateSpaceResult =
  | { ok: true; spaceId: string }
  | { ok: false; message?: string };

export type CreateHoldResult =
  | { ok: true; holdId: string }
  | { ok: false; message?: string };
