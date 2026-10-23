/**
 * Shared email ink tokens — HTC palette roles that meet WCAG 2.2 AA on the
 * standard light email shell (white card on linen-tinted page). Prefer these
 * over cool Tailwind greys and never restore pale #9ca3af (~2.5:1 on white).
 */
export const EMAIL_INK = {
  /** Body — forest sage (brand text) */
  body: "#4f5f4f",
  /** Headings — black (print / primary body role on light) */
  heading: "#000000",
  /** Secondary labels, venue name, signature — heritage sage (≥4.5:1 on white) */
  muted: "#5d6f5d",
  /** Footer / legal / fallback URL — deeper forest (replaces #9ca3af) */
  footer: "#4f5f4f",
  /** Card surface */
  card: "#ffffff",
  /** Page backdrop — natural cream / linen family */
  page: "#f7f5f1",
} as const;
