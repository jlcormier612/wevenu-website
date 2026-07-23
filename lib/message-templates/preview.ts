/**
 * Preview-mode merge field substitution — bug-report follow-up, 2026-07-22:
 * "when you create a message template from scratch, you need to be able to
 * view it, not just edit it. they'll want to preview it before sending."
 *
 * Templates aren't wired to a real send yet (no live client/event context to
 * pull real values from at this stage — see page.tsx's own "ready to send
 * from Planning tasks once that connection ships"), so preview substitutes
 * realistic sample values for each {{merge_field}} token rather than leaving
 * the raw token in place, matching MESSAGE_MERGE_FIELDS' own vocabulary.
 */
export const SAMPLE_MERGE_VALUES: Record<string, string> = {
  venue_name: "Willow Creek Estate",
  client_name: "Emily & James Carter",
  coordinator_name: "Jordan Blake",
  event_date: "June 12, 2027",
  task_name: "Send final headcount",
  days_until_event: "14",
};

export function substituteSampleMergeFields(text: string): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => SAMPLE_MERGE_VALUES[key] ?? match);
}
