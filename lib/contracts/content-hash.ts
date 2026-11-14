import { createHash } from "node:crypto";

/** Server-only SHA-256 of contract content. Do not import from Client Components. */
export function hashContractContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
