/**
 * Couple Tasks Impl 7 — Final Payment verified completion (Option B) acceptance.
 *
 * Pure helpers + attention policy. Verification path uses durable
 * payment_line_item_id binding + obligation_kind=final — never labels.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINAL_PAYMENT_OBLIGATION_CELEBRATION,
  FINAL_PAYMENT_OBLIGATION_TRIGGER,
  isPaymentObligationKind,
} from "@/lib/payments/final-payment-obligation";
import { SCHEDULE_PRESETS } from "@/lib/payments/constants";
import { validateLineItemInput } from "@/lib/payments/validation";
import {
  buildUnifiedTaskList,
  isPaymentAttentionMirror,
  venueTaskPresentation,
} from "@/lib/portal/unified-tasks";
import type { PortalTask } from "@/lib/portal/types";
import {
  coupleCelebrationMessage,
  coordinatorCelebrationMessage,
} from "@/lib/luv/celebrations";
import { celebrationTypeForVerifiedTrigger } from "@/lib/luv/verified-domain-celebrations";
import { STANDARD_CLIENT_PLANNING_TASKS, STANDARD_VENUE_WORKFLOW_TASKS } from "@/lib/playbooks/constants";

function task(partial: Partial<PortalTask> & Pick<PortalTask, "id" | "title" | "status" | "dueDate">): PortalTask {
  return {
    description: null,
    category: "financial",
    ownerType: "couple",
    visibility: "client_owned",
    daysOffset: -30,
    milestoneName: "Final Details",
    milestoneKind: "final_stretch",
    isRequired: true,
    completedAt: null,
    autoCompleteTrigger: null,
    canComplete: false,
    ...partial,
    canUndo: partial.canUndo ?? false,
    links: partial.links ?? [],
  };
}

const emptyUnified = {
  venueTasks: [] as PortalTask[],
  requests: [],
  paymentSchedules: [],
  questionnaire: null,
  documents: [],
  timelineHasUnpublishedChanges: false,
};

describe("Impl 7 — obligation_kind at creation (never from label)", () => {
  it("presets stamp deposit / installment / final authoritatively", () => {
    const thirds = SCHEDULE_PRESETS.find((p) => p.id === "thirds");
    assert.ok(thirds);
    assert.deepEqual(
      thirds!.items.map((i) => i.obligationKind),
      ["deposit", "installment", "final"],
    );
    const fifty = SCHEDULE_PRESETS.find((p) => p.id === "fifty_fifty");
    assert.equal(fifty!.items[0]?.obligationKind, "deposit");
    assert.equal(fifty!.items[1]?.obligationKind, "final");
  });

  it("manual create requires explicit obligationKind — refuses label-only", () => {
    const missing = validateLineItemInput({ label: "Final Payment", amount: "100", dueDate: "" });
    assert.ok(missing.obligationKind);
    const ok = validateLineItemInput({
      label: "Whatever", amount: "100", dueDate: "", obligationKind: "other",
    });
    assert.equal(Object.keys(ok).length, 0);
    assert.equal(isPaymentObligationKind("final"), true);
    assert.equal(isPaymentObligationKind("Final"), false);
  });

  it("retainer is deposit, not final (kind constant check)", () => {
    // createRetainerInvoiceAndSchedule passes obligationKind: "deposit"
    assert.equal(isPaymentObligationKind("deposit"), true);
  });
});

describe("Impl 7 — trigger / celebration naming", () => {
  it("Client Planning Final payment uses narrow trigger", () => {
    const row = STANDARD_CLIENT_PLANNING_TASKS.find((t) => t.title === "Final payment");
    assert.equal(row?.autoCompleteTrigger, FINAL_PAYMENT_OBLIGATION_TRIGGER);
    assert.notEqual(row?.autoCompleteTrigger, "payment_received");
  });

  it("Verify deposit stays on broad payment_received", () => {
    const verify = STANDARD_VENUE_WORKFLOW_TASKS.find((t) => t.title === "Verify deposit");
    assert.equal(verify?.autoCompleteTrigger, "payment_received");
  });

  it("celebration type is distinct from paid-in-full", () => {
    assert.equal(FINAL_PAYMENT_OBLIGATION_CELEBRATION, "final_payment_obligation_paid");
    assert.notEqual(FINAL_PAYMENT_OBLIGATION_CELEBRATION, "final_payment_received");
    assert.match(coupleCelebrationMessage("final_payment_obligation_paid"), /final payment/i);
    assert.match(
      coordinatorCelebrationMessage("final_payment_obligation_paid", "Emma & Jordan"),
      /obligation/i,
    );
    // Not via playbook-trigger map (celebrated from mark-paid path)
    assert.equal(celebrationTypeForVerifiedTrigger(FINAL_PAYMENT_OBLIGATION_TRIGGER), null);
    assert.equal(celebrationTypeForVerifiedTrigger("payment_received"), null);
  });
});

describe("Impl 7 — attention matrix (buildUnifiedTaskList)", () => {
  const due = "2026-09-01";
  const finalTask = () =>
    task({
      id: "et-final",
      title: "Final payment",
      status: "pending",
      dueDate: due,
      autoCompleteTrigger: FINAL_PAYMENT_OBLIGATION_TRIGGER,
      canComplete: false,
    });

  const schedule = (lines: { id: string; label: string; status: string; amount?: number }[]) => [{
    id: "sch",
    title: "Payment Schedule",
    invoiceId: "inv",
    createdAt: "2026-08-01",
    lineItems: lines.map((li) => ({
      id: li.id,
      label: li.label,
      amount: li.amount ?? 1000,
      dueDate: due,
      status: li.status,
    })),
  }];

  it("deposit / installment / other unpaid: Final Payment task suppressed; Pay now owns attention", () => {
    for (const label of ["Deposit", "First Installment", "Misc"]) {
      const list = buildUnifiedTaskList({
        ...emptyUnified,
        venueTasks: [finalTask()],
        paymentSchedules: schedule([{ id: "li", label, status: "pending" }]),
      });
      assert.equal(list.find((t) => t.id === "task_et-final"), undefined, label);
      assert.equal(list.filter((t) => t.kind === "payment").length, 1, label);
    }
  });

  it("Final Payment unpaid: checklist suppressed; ledger Pay now remains", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [finalTask()],
      paymentSchedules: schedule([{ id: "li-final", label: "Final Payment", status: "pending" }]),
    });
    assert.equal(list.find((t) => t.id === "task_et-final"), undefined);
    assert.equal(list.find((t) => t.id === "payment_li-final")?.actionLabel, "Pay now");
    assert.equal(list.find((t) => t.id === "payment_li-final")?.completableHere, false);
  });

  it("Final Payment paid + task complete: no attention twin", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [{ ...finalTask(), status: "complete", completedAt: "2026-08-09" }],
      paymentSchedules: schedule([{ id: "li-final", label: "Final Payment", status: "paid" }]),
    });
    assert.equal(list.filter((t) => t.kind === "payment").length, 0);
    const row = list.find((t) => t.id === "task_et-final");
    assert.ok(row);
    assert.equal(row?.completed, true);
    assert.equal(row?.completableHere, false);
  });

  it("multiple unpaid lines: only bound-final identity matters for twin suppress; all Pay now stay", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [finalTask()],
      paymentSchedules: schedule([
        { id: "li-1", label: "Deposit", status: "pending" },
        { id: "li-2", label: "Final Payment", status: "pending" },
      ]),
    });
    assert.equal(list.find((t) => t.id === "task_et-final"), undefined);
    assert.equal(list.filter((t) => t.kind === "payment").length, 2);
  });

  it("paid-in-full without typed final: Final Payment mirror may still show if open + no unpaid lines", () => {
    // Event paid via non-final lines only (legacy null kinds counted as paid).
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [finalTask()],
      paymentSchedules: schedule([
        { id: "li-a", label: "Installment A", status: "paid" },
        { id: "li-b", label: "Installment B", status: "paid" },
      ]),
    });
    assert.equal(list.filter((t) => t.kind === "payment").length, 0);
    // No unpaid → suppress gate off; open verified task still navigates (not Mark complete)
    const mirror = list.find((t) => t.id === "task_et-final");
    assert.ok(mirror);
    assert.equal(mirror?.completableHere, false);
    assert.equal(mirror?.actionLabel, "Pay now");
  });

  it("navigation presentation never completableHere for verified trigger", () => {
    const p = venueTaskPresentation(finalTask());
    assert.equal(p.completableHere, false);
    assert.equal(p.targetSection, "payments");
    assert.equal(isPaymentAttentionMirror(finalTask()), true);
    assert.equal(isPaymentAttentionMirror(task({
      id: "x", title: "Verify", status: "pending", dueDate: due,
      autoCompleteTrigger: "payment_received",
    })), true);
  });

  it("refresh / build is pure — no side effects (identity check via re-run)", () => {
    const input = {
      ...emptyUnified,
      venueTasks: [finalTask()],
      paymentSchedules: schedule([{ id: "li-final", label: "Final Payment", status: "pending" }]),
    };
    const a = buildUnifiedTaskList(input);
    const b = buildUnifiedTaskList(input);
    assert.deepEqual(a, b);
  });
});
