type CalendlyQa = {
  question?: string;
  answer?: string;
  position?: number;
};

export type CalendlyWebhookBody = {
  event?: string;
  created_at?: string;
  payload?: {
    email?: string;
    name?: string;
    uri?: string;
    cancel_url?: string;
    reschedule_url?: string;
    timezone?: string;
    questions_and_answers?: CalendlyQa[];
    cancellation?: { canceled_by?: string; reason?: string };
    scheduled_event?: {
      start_time?: string;
      end_time?: string;
      uri?: string;
      name?: string;
      location?: { type?: string; location?: string };
    };
  };
};

function venueFromQuestions(questions: CalendlyQa[] | undefined): string | undefined {
  if (!questions?.length) return undefined;
  const venueQ = questions.find((q) => {
    const label = (q.question || "").toLowerCase();
    return (
      label.includes("venue") ||
      label.includes("business") ||
      label.includes("company") ||
      label.includes("organization")
    );
  });
  return venueQ?.answer?.trim() || undefined;
}

function notesFromQuestions(questions: CalendlyQa[] | undefined): string | undefined {
  if (!questions?.length) return undefined;
  const lines = questions
    .filter((q) => q.question?.trim() && q.answer?.trim())
    .map((q) => `${q.question!.trim()}: ${q.answer!.trim()}`);
  return lines.length ? lines.join("\n") : undefined;
}

export function extractCalendlyInvitee(body: CalendlyWebhookBody): {
  email: string;
  name?: string;
  venueName?: string;
  scheduledAt?: string | null;
  message?: string;
  reason?: string | null;
  sourceId?: string;
} | null {
  const payload = body.payload;
  const email = payload?.email?.trim();
  if (!email) return null;

  const questions = payload?.questions_and_answers;
  return {
    email,
    name: payload?.name?.trim() || undefined,
    venueName: venueFromQuestions(questions),
    scheduledAt: payload?.scheduled_event?.start_time || null,
    message: notesFromQuestions(questions),
    reason: payload?.cancellation?.reason?.trim() || null,
    sourceId: payload?.uri || payload?.scheduled_event?.uri || undefined,
  };
}
