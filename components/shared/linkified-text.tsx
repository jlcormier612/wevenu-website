import * as React from "react";

/** Match http(s) URLs; trail punctuation stays outside the link. */
const URL_RE = /(https?:\/\/[^\s<]+)/gi;

function trimTrailingPunct(url: string): { href: string; trail: string } {
  let href = url;
  let trail = "";
  while (/[.,;:!?')\]}>]$/.test(href)) {
    trail = href.slice(-1) + trail;
    href = href.slice(0, -1);
  }
  return { href, trail };
}

/**
 * Render plain text with http(s) URLs as safe links.
 * React text nodes escape content — never inject raw HTML from notes.
 */
export function LinkifiedText({
  text,
  className,
  linkClassName = "underline underline-offset-2 hover:opacity-80",
  linkStyle,
}: {
  text: string;
  className?: string;
  linkClassName?: string;
  linkStyle?: React.CSSProperties;
}) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_RE.source, URL_RE.flags);
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const { href, trail } = trimTrailingPunct(match[0]);
    if (href) {
      nodes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
          style={linkStyle}
        >
          {href}
        </a>,
      );
    }
    if (trail) nodes.push(trail);
    last = match.index + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  if (nodes.length === 0) return null;

  return <span className={className}>{nodes}</span>;
}
