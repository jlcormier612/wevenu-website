/**
 * Canonical primary email for a newly composed relationship message.
 *
 * A Lead Workspace save updates the lead (and, when linked, the client and
 * the relationship). A newer client row created earlier can still hold the
 * previous address. New messages must follow the identity write that
 * happened last, not the oldest snapshot and not a partner address.
 */

export type RecipientEmailCandidate = {
  email: string | null;
  updatedAt: string | null;
};

export type RecipientEmailRole = "client" | "lead" | "relationship";

const TIE_PRIORITY: Record<RecipientEmailRole, number> = {
  client: 3,
  lead: 2,
  relationship: 1,
};

function usable(candidate: RecipientEmailCandidate | null | undefined): {
  email: string;
  updatedAt: string;
} | null {
  const email = candidate?.email?.trim() || "";
  if (!email || !email.includes("@")) return null;
  return { email, updatedAt: candidate?.updatedAt ?? "" };
}

/**
 * Pick the primary recipient for a new message.
 * Newest updated_at wins. Equal timestamps keep client, then lead, then
 * the relationship — the same preference as a save that touches all three.
 */
export function chooseCurrentRecipientEmail(input: {
  client: RecipientEmailCandidate | null;
  lead: RecipientEmailCandidate | null;
  relationship: RecipientEmailCandidate | null;
}): string | null {
  const ranked: { role: RecipientEmailRole; email: string; updatedAt: string }[] = [];
  const client = usable(input.client);
  const lead = usable(input.lead);
  const relationship = usable(input.relationship);
  if (client) ranked.push({ role: "client", ...client });
  if (lead) ranked.push({ role: "lead", ...lead });
  if (relationship) ranked.push({ role: "relationship", ...relationship });
  if (ranked.length === 0) return null;
  ranked.sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? -1 : 1;
    return TIE_PRIORITY[b.role] - TIE_PRIORITY[a.role];
  });
  return ranked[0]!.email;
}
