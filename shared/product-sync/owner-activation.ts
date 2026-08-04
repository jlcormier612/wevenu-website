/**
 * Record venue-owner activation credentials alongside simulated product sync.
 * Used when product provisioning is local/simulated so the Activate Account
 * email loop remains testable without a real Supabase Auth user.
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { getProductSyncDataDir } from "./paths";

type OwnerActivationArtifact = {
  relationshipId: string;
  updatedAt: string;
  resources: Partial<
    Record<
      string,
      {
        id: string;
        detail?: string;
        passwordHash?: string;
        activatedEmail?: string;
        activatedAt?: string;
      }
    >
  >;
  history: Array<{
    step: string;
    resourceId: string;
    at: string;
    detail?: string;
  }>;
};

async function loadArtifact(relationshipId: string): Promise<OwnerActivationArtifact> {
  const dir = getProductSyncDataDir();
  const filePath = path.join(dir, `${relationshipId}.json`);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as OwnerActivationArtifact;
  } catch {
    return {
      relationshipId,
      updatedAt: new Date().toISOString(),
      resources: {},
      history: [],
    };
  }
}

/**
 * Persist a scrypt password hash on the local owner_account artifact.
 * Does not call the product app. Safe for dry-run / simulated sync.
 */
export async function recordOwnerActivationCredential(input: {
  relationshipId: string;
  email: string;
  passwordHash: string;
  ownerAccountId?: string | null;
}): Promise<void> {
  const artifact = await loadArtifact(input.relationshipId);
  const now = new Date().toISOString();
  const existing = artifact.resources.owner_account;
  const resourceId =
    input.ownerAccountId?.trim() ||
    existing?.id ||
    `acct_activated_${input.relationshipId.slice(0, 12)}`;

  artifact.resources.owner_account = {
    id: resourceId,
    detail:
      existing?.detail ||
      `Owner account activated for ${input.email.trim().toLowerCase()}`,
    passwordHash: input.passwordHash,
    activatedEmail: input.email.trim().toLowerCase(),
    activatedAt: now,
  };
  artifact.history.push({
    step: "owner_account",
    resourceId,
    at: now,
    detail: `Password set via Activate Account (${input.email.trim().toLowerCase()})`,
  });
  artifact.updatedAt = now;

  const dir = getProductSyncDataDir();
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${artifact.relationshipId}.json`);
  await writeFile(filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}
