import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";

import { NavListBodyFallback } from "@/components/shell/nav-list-body-fallback";
import { HELP_GUIDES_TAGLINE, HELP_GUIDES_TITLE } from "@/lib/help-guides/areas";
import { getPublishedCategories } from "@/lib/success-library/service";

export const metadata: Metadata = { title: HELP_GUIDES_TITLE };

async function HelpBodyIsland() {
  const categories = await getPublishedCategories();
  const visible = categories.filter((cat) => cat.articles.length > 0);

  return (
    <div className="space-y-8">
      {visible.map((cat) => (
        <section key={cat.category} className="space-y-2" aria-labelledby={`help-area-${cat.category}`}>
          <div>
            <h2 id={`help-area-${cat.category}`} className="text-sm font-semibold text-foreground">
              {cat.category}
            </h2>
            {cat.description ? (
              <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
            ) : null}
          </div>

          <div className="htc-help-article-list rounded-sm border border-border divide-y divide-border">
            {cat.articles.map((a) => (
              <Link
                key={a.slug}
                href={`/help/${a.slug}`}
                className="htc-help-article-row block px-4 py-3 text-sm font-medium transition-colors"
              >
                <span className="htc-record-link">{a.title}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function HelpGuidesHomePage() {
  return (
    <div
      className="htc-hospitality-page space-y-4 sm:space-y-6 max-w-3xl"
      data-testid="guidance-streaming-root"
    >
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden />
          {HELP_GUIDES_TITLE}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{HELP_GUIDES_TAGLINE}</p>
      </div>

      <Suspense fallback={<NavListBodyFallback label="Loading guidance" />}>
        <HelpBodyIsland />
      </Suspense>
    </div>
  );
}
