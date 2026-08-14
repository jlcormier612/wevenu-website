/**
 * Renders the light markdown subset used in legal_documents.content:
 * ATX headings (# / ##), unordered lists (- ), and paragraphs.
 * Skips a leading H1 when the page chrome already shows the document title.
 */
export function LegalMarkdown({
  content,
  skipLeadingH1 = true,
}: {
  content: string;
  skipLeadingH1?: boolean;
}) {
  const blocks = parseLegalMarkdown(content, skipLeadingH1);
  return (
    <div className="space-y-5 text-base leading-relaxed text-foreground/90">
      {blocks.map((block, index) => {
        if (block.type === "h1") {
          return (
            <h2
              key={index}
              className="font-heading text-2xl font-medium tracking-tight text-heading"
            >
              {block.text}
            </h2>
          );
        }
        if (block.type === "h2") {
          return (
            <h2
              key={index}
              className="pt-2 font-heading text-xl font-medium tracking-tight text-heading md:text-2xl"
            >
              {block.text}
            </h2>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={index} className="list-disc space-y-2 pl-5">
              {block.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="max-w-[65ch]">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

type MarkdownBlock =
  | { type: "h1" | "h2" | "p"; text: string }
  | { type: "ul"; items: string[] };

function parseLegalMarkdown(content: string, skipLeadingH1: boolean): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let sawContent = false;
  let skippedLeadingH1 = false;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "p", text: paragraph.join(" ").trim() });
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ type: "ul", items: listItems });
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const h1 = trimmed.match(/^#\s+(.+)$/);
    if (h1 && !trimmed.startsWith("##")) {
      flushParagraph();
      flushList();
      if (skipLeadingH1 && !sawContent && !skippedLeadingH1) {
        skippedLeadingH1 = true;
        continue;
      }
      sawContent = true;
      blocks.push({ type: "h1", text: h1[1].trim() });
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      flushParagraph();
      flushList();
      sawContent = true;
      blocks.push({ type: "h2", text: h2[1].trim() });
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      sawContent = true;
      listItems.push(bullet[1].trim());
      continue;
    }

    flushList();
    sawContent = true;
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
}
