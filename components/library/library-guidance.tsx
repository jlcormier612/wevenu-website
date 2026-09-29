import Link from "next/link";

/**
 * Concise in-product guidance for Library pages — teaches the workflow at
 * the point of use without a separate help manual.
 */
export function LibraryHowItWorks({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-sm border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * Explicit dependency between a Library object and the catalog/source it pulls from
 * (or that pulls from it). Always include at least one Manage/View link.
 */
export function LibraryDependencyNote({
  children,
  links,
}: {
  children: React.ReactNode;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div className="rounded-sm border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground space-y-1.5">
      <p>{children}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {links.map((l) => (
          <Link key={l.href + l.label} href={l.href} className="font-medium text-heading hover:underline">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
