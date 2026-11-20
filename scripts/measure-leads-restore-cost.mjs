/**
 * Measure Wave 1 progressive restore request cost for 20 / 40 / 60 windows.
 * Sandbox Fancy venue only. Mirrors loadMoreLeadsAction restore path:
 * lean index (shared) + message-attention for the restored window.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const REPO = process.cwd();
const OUT = join(homedir(), "Desktop/HTC-NAV-PERF-LEADS-WAVE1");
mkdirSync(OUT, { recursive: true });

for (const line of readFileSync(join(REPO, "../../.env.local"), "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

// Prefer primary tree env if worktree path above fails differently
try {
  for (const line of readFileSync(
    join(homedir(), "Developer/wevenu-website/.env.local"),
    "utf8",
  ).split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
  }
} catch {
  /* already loaded */
}

const require = createRequire(join(homedir(), "Developer/wevenu-website/package.json"));
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url?.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const CHUNK = 1000;
const HARD_CAP = 20_000;
const LEAD_LIST_SELECT = [
  "id",
  "venue_id",
  "sales_stage",
  "status",
  "relationship_id",
  "inquiry_date",
  "created_at",
  "event_type",
  "merged_into_lead_id",
].join(",");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function now() {
  return performance.now();
}

async function leanIndex(archivedIds) {
  const rows = [];
  const t0 = now();
  for (let from = 0; from < HARD_CAP; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, HARD_CAP - 1);
    let q = admin
      .from("leads")
      .select(LEAD_LIST_SELECT)
      .eq("venue_id", FANCY)
      .is("merged_into_lead_id", null);
    if (archivedIds.length > 0) {
      q = q.not("relationship_id", "in", `(${archivedIds.join(",")})`);
    }
    const { data, error } = await q
      .order("inquiry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < CHUNK) break;
  }
  return { rows, ms: Math.round(now() - t0) };
}

async function messageAttention(leads) {
  const relationshipIds = [
    ...new Set(leads.map((l) => l.relationship_id).filter(Boolean)),
  ];
  if (relationshipIds.length === 0) return { ms: 0, rels: 0 };
  const t0 = now();
  const { error } = await admin
    .from("conversations")
    .select("id, relationship_id, needs_response, last_message_at")
    .in("relationship_id", relationshipIds)
    .eq("needs_response", true);
  if (error) throw error;
  return { ms: Math.round(now() - t0), rels: relationshipIds.length };
}

function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * p) - 1)];
}

async function main() {
  const { data: archived, error: aErr } = await admin
    .from("venue_customer_relationships")
    .select("id")
    .eq("venue_id", FANCY)
    .not("archived_at", "is", null);
  if (aErr) throw aErr;
  const archivedIds = (archived ?? []).map((r) => r.id);

  const windows = [20, 40, 60];
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const index = await leanIndex(archivedIds);
    const active = index.rows.filter((r) => r.sales_stage !== "lost" && r.sales_stage !== "booked");
    const byWindow = {};
    for (const n of windows) {
      const slice = active.slice(0, n);
      const attn = await messageAttention(slice);
      byWindow[n] = {
        indexMs: index.ms,
        attentionMs: attn.ms,
        attentionRels: attn.rels,
        // Restore reuses same index path as first page; incremental cost is attention delta.
        restoreTotalMs: index.ms + attn.ms,
        incrementalVs20: null,
      };
    }
    const base = byWindow[20].attentionMs;
    for (const n of windows) {
      byWindow[n].incrementalAttentionVs20 = byWindow[n].attentionMs - base;
      byWindow[n].incrementalTotalVs20 = byWindow[n].restoreTotalMs - byWindow[20].restoreTotalMs;
    }
    runs.push({ run: i + 1, leadCount: active.length, byWindow });
  }

  const summary = {};
  for (const n of windows) {
    const totals = runs.map((r) => r.byWindow[n].restoreTotalMs);
    const attn = runs.map((r) => r.byWindow[n].attentionMs);
    const incr = runs.map((r) => r.byWindow[n].incrementalTotalVs20);
    summary[n] = {
      restoreTotalMedian: pct(totals, 0.5),
      restoreTotalP90: pct(totals, 0.9),
      attentionMedian: pct(attn, 0.5),
      incrementalVs20Median: pct(incr, 0.5),
    };
  }

  const report = {
    measuredAt: new Date().toISOString(),
    venue: "fancy",
    note:
      "Restore calls getLeadsListPage(pageSize=N) which reloads lean index then message-attention for N rows. Index dominates; attention scales with window.",
    clampMax: 100,
    summary,
    runs,
    wave1Acceptable:
      summary[40].incrementalVs20Median < 200 && summary[60].incrementalVs20Median < 350
        ? "YES — incremental attention cost modest vs index; acceptable for Wave 1"
        : "REVIEW — incremental cost higher than expected; still bounded by clamp 100",
  };

  const path = join(OUT, "RESTORE-COST-40-60.json");
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.summary, null, 2));
  console.log("wrote", path);
  console.log(report.wave1Acceptable);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
