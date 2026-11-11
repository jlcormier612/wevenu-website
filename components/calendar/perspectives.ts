/**
 * Calendar operational perspectives were retired.
 *
 * The venue Calendar no longer exposes Everything / Sales / Planning /
 * Operations / Wedding Day as a second business-area classification layer.
 * Filtering is taxonomy + staff/space only (Event · Tour · Appointment ·
 * Hold · Blocked Time).
 *
 * Do not reintroduce perspective presets here.
 */

export const CALENDAR_PERSPECTIVES_RETIRED = true as const;
