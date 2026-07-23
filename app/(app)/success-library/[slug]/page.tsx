import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getPublishedArticleBySlug } from "@/lib/success-library/service";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  return { title: article ? `${article.title} — Luv's Success Library` : "Luv's Success Library" };
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}

export default async function SuccessLibraryArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/success-library" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Success Library
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{article.goalCategory}</p>
        <h1 className="text-xl font-bold text-foreground mt-1">{article.title}</h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <Section title="Why this matters" body={article.whyItMatters} />
        <Section title="When to use it" body={article.whenToUse} />
        <Section title="Best practices" body={article.bestPractices} />
        <Section title="Common mistakes" body={article.commonMistakes} />
      </div>

      {article.relatedFeatures.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Go do it</p>
          <div className="flex flex-wrap gap-2">
            {article.relatedFeatures.map((f) => (
              <Link key={f.href} href={f.href} className="inline-flex items-center rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">
                {f.label} →
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
