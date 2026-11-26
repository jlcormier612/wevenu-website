/**
 * Inline Help prose tokens: **bold** and [label](url) including relative app paths.
 */

export type HelpInlineSegment =
  | { type: "text"; value: string }
  | { type: "link"; label: string; href: string; external: boolean }
  | { type: "bold"; value: string };

/** Match markdown links (http(s) or root-relative) and bold. */
export const HELP_INLINE_TOKEN_RE =
  /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)|\*\*([^*]+)\*\*/g;

export function parseHelpInlineSegments(text: string): HelpInlineSegment[] {
  const parts: HelpInlineSegment[] = [];
  const tokenRe = new RegExp(HELP_INLINE_TOKEN_RE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: "text", value: text.slice(last, m.index) });
    }
    if (m[1] && m[2]) {
      const href = m[2];
      parts.push({
        type: "link",
        label: m[1],
        href,
        external: /^https?:\/\//.test(href),
      });
    } else if (m[3]) {
      parts.push({ type: "bold", value: m[3] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  return parts.length ? parts : [{ type: "text", value: text }];
}
