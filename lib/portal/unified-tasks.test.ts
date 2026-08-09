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
    const cases: { trigger: string; section: string; label: string; focus: string | null }[] = [
      { trigger: "guest_count_finalized", section: "guests", label: "Submit guest count", focus: "finalize" },
      { trigger: "vendor_selected", section: "vendors", label: "Add vendors", focus: "pick" },
      { trigger: "seating_submitted", section: "seating", label: "Submit seating", focus: "submit" },
      { trigger: "timeline_submitted", section: "timeline", label: "Submit timeline", focus: "submit" },
      { trigger: "contract_signed", section: "documents", label: "Review & sign", focus: "sign" },
      { trigger: "payment_received", section: "payments", label: "Pay now", focus: null },
      { trigger: "questionnaire_submitted", section: "questionnaire", label: "Complete form", focus: "form" },
      { trigger: "document_uploaded_insurance", section: "documents", label: "Upload insurance", focus: null },
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
      assert.equal(p.targetFocus, c.focus, c.trigger);
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
    assert.equal(list[0]?.targetFocus, "finalize");
    // Clicking CTA would navigate — never handleComplete
    assert.equal(list[0]?.actionLabel, "Submit guest count");
  });

  it("workspace focus is structured from trigger/kind — never title text", () => {
    const weirdTitle = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [
        task({
          id: "gc",
          title: "Please upload seating somehow",
          status: "pending",
          dueDate: due,
          visibility: "client_owned",
          canComplete: false,
          autoCompleteTrigger: "guest_count_finalized",
        }),
      ],
    })[0];
    assert.equal(weirdTitle?.targetSection, "guests");
    assert.equal(weirdTitle?.targetFocus, "finalize");

    const derived = buildUnifiedTaskList({
      ...emptyUnified,
      documents: [{ id: "c1", docType: "contract", name: "Agreement", status: "sent", signToken: "tok" }],
      questionnaire: { status: "sent" },
      timelineHasUnpublishedChanges: true,
    });
    assert.equal(derived.find((t) => t.kind === "contract")?.targetFocus, "sign");
    assert.equal(derived.find((t) => t.kind === "questionnaire")?.targetFocus, "form");
    assert.equal(derived.find((t) => t.kind === "timeline")?.targetFocus, "submit");
  });

  it("payment derived rows keep section-only routing (unchanged from Impl 2)", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      paymentSchedules: [{
        id: "sch",
        title: "Schedule",
        lineItems: [{ id: "p1", label: "Final Payment", amount: 100, dueDate: due, status: "pending" }],
      }],
    });
    const pay = list.find((t) => t.kind === "payment");
    assert.equal(pay?.targetSection, "payments");
    assert.equal(pay?.targetFocus, null);
    assert.equal(pay?.completableHere, false);
  });

  it("null-trigger acknowledgment keeps Mark complete with no focus", () => {
    const p = venueTaskPresentation(task({
      id: "pkg",
      title: "Choose your package",
      status: "pending",
      dueDate: due,
      visibility: "client_owned",
      canComplete: true,
      autoCompleteTrigger: null,
    }));
    assert.equal(p.completableHere, true);
    assert.equal(p.actionLabel, "Mark complete");
    assert.equal(p.targetSection, "tasks");
    assert.equal(p.targetFocus, null);
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

describe("payment attention twin suppression (Impl 2)", () => {
  const due = "2026-09-17";
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nIso = nextWeek.toISOString().slice(0, 10);

  const finalPaymentMirror = () =>
    task({
      id: "et-final",
      title: "Final payment",
      status: "pending",
      dueDate: due,
      category: "financial",
      visibility: "client_owned",
      isRequired: true,
      canComplete: false,
      autoCompleteTrigger: "payment_received",
    });

  const unpaidFinalLine = () => ({
    id: "sch",
    title: "Payment Schedule",
    invoiceId: "inv",
    createdAt: "2026-08-01",
    lineItems: [
      { id: "li-final", label: "Final Payment", amount: 4321, dueDate: due, status: "pending" },
    ],
  });

  // Case 1: unpaid line + payment_received mirror → Pay now only; mirror hidden
  it("case 1: unpaid line hides payment_received checklist mirror; Pay now remains", () => {
    const home = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [finalPaymentMirror()],
      paymentSchedules: [unpaidFinalLine()],
    });
    const tasks = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [finalPaymentMirror()],
      paymentSchedules: [unpaidFinalLine()],
    });
    for (const list of [home, tasks]) {
      assert.equal(list.find((t) => t.id === "task_et-final"), undefined);
      const payments = list.filter((t) => t.kind === "payment");
      assert.equal(payments.length, 1);
      assert.equal(payments[0]?.id, "payment_li-final");
      assert.equal(payments[0]?.actionLabel, "Pay now");
      assert.equal(payments[0]?.completableHere, false);
    }
    assert.deepEqual(home.map((t) => t.id), tasks.map((t) => t.id));
  });

  // Case 2: paid → financial attention gone; no synthetic checklist; mirror may reappear if still open
  it("case 2: paid line removes payment attention; open mirror not inventing a Pay now twin", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [finalPaymentMirror()],
      paymentSchedules: [{
        id: "sch",
        title: "Payment Schedule",
        invoiceId: "inv",
        createdAt: "2026-08-01",
        lineItems: [
          { id: "li-final", label: "Final Payment", amount: 4321, dueDate: due, status: "paid" },
        ],
      }],
    });
    assert.equal(list.filter((t) => t.kind === "payment").length, 0);
    // No unpaid obligation → checklist mirror stays visible (auto-complete owns completion when money lands)
    const mirror = list.find((t) => t.id === "task_et-final");
    assert.ok(mirror);
    assert.equal(mirror?.kind, "venue_task");
    assert.equal(mirror?.actionLabel, "Pay now");
    assert.equal(mirror?.completableHere, false);
  });

  // Case 3: checklist only → keep visible
  it("case 3: payment_received checklist stays when no payment line exists", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [finalPaymentMirror()],
      paymentSchedules: [],
    });
    assert.equal(list.filter((t) => t.kind === "payment").length, 0);
    assert.equal(list.find((t) => t.id === "task_et-final")?.title, "Final payment");
    assert.equal(list.find((t) => t.id === "task_et-final")?.completableHere, false);
  });

  // Case 4: payment line only → Pay now; no synthetic checklist
  it("case 4: unpaid payment line alone does not invent a checklist mirror", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [],
      paymentSchedules: [unpaidFinalLine()],
    });
    assert.equal(list.length, 1);
    assert.equal(list[0]?.kind, "payment");
    assert.equal(list[0]?.id, "payment_li-final");
    assert.equal(list.filter((t) => t.kind === "venue_task").length, 0);
  });

  // Case 5: multiple installments stay distinct; canonical schedules
  it("case 5: multiple installments stay distinct; mirror still hidden; no title collapse", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const yIso = yesterday.toISOString().slice(0, 10);
    const schedules = [
      {
        id: "sch-old",
        title: "Old dup",
        invoiceId: "inv-1",
        createdAt: "2026-07-01",
        lineItems: [
          { id: "old-1", label: "First Installment", amount: 1000, dueDate: yIso, status: "overdue" },
        ],
      },
      {
        id: "sch-new",
        title: "Canonical",
        invoiceId: "inv-1",
        createdAt: "2026-08-05",
        lineItems: [
          { id: "li-1", label: "First Installment", amount: 4319.57, dueDate: yIso, status: "overdue" },
          { id: "li-2", label: "Second Installment", amount: 4319.57, dueDate: nIso, status: "pending" },
          { id: "li-3", label: "Final Payment", amount: 4320.86, dueDate: due, status: "pending" },
        ],
      },
    ];
    assert.equal(selectCanonicalPaymentSchedules(schedules).length, 1);

    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [finalPaymentMirror()],
      paymentSchedules: schedules,
    });
    const payments = list.filter((t) => t.kind === "payment");
    assert.equal(payments.length, 3);
    assert.deepEqual(payments.map((p) => p.title).sort(), [
      "Final Payment",
      "First Installment",
      "Second Installment",
    ]);
    assert.equal(list.find((t) => t.id === "task_et-final"), undefined);
    assert.equal(remainingBalanceFromSchedules(schedules), 4319.57 + 4319.57 + 4320.86);
  });

  // Case 6: never title-only dedupe — same title without payment_received stays
  it("case 6: does not hide checklist by title alone when trigger is absent", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [
        task({
          id: "lookalike",
          title: "Final payment",
          status: "pending",
          dueDate: due,
          category: "financial",
          visibility: "client_owned",
          canComplete: true,
          autoCompleteTrigger: null,
        }),
      ],
      paymentSchedules: [unpaidFinalLine()],
    });
    assert.ok(list.find((t) => t.id === "task_lookalike"));
    assert.equal(list.find((t) => t.kind === "payment")?.id, "payment_li-final");
  });

  // Case 7: non-payment triggered tasks remain alongside unpaid lines
  it("case 7: other domain checklist tasks remain when unpaid payments exist", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [
        finalPaymentMirror(),
        task({
          id: "gc",
          title: "Submit your guest count",
          status: "pending",
          dueDate: due,
          visibility: "client_owned",
          canComplete: false,
          autoCompleteTrigger: "guest_count_finalized",
        }),
        task({
          id: "ins",
          title: "Purchase event insurance",
          status: "pending",
          dueDate: due,
          visibility: "client_owned",
          canComplete: false,
          autoCompleteTrigger: "document_uploaded_insurance",
        }),
      ],
      paymentSchedules: [unpaidFinalLine()],
    });
    assert.equal(list.find((t) => t.id === "task_et-final"), undefined);
    assert.ok(list.find((t) => t.id === "task_gc"));
    assert.ok(list.find((t) => t.id === "task_ins"));
    assert.equal(list.filter((t) => t.kind === "payment").length, 1);
  });

  // Case 8: trigger safety — suppression is attention-only; different-title
  // payment_received still suppressed by trigger (not title); we do not invent
  // installment-scoped auto-complete here (limitation documented in deliverable).
  it("case 8: suppression keys on payment_received trigger regardless of title; completableHere stays false", () => {
    const list = buildUnifiedTaskList({
      ...emptyUnified,
      venueTasks: [
        task({
          id: "odd-title",
          title: "Settle remaining balance",
          status: "pending",
          dueDate: due,
          category: "planning",
          visibility: "client_owned",
          canComplete: false,
          autoCompleteTrigger: "payment_received",
        }),
      ],
      paymentSchedules: [unpaidFinalLine()],
    });
    assert.equal(list.find((t) => t.id === "task_odd-title"), undefined);
    const payment = list.find((t) => t.kind === "payment");
    assert.equal(payment?.actionLabel, "Pay now");
    assert.equal(payment?.completableHere, false);
    // presentation policy for an isolated mirror (no unpaid lines) still blocks Mark complete
    const alone = venueTaskPresentation(task({
      id: "alone",
      title: "Final payment",
      status: "pending",
      dueDate: due,
      canComplete: true,
      autoCompleteTrigger: "payment_received",
    }));
    assert.equal(alone.completableHere, false);
    assert.equal(alone.actionLabel, "Pay now");
  });
});
