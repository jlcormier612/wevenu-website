/**
 * Merge Lead client/server boundary — Continue-gate helpers must not pull
 * Node fs / venue provisioning into the browser bundle via merge.ts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  canAdvanceToMergeFinalConfirm,
  hasUnresolvedMergeFieldConflicts,
} from "@/lib/leads/merge-client";

const root = resolve(".");

describe("merge-client is browser-safe", () => {
  it("merge-client has no server/fs/product-sync imports", () => {
    const src = readFileSync(resolve(root, "lib/leads/merge-client.ts"), "utf8");
    const imports = [...src.matchAll(/^import\s.+$/gm)].map((m) => m[0]).join("\n");
    assert.equal(imports, "", "merge-client must have zero imports");
    assert.doesNotMatch(src, /from\s+["']fs\/promises["']|from\s+["']node:fs["']|@\/integrations\/supabase\/server|@\/lib\/venue\/service|@shared\/product-sync/);
  });

  it("merge-lead-dialog imports gate helpers from merge-client, not merge.ts", () => {
    const src = readFileSync(resolve(root, "components/leads/merge-lead-dialog.tsx"), "utf8");
    assert.match(src, /from "@\/lib\/leads\/merge-client"/);
    assert.doesNotMatch(src, /from "@\/lib\/leads\/merge"/);
    assert.match(src, /canAdvanceToMergeFinalConfirm/);
  });

  it("Continue stays disabled until conflict choices resolve", () => {
    const diffs = [
      {
        key: "email" as const,
        kind: "conflict" as const,
        primaryValue: "a@example.com",
        secondaryValue: "b@example.com",
        label: "Email",
      },
    ];
    assert.equal(hasUnresolvedMergeFieldConflicts(diffs, {}), true);
    assert.equal(
      canAdvanceToMergeFinalConfirm({
        preview: { blockers: [], needsExplicitPrimaryChoice: false, fieldDiffs: diffs },
        explicitPrimaryId: null,
        fieldChoices: {},
      }),
      false,
    );
    assert.equal(
      canAdvanceToMergeFinalConfirm({
        preview: { blockers: [], needsExplicitPrimaryChoice: false, fieldDiffs: diffs },
        explicitPrimaryId: null,
        fieldChoices: { email: "a@example.com" },
      }),
      true,
    );
  });
});
