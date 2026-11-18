/**
 * Format LuvAskPortalContext for the Ask Luv system prompt.
 */

import type { LuvAskPortalContext } from "@/lib/luv/portal-context/types";
import { formatLuvAskMoney } from "@/lib/luv/portal-context/build";

/**
 * Phase 1 placeholder — kept when portal context was not loaded for this turn.
 * Phase 1 tests assert this exact status string.
 */
export function formatPortalContextPlaceholderForPrompt(): string {
  return [
    `--- CURRENT PORTAL CONTEXT ---`,
    `source: portal_context`,
    `status: not_provided_in_phase_1`,
    `(No live payment amounts, contract records, questionnaire rows, lifecycle state, or other portal facts are available in this turn.)`,
    `Do not invent portal facts. If the couple asks for their specific dates, amounts, or statuses, say you do not have that live portal detail in this chat and point them to the matching portal section (Documents, Payments, Tasks, Your Choices) or their coordinator.`,
  ].join("\n");
}

export function formatPortalContextForPrompt(
  ctx: LuvAskPortalContext | null | undefined,
): string {
  if (!ctx) return formatPortalContextPlaceholderForPrompt();

  const parts: string[] = [
    `--- CURRENT PORTAL CONTEXT ---`,
    `source: portal_context`,
    `status: provided`,
    `These are live facts about THIS couple's portal. When present, they take precedence over generic HTC product how-tos about the couple's current state.`,
    `MISSING facts are omitted — never invent dates, amounts, signatures, or statuses.`,
  ];

  const pay = ctx.payments;
  if (!pay) {
    parts.push(`Payments: (not loaded)`);
  } else {
    parts.push(`Payments:`);
    if (!pay.hasPaymentPlan && pay.unscheduledBalances.length === 0) {
      parts.push(`- No payment plan or invoice balance is currently available in the portal.`);
    }
    if (pay.hasPaymentPlan) {
      if (pay.planTotal != null) parts.push(`- Plan total: ${formatLuvAskMoney(pay.planTotal)}`);
      if (pay.amountPaid != null) parts.push(`- Amount paid: ${formatLuvAskMoney(pay.amountPaid)}`);
      if (pay.remainingBalance != null) {
        parts.push(
          `- Remaining balance: ${formatLuvAskMoney(pay.remainingBalance)} (this is a balance, not automatically "due")`,
        );
      }
    }
    if (pay.nextScheduledPayment) {
      const n = pay.nextScheduledPayment;
      parts.push(
        `- Next scheduled payment: ${n.label} — ${formatLuvAskMoney(n.amount)} due ${n.dueDateLabel}${n.isOverdue ? " (overdue)" : ""}`,
      );
    } else if (pay.hasPaymentPlan) {
      parts.push(`- Next scheduled payment: none (no unpaid line with a due date)`);
    }
    for (const u of pay.unscheduledBalances) {
      parts.push(
        `- Invoice "${u.label}" has Balance: ${formatLuvAskMoney(u.balance)} with no payment schedule.`,
      );
      if (u.invoiceDueDateLabel) {
        parts.push(`  Invoice due date on file: ${u.invoiceDueDateLabel}`);
      } else {
        parts.push(`  No payment schedule has been set for this invoice yet. Do not invent a due date.`);
      }
    }
    if (pay.onlinePaymentsReady === true) {
      parts.push(`- Online payments: available in the Payments section.`);
    } else if (pay.onlinePaymentsReady === false) {
      parts.push(`- Online payments: not currently available; couple should contact the venue about paying.`);
    }
  }

  if (ctx.contracts.length === 0) {
    parts.push(`Contracts: (none visible in the portal)`);
  } else {
    parts.push(`Contracts:`);
    for (const c of ctx.contracts) {
      parts.push(
        `- "${c.title}": ${c.lifecycleLabel}` +
          ` (couple signed: ${c.signedByCouple ? "yes" : "no"}; venue signed: ${c.signedByVenue ? "yes" : "no"}; fully executed: ${c.fullyExecuted ? "yes" : "no"})` +
          (c.signedAtLabel ? `; executed ${c.signedAtLabel}` : ""),
      );
    }
  }

  if (ctx.documents.length === 0) {
    parts.push(`Documents: (none visible)`);
  } else {
    parts.push(`Documents (customer-visible):`);
    for (const d of ctx.documents) {
      parts.push(
        `- "${d.name}" [${d.docType}]${d.statusLabel ? ` — ${d.statusLabel}` : ""}`,
      );
    }
  }

  const plan = ctx.planning;
  if (!plan) {
    parts.push(`Planning: (not loaded for this turn)`);
  } else {
    parts.push(`Planning tasks:`);
    parts.push(
      `- Open: ${plan.openTaskCount}; overdue: ${plan.overdueTaskCount}; completed: ${plan.completedTaskCount}`,
    );
    if (plan.nextSuggestedTask) {
      const n = plan.nextSuggestedTask;
      parts.push(
        `- Suggested next: "${n.title}"` +
          (n.dueDateLabel ? ` (due ${n.dueDateLabel})` : "") +
          (n.status === "overdue" ? " — overdue" : ""),
      );
    } else if (plan.openTaskCount === 0) {
      parts.push(`- No open couple-visible planning tasks are currently listed.`);
    }
    for (const t of plan.openTasks) {
      parts.push(
        `- OPEN "${t.title}" [${t.status}]` +
          (t.dueDateLabel ? ` due ${t.dueDateLabel}` : "") +
          (t.isRequired ? " (required)" : ""),
      );
    }
    for (const t of plan.completedTasks) {
      parts.push(`- COMPLETED "${t.title}"`);
    }

    parts.push(`Questionnaires:`);
    if (plan.questionnaires.length === 0) {
      parts.push(`- None visible in the portal right now.`);
    } else {
      parts.push(
        `- Open/in progress: ${plan.openQuestionnaireCount}; completed: ${plan.completedQuestionnaireCount}`,
      );
      for (const q of plan.questionnaires) {
        parts.push(
          `- "${q.title}"${q.kind ? ` [${q.kind}]` : ""} — ${q.status}`,
        );
      }
    }

    parts.push(`Published / shared timeline:`);
    if (!plan.timelineAvailable) {
      parts.push(`- Timeline details are not available in this turn.`);
    } else if (plan.timelineEntries.length === 0) {
      parts.push(`- No couple-visible timeline entries are listed yet.`);
    } else {
      for (const e of plan.timelineEntries) {
        const time =
          e.entryTime
            ? e.endTime
              ? `${e.entryTime}–${e.endTime}`
              : e.entryTime
            : "time TBD";
        parts.push(
          `- Day ${e.dayOffset}: ${time} — "${e.title}" (${e.owner})`,
        );
      }
    }
  }

  parts.push(
    `Rules for using this layer:`,
    `- Prefer these facts over generic HTC instructions when answering about THIS couple's current state.`,
    `- Example: if lifecycle is Awaiting Venue Signature, do NOT tell them to sign from Documents — they already signed.`,
    `- If a payment schedule is absent, do NOT invent a due date; point them to Payments.`,
    `- Invoice "Issued" is not a signature request.`,
    `- For "what should we work on next?" / "what haven't we finished?" use Planning tasks and Questionnaires only — never invent unfinished work.`,
    `- Timeline times come only from published/shared couple-visible entries; never invent florist/vendor call times not listed.`,
    `- If planning facts are missing, say so and point them to Tasks, Questionnaire, or Timeline via nextSteps.`,
  );

  return parts.join("\n");
}
