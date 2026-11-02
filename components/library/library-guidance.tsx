import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Shared Library teaching UI — keep copy venue-facing and action-oriented.
 * Prefer a single primary link to the canonical create/edit surface for the
 * catalog the template selects from. Do not link back to the Template Library hub.
 */

export type LibraryGuidanceTone = "default" | "blush" | "eucalyptus";

const TONE_PANEL: Record<LibraryGuidanceTone, string> = {
  default: "border-border/70 bg-muted/30 text-muted-foreground",
  blush: "border-[#e8c4c8] bg-[#F7E9EB] text-foreground",
  eucalyptus: "border-[#b7d0c0] bg-[#DCE8E0] text-foreground",
};

const TONE_ACCENT: Record<LibraryGuidanceTone, string> = {
  default: "bg-border",
  blush: "bg-[color-mix(in_oklch,var(--htc-blush)_70%,white)]",
  eucalyptus: "bg-[var(--htc-eucalyptus)]",
};

/**
 * Instructional panel. Prefer `title` + body `children` so heading and copy
 * are separate block elements (never run together as "Title.Body").
 * Callers that still pass a single prose child remain supported.
 */
export function LibraryHowItWorks({
  children,
  title,
  tone = "default",
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  tone?: LibraryGuidanceTone;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border px-3 py-2.5 pl-4 sm:px-3.5 sm:py-3",
        TONE_PANEL[tone],
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-2 left-1.5 w-1 rounded-full", TONE_ACCENT[tone])}
      />
      {title ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold leading-snug text-heading">{title}</p>
          <p className="m-0 text-xs leading-relaxed text-muted-foreground">{children}</p>
        </div>
      ) : (
        <div className="text-xs leading-relaxed">{children}</div>
      )}
    </div>
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
  tone = "default",
  /** @deprecated Prefer `action` + `detail`. Kept for callers mid-migration. */
  links,
}: {
  children: React.ReactNode;
  detail?: React.ReactNode;
  action?: LibraryGuidanceAction;
  secondaryActions?: ReadonlyArray<LibraryGuidanceAction>;
  tone?: LibraryGuidanceTone;
  links?: ReadonlyArray<LibraryGuidanceAction>;
}) {
  const primary = action ?? links?.[0];
  const rest =
    secondaryActions ??
    (action ? [] : links?.slice(1)) ??
    [];

  return (
    <div
      className={cn(
        "relative space-y-1.5 overflow-hidden rounded-xl border px-3 py-2.5 pl-4 text-xs leading-relaxed sm:px-3.5 sm:py-3",
        TONE_PANEL[tone],
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-2 left-1.5 w-1 rounded-full", TONE_ACCENT[tone])}
      />
      <p className="text-sm font-semibold leading-snug text-heading">{children}</p>
      {detail ? <p className="m-0 text-xs leading-relaxed text-muted-foreground">{detail}</p> : null}
      {(primary || rest.length > 0) && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
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
