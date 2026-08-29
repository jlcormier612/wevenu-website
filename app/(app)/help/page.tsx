import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";

import { HELP_GUIDES_TAGLINE, HELP_GUIDES_TITLE } from "@/lib/help-guides/areas";
import { SETUP_GUIDES } from "@/lib/help-guides/setup-guides";
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

      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3" aria-labelledby="setup-guides">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Start here</p>
          <h2 id="setup-guides" className="mt-1 text-lg font-semibold text-foreground">Setup guides for your venue</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            New to Hello to Cheers? These guides walk you through setup one step at a time — including what to click, what you should see next, and what not to choose. Screenshots can be added to individual steps as they are captured.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {SETUP_GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              href={`/help/${guide.slug}`}
              className="group flex items-start gap-2.5 rounded-lg border border-border bg-card px-3.5 py-3 hover:bg-muted/40 transition-colors"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{guide.shortTitle}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{guide.time}</span>
              </span>
              <ArrowRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-60 group-hover:translate-x-0.5 transition-transform" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

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
