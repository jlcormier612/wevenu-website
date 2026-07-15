import Link from "next/link";

import { CONCEPTS } from "@/lib/marketing/vision";
import { cn } from "@/lib/utils";

export function ConceptSwitcher({ active }: { active?: string }) {
  return (
    <div className="sticky top-16 z-40 border-b border-[var(--taupe-medium)]/40 bg-[var(--header-linen)]/95 backdrop-blur-md md:top-20">
      <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-6 py-3">
        <Link
          href="/concepts"
          className={cn(
            "shrink-0 text-xs tracking-[0.18em] uppercase",
            !active ? "text-[var(--forest-sage)]" : "text-[var(--forest-sage)]/45 hover:text-[var(--forest-sage)]",
          )}
        >
          All concepts
        </Link>
        <span className="text-[var(--taupe-dark)]" aria-hidden>
          /
        </span>
        {CONCEPTS.map((c) => (
          <Link
            key={c.id}
            href={`/concepts/${c.slug}`}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs tracking-wide transition",
              active === c.slug
                ? "bg-[var(--heritage-sage)] text-[var(--true-white)]"
                : "text-[var(--forest-sage)]/65 hover:bg-[var(--linen)] hover:text-[var(--forest-sage)]",
            )}
          >
            {c.name} · {c.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
