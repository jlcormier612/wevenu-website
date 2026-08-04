#!/usr/bin/env node
/**
 * Local/QA deterministic lifecycle processor — Venue Lifecycle Automation
 * Completion Pass (2026-08-04), Phase 9.
 *
 * Production processing stays exactly as it is: Vercel cron hits each
 * processor's own route on its own schedule (see vercel.json). This script
 * does not replace that, does not run automatically, and is never invoked
 * by any page render or API route in the app itself — it is a plain CLI
 * tool a developer or QA run runs by hand, POSTing to the same manual-
 * trigger endpoints those cron jobs already use, so nothing "secretly"
 * processes anything.
 *
 * It exists because there wasn't one place to exercise the complete
 * lifecycle locally — automation rules, scheduled messages, and
 * reminders/escalations are three separate processors with three separate
 * endpoints, and proving the lifecycle works requires all three to run in
 * a predictable order, not whichever a developer remembers to curl.
 *
 * Usage:
 *   node scripts/process-lifecycle.mjs [baseUrl]
 *   npm run process:lifecycle
 *
 * baseUrl defaults to http://localhost:3000. In development, all three
 * endpoints accept unauthenticated POSTs (see each route's own comment);
 * against a deployed environment, set the matching secret env vars
 * (AUTOMATION_SECRET, NOTIFICATIONS_SECRET) before running this.
 */

const baseUrl = process.argv[2] ?? "http://localhost:3000";

const steps = [
  {
    name: "Automation Rules + System Guarantees",
    path: "/api/automation/process",
    headers: process.env.AUTOMATION_SECRET ? { "x-automation-secret": process.env.AUTOMATION_SECRET } : {},
  },
  {
    name: "Scheduled Messages (sequences + relationship messages)",
    path: "/api/communication/scheduled/process",
    headers: process.env.NOTIFICATIONS_SECRET ? { "x-notifications-secret": process.env.NOTIFICATIONS_SECRET } : {},
  },
  {
    name: "Task Reminders + Escalations",
    path: "/api/notifications/process",
    headers: process.env.NOTIFICATIONS_SECRET ? { "x-notifications-secret": process.env.NOTIFICATIONS_SECRET } : {},
  },
];

let hadFailure = false;

for (const step of steps) {
  const url = `${baseUrl}${step.path}`;
  process.stdout.write(`\n→ ${step.name}\n  POST ${url}\n`);
  try {
    const res = await fetch(url, { method: "POST", headers: step.headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      hadFailure = true;
      console.error(`  ✗ ${res.status} ${JSON.stringify(body)}`);
    } else {
      console.log(`  ✓ ${res.status} ${JSON.stringify(body)}`);
    }
  } catch (err) {
    hadFailure = true;
    console.error(`  ✗ request failed: ${err instanceof Error ? err.message : err}`);
  }
}

process.stdout.write("\n");
if (hadFailure) {
  console.error("One or more processors reported a failure — see above.");
  process.exit(1);
}
console.log("All processors ran.");
