import Link from "next/link";

import { cn } from "@/lib/utils";

type JourneyNavProps = {
  prev?: { id: string; title: string } | null;
  next?: { id: string; title: string } | null;
  className?: string;
};

/** Large, elegant previous / next for journey chapter pages. */
export function JourneyNav({ prev, next, className }: JourneyNavProps) {
  return (
    <nav
      className={cn(
        "mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-10 border-t border-[var(--taupe-medium)]/60 px-6 pt-14",
        className,
      )}
      aria-label="Journey navigation"
    >
      {prev ? (
        <Link
          href={`/product/journey/${prev.id}`}
          className="group max-w-xs transition-opacity hover:opacity-80"
        >
          <span className="block text-[10px] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/70">
            Previous
          </span>
          <span className="mt-2 block font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
            ← {prev.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`/product/journey/${next.id}`}
          className="group ml-auto max-w-xs text-right transition-opacity hover:opacity-80"
        >
          <span className="block text-[10px] tracking-[0.22em] uppercase text-[var(--heritage-sage)]/70">
            Next
          </span>
          <span className="mt-2 block font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
            {next.title} →
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
