import Link from "next/link";

/**
 * Shared Library teaching UI — keep copy venue-facing and action-oriented.
 * Prefer a single primary link to the canonical create/edit surface for the
 * catalog the template selects from. Do not link back to the Template Library hub.
 */

export function LibraryHowItWorks({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-sm border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </p>
  );
}

export type LibraryGuidanceAction = {
  href: string;
  /** Specific CTA, e.g. "Manage Available Inventory" — not "Manage" or "Learn more". */
  label: string;
};

/**
 * Explains a catalog → template relationship:
 * - summary: plain-language what this uses
 * - detail: how the source is selected/populated in the template (optional)
 * - action: direct link to the create/edit surface for that source
 * - secondaryActions: additional specific destinations only (never the Library hub)
 */
export function LibraryDependencyNote({
  children,
  detail,
  action,
  secondaryActions,
  /** @deprecated Prefer `action` + `detail`. Kept for callers mid-migration. */
  links,
}: {
  children: React.ReactNode;
  detail?: React.ReactNode;
  action?: LibraryGuidanceAction;
  secondaryActions?: ReadonlyArray<LibraryGuidanceAction>;
  links?: ReadonlyArray<LibraryGuidanceAction>;
}) {
  const primary = action ?? links?.[0];
  const rest =
    secondaryActions ??
    (action ? [] : links?.slice(1)) ??
    [];

  return (
    <div className="space-y-1.5 rounded-sm border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <p>{children}</p>
      {detail ? <p>{detail}</p> : null}
      {(primary || rest.length > 0) && (
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          {primary ? (
            <Link href={primary.href} className="font-medium text-heading hover:underline">
              {primary.label.includes("→") ? primary.label : `${primary.label} →`}
            </Link>
          ) : null}
          {rest.map((l) => (
            <Link key={l.href} href={l.href} className="font-medium text-heading hover:underline">
              {l.label.includes("→") ? l.label : `${l.label} →`}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}
