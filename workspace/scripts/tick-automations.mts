/**
 * In-process automation tick (no HTTP server required).
 *
 * From workspace/:
 *   npm run tick:automations
 *
 * Use when workspace is not on Vercel Cron (system crontab, CI, local ops).
 * Same engines as `/api/cron/automations`: sequences, workflows, renewals, dunning.
 */
import { tickAutomations } from "../lib/program3/tick-automations.ts";

const result = await tickAutomations({ includeLifecycle: true });
console.log(JSON.stringify(result, null, 2));
