/**
 * Conversation message body URL linkification.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { isValidElement, type ReactElement, type ReactNode } from "react";

import {
  extractMessageBodyUrls,
  linkifyMessageBody,
} from "@/lib/conversations/message-body-links";

function flattenText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (isValidElement(node)) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    return flattenText(el.props.children);
  }
  return "";
}

function collectAnchors(node: ReactNode): Array<{ href: string; target: string; rel: string; text: string }> {
  const out: Array<{ href: string; target: string; rel: string; text: string }> = [];
  function walk(n: ReactNode) {
    if (n == null || typeof n === "boolean" || typeof n === "string" || typeof n === "number") return;
    if (Array.isArray(n)) {
      for (const child of n) walk(child);
      return;
    }
    if (isValidElement(n)) {
      const el = n as ReactElement<{ href?: string; target?: string; rel?: string; children?: ReactNode }>;
      if (el.type === "a") {
        out.push({
          href: el.props.href ?? "",
          target: el.props.target ?? "",
          rel: el.props.rel ?? "",
          text: flattenText(el.props.children),
        });
      }
      walk(el.props.children);
    }
  }
  walk(node);
  return out;
}

describe("message body URL linkification", () => {
  it("makes plain HTTPS and HTTP URLs clickable", () => {
    const https = linkifyMessageBody(
      "https://app.sandbox.hellotocheers.com/availability/abc123",
      "link",
    );
    const http = linkifyMessageBody("http://example.com/path", "link");
    const httpsAnchors = collectAnchors(https);
    const httpAnchors = collectAnchors(http);
    assert.equal(httpsAnchors.length, 1);
    assert.equal(httpsAnchors[0]?.href, "https://app.sandbox.hellotocheers.com/availability/abc123");
    assert.equal(httpsAnchors[0]?.target, "_blank");
    assert.equal(httpsAnchors[0]?.rel, "noopener noreferrer");
    assert.equal(httpAnchors[0]?.href, "http://example.com/path");
  });

  it("linkifies a URL inside a sentence without changing surrounding text", () => {
    const body = "here's our availability https://app.sandbox.hellotocheers.com/availability/abc123 thanks";
    const rendered = linkifyMessageBody(body, "link");
    assert.equal(flattenText(rendered), body);
    const anchors = collectAnchors(rendered);
    assert.equal(anchors.length, 1);
    assert.equal(anchors[0]?.href, "https://app.sandbox.hellotocheers.com/availability/abc123");
  });

  it("handles multiple URLs and preserves line breaks in the text", () => {
    const body = "One\nhttps://one.example/a\nTwo http://two.example/b end";
    const rendered = linkifyMessageBody(body, "link");
    assert.equal(flattenText(rendered), body);
    assert.deepEqual(extractMessageBodyUrls(body), [
      "https://one.example/a",
      "http://two.example/b",
    ]);
    assert.equal(collectAnchors(rendered).length, 2);
  });

  it("leaves messages without URLs unchanged as plain text", () => {
    const body = "Just checking in about the tour.";
    const rendered = linkifyMessageBody(body, "link");
    assert.equal(rendered, body);
    assert.deepEqual(extractMessageBodyUrls(body), []);
  });

  it("strips trailing sentence punctuation from the href", () => {
    const rendered = linkifyMessageBody("See https://example.com/path.", "link");
    const anchors = collectAnchors(rendered);
    assert.equal(anchors[0]?.href, "https://example.com/path");
    assert.equal(flattenText(rendered), "See https://example.com/path.");
  });

  it("does not turn non-URL text into links", () => {
    const body = "email me at hello@example.com or visit example.com/no-scheme";
    assert.deepEqual(extractMessageBodyUrls(body), []);
    assert.equal(collectAnchors(linkifyMessageBody(body, "link")).length, 0);
  });
});

describe("ConversationThread wiring", () => {
  it("uses shared linkify for message bubbles and keeps prefill on stored body", () => {
    const thread = readFileSync(resolve("components/conversations/conversation-thread.tsx"), "utf8");
    const links = readFileSync(resolve("lib/conversations/message-body-links.ts"), "utf8");
    assert.match(thread, /linkifyMessageBody/);
    assert.match(links, /noopener noreferrer/);
    assert.match(links, /target: "_blank"/);
    // Prefill / recovery must keep the raw stored body, not a linked React tree.
    assert.match(thread, /onPrefill\(msg\.body/);
    assert.match(thread, /whitespace-pre-wrap break-words/);
    assert.match(thread, /overflow-wrap:anywhere/);
  });
});
