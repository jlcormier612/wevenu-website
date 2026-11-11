/**
 * Render conversation message bodies with clickable http(s) URLs.
 * Does not mutate stored message text — presentation only.
 */

import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

/** http/https URLs; trailing sentence punctuation is stripped from the href. */
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;

function trimTrailingPunctuation(url: string): { href: string; trailing: string } {
  let end = url.length;
  while (end > 0 && /[.,;:!?)]$/.test(url.charAt(end - 1))) {
    end -= 1;
  }
  return { href: url.slice(0, end), trailing: url.slice(end) };
}

export function linkifyMessageBody(body: string, linkClassName: string): ReactNode {
  if (!body) return body;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);
  let key = 0;

  while ((match = re.exec(body)) !== null) {
    const raw = match[0]!;
    const start = match.index;
    if (start > lastIndex) {
      nodes.push(body.slice(lastIndex, start));
    }
    const { href, trailing } = trimTrailingPunctuation(raw);
    if (/^https?:\/\//i.test(href)) {
      nodes.push(
        createElement(
          "a",
          {
            key: `url-${key++}`,
            href,
            target: "_blank",
            rel: "noopener noreferrer",
            className: linkClassName,
          },
          href,
        ),
      );
      if (trailing) nodes.push(trailing);
    } else {
      nodes.push(raw);
    }
    lastIndex = start + raw.length;
  }

  if (lastIndex < body.length) {
    nodes.push(body.slice(lastIndex));
  }

  if (nodes.length === 1 && typeof nodes[0] === "string") {
    return nodes[0];
  }

  return createElement(Fragment, null, ...nodes);
}

/** Extract link hrefs for tests — same detection as the renderer. */
export function extractMessageBodyUrls(body: string): string[] {
  const urls: string[] = [];
  const re = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const { href } = trimTrailingPunctuation(match[0]!);
    if (/^https?:\/\//i.test(href)) urls.push(href);
  }
  return urls;
}
