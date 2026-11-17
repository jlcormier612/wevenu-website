/**
 * Detect whether pasted text is columnar enough to parse as a spreadsheet
 * instead of handing it to freeform/Luv structuring.
 *
 * A single ragged row (one extra comma) must not send a real spreadsheet
 * down the unstructured path, where every column can default to Skip.
 */

export function looksTabular(text: string): boolean {
  const lines = text.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return false;
  const delimiterCount = (line: string) =>
    Math.max((line.match(/\t/g) ?? []).length, (line.match(/,/g) ?? []).length);
  const sample = lines.slice(0, 10).map(delimiterCount);
  const expected = sample[0];
  if (expected < 1) return false;
  const closeEnough = sample.filter((count) => Math.abs(count - expected) <= 1).length;
  return closeEnough >= Math.ceil(sample.length * 0.6);
}
