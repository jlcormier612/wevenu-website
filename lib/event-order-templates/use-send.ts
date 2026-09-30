/**
 * Event Order Template Use / Send — venue-side and client-facing paths.
 * Fixed lines → existing Event Order apply. Selectable groups → client_choices
 * runtime (freeze / answers / finalize), owned by the EO Template.
 */
import {
  createClientChoicesFromEventOrderTemplate,
  finalizeClientChoices,
  sendClientChoices,
  updateClientChoicesDraft,
} from "@/lib/client-choices/service";
import type { ChoicesAnswers } from "@/lib/client-choices/types";
import {
  defaultAnswersFromEventOrderTemplate,
  templateHasSelectableGroups,
} from "@/lib/event-order-templates/selection-definition";
import type { TemplateApplySelection } from "@/lib/event-order-templates/offerings";
import * as templatesRepo from "@/lib/event-order-templates/repository";
import { startOrApplyEventOrderTemplate } from "@/lib/event-orders/service";
import type { EnsureEventOrderResult } from "@/lib/event-orders/types";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import { isSupabaseConfigured } from "@/lib/env";

export type UseEventOrderTemplateResult =
  | {
      ok: true;
      eventOrderId: string;
      choicesId?: string;
      financialDelta?: number;
    }
  | { ok: false; message?: string };

export type SendEventOrderTemplateResult =
  | { ok: true; choicesId: string; eventOrderId: string }
  | { ok: false; message?: string };

/**
 * Use (no client round-trip):
 * 1. Apply fixed lines/sections into the event’s Event Order.
 * 2. If the template has choice groups, freeze a selection instance, apply
 *    venue answers (or defaults), and finalize → EO lines.
 */
export async function useEventOrderTemplate(
  eventId: string,
  templateId: string,
  opts?: {
    lineSelections?: TemplateApplySelection[];
    /** Venue-filled answers for selectable groups. Defaults used when omitted. */
    answers?: ChoicesAnswers;
  },
): Promise<UseEventOrderTemplateResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };

  const supabase = await createClient();
  const template = await templatesRepo.getTemplateWithDetails(supabase, venue.id, templateId);
  if (!template) return { ok: false, message: "Event Order Template not found." };

  const applied: EnsureEventOrderResult = await startOrApplyEventOrderTemplate(
    eventId, templateId, opts?.lineSelections,
  );
  if (!applied.ok) {
    return { ok: false, message: applied.message ?? "Could not apply fixed offerings." };
  }

  if (!templateHasSelectableGroups(template)) {
    return { ok: true, eventOrderId: applied.eventOrderId };
  }

  const created = await createClientChoicesFromEventOrderTemplate(eventId, templateId);
  if (!created.ok) {
    return {
      ok: false,
      message: created.message ?? "Fixed offerings applied, but selections could not be started.",
    };
  }

  const answers = opts?.answers ?? defaultAnswersFromEventOrderTemplate(template);
  const draft = await updateClientChoicesDraft(created.choicesId, { answers });
  if (!draft.ok) {
    return {
      ok: false,
      message: draft.message ?? "Could not save selections.",
    };
  }

  const finalized = await finalizeClientChoices(created.choicesId);
  if (!finalized.ok) {
    return {
      ok: false,
      message: finalized.message ?? "Selections saved but could not finalize into the Event Order.",
    };
  }

  return {
    ok: true,
    eventOrderId: finalized.eventOrderId ?? applied.eventOrderId,
    choicesId: created.choicesId,
    financialDelta: finalized.financialDelta,
  };
}

/**
 * Send (client path):
 * 1. Apply fixed lines into the Event Order (structure ready).
 * 2. Freeze selectable definition into a client_choices instance and mark sent.
 * Client selects → venue finalizes via existing finalize path.
 */
export async function sendEventOrderTemplate(
  eventId: string,
  templateId: string,
  opts?: {
    lineSelections?: TemplateApplySelection[];
    answers?: ChoicesAnswers;
  },
): Promise<SendEventOrderTemplateResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };

  const supabase = await createClient();
  const template = await templatesRepo.getTemplateWithDetails(supabase, venue.id, templateId);
  if (!template) return { ok: false, message: "Event Order Template not found." };

  const applied = await startOrApplyEventOrderTemplate(
    eventId, templateId, opts?.lineSelections,
  );
  if (!applied.ok) {
    return { ok: false, message: applied.message ?? "Could not apply fixed offerings." };
  }

  if (!templateHasSelectableGroups(template)) {
    return {
      ok: false,
      message: "This template has no choice groups to send. Use Apply for fixed offerings, or add choice groups first.",
    };
  }

  const created = await createClientChoicesFromEventOrderTemplate(eventId, templateId);
  if (!created.ok) {
    return { ok: false, message: created.message ?? "Could not create client selection." };
  }

  if (opts?.answers) {
    const draft = await updateClientChoicesDraft(created.choicesId, { answers: opts.answers });
    if (!draft.ok) {
      return { ok: false, message: draft.message ?? "Could not save default selections." };
    }
  }

  const sent = await sendClientChoices(created.choicesId);
  if (!sent.ok) {
    return { ok: false, message: sent.message ?? "Could not send to client." };
  }

  return {
    ok: true,
    choicesId: created.choicesId,
    eventOrderId: applied.eventOrderId,
  };
}
