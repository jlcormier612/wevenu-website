import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { IntegrationSetupHelpProse } from "@/components/help/integration-setup-help-prose";
import { HELP_GUIDES_HOME_HREF, HELP_GUIDES_TITLE } from "@/lib/help-guides/areas";
import { parseHelpInlineSegments } from "@/lib/help-guides/help-prose-inline";
import { isIntegrationSetupArticleSlug } from "@/lib/help-guides/integration-setup-articles";
import { LEGACY_SETUP_GUIDE_REDIRECTS } from "@/lib/setup-hub/help-crosswalk";
import { getPublishedArticleBySlug } from "@/lib/success-library/service";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const legacy = LEGACY_SETUP_GUIDE_REDIRECTS[slug];
  if (legacy) {
    const article = await getPublishedArticleBySlug(legacy);
    return { title: article ? `${article.title} — ${HELP_GUIDES_TITLE}` : HELP_GUIDES_TITLE };
  }
  const article = await getPublishedArticleBySlug(slug);
  return { title: article ? `${article.title} — ${HELP_GUIDES_TITLE}` : HELP_GUIDES_TITLE };
}

/** Default Help prose for non–integration-setup articles (unchanged structure). */
function HelpProse({ body }: { body: string }) {
  const blocks = body.trim().split(/\n\n+/);
  return (
    <div className="space-y-4 text-sm text-foreground leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        const heading = block.trim().match(/^###\s+(.+)$/);
        if (heading && lines.length === 1) {
          return (
            <h2 key={i} className="text-sm font-semibold text-foreground pt-2">
              {heading[1]}
            </h2>
          );
        }

        const isCallout = lines.every((l) => /^>\s?/.test(l.trim()) || l.trim() === ">");
        if (isCallout && lines.length > 0) {
          return (
            <div
              key={i}
              className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-2"
            >
              {lines.map((l, j) => (
                <p key={j} className="text-sm leading-6 text-foreground whitespace-pre-wrap">
                  {renderInline(l.trim().replace(/^>\s?/, ""))}
                </p>
              ))}
            </div>
          );
        }

        const orderedLines = lines.filter((l) => /^\d+\.\s/.test(l.trim()));
        const bulletLines = lines.filter((l) => /^[-*]\s/.test(l.trim()));
        const proseLines = lines.filter(
          (l) => l.trim() !== "" && !/^[-*]\s/.test(l.trim()) && !/^\d+\.\s/.test(l.trim()),
        );

        if (orderedLines.length > 0 && orderedLines.length === lines.length) {
          return (
            <ol key={i} className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
              {orderedLines.map((l, j) => (
                <li key={j}>{renderInline(l.trim().replace(/^\d+\.\s/, ""))}</li>
              ))}
            </ol>
          );
        }

        if (bulletLines.length > 0) {
          return (
            <div key={i} className="space-y-2">
              {proseLines.map((line, j) => (
                <p key={`p-${j}`} className="text-muted-foreground whitespace-pre-wrap">
                  {renderInline(line)}
                </p>
              ))}
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                {bulletLines.map((l, j) => (
                  <li key={j}>{renderInline(l.trim().replace(/^[-*]\s/, ""))}</li>
                ))}
              </ul>
            </div>
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
  const segments = parseHelpInlineSegments(text);
  return segments.map((seg, key) => {
    if (seg.type === "text") return <span key={key}>{seg.value}</span>;
    if (seg.type === "bold") {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {seg.value}
        </strong>
      );
    }
    return (
      <a
        key={key}
        href={seg.href}
        {...(seg.external
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
        className="font-medium text-primary underline underline-offset-2"
      >
        {seg.label}
      </a>
    );
  });
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

  const legacyTarget = LEGACY_SETUP_GUIDE_REDIRECTS[slug];
  if (legacyTarget) {
    redirect(`/help/${legacyTarget}`);
  }

  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  const isProse =
    !article.whenToUse.trim() &&
    !article.bestPractices.trim() &&
    !article.commonMistakes.trim();

  const isIntegrationSetup = isIntegrationSetupArticleSlug(slug);

  return (
    <div
      className={
        isIntegrationSetup
          ? "mx-auto w-full max-w-[840px] space-y-6"
          : "space-y-6 max-w-2xl"
      }
    >
      <Link
        href={HELP_GUIDES_HOME_HREF}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {HELP_GUIDES_TITLE}
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {article.goalCategory}
        </p>
        <h1
          className={
            isIntegrationSetup
              ? "mt-2 font-serif text-[28px] font-normal leading-tight text-[color:var(--htc-charcoal,#2c2c2c)] sm:text-[32px]"
              : "text-xl font-bold text-foreground mt-1"
          }
        >
          {article.title}
        </h1>
      </div>

      <div
        className={
          isIntegrationSetup
            ? "rounded-[12px] border border-[color:var(--htc-border-warm,#e6e0d6)] bg-white px-4 py-5 sm:px-8 sm:py-8 space-y-5"
            : "rounded-sm border border-border bg-card p-5 space-y-5"
        }
      >
        {isProse ? (
          isIntegrationSetup ? (
            <IntegrationSetupHelpProse body={article.whyItMatters} />
          ) : (
            <HelpProse body={article.whyItMatters} />
          )
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
