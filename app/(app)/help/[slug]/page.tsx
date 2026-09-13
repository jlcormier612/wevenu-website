import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { IntegrationSetupGuideView } from "@/components/help/integration-setup-guide";
import { getSetupGuide } from "@/lib/help-guides/setup-guides";
import { HELP_GUIDES_HOME_HREF, HELP_GUIDES_TITLE } from "@/lib/help-guides/areas";
import { getPublishedArticleBySlug } from "@/lib/success-library/service";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getSetupGuide(slug);
  if (guide) return { title: `${guide.title} — ${HELP_GUIDES_TITLE}` };
  const article = await getPublishedArticleBySlug(slug);
  return { title: article ? `${article.title} — ${HELP_GUIDES_TITLE}` : HELP_GUIDES_TITLE };
}

/** Render editorial Help copy: paragraphs + **bold** + simple bullet lines. */
function HelpProse({ body }: { body: string }) {
  const blocks = body.trim().split(/\n\n+/);
  return (
    <div className="space-y-4 text-sm text-foreground leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => l.trim() === "" || l.trim().startsWith("* "));
        if (isList) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              {lines.filter((l) => l.trim().startsWith("* ")).map((l, j) => (
                <li key={j}>{renderInline(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-muted-foreground whitespace-pre-wrap">
            {renderInline(block)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(<strong key={key++} className="font-semibold text-foreground">{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}

export default async function HelpGuideArticlePage({ params }: Props) {
  const { slug } = await params;
  const guide = getSetupGuide(slug);
  if (guide) return <IntegrationSetupGuideView guide={guide} />;

  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  const isProse =
    !article.whenToUse.trim() &&
    !article.bestPractices.trim() &&
    !article.commonMistakes.trim();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href={HELP_GUIDES_HOME_HREF}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {HELP_GUIDES_TITLE}
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{article.goalCategory}</p>
        <h1 className="text-xl font-bold text-foreground mt-1">{article.title}</h1>
      </div>

      <div className="rounded-sm border border-border bg-card p-5 space-y-5">
        {isProse ? (
          <HelpProse body={article.whyItMatters} />
        ) : (
          <>
            <Section title="Why this matters" body={article.whyItMatters} />
            <Section title="When to use it" body={article.whenToUse} />
            <Section title="Best practices" body={article.bestPractices} />
            <Section title="Common mistakes" body={article.commonMistakes} />
          </>
        )}
      </div>

      {article.relatedFeatures.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Go do it</p>
          <div className="flex flex-wrap gap-2">
            {article.relatedFeatures.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="inline-flex items-center rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {f.label} →
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
