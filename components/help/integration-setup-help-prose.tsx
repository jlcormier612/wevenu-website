"use client";

import * as React from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { splitGuideTocHeadings } from "@/lib/help-guides/guide-toc";
import { parseHelpInlineSegments } from "@/lib/help-guides/help-prose-inline";
import { cn } from "@/lib/utils";

type Block =
  | { kind: "heading"; text: string; id: string }
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[]; lead?: string[] }
  | { kind: "ordered"; items: string[] }
  | { kind: "callout"; lines: string[] };

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseBlocks(body: string): Block[] {
  const chunks = body.trim().split(/\n\n+/);
  const blocks: Block[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split("\n").filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;

    const heading = chunk.trim().match(/^###\s+(.+)$/);
    if (heading && lines.length === 1) {
      blocks.push({ kind: "heading", text: heading[1], id: slugifyHeading(heading[1]) });
      continue;
    }

    const isCallout = lines.every((l) => /^>\s?/.test(l.trim()) || l.trim() === ">");
    if (isCallout) {
      blocks.push({
        kind: "callout",
        lines: lines.map((l) => l.trim().replace(/^>\s?/, "")),
      });
      continue;
    }

    const ordered = lines.filter((l) => /^\d+\.\s/.test(l.trim()));
    const bullets = lines.filter((l) => /^[-*]\s/.test(l.trim()));
    const prose = lines.filter(
      (l) => l.trim() !== "" && !/^[-*]\s/.test(l.trim()) && !/^\d+\.\s/.test(l.trim()),
    );

    if (ordered.length > 0 && ordered.length === lines.length) {
      blocks.push({
        kind: "ordered",
        items: ordered.map((l) => l.trim().replace(/^\d+\.\s/, "")),
      });
      continue;
    }

    if (bullets.length > 0) {
      blocks.push({
        kind: "bullets",
        lead: prose.length ? prose : undefined,
        items: bullets.map((l) => l.trim().replace(/^[-*]\s/, "")),
      });
      continue;
    }

    blocks.push({ kind: "paragraph", text: chunk });
  }
  return blocks;
}

function renderInline(text: string): ReactNode {
  const segments = parseHelpInlineSegments(text);
  return segments.map((seg, key) => {
    if (seg.type === "text") return <span key={key}>{seg.value}</span>;
    if (seg.type === "bold") {
      return (
        <strong key={key} className="font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]">
          {seg.value}
        </strong>
      );
    }
    return (
      <a
        key={key}
        href={seg.href}
        {...(seg.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="inline-flex items-center gap-1 font-medium text-[color:var(--htc-botanical)] underline underline-offset-2 hover:opacity-90"
      >
        {seg.label}
        {seg.external ? <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden /> : null}
      </a>
    );
  });
}

function isLoneNavPathParagraph(text: string): boolean {
  const t = text.trim();
  if (!t.includes("→")) return false;
  if (t.includes("\n")) return false;
  return (
    /Your Venue\s*→/i.test(t) ||
    (/Settings\s*→/i.test(t) && t.length < 120) ||
    (/^[A-Za-z0-9 &/'’.-]+\s*→\s*[A-Za-z0-9 &/'’.-]+(\s*→\s*[A-Za-z0-9 &/'’.-]+)+$/.test(t) &&
      t.length < 140)
  );
}

function stepNumberFromHeading(text: string): { n: number; title: string } | null {
  const m = text.match(/^Step\s+(\d+)\s+[—–-]\s+(.+)$/i);
  if (!m) return null;
  return { n: Number(m[1]), title: m[2] };
}

function isExampleHeading(text: string): boolean {
  return /^example\b/i.test(text) || /\bexample\b/i.test(text);
}

function ArticleContents({ headings }: { headings: { id: string; text: string }[] }) {
  const [showAll, setShowAll] = React.useState(false);
  if (headings.length < 4) return null;

  const { primary, secondary } = splitGuideTocHeadings(headings);
  const visible = showAll || secondary.length === 0 ? headings : primary;
  const canToggle = secondary.length > 0;

  return (
    <nav
      aria-label="In this guide"
      data-testid="guide-toc"
      data-guide-toc-expanded={showAll ? "true" : "false"}
      className="rounded-[10px] border border-[color:var(--htc-border-warm,#e6e0d6)] bg-[color:var(--htc-canvas,#f7f4ef)] px-4 py-3"
    >
      <p className="text-[15px] font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]">
        In this guide
      </p>
      <ul className="mt-2 space-y-1.5">
        {visible.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className="text-[14px] text-[color:var(--htc-botanical)] underline-offset-2 hover:underline"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
      {canToggle ? (
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--htc-charcoal,#2c2c2c)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--htc-botanical)] focus-visible:ring-offset-2 rounded-sm"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          data-testid="guide-toc-toggle"
        >
          {showAll ? "Show fewer sections" : "Show all sections"}
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", showAll && "rotate-180")}
            aria-hidden
          />
        </button>
      ) : null}
    </nav>
  );
}

function Paragraph({ text }: { text: string }) {
  if (isLoneNavPathParagraph(text)) {
    return (
      <p className="rounded-md bg-[#F5F2EC] px-3.5 py-3 text-[15px] font-medium leading-relaxed text-[color:var(--htc-charcoal,#2c2c2c)]">
        {renderInline(text.trim())}
      </p>
    );
  }
  return (
    <p className="text-[15px] leading-[1.6] text-[color:var(--htc-charcoal,#2c2c2c)] whitespace-pre-wrap">
      {renderInline(text)}
    </p>
  );
}

function renderBlock(block: Block, key: string | number) {
  if (block.kind === "paragraph") {
    return <Paragraph key={key} text={block.text} />;
  }
  if (block.kind === "bullets") {
    return (
      <div key={key} className="space-y-3">
        {block.lead?.map((line, j) => (
          <Paragraph key={`lead-${j}`} text={line} />
        ))}
        <ul className="list-disc space-y-2 pl-5 text-[15px] leading-[1.6] text-[color:var(--htc-charcoal,#2c2c2c)]">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (block.kind === "ordered") {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-[1.6] text-[color:var(--htc-charcoal,#2c2c2c)]">
        {block.items.map((item, j) => (
          <li key={j}>{renderInline(item)}</li>
        ))}
      </ol>
    );
  }
  if (block.kind === "callout") {
    return (
      <div
        key={key}
        className="rounded-[10px] border border-[color:color-mix(in_oklch,var(--htc-botanical)_18%,transparent)] bg-[color:var(--htc-botanical-pale,#E8F0EA)] px-5 py-4 space-y-2"
      >
        {block.lines.map((line, j) => (
          <p key={j} className="text-[15px] leading-[1.6] text-[color:var(--htc-charcoal,#2c2c2c)]">
            {renderInline(line)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

/**
 * Enhanced instructional presentation for the seven integration setup Help articles.
 * Preserves approved wording; presentation-only.
 */
export function IntegrationSetupHelpProse({ body }: { body: string }) {
  const blocks = React.useMemo(() => parseBlocks(body), [body]);
  const headings = blocks
    .filter((b): b is Extract<Block, { kind: "heading" }> => b.kind === "heading")
    .map((h) => ({ id: h.id, text: h.text }));

  // Split intro (before first heading) from the rest for contents placement.
  const firstHeadingIdx = blocks.findIndex((b) => b.kind === "heading");
  const intro = firstHeadingIdx === -1 ? blocks : blocks.slice(0, firstHeadingIdx);
  const rest = firstHeadingIdx === -1 ? [] : blocks.slice(firstHeadingIdx);

  const sections: ReactNode[] = [];
  let i = 0;
  while (i < rest.length) {
    const block = rest[i];
    if (block.kind !== "heading") {
      sections.push(renderBlock(block, `r-${i}`));
      i += 1;
      continue;
    }

    const heading = block;
    const step = stepNumberFromHeading(heading.text);
    const beforeBegin = /^before you begin$/i.test(heading.text);
    const faq = /^frequently asked questions$/i.test(heading.text);
    const additional = /^additional\b/i.test(heading.text);
    const example = isExampleHeading(heading.text);

    // Collect following content until next heading
    const content: Block[] = [];
    let j = i + 1;
    while (j < rest.length && rest[j].kind !== "heading") {
      content.push(rest[j]);
      j += 1;
    }

    if (beforeBegin) {
      sections.push(
        <section key={heading.id} id={heading.id} className="scroll-mt-24 rounded-[12px] bg-[#EEF1E9] px-5 py-5 sm:px-6 space-y-3">
          <h2 className="text-[18px] font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]">
            {heading.text}
          </h2>
          <div className="space-y-3">{content.map((b, k) => renderBlock(b, `bb-${k}`))}</div>
        </section>,
      );
      i = j;
      continue;
    }

    if (step) {
      sections.push(
        <section key={heading.id} id={heading.id} className="scroll-mt-24 mt-8 space-y-3">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF1E9] text-[14px] font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]"
              aria-hidden
            >
              {step.n}
            </span>
            <h2 className="pt-0.5 text-[18px] font-semibold leading-snug text-[color:var(--htc-charcoal,#2c2c2c)] sm:text-[20px]">
              <span className="sr-only">Step {step.n} — </span>
              {step.title}
            </h2>
          </div>
          <div className="space-y-3 sm:pl-11">{content.map((b, k) => renderBlock(b, `st-${k}`))}</div>
        </section>,
      );
      i = j;
      continue;
    }

    if (example) {
      sections.push(
        <section key={heading.id} id={heading.id} className="scroll-mt-24 mt-6 space-y-3">
          <div className="rounded-[10px] border border-[color:var(--htc-border-warm,#e6e0d6)] bg-[#F5F2EC] px-5 py-4 space-y-3">
            <h2 className="text-[17px] font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]">
              {heading.text}
            </h2>
            <div className="space-y-3">{content.map((b, k) => renderBlock(b, `ex-${k}`))}</div>
          </div>
        </section>,
      );
      i = j;
      continue;
    }

    if (faq) {
      // Pair paragraphs as Q then A when possible; otherwise render sequentially with Q emphasis on short lines ending with ?
      const faqNodes: ReactNode[] = [];
      let k = 0;
      while (k < content.length) {
        const b = content[k];
        // Approved FAQ questions are often bold markdown: **Question?**
        if (b.kind === "paragraph" && /\?\*{0,2}\s*$/.test(b.text.trim())) {
          const answer = content[k + 1];
          faqNodes.push(
            <div key={`faq-${k}`} className="space-y-2 border-b border-[color:var(--htc-border-warm,#e6e0d6)] py-4 last:border-0">
              <p className="text-[15px] font-medium text-[color:var(--htc-charcoal,#2c2c2c)]">
                {renderInline(b.text.trim())}
              </p>
              {answer ? (
                <div className="space-y-2 text-[15px] leading-[1.6] text-[color:var(--htc-charcoal,#2c2c2c)]">
                  {renderBlock(answer, `faq-a-${k}`)}
                </div>
              ) : null}
            </div>,
          );
          k += answer ? 2 : 1;
          continue;
        }
        // Nested heading-like FAQ topics (### Bringing over...) already split as separate sections
        faqNodes.push(renderBlock(b, `faq-misc-${k}`));
        k += 1;
      }
      sections.push(
        <section key={heading.id} id={heading.id} className="scroll-mt-24 mt-8 space-y-1">
          <h2 className="text-[20px] font-semibold text-[color:var(--htc-charcoal,#2c2c2c)] mb-2">
            {heading.text}
          </h2>
          <div>{faqNodes}</div>
        </section>,
      );
      i = j;
      continue;
    }

    if (additional) {
      sections.push(
        <section key={heading.id} id={heading.id} className="scroll-mt-24 mt-8 space-y-3">
          <h2 className="text-[18px] font-semibold text-[color:var(--htc-charcoal,#2c2c2c)]">
            {heading.text}
          </h2>
          <div className="space-y-3">{content.map((b, k) => renderBlock(b, `add-${k}`))}</div>
        </section>,
      );
      i = j;
      continue;
    }

    sections.push(
      <section key={heading.id} id={heading.id} className="scroll-mt-24 mt-8 space-y-3">
        <h2 className="text-[18px] font-semibold text-[color:var(--htc-charcoal,#2c2c2c)] sm:text-[20px]">
          {heading.text}
        </h2>
        <div className="space-y-3">{content.map((b, k) => renderBlock(b, `sec-${k}`))}</div>
      </section>,
    );
    i = j;
  }

  return (
    <div className="space-y-4 text-[15px] leading-[1.6] text-[color:var(--htc-charcoal,#2c2c2c)]">
      <div className="space-y-4">{intro.map((b, idx) => renderBlock(b, `intro-${idx}`))}</div>
      <ArticleContents headings={headings} />
      <div className="space-y-1">{sections}</div>
    </div>
  );
}
