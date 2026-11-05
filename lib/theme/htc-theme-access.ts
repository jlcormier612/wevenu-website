/**
 * Launch posture for hospitality surfaces (venue staff + vendor).
 *
 * Dark-mode CSS remaps under `.dark .htc-staff` remain in `app/globals.css`
 * so dark can be re-enabled later without rebuilding the palette. Until
 * dark hospitality QA ships, the theme toggle is hidden and light is forced.
 *
 * Flip `HTC_THEME_TOGGLE_ENABLED` to `true` (and drop `forcedTheme`) to
 * restore user-facing light/dark access.
 */
export const HTC_THEME_TOGGLE_ENABLED = false;
