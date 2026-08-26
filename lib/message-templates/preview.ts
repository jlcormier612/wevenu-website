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
 *
 * Preview never writes back to the stored template.
 */
export const SAMPLE_MERGE_VALUES: Record<string, string> = {
  venue_name: "Willow Creek Estate",
  client_name: "Emily & James Carter",
  first_name: "Sally",
  last_name: "Sunshine",
  full_name: "Sally Sunshine",
  coordinator_name: "Jordan Blake",
  event_date: "June 12, 2027",
  event_name: "Emily & James's Wedding",
  task_name: "Send final headcount",
  days_until_event: "14",
  tour_datetime: "Saturday, May 9, 2027 at 2:00 PM",
  payment_label: "Final Payment",
  payment_amount: "$4,250",
  payment_due_date: "May 13, 2027",
};

export function substituteSampleMergeFields(text: string): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key: string) => SAMPLE_MERGE_VALUES[key] ?? match);
}
