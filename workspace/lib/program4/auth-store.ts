import { randomBytes } from "crypto";

import {
  filePath,
  readJsonlSync,
  withWorkspaceLock,
  writeJsonlAtomic,
} from "@/lib/program3/jsonl";

import { DEMO_LOGIN } from "./demo-login";
import { hashPassword } from "./password";
import { PROGRAM4_FILES } from "./paths";
import type {
  TeamCredential,
  TeamInvite,
  TeamDepartment,
  TeamRole,
  WorkspaceSession,
} from "./types";

export { DEMO_LOGIN };

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function invitesPath() {
  return filePath(PROGRAM4_FILES.teamInvites);
}
function credentialsPath() {
  return filePath(PROGRAM4_FILES.teamCredentials);
}
function sessionsPath() {
  return filePath(PROGRAM4_FILES.sessions);
}

/** Ensure Jennifer has a demo credential so she can log in immediately. */
export async function ensureAuthSeed(): Promise<void> {
  return withWorkspaceLock(async () => {
    const rows = readJsonlSync<TeamCredential>(credentialsPath());
    if (rows.some((c) => c.memberId === DEMO_LOGIN.memberId)) return;

    const now = new Date().toISOString();
    const seed: TeamCredential = {
      memberId: DEMO_LOGIN.memberId,
      email: DEMO_LOGIN.email.toLowerCase(),
      passwordHash: hashPassword(DEMO_LOGIN.password),
      acceptedAt: now,
      updatedAt: now,
    };
    await writeJsonlAtomic(credentialsPath(), [...rows, seed]);
  });
}

export function getCredentialsSync(): TeamCredential[] {
  return readJsonlSync<TeamCredential>(credentialsPath());
}

export function getCredentialByEmailSync(email: string): TeamCredential | undefined {
  const needle = email.trim().toLowerCase();
  return getCredentialsSync().find((c) => c.email === needle);
}

export function getCredentialByMemberIdSync(memberId: string): TeamCredential | undefined {
  return getCredentialsSync().find((c) => c.memberId === memberId);
}

export async function upsertCredential(cred: TeamCredential): Promise<TeamCredential> {
  return withWorkspaceLock(async () => {
    const rows = readJsonlSync<TeamCredential>(credentialsPath());
    const idx = rows.findIndex((c) => c.memberId === cred.memberId);
    const next = [...rows];
    if (idx >= 0) next[idx] = cred;
    else next.push(cred);
    // Keep one credential per email
    const deduped = next.filter(
      (c, i, arr) =>
        c.memberId === cred.memberId ||
        c.email !== cred.email ||
        arr.findIndex((x) => x.email === c.email) === i,
    );
    await writeJsonlAtomic(credentialsPath(), deduped);
    return cred;
  });
}

export function getInvitesSync(): TeamInvite[] {
  return readJsonlSync<TeamInvite>(invitesPath());
}

export function getPendingInvitesSync(): TeamInvite[] {
  return getInvitesSync()
    .filter((i) => i.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getInviteByTokenSync(token: string): TeamInvite | undefined {
  const t = token.trim();
  if (!t) return undefined;
  return getInvitesSync().find((i) => i.token === t);
}

export async function upsertInvite(invite: TeamInvite): Promise<TeamInvite> {
  return withWorkspaceLock(async () => {
    const rows = readJsonlSync<TeamInvite>(invitesPath());
    const idx = rows.findIndex((i) => i.id === invite.id);
    const next = [...rows];
    if (idx >= 0) next[idx] = invite;
    else next.push(invite);
    await writeJsonlAtomic(invitesPath(), next);
    return invite;
  });
}

export function getSessionsSync(): WorkspaceSession[] {
  return readJsonlSync<WorkspaceSession>(sessionsPath());
}

export function getSessionSync(sessionId: string): WorkspaceSession | undefined {
  const id = sessionId.trim();
  if (!id) return undefined;
  const session = getSessionsSync().find((s) => s.id === id);
  if (!session) return undefined;
  if (new Date(session.expiresAt).getTime() < Date.now()) return undefined;
  return session;
}

export async function createSession(memberId: string): Promise<WorkspaceSession> {
  return withWorkspaceLock(async () => {
    const now = Date.now();
    const session: WorkspaceSession = {
      id: `sess_${randomBytes(24).toString("hex")}`,
      memberId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    };
    const rows = readJsonlSync<WorkspaceSession>(sessionsPath()).filter(
      (s) => new Date(s.expiresAt).getTime() >= now,
    );
    await writeJsonlAtomic(sessionsPath(), [...rows, session]);
    return session;
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  return withWorkspaceLock(async () => {
    const rows = readJsonlSync<WorkspaceSession>(sessionsPath()).filter(
      (s) => s.id !== sessionId,
    );
    await writeJsonlAtomic(sessionsPath(), rows);
  });
}

export function roleToDepartment(role: TeamRole): TeamDepartment {
  switch (role) {
    case "owner":
    case "administrator":
      return "leadership";
    case "sales":
      return "sales";
    case "customer_success":
      return "customer_success";
    case "implementation":
      return "implementation";
    case "support":
      return "support";
    case "finance":
      return "finance";
    case "marketing":
      return "marketing";
    case "viewer":
    default:
      return "support";
  }
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function roleDefaultTitle(role: TeamRole): string {
  const map: Record<TeamRole, string> = {
    owner: "Owner",
    administrator: "Administrator",
    sales: "Sales",
    customer_success: "Customer Success",
    implementation: "Implementation",
    support: "Support",
    finance: "Finance",
    marketing: "Marketing",
    viewer: "Viewer",
  };
  return map[role];
}

export function newInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export function workspaceBaseUrl(): string {
  return (
    process.env.WORKSPACE_URL?.trim() ||
    process.env.NEXT_PUBLIC_WORKSPACE_URL?.trim() ||
    "http://localhost:3002"
  );
}

export function inviteAcceptUrl(token: string): string {
  return `${workspaceBaseUrl()}/invite/${encodeURIComponent(token)}`;
}
