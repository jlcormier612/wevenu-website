import { existsSync } from "fs";
import { randomUUID } from "crypto";

import {
  filePath,
  readJsonFileSync,
  readJsonlSync,
  withWorkspaceLock,
  writeJsonAtomic,
  writeJsonlAtomic,
} from "@/lib/program3/jsonl";

import { PROGRAM4_FILES } from "./paths";
import {
  BOOTSTRAP_OWNER_PROFILE,
  DEFAULT_ACTOR_ID,
  LEGACY_FICTIONAL_TEAM_MEMBER_IDS,
  PROGRAM4_BOOTSTRAP_VERSION,
  SEED_COMMISSION_LEDGER,
  SEED_COMMISSION_PLANS,
  SEED_TEAM,
} from "./seed";
import type {
  CommissionLedgerEntry,
  CommissionPlan,
  TeamMemberProfile,
} from "./types";

function teamPath() {
  return filePath(PROGRAM4_FILES.teamMembers);
}
function plansPath() {
  return filePath(PROGRAM4_FILES.commissionPlans);
}
function ledgerPath() {
  return filePath(PROGRAM4_FILES.commissionLedger);
}
function seedMarkerPath() {
  return filePath(PROGRAM4_FILES.seedMarker);
}

type Program4SeedMarker = {
  seededAt: string;
  bootstrapVersion?: number;
  note?: string;
};

const LEGACY_FICTIONAL_ID_SET = new Set<string>(LEGACY_FICTIONAL_TEAM_MEMBER_IDS);

function readSeedMarker(): Program4SeedMarker | null {
  if (!existsSync(seedMarkerPath())) return null;
  return readJsonFileSync<Program4SeedMarker | null>(seedMarkerPath(), null);
}

function markerNeedsBootstrap(marker: Program4SeedMarker | null): boolean {
  if (!marker) return true;
  const version = marker.bootstrapVersion ?? 1;
  return version < PROGRAM4_BOOTSTRAP_VERSION;
}

/**
 * Owner-only roster for operational CRM.
 * Drops legacy fictional demo profiles; always keeps the bootstrap Owner row.
 */
export function operationalTeamBootstrap(
  existing: TeamMemberProfile[],
): TeamMemberProfile[] {
  const kept = existing.filter(
    (m) => !LEGACY_FICTIONAL_ID_SET.has(m.id) && m.id !== BOOTSTRAP_OWNER_PROFILE.id,
  );
  const priorOwner = existing.find((m) => m.id === BOOTSTRAP_OWNER_PROFILE.id);
  const owner: TeamMemberProfile = priorOwner
    ? {
        ...BOOTSTRAP_OWNER_PROFILE,
        // Preserve invite/joined timestamps if already present; never invent staff.
        joinedAt: priorOwner.joinedAt || BOOTSTRAP_OWNER_PROFILE.joinedAt,
        name: priorOwner.name?.trim() || BOOTSTRAP_OWNER_PROFILE.name,
        email: priorOwner.email?.trim() || BOOTSTRAP_OWNER_PROFILE.email,
        initials: priorOwner.initials?.trim() || BOOTSTRAP_OWNER_PROFILE.initials,
        active: true,
        role: "owner",
      }
    : structuredClone(BOOTSTRAP_OWNER_PROFILE);
  return [owner, ...kept.filter((m) => m.active !== false || m.role === "owner")];
}

/**
 * Remove legacy sample ledger rows (seed_* source ids / fictional assignees).
 * Keeps any future genuine entries.
 */
export function operationalLedgerBootstrap(
  existing: CommissionLedgerEntry[],
): CommissionLedgerEntry[] {
  return existing.filter((e) => {
    if (LEGACY_FICTIONAL_ID_SET.has(e.teamMemberId)) return false;
    if (e.sourceEventId?.startsWith("seed_")) return false;
    if (/^cl_[1-6]$/.test(e.id)) return false;
    return true;
  });
}

let seedPromise: Promise<void> | null = null;

export async function ensureProgram4Data(): Promise<void> {
  const marker = readSeedMarker();
  if (markerNeedsBootstrap(marker)) {
    if (!seedPromise) {
      seedPromise = withWorkspaceLock(async () => {
        const again = readSeedMarker();
        if (!markerNeedsBootstrap(again)) return;

        const existingTeam = readJsonlSync<TeamMemberProfile>(teamPath());
        const existingPlans = readJsonlSync<CommissionPlan>(plansPath());
        const existingLedger = readJsonlSync<CommissionLedgerEntry>(ledgerPath());

        const team = operationalTeamBootstrap(
          existingTeam.length ? existingTeam : structuredClone(SEED_TEAM),
        );
        const plans = existingPlans.length
          ? existingPlans
          : structuredClone(SEED_COMMISSION_PLANS);
        const ledger = operationalLedgerBootstrap(existingLedger);

        await writeJsonlAtomic(teamPath(), team);
        await writeJsonlAtomic(plansPath(), plans);
        await writeJsonlAtomic(ledgerPath(), ledger);
        await writeJsonAtomic(seedMarkerPath(), {
          seededAt: again?.seededAt || new Date().toISOString(),
          bootstrapVersion: PROGRAM4_BOOTSTRAP_VERSION,
          migratedAt: new Date().toISOString(),
          note: "Owner-only team; empty synthetic commission ledger; plans preserved.",
        } satisfies Program4SeedMarker & { migratedAt: string });
      }).finally(() => {
        seedPromise = null;
      });
    }
    await seedPromise;
  }
  // Project 8 — seed Jennifer demo credentials if missing
  // R1A: never auto-provision demo credentials when Supabase/memory staff auth is active.
  const { isLegacyJsonlAuthEnabled } = await import(
    "@/lib/supabase/workspace-auth-config"
  );
  if (isLegacyJsonlAuthEnabled()) {
    const { ensureAuthSeed } = await import("./auth-store");
    await ensureAuthSeed();
  }
}

export function getTeamProfilesSync(): TeamMemberProfile[] {
  const rows = readJsonlSync<TeamMemberProfile>(teamPath());
  if (rows.length) return rows;
  return structuredClone(SEED_TEAM);
}

export function getTeamProfileSync(id: string): TeamMemberProfile | undefined {
  return getTeamProfilesSync().find((m) => m.id === id);
}

export function getCommissionPlansSync(): CommissionPlan[] {
  const rows = readJsonlSync<CommissionPlan>(plansPath());
  return rows.length ? rows : structuredClone(SEED_COMMISSION_PLANS);
}

export function getCommissionPlanSync(id: string): CommissionPlan | undefined {
  return getCommissionPlansSync().find((p) => p.id === id);
}

export function getCommissionLedgerSync(opts?: {
  teamMemberId?: string;
  periodKey?: string;
  relationshipId?: string;
}): CommissionLedgerEntry[] {
  const rows = readJsonlSync<CommissionLedgerEntry>(ledgerPath());
  // Empty file ⇒ empty ledger (never fall back to fictional sample rows).
  const base = rows.length ? rows : structuredClone(SEED_COMMISSION_LEDGER);
  return base
    .filter((e) => {
      if (opts?.teamMemberId && e.teamMemberId !== opts.teamMemberId) return false;
      if (opts?.periodKey && e.periodKey !== opts.periodKey) return false;
      if (opts?.relationshipId && e.relationshipId !== opts.relationshipId) return false;
      return true;
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export async function appendCommissionLedgerEntry(
  entry: CommissionLedgerEntry,
): Promise<CommissionLedgerEntry> {
  await ensureProgram4Data();
  return withWorkspaceLock(async () => {
    const rows = readJsonlSync<CommissionLedgerEntry>(ledgerPath());
    const existing = rows.length ? rows : [];
    if (
      existing.some(
        (e) =>
          e.sourceEventId === entry.sourceEventId &&
          e.teamMemberId === entry.teamMemberId,
      )
    ) {
      return existing.find(
        (e) =>
          e.sourceEventId === entry.sourceEventId &&
          e.teamMemberId === entry.teamMemberId,
      )!;
    }
    const next = [...existing, entry];
    await writeJsonlAtomic(ledgerPath(), next);
    return entry;
  });
}

export async function upsertTeamProfile(
  member: TeamMemberProfile,
): Promise<TeamMemberProfile> {
  await ensureProgram4Data();
  return withWorkspaceLock(async () => {
    const rows = getTeamProfilesSync();
    const idx = rows.findIndex((m) => m.id === member.id);
    const next = [...rows];
    if (idx >= 0) next[idx] = member;
    else next.push(member);
    await writeJsonlAtomic(teamPath(), next);
    return member;
  });
}

export function newProgram4Id(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function periodKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

export { DEFAULT_ACTOR_ID };
