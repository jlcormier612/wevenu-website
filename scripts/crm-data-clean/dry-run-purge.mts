/**
 * CRM DATA-CLEAN dry-run — never mutates.
 *
 * Usage (from repo root, with Sandbox service role in env):
 *   npx tsx scripts/crm-data-clean/dry-run-purge.mts \
 *     --manifest ~/Desktop/HTC-LAUNCH-FINAL/CRM-READINESS/DATA-CLEAN-MANIFEST/01-propose-delete-clear.csv
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadLiveStore } from "../../shared/relationships/index.ts";

function parseCsv(path: string): { id: string; venue: string }[] {
  const text = readFileSync(path, "utf8").trim();
  const lines = text.split(/\r?\n/);
  const header = lines[0].split(",");
  const idIdx = header.indexOf("id");
  const venueIdx = header.indexOf("venue");
  return lines.slice(1).map((line) => {
    // naive CSV (venues rarely contain commas in our manifest)
    const cols = line.split(",");
    return { id: cols[idIdx], venue: cols[venueIdx] };
  });
}

function arg(name: string): string | undefined {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : undefined;
}

const PROTECTED = new Set(["rel_841b2c03925e"]);

async function main() {
  const manifestPath = resolve(
    arg("manifest") ||
      `${process.env.HOME}/Desktop/HTC-LAUNCH-FINAL/CRM-READINESS/DATA-CLEAN-MANIFEST/01-propose-delete-clear.csv`,
  );
  const raw = readFileSync(manifestPath);
  const digest = createHash("sha256").update(raw).digest("hex");
  const rows = parseCsv(manifestPath);
  const ids = new Set(rows.map((r) => r.id).filter(Boolean));

  for (const id of PROTECTED) {
    if (ids.has(id)) {
      console.error(`REFUSING: protected id ${id} appears in delete manifest`);
      process.exit(2);
    }
  }

  const store = await loadLiveStore();
  const present = store.relationships.filter((r) => ids.has(r.id));
  const missing = [...ids].filter((id) => !store.relationships.some((r) => r.id === id));

  const cascade = {
    timelineEvents: store.timelineEvents.filter((e) => ids.has(e.relationshipId)).length,
    tasks: store.tasks.filter((t) => ids.has(t.relationshipId)).length,
    notifications: store.notifications.filter((n) => n.relationshipId && ids.has(n.relationshipId)).length,
    communications: store.communications.filter((c) => ids.has(c.relationshipId)).length,
    subscriptions: (store.subscriptions || []).filter((s) => ids.has(s.relationshipId)).length,
    walkthroughs: (store.walkthroughs || []).filter((w) => ids.has(w.relationshipId)).length,
  };

  console.log(
    JSON.stringify(
      {
        mode: "DRY_RUN",
        manifestPath,
        manifestSha256: digest,
        manifestRows: rows.length,
        relationshipsPresentInStore: present.length,
        missingFromStore: missing.length,
        missingSample: missing.slice(0, 10),
        cascadeWouldRemove: cascade,
        afterProjected: {
          relationships: store.relationships.length - present.length,
          timelineEvents: store.timelineEvents.length - cascade.timelineEvents,
          tasks: store.tasks.length - cascade.tasks,
          notifications: store.notifications.length - cascade.notifications,
          communications: store.communications.length - cascade.communications,
          subscriptions: (store.subscriptions || []).length - cascade.subscriptions,
        },
        note: "No writes performed. Founder must approve manifest SHA before EXECUTE.",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
