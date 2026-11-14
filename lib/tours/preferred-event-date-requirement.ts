/**
 * Client-safe validation for public forms.
 *
 * Tour scheduling (`schedule_tour`) is about the tour appointment slot.
 * Preferred event date must not block tour submission — especially when the
 * prospect's own active hold makes that date unselectable in
 * `choose_available` calendars (generic Calendar tour links).
 *
 * Existing-lead `?o=` links still render the preferred date read-only via
 * `existingLeadTour`; new tour visitors may leave preferred date blank.
 * Request Information keeps the venue's preferred-date requirement.
 *
 * HMAC origin tokens stay in origin-context.ts (server-only).
 */
export function shouldSkipPreferredEventDateRequirement(opts: {
  mode: string | null | undefined;
  existingLeadTour?: boolean;
}): boolean {
  return opts.mode === "schedule_tour";
}
