/**
 * The one `{{token}}` resolution engine in this app. Work Package D2's own
 * inventory found `lib/contracts/merge.ts` and `lib/message-templates/merge.ts`
 * each hand-maintaining a byte-for-byte identical copy of this — the
 * message-templates one even said "Mirrors lib/contracts/merge.ts's
 * pattern" in its own comment. Per the standing instruction to consolidate
 * duplicate implementations rather than build a third: this is that
 * consolidation. Each system's own field vocabulary (which tokens exist,
 * where their values come from) stays separate in its own `buildMergeData` —
 * only the actual find-and-replace mechanics were ever duplicated.
 */

export type MergeData = Record<string, string>;

/** Replace all {{token}} occurrences. Unknown tokens are left as-is — never silently blanked (Step 21/D2). */
export function mergeContent(template: string, data: MergeData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key as keyof MergeData];
    return value !== undefined ? value : match;
  });
}

/** Extract all {{token}} names from a template string. */
export function extractTokens(template: string): string[] {
  const tokens = new Set<string>();
  for (const [, key] of template.matchAll(/\{\{(\w+)\}\}/g)) {
    tokens.add(key);
  }
  return [...tokens];
}
