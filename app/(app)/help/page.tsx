import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";

import { HELP_GUIDES_TAGLINE, HELP_GUIDES_TITLE } from "@/lib/help-guides/areas";
import { getPublishedCategories } from "@/lib/success-library/service";

export const metadata: Metadata = { title: HELP_GUIDES_TITLE };

export default async function HelpGuidesHomePage() {
  const categories = await getPublishedCategories();

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden />
          {HELP_GUIDES_TITLE}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{HELP_GUIDES_TAGLINE}</p>
      </div>

      <div className="space-y-8">
        {categories.map((cat) => (
          <section key={cat.category} className="space-y-2" aria-labelledby={`help-area-${cat.category}`}>
            <div>
              <h2 id={`help-area-${cat.category}`} className="text-sm font-semibold text-foreground">
                {cat.category}
              </h2>
              {cat.description ? (
                <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
              ) : null}
            </div>

            {cat.articles.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border px-4 py-5">
                <p className="text-sm text-muted-foreground">Guides for this area are coming soon.</p>
              </div>
            ) : (
              <div className="rounded-sm border border-border bg-card divide-y divide-border">
                {cat.articles.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/help/${a.slug}`}
                    className="block px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
                  >
                    {a.title}
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
