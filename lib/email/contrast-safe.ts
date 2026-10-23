/**
 * Shared email ink tokens that meet WCAG 2.2 AA on the standard light email
 * shell (white card on #f9fafb). Prefer these over Tailwind greys that fall
 * below 4.5:1 at caption sizes (#9ca3af ≈ 2.5:1 on white).
 */
export const EMAIL_INK = {
  /** Body / primary text on white */
  body: "#374151",
  /** Headings on white */
  heading: "#111827",
  /** Secondary labels, venue name, signature (≥4.5:1 on white/#f9fafb) */
  muted: "#6b7280",
  /** Footer / legal / fallback URL — same AA floor as muted (replaces #9ca3af) */
  footer: "#6b7280",
  /** Card surface */
  card: "#ffffff",
  /** Page backdrop */
  page: "#f9fafb",
} as const;
