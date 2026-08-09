import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  remainingBalanceFromSchedules,
  selectCanonicalPaymentSchedules,
  type PortalPaymentScheduleLike,
} from "@/lib/portal/payment-schedules";
import { buildUnifiedTaskList, ownershipLabel, venueTaskPresentation } from "@/lib/portal/unified-tasks";
import type { PortalTask } from "@/lib/portal/types";
import { compactNextStepsActionLabel } from "@/lib/portal/next-steps";

function task(partial: Partial<PortalTask> & Pick<PortalTask, "id" | "title" | "status" | "dueDate">): PortalTask {
  return {
    description: null,
    category: "planning",
    ownerType: "venue",
    visibility: "client_visible",
    daysOffset: 0,
    milestoneName: "",
    milestoneKind: null,
    isRequired: false,
    completedAt: null,
    autoCompleteTrigger: null,
    canComplete: true,
    ...partial,
  };
}

function schedule(partial: PortalPaymentScheduleLike): PortalPaymentScheduleLike {
  return partial;
}

const emptyUnified = {
  venueTasks: [] as PortalTask[],
  requests: [] as never[],
  paymentSchedules: [] as { id?: string; title: string; lineItems: { id: string; label: string; amount: number; dueDate: string | null; status: string }[] }[],
  questionnaire: null as { status: string } | null,
  documents: [] as never[],
  timelineHasUnpublishedChanges: false,
};

describe("buildUnifiedTaskList attention ordering", () => {
  it("boosts overdue before earlier-but-not-overdue due dates", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yIso = yesterday.toISOString().slice(0, 10);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nIso = nextWeek.toISOString().slice(0, 10);

    const list = buildUnifiedTaskList({
      venueTasks: [
        task({ id: "soon", title: "Soon", status: "pending", dueDate: nIso }),
        task({ id: "late", title: "Late", status: "overdue", dueDate: yIso }),
        task({ id: "undated-q", title: "Undated peer", status: "pending", dueDate: "" }),
      ],
      requests: [],
      paymentSchedules: [],
      questionnaire: { status: "sent" },
      documents: [],
      timelineHasUnpublishedChanges: false,
    }).filter((t) => !t.completed);

    assert.equal(list[0]?.id, "task_late");
    assert.equal(list[0]?.isOverdue, true);
    assert.equal(list[1]?.id, "task_soon");
    assert.equal(list.at(-1)?.kind, "questionnaire");
    assert.equal(ownershipLabel(list[0]!.ownership), "From your venue");
  });

  it("marks unpaid past-due payments as shared overdue", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const yIso = yesterday.toISOString().slice(0, 10);

    const list = buildUnifiedTaskList({
      ...emptyUnified,
      paymentSchedules: [{
        id: "sch1",
        title: "Schedule",
        invoiceId: "inv1",
        createdAt: "2026-08-01T00:00:00Z",
        lineItems: [{ id: "p1", label: "Deposit", amount: 1000, dueDate: yIso, status: "pending" }],
      }],
    });

    assert.equal(list[0]?.kind, "payment");
    assert.equal(list[0]?.isOverdue, true);
    assert.equal(list[0]?.ownership, "shared");
    assert.equal(ownershipLabel("shared"), "Shared planning");
  });
});

describe("payment obligation reconciliation", () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 2);
  const yIso = yesterday.toISOString().slice(0, 10);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nIso = nextWeek.toISOString().slice(0, 10);

  const thirdsLineItems = [
    { id: "li-first-a", label: "First Installment", amount: 4319.57, dueDate: yIso, status: "overdue" },
    { id: "li-second-a", label: "Second Installment", amount: 4319.57, dueDate: yIso, status: "overdue" },
    { id: "li-final-a", label: "Final Payment", amount: 4320.86, dueDate: nIso, status: "pending" },
  ];

  it("one payment schedule → one set of obligations", () => {
    const schedules = [
      schedule({
        id: "sch-canonical",
        title: "Payment Schedule",
        invoiceId: "inv-1",
        createdAt: "2026-08-05T00:00:00Z",
        totalAmount: 12960,
        lineItems: thirdsLineItems,
      }),
    ];

    const list = buildUnifiedTaskList({ ...emptyUnified, paymentSchedules: schedules });
    const payments = list.filter((t) => t.kind === "payment");
    assert.equal(payments.length, 3);
    assert.deepEqual(payments.map((p) => p.id).sort(), [
      "payment_li-final-a",
      "payment_li-first-a",
      "payment_li-second-a",
    ]);
    assert.equal(remainingBalanceFromSchedules(schedules), 12960);
  });

  it("duplicate source schedules cannot silently produce duplicate actionable rows", () => {
    const schedules = [
      schedule({
        id: "sch-old",
        title: "Payment Schedule",
        invoiceId: "inv-1",
        createdAt: "2026-07-22T00:00:00Z",
        totalAmount: 12960,
        lineItems: [
          { id: "li-first-b", label: "First Installment", amount: 4319.57, dueDate: yIso, status: "overdue" },
          { id: "li-second-b", label: "Second Installment", amount: 4319.57, dueDate: yIso, status: "overdue" },
          { id: "li-final-b", label: "Final Payment", amount: 4320.86, dueDate: nIso, status: "pending" },
        ],
      }),
      schedule({
        id: "sch-new",
        title: "Payment Schedule",
        invoiceId: "inv-1",
        createdAt: "2026-08-05T00:00:00Z",
        totalAmount: 12960,
        lineItems: thirdsLineItems,
      }),
      schedule({
        id: "sch-other-shape",
        title: "Payment Schedule",
        invoiceId: "inv-1",
        createdAt: "2026-07-22T12:00:00Z",
        totalAmount: 12960,
        lineItems: [
          { id: "li-dep", label: "Deposit", amount: 2500, dueDate: yIso, status: "overdue" },
          { id: "li-half", label: "Half Point Payment", amount: 6000, dueDate: nIso, status: "pending" },
          { id: "li-fin-alt", label: "Final Payment", amount: 4460, dueDate: yIso, status: "overdue" },
        ],
      }),
    ];

    assert.equal(selectCanonicalPaymentSchedules(schedules).length, 1);
    assert.equal(selectCanonicalPaymentSchedules(schedules)[0]?.id, "sch-new");

    const list = buildUnifiedTaskList({ ...emptyUnified, paymentSchedules: schedules });
    const payments = list.filter((t) => t.kind === "payment");
    assert.equal(payments.length, 3);
    assert.equal(payments.filter((p) => p.title === "First Installment").length, 1);
    assert.equal(payments.filter((p) => p.title === "Second Installment").length, 1);
    assert.equal(remainingBalanceFromSchedules(schedules), 12960);
  });

  it("Home and Tasks receive the same obligation set from shared synthesis", () => {
    const schedules = [
      schedule({
        id: "sch-a",
        title: "A",
        invoiceId: "inv-1",
        createdAt: "2026-08-05",
        lineItems: thirdsLineItems,
      }),
      schedule({
        id: "sch-b",
        title: "B",
        invoiceId: "inv-1",
        createdAt: "2026-07-22",
        lineItems: [
          { id: "dup-1", label: "First Installment", amount: 4319.57, dueDate: yIso, status: "overdue" },
        ],
      }),
    ];
    const venueTasks = [
      task({ id: "v1", title: "Purchase event insurance", status: "pending", dueDate: nIso, isRequired: true }),
    ];

    const home = buildUnifiedTaskList({ ...emptyUnified, venueTasks, paymentSchedules: schedules });
    const tasks = buildUnifiedTaskList({ ...emptyUnified, venueTasks, paymentSchedules: schedules });
    assert.deepEqual(
      home.map((t) => t.id),
      tasks.map((t) => t.id),
    );
  });

  it("Payments remaining and Home remaining agree after canonicalization", () => {
    const schedules = [
      schedule({
        id: "sch-new",
        title: "Canonical",
        invoiceId: "inv-1",
        createdAt: "2026-08-05",
        totalAmount: 12960,
        lineItems: thirdsLineItems,
      }),
      schedule({
        id: "sch-old",
        title: "Duplicate",
        invoiceId: "inv-1",
        createdAt: "2026-07-22",
        totalAmount: 12960,
        lineItems: thirdsLineItems.map((li, i) => ({ ...li, id: `old-${i}` })),
      }),
    ];
    const remaining = remainingBalanceFromSchedules(schedules);
    assert.equal(remaining, 12960);
    // Payments destination uses the newest schedule's unpaid total — same number.
    const newest = selectCanonicalPaymentSchedules(schedules)[0]!;
    const paymentsRemaining = newest.lineItems
      .filter((li) => li.status !== "paid" && li.status !== "cancelled")
      .reduce((s, li) => s + li.amount, 0);
    assert.equal(paymentsRemaining, remaining);
  });

  it("legitimately distinct obligations (different invoices) are not incorrectly deduped", () => {
    const schedules = [
      schedule({
        id: "sch-wedding",
        title: "Wedding",
        invoiceId: "inv-wedding",
        createdAt: "2026-08-01",
        lineItems: [
          { id: "w1", label: "Wedding Deposit", amount: 5000, dueDate: yIso, status: "overdue" },
        ],
      }),
      schedule({
        id: "sch-rehearsal",
        title: "Rehearsal Dinner",
        invoiceId: "inv-rehearsal",
        createdAt: "2026-08-02",
        lineItems: [
          { id: "r1", label: "Rehearsal Deposit", amount: 1500, dueDate: nIso, status: "pending" },
        ],
      }),
      schedule({
        id: "sch-orphan",
        title: "Legacy unlinked",
        invoiceId: null,
        createdAt: "2026-07-01",
        lineItems: [
          { id: "o1", label: "Legacy fee", amount: 200, dueDate: nIso, status: "pending" },
        ],
      }),
    ];

    const canonical = selectCanonicalPaymentSchedules(schedules);
    assert.equal(canonical.length, 3);
    const list = buildUnifiedTaskList({ ...emptyUnified, paymentSchedules: schedules });
    const payments = list.filter((t) => t.kind === "payment");
    assert.equal(payments.length, 3);
    assert.equal(remainingBalanceFromSchedules(schedules), 6700);
  });

  it("completed (paid) obligations are correctly represented as absent from actionable list", () => {
    const schedules = [
      schedule({
        id: "sch",
        title: "S",
        invoiceId: "inv",
        createdAt: "2026-08-01",
        lineItems: [
          { id: "paid", label: "Deposit", amount: 4000, dueDate: yIso, status: "paid" },
          { id: "open", label: "Final Payment", amount: 8960, dueDate: nIso, status: "pending" },
        ],
      }),
    ];
    const list = buildUnifiedTaskList({ ...emptyUnified, paymentSchedules: schedules });
    const payments = list.filter((t) => t.kind === "payment");
    assert.equal(payments.length, 1);
    assert.equal(payments[0]?.id, "payment_open");
    assert.equal(remainingBalanceFromSchedules(schedules), 8960);
  });

  it("overdue obligations retain overdue state after canonicalization", () => {
    const schedules = [
      schedule({
        id: "sch-new",
        title: "S",
        invoiceId: "inv",
        createdAt: "2026-08-05",
        lineItems: [
          { id: "over", label: "First Installment", amount: 4319.57, dueDate: yIso, status: "overdue" },
          { id: "soon", label: "Final Payment", amount: 4320.86, dueDate: nIso, status: "pending" },
        ],
      }),
      schedule({
        id: "sch-old",
        title: "S",
        invoiceId: "inv",
        createdAt: "2026-07-01",
        lineItems: [
          { id: "other", label: "First Installment", amount: 4319.57, dueDate: yIso, status: "overdue" },
        ],
      }),
    ];
    const list = buildUnifiedTaskList({ ...emptyUnified, paymentSchedules: schedules });
    const overdue = list.filter((t) => t.kind === "payment" && t.isOverdue);
    assert.equal(overdue.length, 1);
    assert.equal(overdue[0]?.id, "payment_over");
    assert.equal(overdue[0]?.isOverdue, true);
    assert.equal(list[0]?.id, "payment_over");
  });
});

describe("verified action completion policy", () => {
  const due = "2026-09-01";

  it("triggered tasks never Mark complete and route to domain workspaces", () => {
    const cases: { trigger: string; section: string; label: string }[] = [
      { trigger: "guest_count_finalized", section: "guests", label: "Submit guest count" },
      { trigger: "vendor_selected", section: "vendors", label: "Add vendors" },
      { trigger: "seating_submitted", section: "seating", label: "Submit seating" },
      { trigger: "timeline_submitted", section: "timeline", label: "Submit timeline" },
      { trigger: "contract_signed", section: "documents", label: "Review & sign" },
      { trigger: "payment_received", section: "payments", label: "Pay now" },
      { trigger: "questionnaire_submitted", section: "questionnaire", label: "Complete form" },
      { trigger: "document_uploaded_insurance", section: "documents", label: "Upload insurance" },
    ];

    for (const c of cases) {
      const t = task({
        id: c.trigger,
        title: c.trigger,
        status: "pending",
        dueDate: due,
        visibility: "client_owned",
        canComplete: true, // even if API lagged, presentation must block
        autoCompleteTrigger: c.trigger,
      });
      const p = venueTaskPresentation(t);
      assert.equal(p.completableHere, false, c.trigger);
      assert.equal(p.targetSection, c.section, c.trigger);
      assert.equal(p.actionLabel, c.label, c.trigger);
      assert.notEqual(p.actionLabel.toLowerCase(), "mark complete");
      assert.notEqual(p.actionLabel.toLowerCase(), "complete");
    }
  });

  it("navigation presentation does not imply in-list completion", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [
        task({
          id: "gc",
          title: "Submit your guest count",
          status: "pending",
          dueDate: due,
          visibility: "client_owned",
          canComplete: false,
          autoCompleteTrigger: "guest_count_finalized",
        }),
      ],
    });
    assert.equal(list[0]?.completableHere, false);
    assert.equal(list[0]?.targetSection, "guests");
    // Clicking CTA would navigate — never handleComplete
    assert.equal(list[0]?.actionLabel, "Submit guest count");
  });

  it("non-triggered acknowledgment tasks keep Mark complete", () => {
    const t = task({
      id: "pkg",
      title: "Choose your package",
      status: "pending",
      dueDate: due,
      visibility: "client_owned",
      canComplete: true,
      autoCompleteTrigger: null,
    });
    const p = venueTaskPresentation(t);
    assert.equal(p.completableHere, true);
    assert.equal(p.actionLabel, "Mark complete");
    assert.equal(p.targetSection, "tasks");
  });

  it("already-complete triggered tasks show Done and are not completable", () => {
    const t = task({
      id: "done",
      title: "Submit your guest count",
      status: "complete",
      dueDate: due,
      autoCompleteTrigger: "guest_count_finalized",
      canComplete: false,
    });
    const p = venueTaskPresentation(t);
    assert.equal(p.actionLabel, "Done");
    assert.equal(p.completableHere, false);
  });

  it("unknown triggers still block Mark complete", () => {
    const p = venueTaskPresentation(task({
      id: "x",
      title: "Custom",
      status: "pending",
      dueDate: due,
      canComplete: true,
      autoCompleteTrigger: "future_custom_trigger",
    }));
    assert.equal(p.completableHere, false);
    assert.equal(p.actionLabel, "View");
  });

  it("regression: derived payment/contract rows stay navigate-only; Home keeps Review for checklist Mark complete", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      documents: [{ id: "c1", docType: "contract", name: "Agreement", status: "sent", signToken: "tok" }],
      paymentSchedules: [{
        id: "sch",
        title: "Schedule",
        lineItems: [{ id: "p1", label: "Final Payment", amount: 100, dueDate: due, status: "pending" }],
      }],
      venueTasks: [
        task({
          id: "review",
          title: "Leave a review",
          status: "pending",
          dueDate: due,
          visibility: "client_owned",
          canComplete: true,
          autoCompleteTrigger: null,
        }),
      ],
    });
    const payment = list.find((t) => t.kind === "payment");
    const contract = list.find((t) => t.kind === "contract");
    const ack = list.find((t) => t.id === "task_review");
    assert.equal(payment?.completableHere, false);
    assert.equal(payment?.actionLabel, "Pay now");
    assert.equal(contract?.completableHere, false);
    assert.equal(contract?.actionLabel, "Review & sign");
    assert.equal(ack?.completableHere, true);
    assert.equal(ack?.actionLabel, "Mark complete");
    assert.equal(
      compactNextStepsActionLabel({ actionLabel: "Mark complete", kind: "venue_task" }),
      "Review",
    );
    assert.equal(
      compactNextStepsActionLabel({ actionLabel: "Submit guest count", kind: "venue_task" }),
      "Submit",
    );
    assert.equal(
      compactNextStepsActionLabel({ actionLabel: "Pay now", kind: "venue_task" }),
      "Pay",
    );
  });
});
