import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  IDLE_CHIP,
  SELECTED_CHIP,
  SELECTED_SEGMENTED,
} from "@/lib/ui/selected-state";

describe("selected-state tokens", () => {
  it("exposes semantic selected surface classes (no hard-coded hex)", () => {
    assert.match(SELECTED_SEGMENTED, /bg-selected/);
    assert.match(SELECTED_SEGMENTED, /text-selected-foreground/);
    assert.match(SELECTED_SEGMENTED, /ring-selected-border/);
    assert.doesNotMatch(SELECTED_SEGMENTED, /#[0-9a-fA-F]{3,8}/);
    assert.match(SELECTED_CHIP, /bg-primary/);
    assert.match(IDLE_CHIP, /text-muted-foreground/);
  });

  it("globals.css defines --selected for light and dark", () => {
    const css = readFileSync(resolve("app/globals.css"), "utf8");
    assert.match(css, /--color-selected:\s*var\(--selected\)/);
    assert.match(css, /--selected:\s*color-mix\(in oklch, var\(--primary\)/);
    assert.match(css, /\.dark\s*\{[\s\S]*--selected:/);
  });

  it("Inbox category uses SELECTED_SEGMENTED, not bg-background shadow", () => {
    const src = readFileSync(resolve("app/(app)/messaging/conversation-inbox.tsx"), "utf8");
    assert.match(src, /SELECTED_SEGMENTED/);
    assert.doesNotMatch(src, /bg-background text-heading shadow-sm/);
  });

  it("Client buckets use SELECTED_CHIP", () => {
    const src = readFileSync(resolve("components/clients/client-list.tsx"), "utf8");
    assert.match(src, /SELECTED_CHIP/);
  });

  it("TabsTrigger uses selected surface token", () => {
    const src = readFileSync(resolve("components/ui/tabs.tsx"), "utf8");
    assert.match(src, /data-\[active\]:bg-selected/);
  });
});
