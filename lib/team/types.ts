export type StaffRole = 'owner' | 'manager' | 'staff'

export interface StaffMember {
  id: string
  venueId: string
  userId: string | null
  role: StaffRole
  name: string
  email: string | null
  isOwner: boolean
  isActive: boolean
  inviteToken: string | null
  invitedAt: string | null
  acceptedAt: string | null
  lastActiveAt: string | null
  createdAt: string
}

export interface StaffInput {
  name: string
  email: string
  role: StaffRole
}

export interface TeamActionResult {
  ok: boolean
  error?: string
  staffId?: string
}
