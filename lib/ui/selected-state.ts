/**
 * Shared selected / active interactive surface classes.
 *
 * Backed by semantic tokens `--selected`, `--selected-foreground`,
 * `--selected-border` (primary-tinted light green wash that tracks venue brand).
 * Prefer these over ad-hoc `bg-background` + shadow on muted tracks.
 */

/** Segmented controls inside a muted track (Inbox category, Tabs, Guide audience). */
export const SELECTED_SEGMENTED =
  "bg-selected text-selected-foreground shadow-sm ring-1 ring-inset ring-selected-border " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

/** Pill / chip filters (Clients buckets, Leads stages) — solid primary fill. */
export const SELECTED_CHIP =
  "border-primary bg-primary text-primary-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

export const SELECTED_CHIP_COUNT =
  "bg-primary-foreground/20 text-primary-foreground";

export const IDLE_CHIP =
  "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground";

export const IDLE_CHIP_COUNT = "bg-muted text-muted-foreground";

/** Idle segmented tab inside a muted track. */
export const IDLE_SEGMENTED =
  "text-muted-foreground hover:text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
