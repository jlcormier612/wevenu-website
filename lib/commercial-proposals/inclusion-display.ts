/**
 * How package inclusions read on the couple's proposal.
 * Skips repeating a unit that is already the last word of the description
 * (e.g. "Ceremony seating furniture setup" + unit "setup" → no second "setup").
 */

export function inclusionUnitLabel(
  description: string,
  unit: string | null | undefined,
): string | null {
  const u = unit?.trim();
  if (!u) return null;
  const desc = description.trim().toLowerCase();
  const unitWords = u.toLowerCase();
  const alreadyEndsWithUnit =
    desc === unitWords
    || desc.endsWith(` ${unitWords}`)
    || desc.endsWith(`-${unitWords}`);
  return alreadyEndsWithUnit ? null : u;
}
