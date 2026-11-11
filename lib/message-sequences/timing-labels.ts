/**
 * Human-readable Automation step timing labels for the builder UI.
 * Underlying model remains offsetDays — this is display only.
 */

export function automationStepTimingLabel(offsetDays: number, isFirst: boolean): string {
  if (offsetDays === 0) {
    return isFirst ? "Immediately" : "Immediately after the previous message";
  }
  if (isFirst) {
    return offsetDays === 1
      ? "1 day after they enter this automation"
      : `${offsetDays} days after they enter this automation`;
  }
  return offsetDays === 1
    ? "1 day after the previous message"
    : `${offsetDays} days after the previous message`;
}
