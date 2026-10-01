/**
 * Originating-workflow return for Contract Detail.
 * Back means "where I was working", not "whatever record is associated".
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecordPath(prefix: "/leads/" | "/clients/", pathNoQuery: string): boolean {
  if (!pathNoQuery.startsWith(prefix)) return false;
  const id = pathNoQuery.slice(prefix.length);
  return UUID_RE.test(id);
}

export function safeContractReturnPath(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("://")) {
    return null;
  }
  // Strip hash for allowlist check; preserve it on the returned path.
  const pathOnly = decoded.split("#")[0] ?? decoded;
  const pathNoQuery = pathOnly.split("?")[0] ?? pathOnly;
  if (pathOnly.includes("..")) return null;

  const allowed =
    pathNoQuery === "/contracts" ||
    pathNoQuery === "/documents" ||
    isRecordPath("/leads/", pathNoQuery) ||
    isRecordPath("/clients/", pathNoQuery);
  if (!allowed) return null;
  return decoded;
}

export function appendContractReturnTo(
  href: string | null | undefined,
  returnTo: string | null | undefined,
): string | null {
  if (!href) return null;
  const safe = safeContractReturnPath(returnTo);
  if (!safe) return href;
  if (!href.startsWith("/contracts/")) return href;
  const joiner = href.includes("?") ? "&" : "?";
  return `${href}${joiner}returnTo=${encodeURIComponent(safe)}`;
}

export function resolveContractBackNavigation(input: {
  returnTo?: string | null;
  clientId?: string | null;
  clientName?: string | null;
}): { href: string; label: string } {
  const safe = safeContractReturnPath(input.returnTo);
  const coupleLabel = input.clientName?.trim() || null;

  if (safe) {
    const pathOnly = (safe.split("#")[0] ?? safe).split("?")[0] ?? safe;
    if (pathOnly.startsWith("/leads/")) {
      return { href: safe, label: coupleLabel ?? "Lead" };
    }
    if (pathOnly.startsWith("/clients/")) {
      return { href: safe, label: coupleLabel ?? "Client" };
    }
    if (pathOnly === "/contracts" || pathOnly.startsWith("/contracts")) {
      return { href: safe, label: "Contracts" };
    }
    if (pathOnly === "/documents" || pathOnly.startsWith("/documents")) {
      return { href: safe, label: "Documents" };
    }
    return { href: safe, label: coupleLabel ?? "Back" };
  }

  // Canonical fallback from relationships — only when no originating context.
  if (input.clientId) {
    return {
      href: `/clients/${input.clientId}`,
      label: coupleLabel ?? "Client",
    };
  }
  return { href: "/contracts", label: "Contracts" };
}
