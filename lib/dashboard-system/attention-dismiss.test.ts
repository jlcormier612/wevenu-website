import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  contractsAttentionDismissalKey,
  filterDismissedFocusItems,
  leadAttentionDismissalKey,
  leadNewInquiryDismissalKey,
  leadOverdueFollowUpDismissalKey,
  paymentsAttentionDismissalKey,
} from "@/lib/dashboard-system/attention-identity";
import { classifyBriefingItems } from "@/lib/dashboard-system/decision-engine";
import type { DashboardData } from "@/lib/dashboard/types";

function dashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    todayIso: "2026-10-05",
    needsAttention: [],
    followupsDue: [],
    openTasks: [],
    upcomingTours: [],
    upcomingEvents: [],
    upcomingPayments: [],
    briefing: { needsAttentionNow: [] },
    ...overrides,
  } as unknown as DashboardData;
}

describe("Dashboard Focus dismissal identity", () => {
  it("renders an active attention item with a stable dismissal key", () => {
    const data = dashboard({
      needsAttention: [{
        id: "lead-1",
        firstName: "Goldi",
        lastName: "Locks",
        partnerFirstName: null,
        partnerLastName: null,
        followUpDate: null,
        createdAt: "2026-09-24T12:00:00.000Z",
        reason: "New inquiry 11 days old — no follow-up scheduled",
      }] as never,
    });
    const items = classifyBriefingItems(data);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.id, "lead-lead-1");
    assert.equal(items[0]!.dismissalKey, leadNewInquiryDismissalKey("lead-1", "2026-09-24T12:00:00.000Z"));
  });

  it("filters a dismissed item from Today's Focus", () => {
    const items = classifyBriefingItems(dashboard({
      needsAttention: [{
        id: "lead-1",
        firstName: "A",
        lastName: "B",
        partnerFirstName: null,
        partnerLastName: null,
        followUpDate: null,
        createdAt: "2026-09-24T12:00:00.000Z",
        reason: "New inquiry",
      }] as never,
    }));
    const key = items[0]!.dismissalKey!;
    const hidden = filterDismissedFocusItems(items, new Set([key]));
    assert.equal(hidden.length, 0);
  });

  it("keeps the same key while the same unresolved inquiry condition remains", () => {
    const a = leadNewInquiryDismissalKey("lead-1", "2026-09-24T12:00:00.000Z");
    const b = leadNewInquiryDismissalKey("lead-1", "2026-09-24T18:00:00.000Z");
    assert.equal(a, b);
    assert.equal(
      leadAttentionDismissalKey({ id: "lead-1", followUpDate: null, createdAt: "2026-09-24T12:00:00.000Z" }, "2026-10-05"),
      a,
    );
  });

  it("uses a new key when the follow-up condition materially changes", () => {
    const inquiry = leadNewInquiryDismissalKey("lead-1", "2026-09-24T12:00:00.000Z");
    const overdue = leadOverdueFollowUpDismissalKey("lead-1", "2026-10-01");
    assert.notEqual(inquiry, overdue);
  });

  it("uses a new payment key when a new overdue installment appears", () => {
    const eventId = "evt-1";
    const first = paymentsAttentionDismissalKey(eventId, [
      { id: "line-a", status: "overdue", dueDate: "2026-09-24" },
    ]);
    const second = paymentsAttentionDismissalKey(eventId, [
      { id: "line-a", status: "overdue", dueDate: "2026-09-24" },
      { id: "line-b", status: "overdue", dueDate: "2026-10-08" },
    ]);
    assert.notEqual(first, second);
    assert.equal(
      paymentsAttentionDismissalKey(eventId, [
        { id: "line-a", status: "overdue", dueDate: "2026-09-24" },
      ]),
      first,
    );
  });

  it("hides only the dismissed item when several are present", () => {
    const items = classifyBriefingItems(dashboard({
      needsAttention: [
        {
          id: "lead-1",
          firstName: "A",
          lastName: "One",
          partnerFirstName: null,
          partnerLastName: null,
          followUpDate: null,
          createdAt: "2026-09-24T12:00:00.000Z",
          reason: "New inquiry",
        },
        {
          id: "lead-2",
          firstName: "B",
          lastName: "Two",
          partnerFirstName: null,
          partnerLastName: null,
          followUpDate: "2026-10-01",
          createdAt: "2026-09-01T12:00:00.000Z",
          reason: "Follow-up overdue",
        },
      ] as never,
    }));
    assert.equal(items.length, 2);
    const hidden = filterDismissedFocusItems(items, new Set([items[0]!.dismissalKey!]));
    assert.equal(hidden.length, 1);
    assert.equal(hidden[0]!.id, "lead-lead-2");
  });

  it("does not treat dismissal keys as completion evidence", () => {
    const key = contractsAttentionDismissalKey("evt-9", [{ id: "c1", status: "draft" }]);
    assert.match(key, /^v1:contracts:/);
    assert.doesNotMatch(key, /paid|complete|contacted|sent|lost|booked/);
  });
});

describe("Dashboard Focus dismissal architecture (source)", () => {
  const sql = readFileSync(resolve("supabase/migrations/20261412300000_dashboard_attention_dismissals.sql"), "utf8");
  const actions = readFileSync(resolve("app/(app)/dashboard/actions.ts"), "utf8");
  const dismiss = readFileSync(resolve("lib/dashboard-system/attention-dismiss.ts"), "utf8");
  const page = readFileSync(resolve("app/(app)/dashboard/page.tsx"), "utf8");
  const row = readFileSync(resolve("components/dashboard-system/focus-attention-row.tsx"), "utf8");
  const drafts = readFileSync(resolve("lib/luv/drafts.ts"), "utf8");
  const evidence = readFileSync(resolve("lib/luv/pipeline-stage-evidence.ts"), "utf8");
  const engine = readFileSync(resolve("lib/dashboard-system/decision-engine.ts"), "utf8");

  it("persists venue-scoped keys without a 7-day restore", () => {
    assert.match(sql, /dashboard_attention_dismissals/);
    assert.match(sql, /unique \(venue_id, item_key\)/);
    assert.match(sql, /current_user_venue_id\(\)/);
    assert.doesNotMatch(sql, /interval '7 days'/);
    assert.doesNotMatch(sql, /completed_at/);
  });

  it("does not mutate domain tables from dismiss", () => {
    assert.doesNotMatch(dismiss, /payment_line_items/);
    assert.doesNotMatch(dismiss, /sales_stage/);
    assert.doesNotMatch(dismiss, /lost_at/);
    assert.doesNotMatch(dismiss, /booked_at/);
    assert.doesNotMatch(dismiss, /event_tasks/);
    assert.doesNotMatch(actions, /payment_line_items/);
    assert.match(dismiss, /dismiss_dashboard_attention_item/);
  });

  it("wires Focus Dismiss as a secondary action, not Complete", () => {
    assert.match(page, /FocusAttentionRow/);
    assert.match(page, /filterDismissedFocusItems/);
    assert.match(row, /aria-label="Dismiss"/);
    assert.match(row, /title="Dismiss"/);
    assert.match(row, /data-testid="todays-focus-dismiss"/);
    assert.match(row, /from "lucide-react"/);
    assert.match(row, /<X /);
    // Visible label text must not say Dismiss — icon + accessible name only.
    assert.doesNotMatch(row, />\s*Dismiss\s*</);
    assert.doesNotMatch(row, /Hiding…/);
    assert.doesNotMatch(row, /Complete/);
    assert.doesNotMatch(row, /toast\.success/);
  });

  it("matches Dashboard Luv card × dismiss visual language", () => {
    const luv = readFileSync(resolve("components/dashboard/luv-dashboard-entry.tsx"), "utf8");
    assert.match(luv, /<X className="h-3\.5 w-3\.5"/);
    assert.match(row, /<X className="h-3\.5 w-3\.5"/);
    assert.match(luv, /rounded-md p-1 text-muted-foreground transition-opacity hover:opacity-70/);
    assert.match(row, /rounded-md p-1 text-muted-foreground transition-opacity hover:opacity-70/);
    assert.match(row, /dismissDashboardAttentionAction/);
  });

  it("keeps automatic resolution: classifiers still read authoritative feeds", () => {
    assert.match(engine, /data\.needsAttention/);
    assert.match(engine, /data\.briefing\.needsAttentionNow/);
    assert.match(engine, /isOverdue\(task\.dueDate\)/);
  });

  it("Luv factuality does not read Focus dismissals", () => {
    assert.doesNotMatch(drafts, /dashboard_attention_dismissals/);
    assert.doesNotMatch(drafts, /list_dismissed_dashboard_attention_keys/);
    assert.doesNotMatch(evidence, /dashboard_attention/);
    assert.match(evidence, /Pipeline \/ sales stage is never authoritative/);
  });

  it("venue A cannot hide venue B because RPCs bind current_user_venue_id", () => {
    assert.match(sql, /dismiss_dashboard_attention_item/);
    assert.match(sql, /v_venue_id := public.current_user_venue_id\(\)/);
    assert.match(sql, /where venue_id = public.current_user_venue_id\(\)/);
  });
});
