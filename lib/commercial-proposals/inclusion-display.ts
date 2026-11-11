/**
 * How package inclusions read on the couple's proposal.
 *
 * Package item `unit` values are often internal taxonomy (event, booking, setup)
 * rather than customer-facing quantity labels. Those must not be appended to the
 * description ("Client planning portal access booking").
 *
 * Also skips repeating a countable unit that is already the last word of the
 * description (e.g. "Ceremony seating furniture setup" + unit "setup").
 */

/** Units that are catalog taxonomy / duration class — never show to couples. */
const NON_DISPLAY_UNITS = new Set([
  "event",
  "booking",
  "setup",
  "set",
  "package",
  "service",
  "item",
  "inclusion",
]);

export function inclusionUnitLabel(
  description: string,
  unit: string | null | undefined,
): string | null {
  const u = unit?.trim();
  if (!u) return null;
  const unitWords = u.toLowerCase();
  if (NON_DISPLAY_UNITS.has(unitWords)) return null;

  const desc = description.trim().toLowerCase();
  const alreadyEndsWithUnit =
    desc === unitWords
    || desc.endsWith(` ${unitWords}`)
    || desc.endsWith(`-${unitWords}`);
  return alreadyEndsWithUnit ? null : u;
}
