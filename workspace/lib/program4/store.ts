import { existsSync } from "fs";
import { randomUUID } from "crypto";

import {
  filePath,
  readJsonlSync,
  withWorkspaceLock,
  writeJsonAtomic,
  writeJsonlAtomic,
} from "@/lib/program3/jsonl";

import { PROGRAM4_FILES } from "./paths";
import {
  DEFAULT_ACTOR_ID,
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

let seedPromise: Promise<void> | null = null;

export async function ensureProgram4Data(): Promise<void> {
  if (!existsSync(seedMarkerPath())) {
    if (!seedPromise) {
      seedPromise = withWorkspaceLock(async () => {
        if (existsSync(seedMarkerPath())) return;
        await writeJsonlAtomic(teamPath(), SEED_TEAM);
        await writeJsonlAtomic(plansPath(), SEED_COMMISSION_PLANS);
        await writeJsonlAtomic(ledgerPath(), SEED_COMMISSION_LEDGER);
        await writeJsonAtomic(seedMarkerPath(), { seededAt: new Date().toISOString() });
      }).finally(() => {
        seedPromise = null;
      });
    }
    await seedPromise;
  }
  // Project 8 — seed Jennifer demo credentials if missing
  const { ensureAuthSeed } = await import("./auth-store");
  await ensureAuthSeed();
}

export function getTeamProfilesSync(): TeamMemberProfile[] {
  const rows = readJsonlSync<TeamMemberProfile>(teamPath());
  return rows.length ? rows : structuredClone(SEED_TEAM);
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
    const existing = rows.length ? rows : structuredClone(SEED_COMMISSION_LEDGER);
    if (existing.some((e) => e.sourceEventId === entry.sourceEventId && e.teamMemberId === entry.teamMemberId)) {
      return existing.find(
        (e) => e.sourceEventId === entry.sourceEventId && e.teamMemberId === entry.teamMemberId,
      )!;
    }
    const next = [...existing, entry];
    await writeJsonlAtomic(ledgerPath(), next);
    return entry;
  });
}

export async function upsertTeamProfile(member: TeamMemberProfile): Promise<TeamMemberProfile> {
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
