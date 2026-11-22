/**
 * CRM DATA-CLEAN execute — DISABLED unless EXECUTE=1 and --i-approve-manifest=<sha256>.
 *
 * Cascades delete of approved relationship IDs inside the live CRM store only.
 * Never touches Stripe/Resend/Twilio/QuickBooks, Auth, ACL, or venue-app DB.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { withLiveStore } from "../../shared/relationships/index.ts";

function parseCsvIds(path: string): string[] {
  const lines = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const idIdx = header.indexOf("id");
  return lines.slice(1).map((line) => line.split(",")[idIdx]).filter(Boolean);
}

function arg(name: string): string | undefined {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : undefined;
}

const PROTECTED = new Set(["rel_841b2c03925e"]);

async function main() {
  if (process.env.EXECUTE !== "1") {
    console.error("Refusing: set EXECUTE=1 only after founder approval.");
    process.exit(2);
  }
  const approved = arg("i-approve-manifest");
  if (!approved || !/^[a-f0-9]{64}$/.test(approved)) {
    console.error("Refusing: pass --i-approve-manifest=<sha256 of approved CSV>");
    process.exit(2);
  }

  const manifestPath = resolve(
    arg("manifest") ||
      `${process.env.HOME}/Desktop/HTC-LAUNCH-FINAL/CRM-READINESS/DATA-CLEAN-MANIFEST/01-propose-delete-clear.csv`,
  );
  const raw = readFileSync(manifestPath);
  const digest = createHash("sha256").update(raw).digest("hex");
  if (digest !== approved) {
    console.error(`Refusing: manifest sha256 ${digest} != approved ${approved}`);
    process.exit(2);
  }

  const ids = new Set(parseCsvIds(manifestPath));
  for (const id of PROTECTED) {
    if (ids.has(id)) {
      console.error(`Refusing: protected id ${id} in manifest`);
      process.exit(2);
    }
  }

  const { result } = await withLiveStore((store) => {
    const before = {
      relationships: store.relationships.length,
      timelineEvents: store.timelineEvents.length,
      tasks: store.tasks.length,
      notifications: store.notifications.length,
      communications: store.communications.length,
      subscriptions: (store.subscriptions || []).length,
      walkthroughs: (store.walkthroughs || []).length,
    };

    store.relationships = store.relationships.filter((r) => !ids.has(r.id));
    store.timelineEvents = store.timelineEvents.filter((e) => !ids.has(e.relationshipId));
    store.tasks = store.tasks.filter((t) => !ids.has(t.relationshipId));
    store.notifications = store.notifications.filter(
      (n) => !n.relationshipId || !ids.has(n.relationshipId),
    );
    store.communications = store.communications.filter((c) => !ids.has(c.relationshipId));
    store.subscriptions = (store.subscriptions || []).filter((s) => !ids.has(s.relationshipId));
    store.walkthroughs = (store.walkthroughs || []).filter((w) => !ids.has(w.relationshipId));

    const after = {
      relationships: store.relationships.length,
      timelineEvents: store.timelineEvents.length,
      tasks: store.tasks.length,
      notifications: store.notifications.length,
      communications: store.communications.length,
      subscriptions: (store.subscriptions || []).length,
      walkthroughs: (store.walkthroughs || []).length,
    };
    return { before, after, removedRelationshipIds: [...ids].length };
  });

  console.log(JSON.stringify({ mode: "EXECUTED", manifestSha256: digest, ...result }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
