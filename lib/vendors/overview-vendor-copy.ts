/**
 * Overview Vendors tile copy — presentation only.
 * Assignments ≠ couple selections. Unsubmitted highlights ≠ staff approval queue.
 */

export type OverviewVendorCopyInput = {
  assignmentCount: number;
  highlightCount: number;
  /** Recommendation rows with selectedAt set (couple submitted that vendor). */
  submittedHighlightCount: number;
};

export function overviewVendorSummaryLines(input: OverviewVendorCopyInput): string[] {
  const { assignmentCount, highlightCount, submittedHighlightCount } = input;
  const unsubmitted = Math.max(0, highlightCount - submittedHighlightCount);
  const lines: string[] = [];

  if (assignmentCount === 0) {
    lines.push("No vendors assigned to this event yet.");
  } else if (assignmentCount === 1) {
    lines.push("1 vendor assigned to this event.");
  } else {
    lines.push(`${assignmentCount} vendors assigned to this event.`);
  }

  if (highlightCount === 0) {
    lines.push("No vendors highlighted for this event yet.");
  } else if (unsubmitted === 0) {
    lines.push("The couple has submitted choices for all highlighted vendors.");
  } else if (unsubmitted === 1) {
    lines.push("1 highlighted vendor not yet chosen by the couple.");
  } else {
    lines.push(`${unsubmitted} highlighted vendors not yet chosen by the couple.`);
  }

  return lines;
}
