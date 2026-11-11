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

/** Idle chips stay white against the warm staff canvas (never canvas-colored). */
export const IDLE_CHIP =
  "border-[color:var(--htc-border-warm)] bg-card text-muted-foreground hover:border-[color-mix(in_oklch,var(--htc-eucalyptus)_45%,var(--htc-border-warm))] hover:text-foreground";

export const IDLE_CHIP_COUNT =
  "bg-[color:var(--htc-canvas)] text-muted-foreground";

/**
 * Attention / needs-response filter chips (Clients Needs Attention, populated New Inquiry).
 * Soft blush at rest; selected state still uses SELECTED_CHIP (botanical).
 */
export const ATTENTION_CHIP =
  "border-[#e8c4c8] bg-[var(--htc-soft-blush)] text-foreground hover:border-[color-mix(in_oklch,var(--htc-blush)_55%,transparent)]";

export const ATTENTION_CHIP_COUNT =
  "bg-[color-mix(in_oklch,var(--htc-blush)_28%,white)] text-foreground";

/** Idle segmented tab inside a muted track. */
export const IDLE_SEGMENTED =
  "text-muted-foreground hover:text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
