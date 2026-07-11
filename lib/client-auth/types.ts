export type ClientInvitationStatus = "pending" | "accepted" | "revoked";

export type ClientInvitation = {
  id: string;
  venueId: string;
  clientId: string;
  email: string;
  token: string;
  status: ClientInvitationStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

export type ClientAuthResult =
  | { ok: true }
  | { ok: false; error: string };

export type AcceptClientInvitationResult =
  | { ok: true; clientId: string; accessToken: string }
  | { ok: false; error: string };

export type AuthSessionInfo = {
  id: string;
  createdAt: string;
  updatedAt: string;
  notAfter: string | null;
  userAgent: string | null;
  ip: string | null;
  isCurrent: boolean;
};

export type SupportAccessGrant = {
  id: string;
  venueId: string;
  clientId: string;
  label: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};
