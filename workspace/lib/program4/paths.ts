import { getWorkspaceDataDir } from "@/lib/program3/paths";
import path from "path";

export { getWorkspaceDataDir };

export const PROGRAM4_FILES = {
  teamMembers: "team-members.jsonl",
  commissionPlans: "commission-plans.jsonl",
  commissionLedger: "commission-ledger.jsonl",
  seedMarker: "program4-seeded.json",
  /** Project 8 — invite tokens */
  teamInvites: "team-invites.jsonl",
  /** Project 8 — password hashes (never plaintext) */
  teamCredentials: "team-credentials.jsonl",
  /** Project 8 — opaque session ids */
  sessions: "sessions.jsonl",
} as const;

export function program4File(name: (typeof PROGRAM4_FILES)[keyof typeof PROGRAM4_FILES]): string {
  return path.join(getWorkspaceDataDir(), name);
}
