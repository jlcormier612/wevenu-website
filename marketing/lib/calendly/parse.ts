type CalendlyQa = {
  question?: string;
  answer?: string;
  position?: number;
};

type CalendlyTracking = {
  utm_campaign?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  salesforce_uuid?: string | null;
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
    tracking?: CalendlyTracking;
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
  // Prefer the approved HTC label, then any venue/business/company/org question.
  const exact = questions.find((q) => {
    const label = (q.question || "").trim().toLowerCase();
    return (
      label === "venue / business name" ||
      label === "venue/business name" ||
      label === "venue name" ||
      label === "business name"
    );
  });
  const venueQ =
    exact ||
    questions.find((q) => {
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
  /** Opaque HTC handoff from utm_content when present. */
  handoffToken?: string;
  tracking?: CalendlyTracking;
} | null {
  const payload = body.payload;
  const email = payload?.email?.trim();
  if (!email) return null;

  const questions = payload?.questions_and_answers;
  const tracking = payload?.tracking;
  const handoffRaw = tracking?.utm_content?.trim() || "";
  const handoffToken = handoffRaw || undefined;

  return {
    email,
    name: payload?.name?.trim() || undefined,
    venueName: venueFromQuestions(questions),
    scheduledAt: payload?.scheduled_event?.start_time || null,
    message: notesFromQuestions(questions),
    reason: payload?.cancellation?.reason?.trim() || null,
    sourceId: payload?.uri || payload?.scheduled_event?.uri || undefined,
    handoffToken,
    tracking: tracking || undefined,
  };
}
