import { mkdir, appendFile, readFile, writeFile } from "fs/promises";
import path from "path";

import type { InquirySubmission } from "@/lib/inquiries/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "inquiries.jsonl");

/**
 * Persist an inquiry for manual review.
 * JSONL keeps launch simple and can be replaced with a database later.
 */
export async function storeInquiry(submission: InquirySubmission): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await appendFile(STORE_PATH, `${JSON.stringify(submission)}\n`, "utf8");
}

/** Optional helper for local ops — reads stored inquiries. */
export async function listInquiries(): Promise<InquirySubmission[]> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as InquirySubmission);
  } catch {
    return [];
  }
}

/** Test helper — replace store contents. */
export async function replaceInquiryStore(rows: InquirySubmission[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  await writeFile(STORE_PATH, body ? `${body}\n` : "", "utf8");
}
