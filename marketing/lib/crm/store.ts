import { mkdir, appendFile, readFile, writeFile } from "fs/promises";
import path from "path";

import type { VenueEnrollmentRecord } from "@/lib/crm/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "venue-enrollments.jsonl");

/**
 * Persist a venue enrollment record for CRM / ops review.
 * JSONL keeps launch simple; swap for a database later without changing checkout.
 */
export async function storeVenueEnrollment(record: VenueEnrollmentRecord): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(STORE_PATH, `${JSON.stringify(record)}\n`, "utf8");
}

export async function listVenueEnrollments(): Promise<VenueEnrollmentRecord[]> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as VenueEnrollmentRecord);
  } catch {
    return [];
  }
}

/** Update Welcome Back verification (staff / future automation). Never called from checkout. */
export async function updateWelcomeBackVerified(
  id: string,
  status: VenueEnrollmentRecord["welcomeBackVerified"],
): Promise<VenueEnrollmentRecord | null> {
  const rows = await listVenueEnrollments();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return null;

  const updated: VenueEnrollmentRecord = {
    ...rows[index],
    welcomeBackVerified: status,
    updatedAt: new Date().toISOString(),
  };
  rows[index] = updated;

  await mkdir(DATA_DIR, { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  await writeFile(STORE_PATH, body ? `${body}\n` : "", "utf8");
  return updated;
}
