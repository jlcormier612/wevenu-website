/** Lowercase + trim email for dedupe. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Venue name key: lowercase, trim, strip punctuation / extra whitespace.
 * "Willow & Hearth!" → "willow hearth"
 */
export function normalizeVenueName(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitPersonName(fullName: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Map marketing plan tier ids → workspace plan ids. */
export function mapPlanId(plan: string | null | undefined): "gather" | "celebrate" | "flourish" | "none" {
  const key = (plan ?? "").trim().toLowerCase();
  if (key === "starter" || key === "gather") return "gather";
  if (key === "growing" || key === "celebrate") return "celebrate";
  if (key === "professional" || key === "flourish") return "flourish";
  return "none";
}

export function planDisplayName(
  planId: "gather" | "celebrate" | "flourish" | "none",
  fallback?: string | null,
): string {
  if (fallback?.trim()) return fallback.trim();
  switch (planId) {
    case "gather":
      return "Gather";
    case "celebrate":
      return "Celebrate";
    case "flourish":
      return "Flourish";
    default:
      return "—";
  }
}
