/**
 * Explicit HTC internal staff ACL (R1A).
 * Supabase Auth identity ≠ Workspace access until a row exists and is active.
 */

import { createHash, randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  getWorkspaceAuthProvider,
  workspaceSupabaseServiceRoleKey,
  workspaceSupabaseUrl,
} from "@/lib/supabase/workspace-auth-config";
import type { TeamRole } from "./types";

export type InternalStaffRecord = {
  userId: string;
  teamMemberId: string;
  email: string;
  displayName: string;
  role: TeamRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
  createdBy: string | null;
};

export type InternalStaffInvite = {
  id: string;
  tokenHash: string;
  email: string;
  displayName: string;
  role: TeamRole;
  teamMemberId: string | null;
  invitedBy: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  acceptedUserId: string | null;
};

export type StaffAclRepository = {
  getByUserId(userId: string): Promise<InternalStaffRecord | null>;
  getByEmail(email: string): Promise<InternalStaffRecord | null>;
  getByTeamMemberId(teamMemberId: string): Promise<InternalStaffRecord | null>;
  listActive(): Promise<InternalStaffRecord[]>;
  upsertStaff(row: InternalStaffRecord): Promise<InternalStaffRecord>;
  deactivate(userId: string, actorUserId: string | null): Promise<void>;
  countActiveOwners(): Promise<number>;
  createInvite(invite: InternalStaffInvite): Promise<InternalStaffInvite>;
  getInviteByTokenHash(tokenHash: string): Promise<InternalStaffInvite | null>;
  updateInvite(invite: InternalStaffInvite): Promise<InternalStaffInvite>;
  appendAudit(entry: {
    actorUserId: string | null;
    action: string;
    targetUserId?: string | null;
    targetEmail?: string | null;
    detail?: Record<string, unknown>;
  }): Promise<void>;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function newTeamMemberId(): string {
  return `tm_${randomBytes(8).toString("hex")}`;
}

/* -------------------------------------------------------------------------- */
/* Memory repository (tests / local without DB)                               */
/* -------------------------------------------------------------------------- */

export class MemoryStaffAclRepository implements StaffAclRepository {
  staff = new Map<string, InternalStaffRecord>();
  invites = new Map<string, InternalStaffInvite>();
  audit: Array<Record<string, unknown>> = [];

  reset() {
    this.staff.clear();
    this.invites.clear();
    this.audit = [];
  }

  async getByUserId(userId: string) {
    return this.staff.get(userId) ?? null;
  }

  async getByEmail(email: string) {
    const needle = normalizeEmail(email);
    for (const row of this.staff.values()) {
      if (row.email === needle) return row;
    }
    return null;
  }

  async getByTeamMemberId(teamMemberId: string) {
    for (const row of this.staff.values()) {
      if (row.teamMemberId === teamMemberId) return row;
    }
    return null;
  }

  async listActive() {
    return [...this.staff.values()].filter((r) => r.active);
  }

  async upsertStaff(row: InternalStaffRecord) {
    const next = {
      ...row,
      email: normalizeEmail(row.email),
      updatedAt: row.updatedAt || new Date().toISOString(),
    };
    this.staff.set(next.userId, next);
    return next;
  }

  async deactivate(userId: string, actorUserId: string | null) {
    const row = this.staff.get(userId);
    if (!row) return;
    const now = new Date().toISOString();
    this.staff.set(userId, {
      ...row,
      active: false,
      deactivatedAt: now,
      updatedAt: now,
    });
    await this.appendAudit({
      actorUserId,
      action: "deactivate",
      targetUserId: userId,
      targetEmail: row.email,
    });
  }

  async countActiveOwners() {
    return [...this.staff.values()].filter(
      (r) => r.active && r.role === "owner",
    ).length;
  }

  async createInvite(invite: InternalStaffInvite) {
    this.invites.set(invite.id, {
      ...invite,
      email: normalizeEmail(invite.email),
    });
    return invite;
  }

  async getInviteByTokenHash(tokenHash: string) {
    for (const inv of this.invites.values()) {
      if (inv.tokenHash === tokenHash) return inv;
    }
    return null;
  }

  async updateInvite(invite: InternalStaffInvite) {
    this.invites.set(invite.id, invite);
    return invite;
  }

  async appendAudit(entry: {
    actorUserId: string | null;
    action: string;
    targetUserId?: string | null;
    targetEmail?: string | null;
    detail?: Record<string, unknown>;
  }) {
    this.audit.push({
      occurredAt: new Date().toISOString(),
      ...entry,
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Postgres repository (service_role)                                         */
/* -------------------------------------------------------------------------- */

function mapStaffRow(row: Record<string, unknown>): InternalStaffRecord {
  return {
    userId: String(row.user_id),
    teamMemberId: String(row.team_member_id),
    email: String(row.email),
    displayName: String(row.display_name),
    role: row.role as TeamRole,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deactivatedAt: row.deactivated_at ? String(row.deactivated_at) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
  };
}

function mapInviteRow(row: Record<string, unknown>): InternalStaffInvite {
  return {
    id: String(row.id),
    tokenHash: String(row.token_hash),
    email: String(row.email),
    displayName: String(row.display_name),
    role: row.role as TeamRole,
    teamMemberId: row.team_member_id ? String(row.team_member_id) : null,
    invitedBy: row.invited_by ? String(row.invited_by) : null,
    status: row.status as InternalStaffInvite["status"],
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at),
    acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
    acceptedUserId: row.accepted_user_id ? String(row.accepted_user_id) : null,
  };
}

export class PostgresStaffAclRepository implements StaffAclRepository {
  constructor(private readonly admin: SupabaseClient) {}

  async getByUserId(userId: string) {
    const { data, error } = await this.admin
      .from("htc_internal_staff")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapStaffRow(data as Record<string, unknown>) : null;
  }

  async getByEmail(email: string) {
    const { data, error } = await this.admin
      .from("htc_internal_staff")
      .select("*")
      .eq("email", normalizeEmail(email))
      .maybeSingle();
    if (error) throw error;
    return data ? mapStaffRow(data as Record<string, unknown>) : null;
  }

  async getByTeamMemberId(teamMemberId: string) {
    const { data, error } = await this.admin
      .from("htc_internal_staff")
      .select("*")
      .eq("team_member_id", teamMemberId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapStaffRow(data as Record<string, unknown>) : null;
  }

  async listActive() {
    const { data, error } = await this.admin
      .from("htc_internal_staff")
      .select("*")
      .eq("active", true);
    if (error) throw error;
    return (data ?? []).map((r) => mapStaffRow(r as Record<string, unknown>));
  }

  async upsertStaff(row: InternalStaffRecord) {
    const payload = {
      user_id: row.userId,
      team_member_id: row.teamMemberId,
      email: normalizeEmail(row.email),
      display_name: row.displayName,
      role: row.role,
      active: row.active,
      created_at: row.createdAt,
      updated_at: new Date().toISOString(),
      deactivated_at: row.deactivatedAt,
      created_by: row.createdBy,
    };
    const { data, error } = await this.admin
      .from("htc_internal_staff")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw error;
    return mapStaffRow(data as Record<string, unknown>);
  }

  async deactivate(userId: string, actorUserId: string | null) {
    const now = new Date().toISOString();
    const { error } = await this.admin
      .from("htc_internal_staff")
      .update({
        active: false,
        deactivated_at: now,
        updated_at: now,
      })
      .eq("user_id", userId);
    if (error) throw error;
    await this.appendAudit({
      actorUserId,
      action: "deactivate",
      targetUserId: userId,
    });
  }

  async countActiveOwners() {
    const { count, error } = await this.admin
      .from("htc_internal_staff")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .eq("role", "owner");
    if (error) throw error;
    return count ?? 0;
  }

  async createInvite(invite: InternalStaffInvite) {
    const payload = {
      id: invite.id,
      token_hash: invite.tokenHash,
      email: normalizeEmail(invite.email),
      display_name: invite.displayName,
      role: invite.role,
      team_member_id: invite.teamMemberId,
      invited_by: invite.invitedBy,
      status: invite.status,
      expires_at: invite.expiresAt,
      created_at: invite.createdAt,
      accepted_at: invite.acceptedAt,
      accepted_user_id: invite.acceptedUserId,
    };
    const { data, error } = await this.admin
      .from("htc_internal_staff_invites")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return mapInviteRow(data as Record<string, unknown>);
  }

  async getInviteByTokenHash(tokenHash: string) {
    const { data, error } = await this.admin
      .from("htc_internal_staff_invites")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw error;
    return data ? mapInviteRow(data as Record<string, unknown>) : null;
  }

  async updateInvite(invite: InternalStaffInvite) {
    const { data, error } = await this.admin
      .from("htc_internal_staff_invites")
      .update({
        status: invite.status,
        accepted_at: invite.acceptedAt,
        accepted_user_id: invite.acceptedUserId,
        team_member_id: invite.teamMemberId,
      })
      .eq("id", invite.id)
      .select("*")
      .single();
    if (error) throw error;
    return mapInviteRow(data as Record<string, unknown>);
  }

  async appendAudit(entry: {
    actorUserId: string | null;
    action: string;
    targetUserId?: string | null;
    targetEmail?: string | null;
    detail?: Record<string, unknown>;
  }) {
    const { error } = await this.admin.from("htc_internal_staff_audit").insert({
      actor_user_id: entry.actorUserId,
      action: entry.action,
      target_user_id: entry.targetUserId ?? null,
      target_email: entry.targetEmail ? normalizeEmail(entry.targetEmail) : null,
      detail: entry.detail ?? {},
    });
    if (error) throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Repository resolver                                                        */
/* -------------------------------------------------------------------------- */

const globalForAcl = globalThis as unknown as {
  __htcStaffAclRepo?: StaffAclRepository;
  __htcMemoryStaffAcl?: MemoryStaffAclRepository;
};

export function getMemoryStaffAclRepository(): MemoryStaffAclRepository {
  if (!globalForAcl.__htcMemoryStaffAcl) {
    globalForAcl.__htcMemoryStaffAcl = new MemoryStaffAclRepository();
  }
  return globalForAcl.__htcMemoryStaffAcl;
}

export function setStaffAclRepositoryForTests(repo: StaffAclRepository | null) {
  globalForAcl.__htcStaffAclRepo = repo ?? undefined;
}

export function createPostgresStaffAclRepository(): PostgresStaffAclRepository {
  const url = workspaceSupabaseUrl();
  const key = workspaceSupabaseServiceRoleKey();
  if (!url || !key) {
    throw new Error(
      "Postgres staff ACL requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return new PostgresStaffAclRepository(admin);
}

export function getStaffAclRepository(): StaffAclRepository {
  if (globalForAcl.__htcStaffAclRepo) return globalForAcl.__htcStaffAclRepo;
  const provider = getWorkspaceAuthProvider();
  if (provider === "memory") return getMemoryStaffAclRepository();
  if (provider === "supabase") return createPostgresStaffAclRepository();
  // legacy_jsonl does not use ACL repo for session resolution
  return getMemoryStaffAclRepository();
}

/** Active ACL membership required for Workspace CRM access. */
export async function requireActiveInternalStaff(
  userId: string,
): Promise<InternalStaffRecord | null> {
  const row = await getStaffAclRepository().getByUserId(userId);
  if (!row || !row.active) return null;
  return row;
}
