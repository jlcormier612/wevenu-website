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

/**
 * True when a value looks like an email local-part (or full email), not a
 * human given name — e.g. "emma.carter", "john_doe", "user@…".
 */
export function looksLikeEmailLocalPart(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  if (v.includes("@")) return true;
  if (/\s/.test(v)) return false;
  // Dots / underscores / digits mixed in a single token → inbox local-part.
  if (/[._]/.test(v)) return true;
  if (/\d/.test(v) && /[a-z]/i.test(v)) return true;
  return false;
}

function polishGivenName(token: string): string {
  const t = token.trim();
  if (!t) return "";
  if (/^[a-z]+(?:-[a-z]+)*$/.test(t)) {
    return t
      .split("-")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join("-");
  }
  return t;
}

/** "emma.carter" / "john_doe@…" → "Emma" / "John"; otherwise "". */
function givenNameFromLocalPart(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const local = raw.includes("@") ? raw.split("@")[0] || "" : raw;
  const segment = (local.split(/[._+\-]+/)[0] || "").trim();
  if (segment && /^[a-zA-Z]{2,}$/.test(segment)) {
    return polishGivenName(segment);
  }
  return "";
}

/**
 * Greeting-safe first name for replies / templates.
 * Prefer real firstName → first token of fullName → first alphabetic
 * segment of a dotted local-part / email (emma.carter → Emma) → "there".
 * Never returns raw dotted/underscored local-parts like "emma.carter".
 */
export function greetingFirstName(opts: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  fallback?: string;
}): string {
  const fallback = (opts.fallback ?? "there").trim() || "there";

  const prefer = (opts.firstName ?? "").trim();
  if (prefer && !looksLikeEmailLocalPart(prefer)) {
    return polishGivenName(prefer.split(/\s+/)[0] ?? prefer) || fallback;
  }

  const full = (opts.fullName ?? "").trim();
  if (full && !looksLikeEmailLocalPart(full)) {
    const { firstName } = splitPersonName(full);
    if (firstName && !looksLikeEmailLocalPart(firstName)) {
      return polishGivenName(firstName) || fallback;
    }
  }

  // Soft derive: stored firstName "emma.carter" or email emma.carter@… → Emma.
  const fromStored = givenNameFromLocalPart(prefer);
  if (fromStored) return fromStored;
  const fromEmail = givenNameFromLocalPart(opts.email);
  if (fromEmail) return fromEmail;

  void opts.lastName;
  return fallback;
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
