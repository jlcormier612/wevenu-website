/**
 * Initial value for the venue-side Client Portal invitation field.
 *
 * Source is the client's stored primary contact email (`clients.email`).
 * The field is the destination for this invitation only — editing it
 * must not write back to the client record.
 *
 * Empty / whitespace-only primary email → empty field. Never invent an
 * address and never use a placeholder email as a value.
 */
export function initialPortalInviteEmail(
  primaryEmail: string | null | undefined,
): string {
  return primaryEmail?.trim() ?? "";
}
