import type { AccessTitle, BasisTitle, CapabilityOverrides } from "@/lib/authorization";

/** @deprecated Prefer accessTitle + isOwner. Kept for dual-write / legacy readers. */
export type StaffRole = "owner" | "manager" | "coordinator" | "staff";

export interface StaffMember {
  id: string;
  venueId: string;
  userId: string | null;
  /** Legacy dual-write role — not the customer-facing access model. */
  role: StaffRole;
  name: string;
  email: string | null;
  /** Free-text job title (e.g. General Manager) — not access_title. */
  jobTitle: string | null;
  isOwner: boolean;
  isActive: boolean;
  accessTitle: AccessTitle;
  titleBasis: BasisTitle | null;
  capabilityOverrides: CapabilityOverrides;
  ownerInvitePending: boolean;
  inviteToken: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface StaffInviteInput {
  name: string;
  email: string;
  accessTitle: AccessTitle;
  titleBasis?: BasisTitle | null;
  capabilityOverrides?: CapabilityOverrides;
  /** Ownership designation — Owners only may set true. */
  isOwner?: boolean;
  jobTitle?: string | null;
}

/** @deprecated Use StaffInviteInput */
export interface StaffInput {
  name: string;
  email: string;
  role: StaffRole;
}

export interface StaffAccessUpdate {
  accessTitle: AccessTitle;
  titleBasis?: BasisTitle | null;
  capabilityOverrides?: CapabilityOverrides;
  /** Explicit ownership change only; omit to leave unchanged. */
  isOwner?: boolean;
  jobTitle?: string | null;
}

export interface TeamActionResult {
  ok: boolean;
  error?: string;
  staffId?: string;
}
